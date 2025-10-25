import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import paymentService, {
  validatePaymentMethod,
} from "../services/payment.service";

const ensureBookingCode = (bookingCode?: string) => {
  if (!bookingCode) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "BookingCode là bắt buộc");
  }
  return bookingCode;
};

const paymentController = {
  /**
   * Khởi tạo thanh toán (không gọi Momo - chuẩn bị cho SePay)
   * POST /api/payments/bookings/:bookingCode/initiate
   */
  async initiatePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const bookingCode = ensureBookingCode(req.params.bookingCode);
      const { payment_method = "bank_transfer" } = req.body;

      if (!validatePaymentMethod(payment_method)) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "PaymentMethod phải là một trong: bank_transfer, card, ewallet, cash"
        );
      }

      const booking = await paymentService.findBookingByCode(bookingCode);
      if (!booking) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
      }

      if (booking.PaymentStatus === "paid") {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Booking đã thanh toán");
      }

      const adminBankID = await paymentService.getDefaultAdminBankAccount();
      if (!adminBankID) {
        throw new ApiError(
          StatusCodes.NOT_FOUND,
          "Chưa setup tài khoản ngân hàng admin"
        );
      }

      const result = await paymentService.initiatePayment(
        booking.BookingCode,
        booking.TotalPrice,
        adminBankID,
        payment_method
      );

      return apiResponse.success(
        res,
        result,
        "Thanh toán được khởi tạo",
        StatusCodes.CREATED
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Check trạng thái thanh toán
   * GET /api/payments/bookings/:bookingCode/status
   */
  async getPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const bookingCode = ensureBookingCode(req.params.bookingCode);
      const { payload, message } =
        await paymentService.getPaymentStatusByBooking(bookingCode);

      return apiResponse.success(res, payload, message, StatusCodes.OK);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Check payment status - wait for SePay webhook
   * GET /api/payments/bookings/:bookingCode/verify
   */
  async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const bookingCode = ensureBookingCode(req.params.bookingCode);
      const { payload, message } = await paymentService.verifyPaymentStatus(
        bookingCode
      );

      return apiResponse.success(res, payload, message, StatusCodes.OK);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Webhook callback từ SePay (thay thế Momo)
   * POST /api/payments/webhook/sepay
   */
  async sepayCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { payload, message } = await paymentService.handleSepayWebhook(
        req.body
      );
      return apiResponse.success(res, payload, message, StatusCodes.OK);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Lấy kết quả thanh toán (sau khi thanh toán hoàn tất)
   * GET /api/payments/result/:bookingCode
   */
  async getPaymentResult(req: Request, res: Response, next: NextFunction) {
    try {
      const bookingCode = ensureBookingCode(req.params.bookingCode);
      const { payload, message } = await paymentService.getPaymentResultData(
        bookingCode
      );

      return apiResponse.success(res, payload, message, StatusCodes.OK);
    } catch (error) {
      next(error);
    }
  },
};

export default paymentController;
