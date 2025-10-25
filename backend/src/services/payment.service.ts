import ApiError from "../utils/apiErrors";
import { StatusCodes } from "http-status-codes";
import paymentModel from "../models/payment.model";
import { sendBookingConfirmationEmail } from "./mail.service";

const PLATFORM_FEE_PERCENT = 5; // 5% admin fee
const VALID_PAYMENT_METHODS = ["bank_transfer", "card", "ewallet", "cash"] as const;

type PaymentMethod = (typeof VALID_PAYMENT_METHODS)[number];

function extractBookingCode(raw: string | number): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  const matched = String(raw ?? "")
    .trim()
    .match(/(\d+)/);
  if (!matched || !matched[1]) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "BookingCode format không hợp lệ"
    );
  }
  const numeric = Number(matched[1]);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "BookingCode format không hợp lệ"
    );
  }
  return numeric;
}

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
 * Validate payment method
 */
export function validatePaymentMethod(method: string): boolean {
  return VALID_PAYMENT_METHODS.includes(method as PaymentMethod);
}

/**
 * Find booking by code - gọi model
 */
export async function findBookingByCode(bookingCode: string | number) {
  const numericMatch = String(bookingCode).match(/(\d+)/);
  if (!numericMatch) {
    return null;
  }
  const numCode = Number(numericMatch[1]);
  
  // Use paymentModel to get booking with shop info
  return await paymentModel.getBookingWithShop(numCode);
}

/**
 * Get admin bank account (default) - gọi model
 */
export async function getDefaultAdminBankAccount() {
  // Use paymentModel to get default admin bank account
  return await paymentModel.getDefaultAdminBankAccount();
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

/**
 * Lấy trạng thái thanh toán theo booking
 */
export async function getPaymentStatusByBooking(
  bookingCodeInput: string | number
) {
  const bookingCode = extractBookingCode(bookingCodeInput);
  const payment = await paymentModel.getByBookingCode(bookingCode);

  if (!payment) {
    const bookingStatus = await paymentModel.getBookingStatus(bookingCode);
    if (!bookingStatus) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
    }

    return {
      message: "Lấy trạng thái thanh toán thành công (pending)",
      payload: {
        paymentID: null,
        bookingCode,
        bookingId: bookingCode,
        amount: bookingStatus.TotalPrice,
        status: bookingStatus.PaymentStatus || "pending",
        paidAt: null,
      },
    };
  }

  return {
    message: "Lấy trạng thái thanh toán thành công",
    payload: {
      paymentID: payment.PaymentID,
      bookingCode,
      bookingId: bookingCode,
      amount: payment.Amount,
      status: payment.PaymentStatus,
      paidAt: payment.PaidAt || null,
    },
  };
}

/**
 * Kiểm tra thanh toán đã hoàn tất chưa
 */
export async function verifyPaymentStatus(bookingCodeInput: string | number) {
  const bookingCode = extractBookingCode(bookingCodeInput);
  const payment = await paymentModel.getByBookingCode(bookingCode);

  if (!payment) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payment");
  }

  if (payment.PaymentStatus === "paid") {
    return {
      message: "Thanh toán đã hoàn tất",
      payload: {
        paymentID: payment.PaymentID,
        bookingCode,
        status: "paid" as const,
        message: "Thanh toán đã được xác nhận",
      },
    };
  }

  const hasWebhook = await paymentModel.hasPaymentLog(
    payment.PaymentID,
    "sepay_webhook"
  );

  if (hasWebhook) {
    return {
      message: "Thanh toán đã thành công",
      payload: {
        paymentID: payment.PaymentID,
        bookingCode,
        status: "paid" as const,
        message: "Thanh toán đã được xác nhận từ SePay",
      },
    };
  }

  return {
    message: "Chờ xác nhận thanh toán",
    payload: {
      paymentID: payment.PaymentID,
      bookingCode,
      status: "pending" as const,
      message:
        "Vui lòng quét mã QR để chuyển tiền. Hệ thống sẽ tự động cập nhật khi nhận được tiền.",
    },
  };
}

function buildBookingCandidates(...texts: Array<string | undefined>): number[] {
  const collected: number[] = [];
  const unique = new Set<number>();
  texts.forEach((value) => {
    if (!value) return;
    const normalized = String(value);
    const match = normalized.match(/BK[-_]?(\d+)/i);
    if (match?.[1]) {
      const code = Number(match[1]);
      if (Number.isFinite(code) && code > 0 && !unique.has(code)) {
        unique.add(code);
        collected.push(code);
      }
    }
    const fallback = normalized.match(/(\d{1,9})/);
    if (fallback?.[1]) {
      const code = Number(fallback[1]);
      if (Number.isFinite(code) && code > 0 && !unique.has(code)) {
        unique.add(code);
        collected.push(code);
      }
    }
  });
  return collected;
}

