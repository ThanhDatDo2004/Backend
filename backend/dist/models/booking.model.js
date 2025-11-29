"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const query_1 = __importDefault(require("../services/query"));
// ============ BOOKING MODEL ============
const bookingModel = {
    async runInTransaction(name, handler) {
        return query_1.default.execTransaction(name, handler);
    },
    /**
     * Lock a slot for booking (SELECT FOR UPDATE)
     */
    async lockSlot(connection, fieldCode, slot, quantityId) {
        const params = [
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
        const [rows] = await connection.query(`
        SELECT SlotID, Status, HoldExpiresAt, QuantityID
        FROM Field_Slots
        WHERE FieldCode = ?
          AND PlayDate = ?
          AND StartTime = ?
          AND EndTime = ?
          ${quantityClause}
        FOR UPDATE
      `, params);
        return rows?.[0] ?? null;
    },
    /**
     * Update existing slot to booked status
     */
    async updateExistingSlot(connection, slotId, quantityId) {
        await connection.query(`
        UPDATE Field_Slots
        SET Status = 'booked',
            HoldExpiresAt = NULL,
            QuantityID = IFNULL(?, QuantityID),
            UpdateAt = NOW()
        WHERE SlotID = ?
      `, [quantityId ?? null, slotId]);
    },
    async resetSlotForBooking(connection, slotId, quantityId) {
        await connection.query(`
        UPDATE Field_Slots
        SET Status = 'available',
            BookingCode = NULL,
            HoldExpiresAt = NULL,
            QuantityID = IFNULL(?, QuantityID),
            UpdateAt = NOW()
        WHERE SlotID = ?
      `, [quantityId ?? null, slotId]);
    },
    /**
     * Insert new slot
     */
    async insertNewSlot(connection, fieldCode, slot, quantityId, createdBy) {
        const [result] = await connection.query(`
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
      `, [
            fieldCode,
            quantityId || null,
            slot.db_date,
            slot.db_start_time,
            slot.db_end_time,
            createdBy,
        ]);
        return Number(result.insertId);
    },
    /**
     * Get expired held slots
     */
    async getExpiredHeldSlots(fieldCode) {
        let query = `
      SELECT SlotID AS slotId, BookingCode AS bookingCode
      FROM Field_Slots
      WHERE Status = 'held'
        AND HoldExpiresAt IS NOT NULL
        AND HoldExpiresAt < NOW()
    `;
        const params = [];
        if (fieldCode) {
            query += ` AND FieldCode = ?`;
            params.push(fieldCode);
        }
        const [rows] = await query_1.default.query(query, params);
        return rows;
    },
    /**
     * Release expired held slots
     */
    async releaseExpiredHeldSlots(fieldCode) {
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
        const params = [];
        if (fieldCode) {
            query += ` AND FieldCode = ?`;
            params.push(fieldCode);
        }
        const result = await query_1.default.execQuery(query, params);
        return typeof result === "boolean"
            ? result
                ? 1
                : 0
            : result.affectedRows ?? 0;
    },
    /**
     * Create booking
     */
    async insertPendingBooking(connection, payload) {
        const [result] = await connection.query(`INSERT INTO Bookings (
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', NOW(), NOW())`, [
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
        ]);
        return Number(result.insertId);
    },
    async insertBookingSlotRecord(connection, params) {
        await connection.query(`INSERT INTO Booking_Slots (
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`, [
            params.bookingCode,
            params.fieldCode,
            params.quantityId ?? null,
            params.playDate,
            params.startTime,
            params.endTime,
            params.pricePerSlot,
        ]);
    },
    async holdFieldSlot(connection, params) {
        if (params.quantityId !== null && params.quantityId !== undefined) {
            const [updateResult] = await connection.query(`UPDATE Field_Slots 
           SET Status = 'held',
               BookingCode = ?,
               HoldExpiresAt = ?,
               QuantityID = IFNULL(?, QuantityID),
               UpdateAt = NOW()
           WHERE FieldCode = ?
             AND PlayDate = ?
             AND StartTime = ?
             AND EndTime = ?
             AND (QuantityID = ? OR QuantityID IS NULL)`, [
                params.bookingCode,
                params.holdExpiresAt,
                params.quantityId,
                params.fieldCode,
                params.slot.db_date,
                params.slot.db_start_time,
                params.slot.db_end_time,
                params.quantityId,
            ]);
            if ((updateResult?.affectedRows ?? 0) === 0) {
                await connection.query(`INSERT INTO Field_Slots (
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
               UpdateAt = NOW()`, [
                    params.fieldCode,
                    params.quantityId,
                    params.slot.db_date,
                    params.slot.db_start_time,
                    params.slot.db_end_time,
                    params.bookingCode,
                    params.holdExpiresAt,
                    params.createdBy ?? null,
                ]);
            }
        }
        else {
            const [updateResult] = await connection.query(`UPDATE Field_Slots 
           SET Status = 'held',
               BookingCode = ?,
               HoldExpiresAt = ?,
               UpdateAt = NOW()
           WHERE FieldCode = ?
             AND PlayDate = ?
             AND StartTime = ?
             AND EndTime = ?
             AND QuantityID IS NULL`, [
                params.bookingCode,
                params.holdExpiresAt,
                params.fieldCode,
                params.slot.db_date,
                params.slot.db_start_time,
                params.slot.db_end_time,
            ]);
            if ((updateResult?.affectedRows ?? 0) === 0) {
                await connection.query(`INSERT INTO Field_Slots (
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
               UpdateAt = NOW()`, [
                    params.fieldCode,
                    params.slot.db_date,
                    params.slot.db_start_time,
                    params.slot.db_end_time,
                    params.bookingCode,
                    params.holdExpiresAt,
                    params.createdBy ?? null,
                ]);
            }
        }
    },
    /**
     * Create booking slot
     */
    async createBookingSlot(connection, bookingCode, fieldCode, slotId, quantityId, playDate, startTime, endTime, pricePerSlot) {
        const [result] = await connection.query(`
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
      `, [
            bookingCode,
            fieldCode,
            quantityId || null,
            playDate,
            startTime,
            endTime,
            pricePerSlot,
        ]);
        return Number(result.insertId);
    },
    /**
     * Get booking by code
     */
    async getByBookingCode(bookingCode) {
        const [rows] = await query_1.default.query(`
        SELECT * FROM Bookings
        WHERE BookingCode = ?
        LIMIT 1
      `, [bookingCode]);
        return rows?.[0] || null;
    },
    /**
     * Get booking slots by booking code
     */
    async getBookingSlots(bookingCode) {
        const [rows] = await query_1.default.query(`
        SELECT * FROM Booking_Slots
        WHERE BookingCode = ?
        ORDER BY PlayDate, StartTime
      `, [bookingCode]);
        return rows || [];
    },
    /**
     * Release held slots for booking
     */
    async releaseHeldSlots(bookingCode) {
        await query_1.default.execQuery(`
        UPDATE Field_Slots 
        SET Status = 'available', BookingCode = NULL, HoldExpiresAt = NULL, UpdateAt = NOW()
        WHERE BookingCode = ? AND Status = 'held'
      `, [bookingCode]);
    },
    /**
     * Release held slots by slot IDs
     */
    async releaseHeldSlotsByIds(slotIds) {
        if (!slotIds.length)
            return;
        await query_1.default.query(`UPDATE Field_Slots 
       SET Status = 'available',
           BookingCode = NULL,
           HoldExpiresAt = NULL,
           UpdateAt = NOW()
       WHERE SlotID IN (?)`, [slotIds]);
    },
    /**
     * Update slot to held status
     */
    async updateSlotToHeld(connection, slotId, bookingCode, holdDurationMs) {
        const holdExpiresAt = new Date(Date.now() + holdDurationMs);
        await connection.query(`
        UPDATE Field_Slots
        SET Status = 'held',
            BookingCode = ?,
            HoldExpiresAt = ?,
            UpdateAt = NOW()
        WHERE SlotID = ?
      `, [bookingCode, holdExpiresAt, slotId]);
    },
    /**
     * Get field info for booking (code, shop, price)
     */
    async getFieldInfo(fieldCode) {
        const [rows] = await query_1.default.query(`SELECT FieldCode, ShopCode, DefaultPricePerHour FROM Fields WHERE FieldCode = ?`, [fieldCode]);
        return rows?.[0] || null;
    },
    /**
     * Check promotion usage by user
     */
    async checkPromotionUsageByUser(promotionId, userId) {
        const [rows] = await query_1.default.query(`SELECT 
        SUM(CASE WHEN CustomerUserID = ? THEN 1 ELSE 0 END) AS CustomerUsage,
        COUNT(*) AS TotalUsage
      FROM Bookings
      WHERE PromotionID = ?
        AND BookingStatus IN ('pending','confirmed','completed')`, [userId, promotionId]);
        return {
            customerUsage: Number(rows?.[0]?.CustomerUsage ?? 0),
            totalUsage: Number(rows?.[0]?.TotalUsage ?? 0),
        };
    },
    /**
     * Check promotion total usage
     */
    async checkPromotionTotalUsage(promotionId) {
        const [rows] = await query_1.default.query(`SELECT COUNT(*) AS TotalUsage
      FROM Bookings
      WHERE PromotionID = ?
        AND BookingStatus IN ('pending','confirmed','completed')`, [promotionId]);
        return Number(rows?.[0]?.TotalUsage ?? 0);
    },
    async listCustomerBookings(userId, options) {
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
        s.ShopName
      FROM Bookings b
      JOIN Fields f ON b.FieldCode = f.FieldCode
      JOIN Shops s ON f.ShopCode = s.ShopCode
      WHERE b.CustomerUserID = ?
    `;
        const params = [userId];
        if (options.status) {
            query += " AND b.BookingStatus = ?";
            params.push(options.status);
        }
        query += ` ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;
        params.push(options.limit, options.offset);
        const [rows] = await query_1.default.query(query, params);
        return rows;
    },
    async countCustomerBookings(userId, status) {
        let query = `SELECT COUNT(*) AS total FROM Bookings WHERE CustomerUserID = ?`;
        const params = [userId];
        if (status) {
            query += ` AND BookingStatus = ?`;
            params.push(status);
        }
        const [rows] = await query_1.default.query(query, params);
        return Number(rows?.[0]?.total ?? 0);
    },
    async listSlotsWithQuantity(bookingCodes) {
        if (!bookingCodes.length)
            return [];
        const [rows] = await query_1.default.query(`SELECT 
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
       ORDER BY bs.PlayDate, bs.StartTime`, [bookingCodes]);
        return rows;
    },
    async listShopBookings(shopCode, options) {
        const sortColumnMap = {
            CreateAt: "b.CreateAt",
            PlayDate: "b.CreateAt",
            TotalPrice: "b.TotalPrice",
            BookingStatus: "b.BookingStatus",
        };
        const rawSortField = String(options.sortField ?? "").trim();
        const sortColumn = sortColumnMap[rawSortField] ?? "b.CreateAt";
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
                        f.FieldName
                 FROM Bookings b
                 JOIN Fields f ON b.FieldCode = f.FieldCode
                 LEFT JOIN Users u ON b.CustomerUserID = u.UserID
                 WHERE f.ShopCode = ?`;
        const params = [shopCode];
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
        const [rows] = await query_1.default.query(query, params);
        return rows;
    },
    async countShopBookings(shopCode, options) {
        let query = `SELECT COUNT(*) AS total
                 FROM Bookings b
                 JOIN Fields f ON b.FieldCode = f.FieldCode
                 LEFT JOIN Users u ON b.CustomerUserID = u.UserID
                 WHERE f.ShopCode = ?`;
        const params = [shopCode];
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
        const [rows] = await query_1.default.query(query, params);
        return Number(rows?.[0]?.total ?? 0);
    },
    async getShopBookingStatusSummary(shopCode) {
        const [rows] = await query_1.default.query(`SELECT b.BookingStatus, COUNT(*) AS total
       FROM Bookings b
       JOIN Fields f ON b.FieldCode = f.FieldCode
       WHERE f.ShopCode = ?
       GROUP BY b.BookingStatus`, [shopCode]);
        return rows;
    },
    async getShopPaymentStatusSummary(shopCode) {
        const [rows] = await query_1.default.query(`SELECT b.PaymentStatus, COUNT(*) AS total
       FROM Bookings b
       JOIN Fields f ON b.FieldCode = f.FieldCode
       WHERE f.ShopCode = ?
       GROUP BY b.PaymentStatus`, [shopCode]);
        return rows;
    },
    async getBookingDetail(bookingCode, userId) {
        let query = `
      SELECT b.*, f.FieldName, f.SportType, f.Address, s.ShopName, s.ShopCode,
             CASE WHEN b.PaymentStatus = 'paid' THEN p.Amount ELSE 0 END AS paid_amount
      FROM Bookings b
      JOIN Fields f ON b.FieldCode = f.FieldCode
      JOIN Shops s ON f.ShopCode = s.ShopCode
      LEFT JOIN Payments_Admin p ON b.PaymentID = p.PaymentID
      WHERE b.BookingCode = ?
    `;
        const params = [bookingCode];
        if (Number.isFinite(userId) && userId) {
            query += " AND b.CustomerUserID = ?";
            params.push(userId);
        }
        const [rows] = await query_1.default.query(query, params);
        return rows?.[0] || null;
    },
    async getBookingByCustomer(bookingCode, userId) {
        const [rows] = await query_1.default.query(`SELECT * FROM Bookings WHERE BookingCode = ? AND CustomerUserID = ?`, [bookingCode, userId]);
        return rows?.[0] || null;
    },
    async getEarliestSlot(bookingCode) {
        const [rows] = await query_1.default.query(`SELECT PlayDate, StartTime 
         FROM Booking_Slots 
        WHERE BookingCode = ?
        ORDER BY PlayDate ASC, StartTime ASC
        LIMIT 1`, [bookingCode]);
        return rows?.[0] || null;
    },
    async setBookingStatus(bookingCode, status) {
        await query_1.default.query(`UPDATE Bookings 
         SET BookingStatus = ?, UpdateAt = NOW()
       WHERE BookingCode = ?`, [status, bookingCode]);
    },
    async setBookingCompletedAt(bookingCode) {
        await query_1.default.query(`UPDATE Bookings SET CompletedAt = NOW(), UpdateAt = NOW() WHERE BookingCode = ?`, [bookingCode]);
    },
    async setBookingSlotsStatus(bookingCode, status) {
        await query_1.default.query(`UPDATE Booking_Slots
         SET Status = ?, UpdateAt = NOW()
       WHERE BookingCode = ?`, [status, bookingCode]);
    },
    async setBookingCheckinTime(bookingCode) {
        await query_1.default.query(`UPDATE Bookings 
         SET CheckinTime = NOW(), UpdateAt = NOW()
       WHERE BookingCode = ?`, [bookingCode]);
    },
    async resetFieldSlotsToAvailable(bookingCode) {
        await query_1.default.query(`UPDATE Field_Slots 
         SET Status = 'available',
             BookingCode = NULL,
             HoldExpiresAt = NULL,
             UpdateAt = NOW()
       WHERE BookingCode = ?`, [bookingCode]);
    },
    async decrementFieldRent(fieldCode) {
        await query_1.default.query(`UPDATE Fields
         SET Rent = GREATEST(Rent - 1, 0),
             UpdateAt = NOW()
       WHERE FieldCode = ?`, [fieldCode]);
    },
    async incrementFieldRent(fieldCode) {
        await query_1.default.query(`UPDATE Fields
         SET Rent = Rent + 1,
             UpdateAt = NOW()
       WHERE FieldCode = ?`, [fieldCode]);
    },
    async insertBookingRefund(bookingCode, amount, reason) {
        await query_1.default.query(`INSERT INTO Booking_Refunds (
         BookingCode,
         RefundAmount,
         Reason,
         Status,
         RequestedAt,
         CreateAt
       ) VALUES (?, ?, ?, 'approved', NOW(), NOW())`, [bookingCode, amount, reason]);
    },
    async getFieldShopCode(fieldCode) {
        const [rows] = await query_1.default.query(`SELECT ShopCode FROM Fields WHERE FieldCode = ?`, [fieldCode]);
        return rows?.[0]?.ShopCode ?? null;
    },
    /**
     * Cancel expired bookings
     */
    async cancelExpiredBookings(bookingCodes) {
        if (!bookingCodes.length)
            return;
        await query_1.default.query(`UPDATE Booking_Slots
       SET Status = 'cancelled',
           UpdateAt = NOW()
       WHERE Status = 'pending'
         AND BookingCode IN (?)`, [bookingCodes]);
        await query_1.default.query(`UPDATE Bookings
       SET BookingStatus = 'cancelled',
           PaymentStatus = CASE
             WHEN PaymentStatus = 'paid' THEN PaymentStatus
             ELSE 'failed'
           END,
           UpdateAt = NOW()
       WHERE BookingStatus = 'pending'
         AND BookingCode IN (?)`, [bookingCodes]);
        await query_1.default.query(`UPDATE Field_Slots
       SET Status = 'available',
           BookingCode = NULL,
           HoldExpiresAt = NULL,
           UpdateAt = NOW()
       WHERE BookingCode IN (?)`, [bookingCodes]);
        await query_1.default.query(`UPDATE Payments_Admin
       SET PaymentStatus = 'failed',
           UpdateAt = NOW()
       WHERE PaymentStatus = 'pending'
         AND BookingCode IN (?)`, [bookingCodes]);
    },
    async listStalePendingBookingCodes(shopCode) {
        const [rows] = await query_1.default.query(`SELECT BookingCode
         FROM Bookings
         WHERE BookingStatus = 'pending'
           AND TIMESTAMPDIFF(MINUTE, CreateAt, NOW()) > 10
           AND FieldCode IN (SELECT FieldCode FROM Fields WHERE ShopCode = ?)`, [shopCode]);
        return rows
            .map((row) => Number(row.BookingCode))
            .filter((code) => Number.isFinite(code) && code > 0);
    },
};
exports.default = bookingModel;
