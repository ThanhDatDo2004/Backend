import ApiError from "../utils/apiErrors";
import { StatusCodes } from "http-status-codes";
import paymentModel from "../models/payment.model";
import { sendBookingConfirmationEmail } from "./mail.service";
import cartService from "./cart.service";

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
  const payment = await paymentModel.create(
    bookingCode,
    fees.totalPrice,
    adminBankID,
    paymentMethod
  );

  return {
    paymentID: payment.PaymentID,
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
  return await paymentModel.getById(paymentID);
}

/**
 * Tìm payment bằng MomoTransactionID (transId từ webhook)
 */
export async function getPaymentByMomoTransactionID(momoTransactionID: string) {
  return await paymentModel.getByMomoTransactionID(momoTransactionID);
}

/**
 * Tìm payment bằng MomoOrderId (orderId từ Momo)
 */
export async function getPaymentByMomoOrderId(momoOrderId: string) {
  return await paymentModel.getByMomoOrderId(momoOrderId);
}

/**
 * Lấy payment từ booking
 */
export async function getPaymentByBookingCode(bookingCode: string | number) {
  return await paymentModel.getByBookingCode(bookingCode);
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
  return await paymentModel.updateStatus(
    paymentID,
    status,
    momoTransactionID,
    momoRequestID
  );
}

/**
 * Xử lý payment success - cập nhật wallet + booking status
 */
export async function handlePaymentSuccess(paymentID: number) {
  // Lấy payment info
  const payment = await paymentModel.getById(paymentID);
  if (!payment) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payment");
  }

  // Lấy booking info
  const bookingInfo = await paymentModel.getBookingInfoByPaymentId(paymentID);
  if (!bookingInfo) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
  }

  const wasAlreadyConfirmed = bookingInfo.BookingStatus === "confirmed";

  // Cập nhật payment status
  await paymentModel.updateStatus(paymentID, "paid");

  // Cập nhật booking status
  await paymentModel.confirmBooking(payment.BookingCode, paymentID);

  const bookingCodeNumeric = Number(payment.BookingCode);
  if (
    Number.isFinite(bookingCodeNumeric) &&
    bookingCodeNumeric > 0
  ) {
    await cartService.removeEntriesForBookings([bookingCodeNumeric]);
  }

  // Update Booking_Slots - change status from 'pending' to 'booked'
  await paymentModel.updateBookingSlotsToBooked(payment.BookingCode);

  // Lock Field_Slots - change status from 'held' to 'booked'
  await paymentModel.updateFieldSlotsToBooked(payment.BookingCode);

  // Lấy booking để tính netToShop
  const shopCode = bookingInfo.ShopCode;
  const fees = calculateFees(payment.Amount);

  // Cập nhật wallet shop
  await paymentModel.creditShopWallet(shopCode, fees.netToShop);

  // ✅ Increase field rent only if booking was not confirmed before
  if (!wasAlreadyConfirmed) {
    await paymentModel.incrementFieldRent(bookingInfo.FieldCode);
  }

  // Tạo wallet transaction
  await paymentModel.createWalletTransaction(
    shopCode,
    payment.BookingCode,
    "credit_settlement",
    fees.netToShop,
    "Payment from booking"
  );

  // Gửi email xác nhận đặt lịch
  if (payment.BookingCode) {
    try {
      const bookingSlot = await paymentModel.getBookingSlotForEmail(
        payment.BookingCode
      );

      if (bookingSlot) {
        const playDateStr = new Date(bookingSlot.PlayDate).toLocaleDateString(
          "vi-VN"
        );
        const timeSlot = `${bookingSlot.StartTime} - ${bookingSlot.EndTime}`;

        await sendBookingConfirmationEmail(
          bookingSlot.CustomerEmail,
          String(bookingSlot.BookingCode),
          bookingSlot.CheckinCode,
          bookingSlot.FieldName,
          playDateStr,
          timeSlot
        );
      }
    } catch (e) {
      console.error("Lỗi gửi email xác nhận:", e);
      // Không throw, tiếp tục xử lý
    }
  }

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
  await paymentModel.logAction(
    paymentID,
    action,
    requestData,
    responseData,
    momoTransactionID,
    resultCode,
    resultMessage
  );
}

/**
 * Release held slots when payment fails or hold expires
 */
export async function releaseHeldSlots(bookingCode: string | number) {
  // Note: This is handled by booking.model in the booking flow
  // But keeping it here for backward compatibility
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
