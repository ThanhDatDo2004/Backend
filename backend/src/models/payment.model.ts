import type { ResultSetHeader, RowDataPacket } from "mysql2";
import queryService from "../services/query";

// ============ TYPES ============
export type PaymentRow = {
  PaymentID: number;
  BookingCode: string;
  AdminBankID?: number;
  PaymentMethod: string;
  Amount: number;
  PaymentStatus: "pending" | "paid" | "failed" | "refunded";
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
    adminBankID: number,
    paymentMethod: string = "bank_transfer"
  ): Promise<PaymentRow> {
    const [result] = await queryService.query<ResultSetHeader>(
      `INSERT INTO Payments_Admin (
        BookingCode,
        AdminBankID,
        PaymentMethod,
        Amount,
        PaymentStatus,
        CreateAt
      ) VALUES (?, ?, ?, ?, 'pending', NOW())`,
      [bookingCode, adminBankID, paymentMethod, totalPrice]
    );

    return {
      PaymentID: Number(result.insertId),
      BookingCode: String(bookingCode),
      AdminBankID: adminBankID,
      PaymentMethod: paymentMethod,
      Amount: totalPrice,
      PaymentStatus: "pending",
    };
  },

  /**
   * Get payment by ID
   */
  async getById(paymentID: number): Promise<PaymentRow | null> {
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
  ): Promise<PaymentRow | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT * FROM Payments_Admin WHERE MomoTransactionID = ?`,
      [momoTransactionID]
    );

    return rows?.[0] || null;
  },

  /**
   * Get payment by MomoOrderId
   */
  async getByMomoOrderId(momoOrderId: string): Promise<PaymentRow | null> {
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
  ): Promise<PaymentRow | null> {
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

  /**
   * Get default admin bank account
   */
  async getDefaultAdminBank(): Promise<{ AdminBankID: number } | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT AdminBankID FROM Admin_Bank_Accounts WHERE IsDefault = 'Y' LIMIT 1`,
      []
    );

    return rows?.[0] || null;
  },
};

export default paymentModel;
