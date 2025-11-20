import type { ResultSetHeader, RowDataPacket } from "mysql2";
import queryService from "../services/query";

// ============ TYPES ============
// Thêm type PaymentDbRow = RowDataPacket, chỉnh Promise<PaymentRow | null> thành Promise<PaymentDbRow | null>

export type PaymentRow = {
  PaymentID?: number;
  BookingCode?: string;
  PaymentMethod?: string;
  Amount?: number;
  PaymentStatus?: "pending" | "paid" | "failed" | "refunded";
  MomoTransactionID?: string | null;
  MomoOrderId?: string | null;
  MomoRequestID?: string | null;
  CreateAt?: string | Date;
  UpdateAt?: string | Date;
  PaidAt?: string | Date | null;
};
type PaymentDbRow = RowDataPacket & {
  PaymentID?: number;
  BookingCode?: string;
  PaymentMethod?: string;
  Amount?: number;
  PaymentStatus?: "pending" | "paid" | "failed" | "refunded";
  MomoTransactionID?: string | null;
  MomoOrderId?: string | null;
  MomoRequestID?: string | null;
  CreateAt?: string | Date;
  UpdateAt?: string | Date;
  PaidAt?: string | Date | null;
};

// ============ PAYMENT MODEL ============
const paymentModel = {
  /**
   * Insert new payment
   */
  async create(
    bookingCode: string | number,
    totalPrice: number,
    paymentMethod: string = "bank_transfer"
  ): Promise<PaymentRow> {
    const [result] = await queryService.query<ResultSetHeader>(
      `INSERT INTO Payments_Admin (
        BookingCode,
        PaymentMethod,
        Amount,
        PaymentStatus,
        CreateAt
      ) VALUES (?, ?, ?, 'pending', NOW())`,
      [bookingCode, paymentMethod, totalPrice]
    );

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
  async getById(paymentID: number): Promise<PaymentDbRow | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT * FROM Payments_Admin WHERE PaymentID = ?`,
      [paymentID]
    );

    return rows?.[0] || null;
  },

  /**
   * Get payment by MomoTransactionID
   */
  async getByMomoTransactionID(
    momoTransactionID: string
  ): Promise<PaymentDbRow | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT * FROM Payments_Admin WHERE MomoTransactionID = ?`,
      [momoTransactionID]
    );

    return rows?.[0] || null;
  },

  /**
   * Get payment by MomoOrderId
   */
  async getByMomoOrderId(momoOrderId: string): Promise<PaymentDbRow | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT * FROM Payments_Admin WHERE MomoOrderId = ?`,
      [momoOrderId]
    );

    return rows?.[0] || null;
  },

  /**
   * Get payment by booking code
   */
  async getByBookingCode(
    bookingCode: string | number
  ): Promise<PaymentDbRow | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT * FROM Payments_Admin WHERE BookingCode = ? ORDER BY UpdateAt DESC, PaymentID DESC LIMIT 1`,
      [bookingCode]
    );

    return rows?.[0] || null;
  },

  /**
   * Update payment status
   */
  async updateStatus(
    paymentID: number,
    status: "paid" | "failed" | "refunded",
    momoTransactionID?: string,
    momoRequestID?: string
  ): Promise<boolean> {
    const [result] = await queryService.query<ResultSetHeader>(
      `UPDATE Payments_Admin
       SET PaymentStatus = ?,
           MomoTransactionID = COALESCE(?, MomoTransactionID),
           MomoRequestID = COALESCE(?, MomoRequestID),
           PaidAt = NOW(),
           UpdateAt = NOW()
       WHERE PaymentID = ?`,
      [status, momoTransactionID || null, momoRequestID || null, paymentID]
    );

    return result.affectedRows > 0;
  },

  /**
   * Get booking info for payment
   */
  async getBookingInfoByPaymentId(paymentID: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT 
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
       WHERE p.PaymentID = ?`,
      [paymentID]
    );

    return rows?.[0] || null;
  },

  /**
   * Update booking status to confirmed
   */
  async confirmBooking(
    bookingCode: string | number,
    paymentID: number
  ): Promise<void> {
    await queryService.execQuery(
      `UPDATE Bookings 
       SET BookingStatus = 'confirmed',
           PaymentStatus = 'paid',
           PaymentID = COALESCE(PaymentID, ?),
           UpdateAt = NOW()
       WHERE BookingCode = ?`,
      [paymentID, bookingCode]
    );
  },

  /**
   * Update booking slots to booked
   */
  async updateBookingSlotsToBooked(
    bookingCode: string | number
  ): Promise<void> {
    await queryService.execQuery(
      `UPDATE Booking_Slots 
       SET Status = 'booked', UpdateAt = NOW()
       WHERE BookingCode = ? AND Status = 'pending'`,
      [bookingCode]
    );
  },

  /**
   * Update field slots to booked
   */
  async updateFieldSlotsToBooked(bookingCode: string | number): Promise<void> {
    await queryService.execQuery(
      `UPDATE Field_Slots 
       SET Status = 'booked', HoldExpiresAt = NULL, UpdateAt = NOW()
       WHERE BookingCode = ? AND Status = 'held'`,
      [bookingCode]
    );
  },

  /**
   * Get payment amount for fee calculation
   */
  async getPaymentAmount(paymentID: number): Promise<number | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT Amount FROM Payments_Admin WHERE PaymentID = ?`,
      [paymentID]
    );

    return rows?.[0]?.Amount || null;
  },

  async getBookingOwnershipInfo(bookingCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT 
        b.BookingCode,
        b.CustomerUserID,
        b.TotalPrice,
        b.PaymentStatus,
        s.UserID AS ShopOwnerUserID
       FROM Bookings b
       JOIN Fields f ON b.FieldCode = f.FieldCode
       JOIN Shops s ON f.ShopCode = s.ShopCode
       WHERE b.BookingCode = ?
       LIMIT 1`,
      [bookingCode]
    );
    return rows?.[0] || null;
  },

  async hasPaymentLog(
    paymentID: number,
    action: string,
    externalId?: string | null
  ): Promise<boolean> {
    const params: any[] = [paymentID, action];
    let query = `SELECT LogID FROM Payment_Logs WHERE PaymentID = ? AND Action = ?`;
    if (externalId) {
      query += ` AND MomoTransactionID = ?`;
      params.push(externalId);
    }
    query += ` LIMIT 1`;

    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return Boolean(rows?.[0]);
  },

  async hasWebhookLogByExternalId(
    action: string,
    externalId: string
  ): Promise<boolean> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT LogID FROM Payment_Logs WHERE Action = ? AND MomoTransactionID = ? LIMIT 1`,
      [action, externalId]
    );
    return Boolean(rows?.[0]);
  },

  async findPendingPaymentByAmount(amount: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT * FROM Payments_Admin 
       WHERE PaymentStatus = 'pending' AND Amount = ? 
       ORDER BY CreateAt DESC LIMIT 1`,
      [amount]
    );
    return rows?.[0] || null;
  },

  async getBookingDetailWithOwner(bookingCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT b.*, f.ShopCode, f.FieldCode, f.FieldName, s.UserID AS ShopOwnerUserID
       FROM Bookings b
       JOIN Fields f ON b.FieldCode = f.FieldCode
       JOIN Shops s ON f.ShopCode = s.ShopCode
       WHERE b.BookingCode = ?`,
      [bookingCode]
    );
    return rows?.[0] || null;
  },

  async getFieldSlotsForBooking(bookingCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT SlotID, FieldCode, PlayDate, StartTime, EndTime
       FROM Field_Slots
       WHERE BookingCode = ?
       ORDER BY PlayDate, StartTime`,
      [bookingCode]
    );
    return rows || [];
  },

  /**
   * Insert wallet credit (shop wallet)
   */
  async creditShopWallet(shopCode: number, amount: number): Promise<void> {
    await queryService.execQuery(
      `INSERT INTO Shop_Wallets (ShopCode, Balance, CreateAt, UpdateAt)
       VALUES (?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE 
         Balance = Balance + ?,
         UpdateAt = NOW()`,
      [shopCode, amount, amount]
    );
  },

  async debitShopWallet(shopCode: number, amount: number): Promise<void> {
    await queryService.execQuery(
      `INSERT INTO Shop_Wallets (ShopCode, Balance, CreateAt, UpdateAt)
       VALUES (?, GREATEST(0, ?), NOW(), NOW())
       ON DUPLICATE KEY UPDATE 
         Balance = GREATEST(0, Balance - ?),
         UpdateAt = NOW()`,
      [shopCode, 0, amount]
    );
  },

  /**
   * Increment field rent count
   */
  async incrementFieldRent(fieldCode: number): Promise<void> {
    await queryService.execQuery(
      `UPDATE Fields
       SET Rent = Rent + 1,
           UpdateAt = NOW()
       WHERE FieldCode = ?`,
      [fieldCode]
    );
  },

  /**
   * Create wallet transaction log
   */
  async createWalletTransaction(
    shopCode: number,
    bookingCode: string | number,
    type: string,
    amount: number,
    note: string,
    status: string = "completed"
  ): Promise<void> {
    await queryService.execQuery(
      `INSERT INTO Wallet_Transactions (
        ShopCode,
        BookingCode,
        Type,
        Amount,
        Note,
        Status,
        CreateAt
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [shopCode, bookingCode, type, amount, note, status]
    );
  },

  /**
   * Get first booking slot info for email
   */
  async getBookingSlotForEmail(bookingCode: string | number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT b.BookingCode, b.CustomerEmail, b.CustomerName, b.CheckinCode,
              f.FieldName, 
              DATE_FORMAT(bs.PlayDate, '%Y-%m-%d') as PlayDate,
              DATE_FORMAT(bs.StartTime, '%H:%i') as StartTime,
              DATE_FORMAT(bs.EndTime, '%H:%i') as EndTime
       FROM Bookings b
       JOIN Fields f ON b.FieldCode = f.FieldCode
       JOIN Booking_Slots bs ON b.BookingCode = bs.BookingCode
       WHERE b.BookingCode = ?
       ORDER BY bs.PlayDate, bs.StartTime
       LIMIT 1`,
      [bookingCode]
    );

    return rows?.[0] || null;
  },

  /**
   * Log payment action
   */
  async logAction(
    paymentID: number,
    action: string,
    requestData?: any,
    responseData?: any,
    momoTransactionID?: string,
    resultCode?: number,
    resultMessage?: string
  ): Promise<void> {
    await queryService.execQuery(
      `INSERT INTO Payment_Logs (
        PaymentID,
        Action,
        RequestData,
        ResponseData,
        MomoTransactionID,
        ResultCode,
        ResultMessage,
        CreateAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        paymentID,
        action,
        requestData ? JSON.stringify(requestData) : null,
        responseData ? JSON.stringify(responseData) : null,
        momoTransactionID || null,
        resultCode || null,
        resultMessage || null,
      ]
    );
  },

};

export default paymentModel;
