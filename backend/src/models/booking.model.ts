import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import queryService from "../services/query";

// ============ TYPES ============
export type SlotRow = RowDataPacket & {
  SlotID: number;
  Status: string;
  HoldExpiresAt: string | null;
  QuantityID: number | null;
};

export type ExpiredSlot = {
  slotId: number;
  bookingCode: number | null;
};

export type NormalizedSlot = {
  key: string;
  slot_id?: number | null;
  play_date: string;
  start_time: string;
  end_time: string;
  db_date: string;
  db_start_time: string;
  db_end_time: string;
};

export type CustomerBookingRow = RowDataPacket & {
  BookingCode: number;
  FieldCode: number;
  CustomerUserID: number;
  CreateAt: string;
  TotalPrice: number;
  BookingStatus: string;
  PaymentStatus: string;
  FieldName: string;
  SportType: string;
  ShopName: string;
  CustomerPhone: string | null;
  CheckinCode: string | null;
  CancellationStatus?: string | null;
  CancellationRefundAmount?: number | null;
  CancellationPenaltyPercent?: number | null;
  CancellationRequestedAt?: string | null;
  CancellationDecidedAt?: string | null;
};

export type BookingSlotWithQuantityRow = RowDataPacket & {
  BookingCode: number;
  Slot_ID: number;
  QuantityID: number | null;
  QuantityNumber: number | null;
  PlayDate: string;
  StartTime: string;
  EndTime: string;
  PricePerSlot: number;
  Status: string;
};

export type ShopBookingFilters = {
  status?: string;
  search?: string;
  sortField?: string;
  sortOrder?: "ASC" | "DESC";
  limit: number;
  offset: number;
};

export type ShopBookingRow = RowDataPacket & {
  BookingCode: number;
  FieldCode: number;
  CustomerUserID: number | null;
  BookingStatus: string;
  PaymentStatus: string;
  TotalPrice: number;
  NetToShop: number | null;
  CheckinCode: string | null;
  CheckinTime: string | null;
  CreateAt: string;
  UpdateAt: string;
  CustomerName: string | null;
  CustomerPhone: string | null;
  FieldName: string | null;
  CancellationStatus?: string | null;
  CancellationRefundAmount?: number | null;
  CancellationPenaltyPercent?: number | null;
  CancellationRequestedAt?: string | null;
  CancellationDecidedAt?: string | null;
};

export type BookingCancellationRequestRow = RowDataPacket & {
  RequestID: number;
  BookingCode: number;
  CustomerUserID: number;
  ShopCode: number;
  FieldCode: number | null;
  Reason: string | null;
  Status: string;
  PenaltyPercent: number;
  RefundAmount: number;
  DecisionToken: string;
  DecisionAt: string | null;
  DecisionBy: number | null;
  CustomerPhone: string | null;
  CustomerName: string | null;
  CustomerEmail: string | null;
  PreviousStatus?: string | null;
  CreateAt: string;
  UpdateAt: string;
};

