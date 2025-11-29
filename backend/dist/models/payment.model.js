"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const query_1 = __importDefault(require("../services/query"));
// ============ PAYMENT MODEL ============
const paymentModel = {
    /**
     * Insert new payment
     */
    async create(bookingCode, totalPrice, paymentMethod = "bank_transfer") {
        const [result] = await query_1.default.query(`INSERT INTO Payments_Admin (
        BookingCode,
        PaymentMethod,
        Amount,
        PaymentStatus,
        CreateAt
      ) VALUES (?, ?, ?, 'pending', NOW())`, [bookingCode, paymentMethod, totalPrice]);
        return {
            PaymentID: Number(result.insertId),
            BookingCode: String(bookingCode),
            PaymentMethod: paymentMethod,
            Amount: totalPrice,
            PaymentStatus: "pending",
        };
    },
    /**
     * Get payment by ID
     */
    async getById(paymentID) {
        const [rows] = await query_1.default.query(`SELECT * FROM Payments_Admin WHERE PaymentID = ?`, [paymentID]);
        return rows?.[0] || null;
    },
    /**
     * Get payment by MomoTransactionID
     */
    async getByMomoTransactionID(momoTransactionID) {
        const [rows] = await query_1.default.query(`SELECT * FROM Payments_Admin WHERE MomoTransactionID = ?`, [momoTransactionID]);
        return rows?.[0] || null;
    },
    /**
     * Get payment by MomoOrderId
     */
    async getByMomoOrderId(momoOrderId) {
        const [rows] = await query_1.default.query(`SELECT * FROM Payments_Admin WHERE MomoOrderId = ?`, [momoOrderId]);
        return rows?.[0] || null;
    },
    /**
     * Get payment by booking code
     */
    async getByBookingCode(bookingCode) {
        const [rows] = await query_1.default.query(`SELECT * FROM Payments_Admin WHERE BookingCode = ? ORDER BY UpdateAt DESC, PaymentID DESC LIMIT 1`, [bookingCode]);
        return rows?.[0] || null;
    },
    /**
     * Update payment status
     */
    async updateStatus(paymentID, status, momoTransactionID, momoRequestID) {
        const [result] = await query_1.default.query(`UPDATE Payments_Admin
       SET PaymentStatus = ?,
           MomoTransactionID = COALESCE(?, MomoTransactionID),
           MomoRequestID = COALESCE(?, MomoRequestID),
           PaidAt = NOW(),
           UpdateAt = NOW()
       WHERE PaymentID = ?`, [status, momoTransactionID || null, momoRequestID || null, paymentID]);
        return result.affectedRows > 0;
    },
    /**
     * Get booking info for payment
     */
    async getBookingInfoByPaymentId(paymentID) {
        const [rows] = await query_1.default.query(`SELECT 
         b.BookingStatus,
         b.FieldCode,
         f.ShopCode,
         b.CustomerEmail,
         b.CustomerName,
         b.CheckinCode,
         f.FieldName,
         b.BookingCode
       FROM Bookings b
       JOIN Fields f ON b.FieldCode = f.FieldCode
       JOIN Payments_Admin p ON b.BookingCode = p.BookingCode
       WHERE p.PaymentID = ?`, [paymentID]);
        return rows?.[0] || null;
    },
    /**
     * Update booking status to confirmed
     */
    async confirmBooking(bookingCode, paymentID) {
        await query_1.default.execQuery(`UPDATE Bookings 
       SET BookingStatus = 'confirmed',
           PaymentStatus = 'paid',
           PaymentID = COALESCE(PaymentID, ?),
           UpdateAt = NOW()
       WHERE BookingCode = ?`, [paymentID, bookingCode]);
    },
    /**
     * Update booking slots to booked
     */
    async updateBookingSlotsToBooked(bookingCode) {
        await query_1.default.execQuery(`UPDATE Booking_Slots 
       SET Status = 'booked', UpdateAt = NOW()
       WHERE BookingCode = ? AND Status = 'pending'`, [bookingCode]);
    },
    /**
     * Update field slots to booked
     */
    async updateFieldSlotsToBooked(bookingCode) {
        await query_1.default.execQuery(`UPDATE Field_Slots 
       SET Status = 'booked', HoldExpiresAt = NULL, UpdateAt = NOW()
       WHERE BookingCode = ? AND Status = 'held'`, [bookingCode]);
    },
    /**
     * Get payment amount for fee calculation
     */
    async getPaymentAmount(paymentID) {
        const [rows] = await query_1.default.query(`SELECT Amount FROM Payments_Admin WHERE PaymentID = ?`, [paymentID]);
        return rows?.[0]?.Amount || null;
    },
    async getBookingOwnershipInfo(bookingCode) {
        const [rows] = await query_1.default.query(`SELECT 
        b.BookingCode,
        b.CustomerUserID,
        b.TotalPrice,
        b.PaymentStatus,
        s.UserID AS ShopOwnerUserID
       FROM Bookings b
       JOIN Fields f ON b.FieldCode = f.FieldCode
       JOIN Shops s ON f.ShopCode = s.ShopCode
       WHERE b.BookingCode = ?
       LIMIT 1`, [bookingCode]);
        return rows?.[0] || null;
    },
    async hasPaymentLog(paymentID, action, externalId) {
        const params = [paymentID, action];
        let query = `SELECT LogID FROM Payment_Logs WHERE PaymentID = ? AND Action = ?`;
        if (externalId) {
            query += ` AND MomoTransactionID = ?`;
            params.push(externalId);
        }
        query += ` LIMIT 1`;
        const [rows] = await query_1.default.query(query, params);
        return Boolean(rows?.[0]);
    },
    async hasWebhookLogByExternalId(action, externalId) {
        const [rows] = await query_1.default.query(`SELECT LogID FROM Payment_Logs WHERE Action = ? AND MomoTransactionID = ? LIMIT 1`, [action, externalId]);
        return Boolean(rows?.[0]);
    },
    async findPendingPaymentByAmount(amount) {
        const [rows] = await query_1.default.query(`SELECT * FROM Payments_Admin 
       WHERE PaymentStatus = 'pending' AND Amount = ? 
       ORDER BY CreateAt DESC LIMIT 1`, [amount]);
        return rows?.[0] || null;
    },
    async getBookingDetailWithOwner(bookingCode) {
        const [rows] = await query_1.default.query(`SELECT b.*, f.ShopCode, f.FieldCode, f.FieldName, s.UserID AS ShopOwnerUserID
       FROM Bookings b
       JOIN Fields f ON b.FieldCode = f.FieldCode
       JOIN Shops s ON f.ShopCode = s.ShopCode
       WHERE b.BookingCode = ?`, [bookingCode]);
        return rows?.[0] || null;
    },
    async getFieldSlotsForBooking(bookingCode) {
        const [rows] = await query_1.default.query(`SELECT SlotID, FieldCode, PlayDate, StartTime, EndTime
       FROM Field_Slots
       WHERE BookingCode = ?
       ORDER BY PlayDate, StartTime`, [bookingCode]);
        return rows || [];
    },
    /**
     * Insert wallet credit (shop wallet)
     */
    async creditShopWallet(shopCode, amount) {
        await query_1.default.execQuery(`INSERT INTO Shop_Wallets (ShopCode, Balance, CreateAt, UpdateAt)
       VALUES (?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE 
         Balance = Balance + ?,
         UpdateAt = NOW()`, [shopCode, amount, amount]);
    },
    async debitShopWallet(shopCode, amount) {
        await query_1.default.execQuery(`INSERT INTO Shop_Wallets (ShopCode, Balance, CreateAt, UpdateAt)
       VALUES (?, GREATEST(0, ?), NOW(), NOW())
       ON DUPLICATE KEY UPDATE 
         Balance = GREATEST(0, Balance - ?),
         UpdateAt = NOW()`, [shopCode, 0, amount]);
    },
    /**
     * Increment field rent count
     */
    async incrementFieldRent(fieldCode) {
        await query_1.default.execQuery(`UPDATE Fields
       SET Rent = Rent + 1,
           UpdateAt = NOW()
       WHERE FieldCode = ?`, [fieldCode]);
    },
    /**
     * Create wallet transaction log
     */
    async createWalletTransaction(shopCode, bookingCode, type, amount, note, status = "completed") {
        await query_1.default.execQuery(`INSERT INTO Wallet_Transactions (
        ShopCode,
        BookingCode,
        Type,
        Amount,
        Note,
        Status,
        CreateAt
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`, [shopCode, bookingCode, type, amount, note, status]);
    },
    /**
     * Get first booking slot info for email
     */
    async getBookingSlotForEmail(bookingCode) {
        const [rows] = await query_1.default.query(`SELECT b.BookingCode, b.CustomerEmail, b.CustomerName, b.CheckinCode,
              f.FieldName, 
              DATE_FORMAT(bs.PlayDate, '%Y-%m-%d') as PlayDate,
              DATE_FORMAT(bs.StartTime, '%H:%i') as StartTime,
              DATE_FORMAT(bs.EndTime, '%H:%i') as EndTime
       FROM Bookings b
       JOIN Fields f ON b.FieldCode = f.FieldCode
       JOIN Booking_Slots bs ON b.BookingCode = bs.BookingCode
       WHERE b.BookingCode = ?
       ORDER BY bs.PlayDate, bs.StartTime
       LIMIT 1`, [bookingCode]);
        return rows?.[0] || null;
    },
    /**
     * Log payment action
     */
    async logAction(paymentID, action, requestData, responseData, momoTransactionID, resultCode, resultMessage) {
        await query_1.default.execQuery(`INSERT INTO Payment_Logs (
        PaymentID,
        Action,
        RequestData,
        ResponseData,
        MomoTransactionID,
        ResultCode,
        ResultMessage,
        CreateAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`, [
            paymentID,
            action,
            requestData ? JSON.stringify(requestData) : null,
            responseData ? JSON.stringify(responseData) : null,
            momoTransactionID || null,
            resultCode || null,
            resultMessage || null,
        ]);
    },
};
exports.default = paymentModel;
