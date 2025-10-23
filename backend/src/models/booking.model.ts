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

// ============ BOOKING MODEL ============
const bookingModel = {
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
  async createBooking(
    connection: PoolConnection,
    bookingCode: string,
    fieldCode: number,
    customerUserID: number | null,
    customerName: string | null,
    customerEmail: string | null,
    customerPhone: string | null,
    totalPrice: number,
    notes: string | null,
    paymentMethod: string
  ): Promise<number> {
    const [result] = await connection.query<ResultSetHeader>(
      `
        INSERT INTO Bookings (
          BookingCode,
          FieldCode,
          CustomerUserID,
          CustomerName,
          CustomerEmail,
          CustomerPhone,
          TotalPrice,
          Notes,
          PaymentMethod,
          BookingStatus,
          PaymentStatus,
          CreateAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', NOW())
      `,
      [
        bookingCode,
        fieldCode,
        customerUserID,
        customerName,
        customerEmail,
        customerPhone,
        totalPrice,
        notes,
        paymentMethod,
      ]
    );

    return Number(result.insertId);
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
      `UPDATE Payments_Admin
       SET PaymentStatus = 'failed',
           UpdateAt = NOW()
       WHERE PaymentStatus = 'pending'
         AND BookingCode IN (?)`,
      [bookingCodes]
    );
  },
};

export default bookingModel;