// ============ BOOKING MODEL ============
const bookingModel = {
  async runInTransaction<T>(
    name: string,
    handler: (connection: PoolConnection) => Promise<T>
  ) {
    return queryService.execTransaction<T>(name, handler);
  },

  /**
   * Lock a slot for booking (SELECT FOR UPDATE)
   */
  async lockSlot(
    connection: PoolConnection,
    fieldCode: number,
    slot: NormalizedSlot,
    quantityId?: number | null
  ): Promise<SlotRow | null> {
    const params: any[] = [
      fieldCode,
      slot.db_date,
      slot.db_start_time,
      slot.db_end_time,
    ];
    let quantityClause = "";
    if (quantityId !== null && quantityId !== undefined) {
      quantityClause = " AND (QuantityID = ? OR QuantityID IS NULL)";
      params.push(quantityId);
    }
    const [rows] = await connection.query<RowDataPacket[]>(
      `
        SELECT SlotID, Status, HoldExpiresAt, QuantityID
        FROM Field_Slots
        WHERE FieldCode = ?
          AND PlayDate = ?
          AND StartTime = ?
          AND EndTime = ?
          ${quantityClause}
        FOR UPDATE
      `,
      params
    );
    return (rows?.[0] as SlotRow) ?? null;
  },

  /**
   * Update existing slot to booked status
   */
  async updateExistingSlot(
    connection: PoolConnection,
    slotId: number,
    quantityId?: number | null
  ): Promise<void> {
    await connection.query<ResultSetHeader>(
      `
        UPDATE Field_Slots
        SET Status = 'booked',
            HoldExpiresAt = NULL,
            QuantityID = IFNULL(?, QuantityID),
            UpdateAt = NOW()
        WHERE SlotID = ?
      `,
      [quantityId ?? null, slotId]
    );
  },

  async resetSlotForBooking(
    connection: PoolConnection,
    slotId: number,
    quantityId?: number | null
  ): Promise<void> {
    await connection.query<ResultSetHeader>(
      `
        UPDATE Field_Slots
        SET Status = 'available',
            BookingCode = NULL,
            HoldExpiresAt = NULL,
            QuantityID = IFNULL(?, QuantityID),
            UpdateAt = NOW()
        WHERE SlotID = ?
      `,
      [quantityId ?? null, slotId]
    );
  },

  /**
   * Insert new slot
   */
  async insertNewSlot(
    connection: PoolConnection,
    fieldCode: number,
    slot: NormalizedSlot,
    quantityId?: number | null,
    createdBy?: number | null
  ): Promise<number> {
    const [result] = await connection.query<ResultSetHeader>(
      `
        INSERT INTO Field_Slots (
          FieldCode,
          QuantityID,
          PlayDate,
          StartTime,
          EndTime,
          Status,
          HoldExpiresAt,
          CreatedBy
        )
        VALUES (?, ?, ?, ?, ?, 'available', NULL, ?)
        ON DUPLICATE KEY UPDATE
          SlotID = LAST_INSERT_ID(SlotID)
      `,
      [
        fieldCode,
        quantityId || null,
        slot.db_date,
        slot.db_start_time,
        slot.db_end_time,
        createdBy,
      ]
    );

    return Number(result.insertId);
  },

  /**
   * Get expired held slots
   */
  async getExpiredHeldSlots(fieldCode?: number): Promise<ExpiredSlot[]> {
    let query = `
      SELECT SlotID AS slotId, BookingCode AS bookingCode
      FROM Field_Slots
      WHERE Status = 'held'
        AND HoldExpiresAt IS NOT NULL
        AND HoldExpiresAt < NOW()
    `;
    const params: any[] = [];

    if (fieldCode) {
      query += ` AND FieldCode = ?`;
      params.push(fieldCode);
    }

    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return rows as ExpiredSlot[];
  },

  /**
   * Release expired held slots
   */
  async releaseExpiredHeldSlots(fieldCode?: number): Promise<number> {
    let query = `
      UPDATE Field_Slots
      SET Status = 'available',
          BookingCode = NULL,
          HoldExpiresAt = NULL,
          UpdateAt = NOW()
      WHERE Status = 'held'
        AND HoldExpiresAt IS NOT NULL
        AND HoldExpiresAt < NOW()
    `;
    const params: any[] = [];

    if (fieldCode) {
      query += ` AND FieldCode = ?`;
      params.push(fieldCode);
    }

    const result = await queryService.execQuery(query, params);
    return typeof result === "boolean"
      ? result
        ? 1
        : 0
      : (result as any).affectedRows ?? 0;
  },

  /**
   * Create booking
   */
  async insertPendingBooking(
    connection: PoolConnection,
    payload: {
      fieldCode: number;
      quantityId?: number | null;
      customerUserID: number;
      customerName?: string | null;
      customerEmail?: string | null;
      customerPhone?: string | null;
      totalPrice: number;
      platformFee: number;
      netToShop: number;
      discountAmount: number;
      promotionId?: number | null;
      promotionCode?: string | null;
      checkinCode: string;
    }
  ): Promise<number> {
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO Bookings (
          FieldCode,
          QuantityID,
          CustomerUserID,
          CustomerName,
          CustomerEmail,
          CustomerPhone,
          TotalPrice,
          PlatformFee,
          NetToShop,
          DiscountAmount,
          PromotionID,
          PromotionCode,
          CheckinCode,
          BookingStatus,
          PaymentStatus,
          CreateAt,
          UpdateAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', NOW(), NOW())`,
      [
        payload.fieldCode,
        payload.quantityId ?? null,
        payload.customerUserID,
        payload.customerName || null,
        payload.customerEmail || null,
        payload.customerPhone || null,
        payload.totalPrice,
        payload.platformFee,
        payload.netToShop,
        payload.discountAmount,
        payload.promotionId ?? null,
        payload.promotionCode ?? null,
        payload.checkinCode,
      ]
    );

    return Number((result as any).insertId);
  },

  async insertBookingSlotRecord(
    connection: PoolConnection,
    params: {
      bookingCode: number;
      fieldCode: number;
      quantityId?: number | null;
      playDate: string;
      startTime: string;
      endTime: string;
      pricePerSlot: number;
    }
  ): Promise<void> {
    await connection.query<ResultSetHeader>(
      `INSERT INTO Booking_Slots (
          BookingCode,
          FieldCode,
          QuantityID,
          PlayDate,
          StartTime,
          EndTime,
          PricePerSlot,
          Status,
          CreateAt,
          UpdateAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        params.bookingCode,
        params.fieldCode,
        params.quantityId ?? null,
        params.playDate,
        params.startTime,
        params.endTime,
        params.pricePerSlot,
      ]
    );
  },

  async holdFieldSlot(
    connection: PoolConnection,
    params: {
      fieldCode: number;
      bookingCode: number;
      quantityId?: number | null;
      slot: NormalizedSlot;
      holdExpiresAt: Date;
      createdBy?: number | null;
    }
  ): Promise<void> {
    if (params.quantityId !== null && params.quantityId !== undefined) {
      const [updateResult] = await connection.query<ResultSetHeader>(
        `UPDATE Field_Slots 
           SET Status = 'held',
               BookingCode = ?,
               HoldExpiresAt = ?,
               QuantityID = IFNULL(?, QuantityID),
               UpdateAt = NOW()
           WHERE FieldCode = ?
             AND PlayDate = ?
             AND StartTime = ?
             AND EndTime = ?
             AND (QuantityID = ? OR QuantityID IS NULL)`,
        [
          params.bookingCode,
          params.holdExpiresAt,
          params.quantityId,
          params.fieldCode,
          params.slot.db_date,
          params.slot.db_start_time,
          params.slot.db_end_time,
          params.quantityId,
        ]
      );

      if ((updateResult?.affectedRows ?? 0) === 0) {
        await connection.query<ResultSetHeader>(
          `INSERT INTO Field_Slots (
               FieldCode,
               QuantityID,
               PlayDate,
               StartTime,
               EndTime,
               Status,
               BookingCode,
               HoldExpiresAt,
               CreatedBy,
               CreateAt,
               UpdateAt
             )
             VALUES (?, ?, ?, ?, ?, 'held', ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
               Status = 'held',
               BookingCode = VALUES(BookingCode),
               HoldExpiresAt = VALUES(HoldExpiresAt),
               QuantityID = IFNULL(VALUES(QuantityID), QuantityID),
               UpdateAt = NOW()`,
          [
            params.fieldCode,
            params.quantityId,
            params.slot.db_date,
            params.slot.db_start_time,
            params.slot.db_end_time,
            params.bookingCode,
            params.holdExpiresAt,
            params.createdBy ?? null,
          ]
        );
      }
    } else {
      const [updateResult] = await connection.query<ResultSetHeader>(
        `UPDATE Field_Slots 
           SET Status = 'held',
               BookingCode = ?,
               HoldExpiresAt = ?,
               UpdateAt = NOW()
           WHERE FieldCode = ?
             AND PlayDate = ?
             AND StartTime = ?
             AND EndTime = ?
             AND QuantityID IS NULL`,
        [
          params.bookingCode,
          params.holdExpiresAt,
          params.fieldCode,
          params.slot.db_date,
          params.slot.db_start_time,
          params.slot.db_end_time,
        ]
      );

      if ((updateResult?.affectedRows ?? 0) === 0) {
        await connection.query<ResultSetHeader>(
          `INSERT INTO Field_Slots (
               FieldCode,
               QuantityID,
               PlayDate,
               StartTime,
               EndTime,
               Status,
               BookingCode,
               HoldExpiresAt,
               CreatedBy,
               CreateAt,
               UpdateAt
             )
             VALUES (?, NULL, ?, ?, ?, 'held', ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
               Status = 'held',
               BookingCode = VALUES(BookingCode),
               HoldExpiresAt = VALUES(HoldExpiresAt),
               UpdateAt = NOW()`,
          [
            params.fieldCode,
            params.slot.db_date,
            params.slot.db_start_time,
            params.slot.db_end_time,
            params.bookingCode,
            params.holdExpiresAt,
            params.createdBy ?? null,
          ]
        );
      }
    }
  },

  /**
   * Create booking slot
   */
  async createBookingSlot(
    connection: PoolConnection,
    bookingCode: string,
    fieldCode: number,
    slotId: number,
    quantityId: number | null,
    playDate: string,
    startTime: string,
    endTime: string,
    pricePerSlot: number
  ): Promise<number> {
    const [result] = await connection.query<ResultSetHeader>(
      `
        INSERT INTO Booking_Slots (
          BookingCode,
          FieldCode,
          QuantityID,
          PlayDate,
          StartTime,
          EndTime,
          Status,
          PricePerSlot,
          CreateAt
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NOW())
      `,
      [
        bookingCode,
        fieldCode,
        quantityId || null,
        playDate,
        startTime,
        endTime,
        pricePerSlot,
      ]
    );

    return Number(result.insertId);
  },

  /**
   * Get booking by code
   */
  async getByBookingCode(bookingCode: string) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `
        SELECT * FROM Bookings
        WHERE BookingCode = ?
        LIMIT 1
      `,
      [bookingCode]
    );

    return rows?.[0] || null;
  },

  /**
   * Get booking slots by booking code
   */
  async getBookingSlots(bookingCode: string) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `
        SELECT * FROM Booking_Slots
        WHERE BookingCode = ?
        ORDER BY PlayDate, StartTime
      `,
      [bookingCode]
    );

    return rows || [];
  },

  /**
   * Release held slots for booking
   */
  async releaseHeldSlots(bookingCode: string | number): Promise<void> {
    await queryService.execQuery(
      `
        UPDATE Field_Slots 
        SET Status = 'available', BookingCode = NULL, HoldExpiresAt = NULL, UpdateAt = NOW()
        WHERE BookingCode = ? AND Status = 'held'
      `,
      [bookingCode]
    );
  },

  /**
   * Release held slots by slot IDs
   */
  async releaseHeldSlotsByIds(slotIds: number[]): Promise<void> {
    if (!slotIds.length) return;

    await queryService.query<ResultSetHeader>(
      `UPDATE Field_Slots 
       SET Status = 'available',
           BookingCode = NULL,
           HoldExpiresAt = NULL,
           UpdateAt = NOW()
       WHERE SlotID IN (?)`,
      [slotIds]
    );
  },

  /**
   * Update slot to held status
   */
  async updateSlotToHeld(
    connection: PoolConnection,
    slotId: number,
    bookingCode: string,
    holdDurationMs: number
  ): Promise<void> {
    const holdExpiresAt = new Date(Date.now() + holdDurationMs);
    await connection.query<ResultSetHeader>(
      `
        UPDATE Field_Slots
        SET Status = 'held',
            BookingCode = ?,
            HoldExpiresAt = ?,
            UpdateAt = NOW()
        WHERE SlotID = ?
      `,
      [bookingCode, holdExpiresAt, slotId]
    );
  },

  /**
   * Get field info for booking (code, shop, price)
   */
  async getFieldInfo(fieldCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT FieldCode, ShopCode, DefaultPricePerHour FROM Fields WHERE FieldCode = ?`,
      [fieldCode]
    );

    return rows?.[0] || null;
  },

  /**
   * Check promotion usage by user
   */
  async checkPromotionUsageByUser(
    promotionId: number,
    userId: number
  ): Promise<{ customerUsage: number; totalUsage: number }> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT 
        SUM(CASE WHEN CustomerUserID = ? THEN 1 ELSE 0 END) AS CustomerUsage,
        COUNT(*) AS TotalUsage
      FROM Bookings
      WHERE PromotionID = ?
        AND BookingStatus IN ('pending','confirmed','completed')`,
      [userId, promotionId]
    );

    return {
      customerUsage: Number(rows?.[0]?.CustomerUsage ?? 0),
      totalUsage: Number(rows?.[0]?.TotalUsage ?? 0),
    };
  },

  /**
   * Check promotion total usage
   */
  async checkPromotionTotalUsage(promotionId: number): Promise<number> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS TotalUsage
      FROM Bookings
      WHERE PromotionID = ?
        AND BookingStatus IN ('pending','confirmed','completed')`,
      [promotionId]
    );

    return Number(rows?.[0]?.TotalUsage ?? 0);
  },

  async listCustomerBookings(
    userId: number,
    options: {
      status?: string;
      sortField?: string;
      sortOrder?: "ASC" | "DESC";
      limit: number;
      offset: number;
    }
  ): Promise<CustomerBookingRow[]> {
    const allowedSort = new Set([
      "CreateAt",
      "PlayDate",
      "TotalPrice",
      "BookingStatus",
    ]);
    const sortColumn = allowedSort.has(options.sortField || "")
      ? options.sortField
      : "CreateAt";
    const sortOrder = options.sortOrder === "ASC" ? "ASC" : "DESC";

    let query = `
      SELECT 
        b.*, 
        f.FieldName,
        f.SportType,
        s.ShopName,
        bcr.Status AS CancellationStatus,
        bcr.RefundAmount AS CancellationRefundAmount,
        bcr.PenaltyPercent AS CancellationPenaltyPercent,
        bcr.CreateAt AS CancellationRequestedAt,
        bcr.DecisionAt AS CancellationDecidedAt
      FROM Bookings b
      JOIN Fields f ON b.FieldCode = f.FieldCode
      JOIN Shops s ON f.ShopCode = s.ShopCode
      LEFT JOIN Booking_Cancellation_Requests bcr ON b.BookingCode = bcr.BookingCode
      WHERE b.CustomerUserID = ?
    `;

    const params: any[] = [userId];

    if (options.status) {
      query += " AND b.BookingStatus = ?";
      params.push(options.status);
    }

    query += ` ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(options.limit, options.offset);

    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return rows as CustomerBookingRow[];
  },

  async countCustomerBookings(userId: number, status?: string): Promise<number> {
    let query = `SELECT COUNT(*) AS total FROM Bookings WHERE CustomerUserID = ?`;
    const params: any[] = [userId];
    if (status) {
      query += ` AND BookingStatus = ?`;
      params.push(status);
    }

    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return Number(rows?.[0]?.total ?? 0);
  },

  async listSlotsWithQuantity(
    bookingCodes: number[]
  ): Promise<BookingSlotWithQuantityRow[]> {
    if (!bookingCodes.length) return [];

    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT 
         bs.BookingCode,
         bs.Slot_ID,
         bs.QuantityID,
         fq.QuantityNumber,
         DATE_FORMAT(bs.PlayDate, '%Y-%m-%d') AS PlayDate,
         DATE_FORMAT(bs.StartTime, '%H:%i') AS StartTime,
         DATE_FORMAT(bs.EndTime, '%H:%i') AS EndTime,
         bs.PricePerSlot,
         bs.Status
       FROM Booking_Slots bs
       LEFT JOIN Field_Quantity fq ON bs.QuantityID = fq.QuantityID
       WHERE bs.BookingCode IN (?)
       ORDER BY bs.PlayDate, bs.StartTime`,
      [bookingCodes]
    );

    return rows as BookingSlotWithQuantityRow[];
  },

  async listShopBookings(
    shopCode: number,
    options: ShopBookingFilters
  ): Promise<ShopBookingRow[]> {
    const sortColumnMap: Record<string, string> = {
      CreateAt: "b.CreateAt",
      PlayDate: "b.CreateAt",
      TotalPrice: "b.TotalPrice",
      BookingStatus: "b.BookingStatus",
    };
    const rawSortField = String(options.sortField ?? "").trim();
    const sortColumn =
      sortColumnMap[rawSortField] ?? "b.CreateAt";
    const sortOrder = options.sortOrder === "ASC" ? "ASC" : "DESC";

    let query = `SELECT b.BookingCode,
                        b.FieldCode,
                        b.CustomerUserID,
                        b.BookingStatus,
                        b.PaymentStatus,
                        b.TotalPrice,
                        b.NetToShop,
                        b.CheckinCode,
                        b.CheckinTime,
                        b.CreateAt,
                        b.UpdateAt,
                        u.FullName AS CustomerName,
                        b.CustomerPhone,
                        f.FieldName,
                        bcr.Status AS CancellationStatus,
                        bcr.RefundAmount AS CancellationRefundAmount,
                        bcr.PenaltyPercent AS CancellationPenaltyPercent,
                        bcr.CreateAt AS CancellationRequestedAt,
                        bcr.DecisionAt AS CancellationDecidedAt
                 FROM Bookings b
                 JOIN Fields f ON b.FieldCode = f.FieldCode
                 LEFT JOIN Users u ON b.CustomerUserID = u.UserID
                 LEFT JOIN Booking_Cancellation_Requests bcr ON b.BookingCode = bcr.BookingCode
                 WHERE f.ShopCode = ?`;
    const params: any[] = [shopCode];

    if (options.status) {
      query += ` AND b.BookingStatus = ?`;
      params.push(options.status);
    }

    if (options.search) {
      const searchTerm = `%${options.search}%`;
      query += ` AND (
        CAST(b.BookingCode AS CHAR) LIKE ?
        OR f.FieldName LIKE ?
        OR b.CustomerPhone LIKE ?
        OR u.FullName LIKE ?
      )`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(options.limit, options.offset);

    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return rows as ShopBookingRow[];
  },

  async countShopBookings(
    shopCode: number,
    options: ShopBookingFilters
  ): Promise<number> {
    let query = `SELECT COUNT(*) AS total
                 FROM Bookings b
                 JOIN Fields f ON b.FieldCode = f.FieldCode
                 LEFT JOIN Users u ON b.CustomerUserID = u.UserID
                 WHERE f.ShopCode = ?`;
    const params: any[] = [shopCode];

    if (options.status) {
      query += ` AND b.BookingStatus = ?`;
      params.push(options.status);
    }

    if (options.search) {
      const searchTerm = `%${options.search}%`;
      query += ` AND (
        CAST(b.BookingCode AS CHAR) LIKE ?
        OR f.FieldName LIKE ?
        OR b.CustomerPhone LIKE ?
        OR u.FullName LIKE ?
      )`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return Number(rows?.[0]?.total ?? 0);
  },

  async getShopBookingStatusSummary(shopCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT b.BookingStatus, COUNT(*) AS total
       FROM Bookings b
       JOIN Fields f ON b.FieldCode = f.FieldCode
       WHERE f.ShopCode = ?
       GROUP BY b.BookingStatus`,
      [shopCode]
    );
    return rows;
  },

  async getShopPaymentStatusSummary(shopCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT b.PaymentStatus, COUNT(*) AS total
       FROM Bookings b
       JOIN Fields f ON b.FieldCode = f.FieldCode
       WHERE f.ShopCode = ?
       GROUP BY b.PaymentStatus`,
      [shopCode]
    );
    return rows;
  },

  async getBookingDetail(
    bookingCode: number,
    userId?: number
  ): Promise<RowDataPacket | null> {
    let query = `
      SELECT b.*, f.FieldName, f.SportType, f.Address, s.ShopName, s.ShopCode,
             CASE WHEN b.PaymentStatus = 'paid' THEN p.Amount ELSE 0 END AS paid_amount,
             bcr.Status AS CancellationStatus,
             bcr.RefundAmount AS CancellationRefundAmount,
             bcr.PenaltyPercent AS CancellationPenaltyPercent,
             bcr.CreateAt AS CancellationRequestedAt,
             bcr.DecisionAt AS CancellationDecidedAt
      FROM Bookings b
      JOIN Fields f ON b.FieldCode = f.FieldCode
      JOIN Shops s ON f.ShopCode = s.ShopCode
      LEFT JOIN Payments_Admin p ON b.PaymentID = p.PaymentID
      LEFT JOIN Booking_Cancellation_Requests bcr ON b.BookingCode = bcr.BookingCode
      WHERE b.BookingCode = ?
    `;
    const params: any[] = [bookingCode];
    if (Number.isFinite(userId) && userId) {
      query += " AND b.CustomerUserID = ?";
      params.push(userId);
    }

    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return rows?.[0] || null;
  },

  async getBookingWithOwnerContact(bookingCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT b.*, f.FieldName, f.FieldCode, f.ShopCode,
              s.ShopName, s.PhoneNumber AS ShopPhone,
              u.UserID AS ShopOwnerUserID,
              u.FullName AS OwnerFullName,
              u.Email AS OwnerEmail
         FROM Bookings b
         JOIN Fields f ON b.FieldCode = f.FieldCode
         JOIN Shops s ON f.ShopCode = s.ShopCode
         JOIN Users u ON s.UserID = u.UserID
        WHERE b.BookingCode = ?
        LIMIT 1`,
      [bookingCode]
    );

    return rows?.[0] || null;
  },

  async getBookingByCustomer(
    bookingCode: number,
    userId: number
  ): Promise<RowDataPacket | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT * FROM Bookings WHERE BookingCode = ? AND CustomerUserID = ?`,
      [bookingCode, userId]
    );

    return rows?.[0] || null;
  },

  async getEarliestSlot(bookingCode: number): Promise<RowDataPacket | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT PlayDate, StartTime 
         FROM Booking_Slots 
        WHERE BookingCode = ?
        ORDER BY PlayDate ASC, StartTime ASC
        LIMIT 1`,
      [bookingCode]
    );

    return rows?.[0] || null;
  },

  async getLatestSlot(bookingCode: number): Promise<RowDataPacket | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT PlayDate, EndTime
         FROM Booking_Slots
        WHERE BookingCode = ?
        ORDER BY PlayDate DESC, EndTime DESC
        LIMIT 1`,
      [bookingCode]
    );

    return rows?.[0] || null;
  },

  async setBookingStatus(
    bookingCode: number,
    status: string
  ): Promise<void> {
    await queryService.query<ResultSetHeader>(
      `UPDATE Bookings 
         SET BookingStatus = ?, UpdateAt = NOW()
       WHERE BookingCode = ?`,
      [status, bookingCode]
    );
  },

  async setBookingCompletedAt(bookingCode: number): Promise<void> {
    await queryService.query<ResultSetHeader>(
      `UPDATE Bookings SET CompletedAt = NOW(), UpdateAt = NOW() WHERE BookingCode = ?`,
      [bookingCode]
    );
  },

  async setBookingSlotsStatus(
    bookingCode: number,
    status: string
  ): Promise<void> {
    await queryService.query<ResultSetHeader>(
      `UPDATE Booking_Slots
         SET Status = ?, UpdateAt = NOW()
       WHERE BookingCode = ?`,
      [status, bookingCode]
    );
  },

  async setBookingCheckinTime(bookingCode: number): Promise<void> {
    await queryService.query<ResultSetHeader>(
      `UPDATE Bookings 
         SET CheckinTime = NOW(), UpdateAt = NOW()
       WHERE BookingCode = ?`,
      [bookingCode]
    );
  },

  async resetFieldSlotsToAvailable(bookingCode: number): Promise<void> {
    await queryService.query<ResultSetHeader>(
      `UPDATE Field_Slots 
         SET Status = 'available',
             BookingCode = NULL,
             HoldExpiresAt = NULL,
             UpdateAt = NOW()
       WHERE BookingCode = ?`,
      [bookingCode]
    );
  },

  async decrementFieldRent(fieldCode: number): Promise<void> {
    await queryService.query<ResultSetHeader>(
      `UPDATE Fields
         SET Rent = GREATEST(Rent - 1, 0),
             UpdateAt = NOW()
       WHERE FieldCode = ?`,
      [fieldCode]
    );
  },

  async incrementFieldRent(fieldCode: number): Promise<void> {
    await queryService.query<ResultSetHeader>(
      `UPDATE Fields
         SET Rent = Rent + 1,
             UpdateAt = NOW()
       WHERE FieldCode = ?`,
      [fieldCode]
    );
  },

  async insertBookingRefund(
    bookingCode: number,
    amount: number,
    reason: string
  ): Promise<void> {
    await queryService.query<ResultSetHeader>(
      `INSERT INTO Booking_Refunds (
         BookingCode,
         RefundAmount,
         Reason,
         Status,
         RequestedAt,
         CreateAt
       ) VALUES (?, ?, ?, 'approved', NOW(), NOW())`,
      [bookingCode, amount, reason]
    );
  },

  async getFieldShopCode(fieldCode: number): Promise<number | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT ShopCode FROM Fields WHERE FieldCode = ?`,
      [fieldCode]
    );

    return rows?.[0]?.ShopCode ?? null;
  },

  async getCancellationRequestByBooking(
    bookingCode: number
  ): Promise<BookingCancellationRequestRow | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT *
         FROM Booking_Cancellation_Requests
        WHERE BookingCode = ?
        LIMIT 1`,
      [bookingCode]
    );

    return (rows?.[0] as BookingCancellationRequestRow) || null;
  },

  async getCancellationRequestByToken(
    token: string
  ): Promise<BookingCancellationRequestRow | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT *
         FROM Booking_Cancellation_Requests
        WHERE DecisionToken = ?
        LIMIT 1`,
      [token]
    );

    return (rows?.[0] as BookingCancellationRequestRow) || null;
  },

  async upsertCancellationRequest(payload: {
    bookingCode: number;
    customerUserId: number;
    shopCode: number;
    fieldCode?: number | null;
    reason?: string | null;
    penaltyPercent: number;
    refundAmount: number;
    decisionToken: string;
    customerPhone?: string | null;
    customerName?: string | null;
    customerEmail?: string | null;
    previousStatus?: string | null;
  }): Promise<BookingCancellationRequestRow | null> {
    await queryService.query<ResultSetHeader>(
      `INSERT INTO Booking_Cancellation_Requests (
         BookingCode,
         CustomerUserID,
         ShopCode,
         FieldCode,
         Reason,
         Status,
         PenaltyPercent,
         RefundAmount,
         DecisionToken,
         CustomerPhone,
         CustomerName,
         CustomerEmail,
         PreviousStatus,
         CreateAt,
         UpdateAt
       ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         Reason = VALUES(Reason),
         Status = 'pending',
         PenaltyPercent = VALUES(PenaltyPercent),
         RefundAmount = VALUES(RefundAmount),
         DecisionToken = VALUES(DecisionToken),
         CustomerPhone = VALUES(CustomerPhone),
         CustomerName = VALUES(CustomerName),
         CustomerEmail = VALUES(CustomerEmail),
         PreviousStatus = VALUES(PreviousStatus),
         DecisionAt = NULL,
         DecisionBy = NULL,
         UpdateAt = NOW()`,
      [
        payload.bookingCode,
        payload.customerUserId,
        payload.shopCode,
        payload.fieldCode ?? null,
        payload.reason ?? null,
        payload.penaltyPercent,
        payload.refundAmount,
        payload.decisionToken,
        payload.customerPhone ?? null,
        payload.customerName ?? null,
        payload.customerEmail ?? null,
        payload.previousStatus ?? null,
      ]
    );

    return await this.getCancellationRequestByBooking(payload.bookingCode);
  },

  async updateCancellationRequestStatus(
    requestId: number,
    updates: {
      status: "approved" | "rejected";
      decisionBy?: number | null;
    }
  ): Promise<void> {
    await queryService.query<ResultSetHeader>(
      `UPDATE Booking_Cancellation_Requests
          SET Status = ?,
              DecisionAt = NOW(),
              DecisionBy = ?,
              UpdateAt = NOW()
        WHERE RequestID = ?`,
      [updates.status, updates.decisionBy ?? null, requestId]
    );
  },

  async markPastPaidBookingsCompleted(): Promise<number> {
    const [result] = await queryService.query<ResultSetHeader>(
      `UPDATE Bookings b
          JOIN (
            SELECT BookingCode,
                   MAX(TIMESTAMP(PlayDate, EndTime)) AS LastSlotAt
              FROM Booking_Slots
             GROUP BY BookingCode
          ) slot_summary ON slot_summary.BookingCode = b.BookingCode
         SET b.BookingStatus = 'completed',
             b.CompletedAt = NOW(),
             b.UpdateAt = NOW()
       WHERE b.BookingStatus = 'confirmed'
         AND b.PaymentStatus = 'paid'
         AND slot_summary.LastSlotAt <= NOW()`,
      []
    );

    return Number(result?.affectedRows ?? 0);
  },

  /**
   * Cancel expired bookings
   */
  async cancelExpiredBookings(bookingCodes: number[]): Promise<void> {
    if (!bookingCodes.length) return;

    await queryService.query<ResultSetHeader>(
      `UPDATE Booking_Slots
       SET Status = 'cancelled',
           UpdateAt = NOW()
       WHERE Status = 'pending'
         AND BookingCode IN (?)`,
      [bookingCodes]
    );

    await queryService.query<ResultSetHeader>(
      `UPDATE Bookings
       SET BookingStatus = 'cancelled',
           PaymentStatus = CASE
             WHEN PaymentStatus = 'paid' THEN PaymentStatus
             ELSE 'failed'
           END,
           UpdateAt = NOW()
       WHERE BookingStatus = 'pending'
         AND BookingCode IN (?)`,
      [bookingCodes]
    );

    await queryService.query<ResultSetHeader>(
      `UPDATE Field_Slots
       SET Status = 'available',
           BookingCode = NULL,
           HoldExpiresAt = NULL,
           UpdateAt = NOW()
       WHERE BookingCode IN (?)`,
      [bookingCodes]
    );

    await queryService.query<ResultSetHeader>(
      `UPDATE Payments_Admin
       SET PaymentStatus = 'failed',
           UpdateAt = NOW()
       WHERE PaymentStatus = 'pending'
         AND BookingCode IN (?)`,
      [bookingCodes]
    );
  },

  async listStalePendingBookingCodes(shopCode: number): Promise<number[]> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT BookingCode
         FROM Bookings
         WHERE BookingStatus = 'pending'
           AND TIMESTAMPDIFF(MINUTE, CreateAt, NOW()) > 10
           AND FieldCode IN (SELECT FieldCode FROM Fields WHERE ShopCode = ?)`,
      [shopCode]
    );

    return rows
      .map((row) => Number(row.BookingCode))
      .filter((code) => Number.isFinite(code) && code > 0);
  },
};

export default bookingModel;