type SepayWebhookPayload = {
  id?: string | number;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  transferType?: string;
  transferAmount?: string | number;
  accumulated?: unknown;
  code?: string;
  content?: string;
  subAccount?: unknown;
  referenceCode?: string;
  description?: string;
  des?: string;
};

function isIncomingTransfer(value?: string) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    ["in", "incoming", "credit"].includes(normalized) ||
    normalized.includes("transfer_in") ||
    normalized.includes("nap")
  );
}

function normalizeTransferAmount(
  amount: string | number | undefined
): number | null {
  if (typeof amount === "number") {
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }
  if (typeof amount === "string") {
    const cleaned = Number(amount.replace(/[^\d.-]/g, ""));
    return Number.isFinite(cleaned) && cleaned > 0 ? cleaned : null;
  }
  return null;
}

/**
 * Xử lý webhook từ SePay
 */
export async function handleSepayWebhook(payload: SepayWebhookPayload) {
  const {
    id,
    transferType,
    transferAmount,
    content,
    code,
    description,
    des,
    referenceCode,
  } = payload || {};

  const transactionId = String(id ?? "");
  const incoming = isIncomingTransfer(transferType);
  const amountValue = normalizeTransferAmount(transferAmount);

  try {
    if (transactionId) {
      const duplicate = await paymentModel.hasPaymentLogByTransaction(
        "sepay_webhook",
        transactionId
      );
      if (duplicate) {
        return {
          message: "SePay webhook already processed",
          payload: { success: true, duplicate: true },
        };
      }
    }

    const candidates = buildBookingCandidates(
      content,
      code,
      description,
      des,
      referenceCode
    );

    let matchedPayment =
      (await Promise.all(
        candidates.map((candidate) =>
          paymentModel.getByBookingCode(candidate).then((payment) => ({
            candidate,
            payment,
          }))
        )
      ).then((results) =>
        results.find((item) => item.payment)?.payment ?? null
      )) || null;

    if (!matchedPayment && incoming && amountValue) {
      matchedPayment = await paymentModel.findPendingPaymentByAmount(
        amountValue
      );
    }

    if (matchedPayment) {
      await paymentModel.logAction(
        matchedPayment.PaymentID,
        "sepay_webhook",
        payload,
        { status: "processing" },
        transactionId,
        0,
        "OK"
      );

      if (incoming) {
        try {
          await paymentModel.updateStatus(
            matchedPayment.PaymentID,
            "paid",
            transactionId
          );
          const result = await handlePaymentSuccess(
            matchedPayment.PaymentID
          );
          await paymentModel.logAction(
            matchedPayment.PaymentID,
            "payment_success",
            { id: transactionId, transferAmount },
            result,
            transactionId,
            0,
            "Success"
          );
          return {
            message: "SePay payment confirmed",
            payload: { success: true, matched: true },
          };
        } catch (error) {
          return {
            message: "SePay webhook processed with update error",
            payload: {
              success: true,
              matched: true,
              error: (error as Error)?.message,
            },
          };
        }
      }

      return {
        message: "SePay webhook processed",
        payload: { success: true, matched: true },
      };
    }

    return {
      message: "SePay webhook received - no matching payment",
      payload: { success: true, matched: false },
    };
  } catch (error) {
    return {
      message: "SePay webhook received",
      payload: { success: true, error: (error as Error)?.message },
    };
  }
}

/**
 * Lấy thông tin kết quả thanh toán
 */
export async function getPaymentResultData(
  bookingCodeInput: string | number
) {
  const bookingCode = extractBookingCode(bookingCodeInput);
  const payment = await paymentModel.getByBookingCode(bookingCode);

  if (!payment) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payment");
  }

  const booking = await paymentModel.getBookingForResult(bookingCode);
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
  }

  const slots = await paymentModel.listSlotsByBooking(bookingCode);

  return {
    message: "Lấy kết quả thanh toán thành công",
    payload: {
      booking_code: bookingCode,
      transaction_id:
        payment.TransactionCode || `TX-${payment.PaymentID}`,
      payment_status: payment.PaymentStatus,
      field_code: booking.FieldCode,
      field_name: booking.FieldName,
      total_price: payment.Amount,
      slots: slots.map((slot) => ({
        slot_id: slot.slot_id,
        play_date: slot.play_date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        quantity_id: slot.quantity_id ?? null,
      })),
      payment_method: payment.PaymentMethod,
      paid_at: payment.PaidAt,
    },
  };
}

const paymentService = {
  calculateFees,
  validatePaymentMethod,
  findBookingByCode,
  getDefaultAdminBankAccount,
  initiatePayment,
  getPaymentByID,
  getPaymentByBookingCode,
  updatePaymentStatus,
  handlePaymentSuccess,
  logPaymentAction,
  releaseHeldSlots,
  getPaymentStatusByBooking,
  verifyPaymentStatus,
  handleSepayWebhook,
  getPaymentResultData,
};

export default paymentService;
