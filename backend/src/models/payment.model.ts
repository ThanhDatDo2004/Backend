import type { ResultSetHeader, RowDataPacket } from "mysql2";
import queryService from "../core/database";
import { PAYMENT_QUERIES } from "../queries/payment.queries";

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
  TransactionCode?: string | null;
};

export interface BookingInfo extends RowDataPacket {
  BookingCode: string;
  FieldCode: number;
  ShopCode: number;
  Amount?: number;
  PaymentStatus?: string;
  [key: string]: any;
}

export interface BookingStatus extends RowDataPacket {
  BookingCode: number;
  TotalPrice: number;
  PaymentStatus: string;
}

export interface BookingSlotSummary extends RowDataPacket {
  slot_id: number;
  quantity_id: number | null;
  quantity_number: number | null;
  play_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

export interface BookingResultRow extends RowDataPacket {
  BookingCode: number;
  FieldCode: number;
  FieldName: string;
  ShopCode: number;
  TotalPrice: number;
  PaymentStatus: string;
}

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
      PAYMENT_QUERIES.CREATE_PAYMENT,
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
      PAYMENT_QUERIES.GET_PAYMENT_BY_ID,
      [paymentID]
    );

    return (rows?.[0] as PaymentRow) || null;
  },

  /**
   * Get payment by MomoTransactionID
   */
  async getByMomoTransactionID(
    momoTransactionID: string
  ): Promise<PaymentRow | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      PAYMENT_QUERIES.GET_PAYMENT_BY_MOMO_TRANSACTION,
      [momoTransactionID]
    );

    return (rows?.[0] as PaymentRow) || null;
  },

  /**
   * Get payment by MomoOrderId
   */
  async getByMomoOrderId(momoOrderId: string): Promise<PaymentRow | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      PAYMENT_QUERIES.GET_PAYMENT_BY_MOMO_ORDER,
      [momoOrderId]
    );

    return (rows?.[0] as PaymentRow) || null;
  },

  /**
   * Get payment by booking code
   */
  async getByBookingCode(
    bookingCode: string | number
  ): Promise<PaymentRow | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      PAYMENT_QUERIES.GET_PAYMENT_BY_BOOKING,
      [bookingCode]
    );

    return (rows?.[0] as PaymentRow) || null;
  },

  /**
   * Update payment status
   */
  async updateStatus(
    paymentID: number,
    status: "paid" | "failed" | "refunded",
    momoTransactionID?: string,
    momoRequestID?: string
  ) {
    await queryService.query<ResultSetHeader>(
      PAYMENT_QUERIES.UPDATE_PAYMENT_STATUS,
      [status, momoTransactionID || null, momoRequestID || null, paymentID]
    );
    return { PaymentID: paymentID, PaymentStatus: status };
  },

  /**
   * Get booking info by payment ID
   */
  async getBookingInfoByPaymentId(paymentID: number): Promise<BookingInfo | null> {
    const [rows] = await queryService.query<BookingInfo[]>(
      PAYMENT_QUERIES.GET_BOOKING_INFO_BY_PAYMENT,
      [paymentID]
    );

    return (rows?.[0] as BookingInfo) || null;
  },

  /**
   * Get booking with shop info
   */
  async getBookingWithShop(bookingCode: number): Promise<any | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      PAYMENT_QUERIES.GET_BOOKING_WITH_SHOP,
      [bookingCode]
    );

    return rows?.[0] || null;
  },

  /**
   * Get default admin bank account
   */
  async getDefaultAdminBankAccount(): Promise<number | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      PAYMENT_QUERIES.GET_DEFAULT_ADMIN_BANK,
      []
    );

    return rows?.[0]?.AdminBankID || null;
  },

  /**
   * Update booking status to confirmed
   */
  async confirmBooking(
    bookingCode: string | number,
    paymentID: number
  ): Promise<void> {
    await queryService.execQuery(PAYMENT_QUERIES.CONFIRM_BOOKING_STATUS, [
      paymentID,
      bookingCode,
    ]);
  },

  /**
   * Update booking slots to booked
   */
  async updateBookingSlotsToBooked(
    bookingCode: string | number
  ): Promise<void> {
    await queryService.execQuery(
      PAYMENT_QUERIES.UPDATE_BOOKING_SLOTS_TO_BOOKED,
      [bookingCode]
    );
  },

  /**
   * Update field slots to booked
   */
  async updateFieldSlotsToBooked(bookingCode: string | number): Promise<void> {
    await queryService.execQuery(
      PAYMENT_QUERIES.UPDATE_FIELD_SLOTS_TO_BOOKED,
      [bookingCode]
    );
  },

  /**
   * Get payment amount for fee calculation
   */
  async getPaymentAmount(paymentID: number): Promise<number | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      PAYMENT_QUERIES.GET_PAYMENT_AMOUNT,
      [paymentID]
    );

    return rows?.[0]?.Amount || null;
  },

  /**
   * Insert wallet credit (shop wallet)
   */
  async creditShopWallet(shopCode: number, amount: number): Promise<void> {
    await queryService.execQuery(PAYMENT_QUERIES.UPSERT_SHOP_WALLET, [
      shopCode,
      amount,
    ]);
  },

  /**
   * Increment field rent count
   */
  async incrementFieldRent(fieldCode: number): Promise<void> {
    await queryService.execQuery(PAYMENT_QUERIES.INCREMENT_FIELD_RENT, [
      fieldCode,
    ]);
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
    await queryService.execQuery(PAYMENT_QUERIES.CREATE_WALLET_TRANSACTION, [
      shopCode,
      bookingCode,
      type,
      amount,
      note,
      status,
    ]);
  },

  /**
   * Get first booking slot info for email
   */
  async getBookingSlotForEmail(bookingCode: string | number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      PAYMENT_QUERIES.GET_BOOKING_SLOT_FOR_EMAIL,
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
    await queryService.execQuery(PAYMENT_QUERIES.INSERT_PAYMENT_LOG, [
      paymentID,
      action,
      requestData ? JSON.stringify(requestData) : null,
      responseData ? JSON.stringify(responseData) : null,
      momoTransactionID || null,
      resultCode || null,
      resultMessage || null,
    ]);
  },

  /**
   * Lấy trạng thái thanh toán của booking
   */
  async getBookingStatus(
    bookingCode: number
  ): Promise<{ BookingCode: number; TotalPrice: number; PaymentStatus: string } | null> {
    const [rows] = await queryService.query<BookingStatus[]>(
      PAYMENT_QUERIES.GET_BOOKING_STATUS,
      [bookingCode]
    );
    const booking = rows?.[0];
    if (!booking) return null;
    return {
      BookingCode: Number(booking.BookingCode),
      TotalPrice: Number(booking.TotalPrice),
      PaymentStatus: booking.PaymentStatus,
    };
  },

  /**
   * Kiểm tra log thanh toán theo action + transaction
   */
  async hasPaymentLog(
    paymentId: number,
    action: string,
    momoTransactionId?: string
  ): Promise<boolean> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      PAYMENT_QUERIES.CHECK_PAYMENT_LOG_BY_ACTION,
      [paymentId, action]
    );
    return !!rows?.[0];
  },

  /**
   * Kiểm tra log theo transaction id
   */
  async hasPaymentLogByTransaction(
    action: string,
    momoTransactionId: string
  ): Promise<boolean> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      PAYMENT_QUERIES.CHECK_PAYMENT_LOG_BY_TRANSACTION,
      [action, momoTransactionId]
    );
    return !!rows?.[0];
  },

  /**
   * Tìm payment pending theo số tiền
   */
  async findPendingPaymentByAmount(
    amount: number
  ): Promise<PaymentRow | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      PAYMENT_QUERIES.FIND_PENDING_PAYMENT_BY_AMOUNT,
      [amount]
    );
    return (rows?.[0] as PaymentRow) || null;
  },

  /**
   * Lấy thông tin booking để trả kết quả thanh toán
   */
  async getBookingForResult(
    bookingCode: number
  ): Promise<BookingResultRow | null> {
    const [rows] = await queryService.query<BookingResultRow[]>(
      PAYMENT_QUERIES.GET_BOOKING_FOR_RESULT,
      [bookingCode]
    );
    return rows?.[0] || null;
  },

  /**
   * Lấy danh sách slot của booking
   */
  async listSlotsByBooking(
    bookingCode: number
  ): Promise<BookingSlotSummary[]> {
    const [rows] = await queryService.query<BookingSlotSummary[]>(
      PAYMENT_QUERIES.LIST_SLOTS_BY_BOOKING,
      [bookingCode]
    );
    return rows || [];
  },
};

export default paymentModel;
