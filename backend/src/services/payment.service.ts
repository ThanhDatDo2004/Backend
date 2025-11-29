import ApiError from "../utils/apiErrors";
import { StatusCodes } from "http-status-codes";
import paymentModel from "../models/payment.model";
import { sendBookingConfirmationEmail } from "./mail.service";
import cartService from "./cart.service";

const PLATFORM_FEE_PERCENT = 5;
const SHOP_EARNING_PERCENT = 95;

type PaymentRow = {
  PaymentID: number;
  BookingCode: number;
  Amount: number;
  PaymentStatus: string;
};

type BookingRow = {
  ShopCode: number;
  FieldCode: number;
  BookingStatus?: string;
};

/**
 * Tính toán phí
 */
export function calculateFees(totalPrice: number) {
  const platformFee = +(totalPrice * PLATFORM_FEE_PERCENT / 100).toFixed(2);
  const netToShop = +(totalPrice - platformFee).toFixed(2);

  return {
    totalPrice: +totalPrice.toFixed(2),
    platformFee,
    netToShop,
  };
}

/**
 * Tạo record payment
 */
export async function initiatePayment(
  bookingCode: string | number,
  totalPrice: number,
  paymentMethod: string = "bank_transfer"
) {
  const bCode = Number(bookingCode);

  if (!Number.isFinite(bCode)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "BookingCode không hợp lệ");
  }

  const fees = calculateFees(totalPrice);

  const payment = await paymentModel.create(
    bCode,
    fees.totalPrice,
    paymentMethod
  );

  return {
    paymentID: payment.PaymentID,
    bookingCode: bCode,
    amount: fees.totalPrice,
    platformFee: fees.platformFee,
    netToShop: fees.netToShop,
    paymentStatus: "pending",
  };
}

/**
 * Get payment info
 */
export async function getPaymentByID(paymentID: number) {
  return await paymentModel.getById(paymentID);
}

export async function getPaymentByBookingCode(bookingCode: string | number) {
  const code = Number(bookingCode);
  if (!Number.isFinite(code)) return null;
  return await paymentModel.getByBookingCode(code);
}

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
 * Payment Success
 */
export async function handlePaymentSuccess(paymentID: number) {
  const payment = (await paymentModel.getById(paymentID)) as PaymentRow | null;

  if (!payment) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payment");
  }

  const bookingInfo = (await paymentModel.getBookingInfoByPaymentId(
    paymentID
  )) as BookingRow | null;

  if (!bookingInfo) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
  }

  const wasAlreadyConfirmed = bookingInfo.BookingStatus === "confirmed";

  await paymentModel.updateStatus(paymentID, "paid");

  await paymentModel.confirmBooking(payment.BookingCode, paymentID);

  const bookingCodeNumeric = Number(payment.BookingCode);
  if (Number.isFinite(bookingCodeNumeric)) {
    await cartService.removeEntriesForBookings([bookingCodeNumeric]);
  }

  await paymentModel.updateBookingSlotsToBooked(payment.BookingCode);

  await paymentModel.updateFieldSlotsToBooked(payment.BookingCode);

  const fees = calculateFees(payment.Amount);

  await paymentModel.creditShopWallet(bookingInfo.ShopCode, fees.netToShop);

  if (!wasAlreadyConfirmed) {
    await paymentModel.incrementFieldRent(bookingInfo.FieldCode);
  }

  await paymentModel.createWalletTransaction(
    bookingInfo.ShopCode,
    payment.BookingCode,
    "credit_settlement",
    fees.netToShop,
    "Payment from booking"
  );

  // Email gửi sau thanh toán
  try {
    if (payment.BookingCode) {
      const bookingSlot = await paymentModel.getBookingSlotForEmail(
        payment.BookingCode
      );

      if (bookingSlot) {
        const playDateStr = new Date(bookingSlot.PlayDate).toLocaleDateString("vi-VN");
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
    }
  } catch (e) {
    console.error("Lỗi gửi email:", e);
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

export async function logPaymentAction(
  paymentID: number,
  action: string,
  requestData?: any,
  responseData?: any,
  momoTransactionID?: string,
  resultCode?: number,
  resultMessage?: string
) {
  return await paymentModel.logAction(
    paymentID,
    action,
    requestData,
    responseData,
    momoTransactionID,
    resultCode,
    resultMessage
  );
}

export async function getBookingOwnershipInfo(bookingCode: number) {
  return await paymentModel.getBookingOwnershipInfo(bookingCode);
}

export async function hasPaymentLog(paymentID: number, action: string, externalId?: string) {
  return await paymentModel.hasPaymentLog(paymentID, action, externalId);
}

export async function hasWebhookLogByExternalId(action: string, externalId: string) {
  return await paymentModel.hasWebhookLogByExternalId(action, externalId);
}

export async function findPendingPaymentByAmount(amount: number) {
  return await paymentModel.findPendingPaymentByAmount(amount);
}

export async function getBookingDetailWithOwner(bookingCode: number) {
  return await paymentModel.getBookingDetailWithOwner(bookingCode);
}

export async function getFieldSlotsForBooking(bookingCode: number) {
  return await paymentModel.getFieldSlotsForBooking(bookingCode);
}

const paymentService = {
  calculateFees,
  initiatePayment,
  getPaymentByID,
  getPaymentByBookingCode,
  updatePaymentStatus,
  handlePaymentSuccess,
  logPaymentAction,
  getBookingOwnershipInfo,
  hasPaymentLog,
  hasWebhookLogByExternalId,
  findPendingPaymentByAmount,
  getBookingDetailWithOwner,
  getFieldSlotsForBooking,
};

export default paymentService;
