import { RowDataPacket, ResultSetHeader } from "mysql2";
import queryService from "./query";
import ApiError from "../utils/apiErrors";
import { StatusCodes } from "http-status-codes";

const PLATFORM_FEE_PERCENT = 5; // 5% admin fee
const SHOP_EARNING_PERCENT = 95; // 95% shop earning

/**
 * Tính toán phí và số tiền shop nhận
 */
export function calculateFees(totalPrice: number) {
  const platformFee = parseFloat(
    ((totalPrice * PLATFORM_FEE_PERCENT) / 100).toFixed(2)
  );
  const netToShop = parseFloat((totalPrice - platformFee).toFixed(2));
  return {
    totalPrice: parseFloat(totalPrice.toFixed(2)),
    platformFee,
    netToShop,
  };
}

/**
 * Tạo payment record khi khách chọn thanh toán
 */
export async function initiatePayment(
  bookingCode: string | number,
  totalPrice: number,
  adminBankID: number,
  paymentMethod: string = "bank_transfer"
) {
  const fees = calculateFees(totalPrice);

  const [result] = await queryService.query<ResultSetHeader>(
    `INSERT INTO Payments_Admin (
      BookingCode,
      AdminBankID,
      PaymentMethod,
      Amount,
      PaymentStatus,
      CreateAt
    ) VALUES (?, ?, ?, ?, 'pending', NOW())`,
    [bookingCode, adminBankID, paymentMethod, fees.totalPrice]
  );

  return {
    paymentID: result.insertId,
    bookingCode,
    amount: fees.totalPrice,
    platformFee: fees.platformFee,
    netToShop: fees.netToShop,
    paymentStatus: "pending",
  };
}

/**
 * Lấy chi tiết payment
 */
export async function getPaymentByID(paymentID: number) {
  const [rows] = await queryService.query<RowDataPacket[]>(
    `SELECT * FROM Payments_Admin WHERE PaymentID = ?`,
    [paymentID]
  );

  return rows?.[0] || null;
}

/**
 * Tìm payment bằng MomoTransactionID (transId từ webhook)
 */
export async function getPaymentByMomoTransactionID(momoTransactionID: string) {
  const [rows] = await queryService.query<RowDataPacket[]>(
    `SELECT * FROM Payments_Admin WHERE MomoTransactionID = ?`,
    [momoTransactionID]
  );

  return rows?.[0] || null;
}

/**
 * Tìm payment bằng MomoOrderId (orderId từ Momo)
 */
export async function getPaymentByMomoOrderId(momoOrderId: string) {
  const [rows] = await queryService.query<RowDataPacket[]>(
    `SELECT * FROM Payments_Admin WHERE MomoOrderId = ?`,
    [momoOrderId]
  );

  return rows?.[0] || null;
}

/**
 * Lấy payment từ booking
 */
export async function getPaymentByBookingCode(bookingCode: string | number) {
  const [rows] = await queryService.query<RowDataPacket[]>(
    `SELECT * FROM Payments_Admin WHERE BookingCode = ? ORDER BY UpdateAt DESC, PaymentID DESC LIMIT 1`,
    [bookingCode]
  );
  return rows?.[0] || null;
}

/**
 * Cập nhật payment status từ webhook Momo
 */
export async function updatePaymentStatus(
  paymentID: number,
  status: "paid" | "failed" | "refunded",
  momoTransactionID?: string,
  momoRequestID?: string
) {
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
}

/**
 * Xử lý payment success - cập nhật wallet + booking status
 */
export async function handlePaymentSuccess(paymentID: number) {
  // Lấy payment + booking info
  const payment = await getPaymentByID(paymentID);
  if (!payment) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payment");
  }

  // Cập nhật payment status
  await updatePaymentStatus(paymentID, "paid");

  // Cập nhật booking status
  await queryService.query<ResultSetHeader>(
    `UPDATE Bookings 
     SET BookingStatus = 'confirmed',
         PaymentStatus = 'paid',
         PaymentID = COALESCE(PaymentID, ?),
         UpdateAt = NOW()
     WHERE BookingCode = ?`,
    [paymentID, payment.BookingCode]
  );

  // Lock slots - change status from 'hold' to 'booked'
  await queryService.query<ResultSetHeader>(
    `UPDATE Field_Slots 
     SET Status = 'booked', HoldExpiresAt = NULL, UpdateAt = NOW()
     WHERE BookingCode = ? AND Status = 'hold'`,
    [payment.BookingCode]
  );

  // Lấy booking để tính netToShop
  const [bookingRows] = await queryService.query<RowDataPacket[]>(
    `SELECT ShopCode FROM (
       SELECT f.ShopCode FROM Bookings b
       JOIN Fields f ON b.FieldCode = f.FieldCode
       WHERE b.BookingCode = ?
     ) AS booking`,
    [payment.BookingCode]
  );

  if (!bookingRows?.[0]) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
  }

  const shopCode = bookingRows[0].ShopCode;
  const fees = calculateFees(payment.Amount);

  // Cập nhật wallet shop
  await queryService.query<ResultSetHeader>(
    `INSERT INTO Shop_Wallets (ShopCode, Balance, CreateAt, UpdateAt)
     VALUES (?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE 
       Balance = Balance + ?,
       UpdateAt = NOW()`,
    [shopCode, fees.netToShop, fees.netToShop]
  );

  // Tạo wallet transaction
  await queryService.query<ResultSetHeader>(
    `INSERT INTO Wallet_Transactions (
      ShopCode,
      BookingCode,
      Type,
      Amount,
      Note,
      Status,
      CreateAt
    ) VALUES (?, ?, 'credit_settlement', ?, 'Payment from booking', 'completed', NOW())`,
    [shopCode, payment.BookingCode, fees.netToShop]
  );

  return {
    success: true,
    paymentID,
    bookingCode: payment.BookingCode,
    amountToPay: fees.totalPrice,
    platformFee: fees.platformFee,
    netToShop: fees.netToShop,
  };
}

/**
 * Lưu log payment (từ webhook)
 */
export async function logPaymentAction(
  paymentID: number,
  action: string,
  requestData?: any,
  responseData?: any,
  momoTransactionID?: string,
  resultCode?: number,
  resultMessage?: string
) {
  await queryService.query<ResultSetHeader>(
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
}

/**
 * Release held slots when payment fails or hold expires
 */
export async function releaseHeldSlots(bookingCode: string | number) {
  await queryService.query<ResultSetHeader>(
    `UPDATE Field_Slots 
     SET Status = 'available', BookingCode = NULL, HoldExpiresAt = NULL, UpdateAt = NOW()
     WHERE BookingCode = ? AND Status = 'hold'`,
    [bookingCode]
  );
}

const paymentService = {
  calculateFees,
  initiatePayment,
  getPaymentByID,
  getPaymentByBookingCode,
  updatePaymentStatus,
  handlePaymentSuccess,
  logPaymentAction,
  releaseHeldSlots,
};

export default paymentService;
