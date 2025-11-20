import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import paymentService from "../services/payment.service";

function resolveCurrentUser(req: Request) {
  const rawUser = (req as any).user ?? {};
  const userId = Number(
    rawUser.UserID ?? rawUser.user_id ?? rawUser.user_code ?? rawUser.id
  );
  const role = String(
    rawUser.role ?? rawUser.LevelType ?? rawUser.level_type ?? ""
  ).toLowerCase();
  return { userId, role };
}

function parseBookingCode(value: string): number | null {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }
  const match = String(value).match(/(\d+)/);
  if (match && match[1]) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function ensureBookingAccess(
  req: Request,
  booking: { CustomerUserID?: number | null; ShopOwnerUserID?: number | null }
) {
  const { userId, role } = resolveCurrentUser(req);

  if (role === "admin") {
    return;
  }

  if (!Number.isFinite(userId)) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Yêu cầu đăng nhập");
  }

  if (
    Number(booking.CustomerUserID) === userId ||
    Number(booking.ShopOwnerUserID) === userId
  ) {
    return;
  }

  throw new ApiError(
    StatusCodes.FORBIDDEN,
    "Bạn không có quyền truy cập thông tin thanh toán của booking này"
  );
}

const paymentController = {
  /**
   * Khởi tạo thanh toán (không gọi Momo - chuẩn bị cho SePay)
   * POST /api/payments/bookings/:bookingCode/initiate
   */
  async initiatePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { bookingCode } = req.params;
      const { payment_method = "bank_transfer" } = req.body;
      const userId = Number((req as any).user?.UserID);

      if (!bookingCode) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "BookingCode là bắt buộc")
        );
      }

      if (!Number.isFinite(userId) || userId <= 0) {
        return next(
          new ApiError(StatusCodes.UNAUTHORIZED, "Yêu cầu đăng nhập")
        );
      }

      // Validate payment method
      const validMethods = ["bank_transfer", "card", "ewallet", "cash"];
      if (!validMethods.includes(payment_method)) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            `PaymentMethod phải là một trong: ${validMethods.join(", ")}`
          )
        );
      }

      // Try to find existing booking by searchable identifier
      const normalizedCode = parseBookingCode(String(bookingCode));
      if (!normalizedCode) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "BookingCode format không hợp lệ"
          )
        );
      }

      const booking = await paymentService.getBookingDetailWithOwner(
        normalizedCode
      );

      if (!booking) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking")
        );
      }

      const customerUserId = Number(booking.CustomerUserID);
      const shopOwnerUserId = Number(booking.ShopOwnerUserID);

      if (customerUserId !== userId && shopOwnerUserId !== userId) {
        return next(
          new ApiError(
            StatusCodes.FORBIDDEN,
            "Bạn không có quyền thanh toán cho booking này"
          )
        );
      }

      // Kiểm tra booking chưa thanh toán
      if (booking.PaymentStatus === "paid") {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Booking đã thanh toán")
        );
      }

      // Tạo payment record với BookingCode thực (INT)
      const paymentInfo = await paymentService.initiatePayment(
        booking.BookingCode,
        booking.TotalPrice,
        payment_method
      );

      console.log("DEBUG initiatePayment:", {
        bookingCode: bookingCode,
        actualBookingCode: booking.BookingCode,
        booking: {
          BookingCode: booking.BookingCode,
          TotalPrice: booking.TotalPrice,
        },
        paymentInfo,
      });

      // Build SePay QR URL (FE can render this URL as <img src="..." />)
      const sepayAcc = process.env.SEPAY_ACC || "96247THUERE";
      const sepayBank = process.env.SEPAY_BANK || "BIDV";
      const amount = Number(booking.TotalPrice);
      const des = `BK${booking.BookingCode}`;
      const sepayQrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(
        sepayAcc
      )}&bank=${encodeURIComponent(sepayBank)}&amount=${encodeURIComponent(
        amount
      )}&des=${encodeURIComponent(des)}`;

      // Không gọi Momo nữa. Trả về thông tin để FE hiển thị QR SePay và chờ webhook
      return apiResponse.success(
        res,
        {
          paymentID: paymentInfo.paymentID,
          qr_code: sepayQrUrl,
          momo_url: null,
          amount: amount,
          expiresIn: 900,
          bookingId: booking.BookingCode,
          paymentMethod: payment_method,
          bankAccount: {
            bankName:
              process.env.SEPAY_BANK_NAME ||
              process.env.SEPAY_BANK ||
              "BIDV",
            accountNumber: process.env.SEPAY_ACC || "96247THUERE",
            accountHolder:
              process.env.SEPAY_ACC_HOLDER || "ThueRe Platform",
          },
        },
        "Khởi tạo thanh toán thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Không thể khởi tạo thanh toán"
        )
      );
    }
  },

  /**
   * Check trạng thái thanh toán
   * GET /api/payments/bookings/:bookingCode/status
   */
  async getPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { bookingCode } = req.params;

      if (!bookingCode) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "BookingCode là bắt buộc")
        );
      }

      const searchBookingCode = parseBookingCode(String(bookingCode));
      if (!searchBookingCode) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "BookingCode format không hợp lệ"
          )
        );
      }

      const bookingInfo =
        await paymentService.getBookingOwnershipInfo(searchBookingCode);
      if (!bookingInfo) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking")
        );
      }
      ensureBookingAccess(req, bookingInfo);

      // Lấy payment info
      let payment = await paymentService.getPaymentByBookingCode(
        searchBookingCode as any
      );

      // Nếu payment không tìm thấy (transaction chưa commit), fallback: lấy booking info
      if (!payment) {
        return apiResponse.success(
          res,
          {
            paymentID: null,
            bookingCode: searchBookingCode,
            bookingId: searchBookingCode,
            amount: bookingInfo.TotalPrice,
            status: bookingInfo.PaymentStatus || "pending",
            paidAt: null,
          },
          "Lấy trạng thái thanh toán thành công (pending)",
          StatusCodes.OK
        );
      }

      return apiResponse.success(
        res,
        {
          paymentID: payment.PaymentID,
          bookingCode: searchBookingCode,
          bookingId: searchBookingCode,
          amount: payment.Amount,
          status: payment.PaymentStatus,
          paidAt: payment.PaidAt || null,
        },
        "Lấy trạng thái thanh toán thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Không thể lấy trạng thái thanh toán"
        )
      );
    }
  },

  /**
   * Check payment status - wait for SePay webhook
   * GET /api/payments/bookings/:bookingCode/verify
   */
  async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { bookingCode } = req.params;

      if (!bookingCode) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "BookingCode là bắt buộc")
        );
      }

      const searchBookingCode = parseBookingCode(String(bookingCode));
      if (!searchBookingCode) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "BookingCode format không hợp lệ"
          )
        );
      }

      const bookingInfo =
        await paymentService.getBookingOwnershipInfo(searchBookingCode);
      if (!bookingInfo) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking")
        );
      }
      ensureBookingAccess(req, bookingInfo);

      // Get payment
      const payment = await paymentService.getPaymentByBookingCode(searchBookingCode as any);
      if (!payment) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payment")
        );
      }

      // If already paid, return success
      if (payment.PaymentStatus === "paid") {
        return apiResponse.success(
          res,
          {
            paymentID: payment.PaymentID,
            bookingCode: searchBookingCode,
            status: "paid",
            message: "Thanh toán đã được xác nhận"
          },
          "Thanh toán đã hoàn tất",
          StatusCodes.OK
        );
      }

      // Check if SePay webhook has been called
      const hasWebhookLog = await paymentService.hasPaymentLog(
        payment.PaymentID,
        "sepay_webhook"
      );

      if (hasWebhookLog) {
        // Webhook đã gọi, payment đã được update
        return apiResponse.success(
          res,
          {
            paymentID: payment.PaymentID,
            bookingCode: searchBookingCode,
            status: "paid",
            message: "Thanh toán đã được xác nhận từ SePay"
          },
          "Thanh toán thành công",
          StatusCodes.OK
        );
      }

      // Chưa nhận webhook
      return apiResponse.success(
        res,
        {
          paymentID: payment.PaymentID,
          bookingCode: searchBookingCode,
          status: "pending",
          message: "Vui lòng quét mã QR để chuyển tiền. Hệ thống sẽ tự động cập nhật khi nhận được tiền."
        },
        "Chờ xác nhận thanh toán",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Không thể kiểm tra thanh toán"
        )
      );
    }
  },

  /**
   * Webhook callback từ SePay (thay thế Momo)
   * POST /api/payments/webhook/sepay
   */
  async sepayCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        id,
        gateway,
        transactionDate,
        accountNumber,
        transferType,
        transferAmount,
        accumulated,
        code,
        content,
        subAccount,
        referenceCode,
        description,
        des,
      } = req.body || {};

      const normalizedTransferType =
        typeof transferType === "string"
          ? transferType.trim().toLowerCase()
          : "";
      const isIncomingTransfer =
        ["in", "incoming", "credit"].includes(normalizedTransferType) ||
        normalizedTransferType.includes("transfer_in") ||
        normalizedTransferType.includes("nap");
      const normalizedTransferAmount =
        typeof transferAmount === "string"
          ? Number(transferAmount.replace(/[^\d.-]/g, ""))
          : typeof transferAmount === "number"
          ? transferAmount
          : null;
      const transferAmountValue =
        typeof normalizedTransferAmount === "number" &&
        Number.isFinite(normalizedTransferAmount) &&
        normalizedTransferAmount > 0
          ? normalizedTransferAmount
          : null;

      // DEBUG: Log webhook received
      console.log("=== SePay Webhook Received ===");
      console.log("ID:", id);
      console.log("TransferType:", transferType);
      console.log("Amount:", transferAmountValue ?? transferAmount);
      console.log("Content:", content);
      console.log("Description:", description);
      console.log("Des:", des);
      console.log("ReferenceCode:", referenceCode);
      console.log("==============================");

      // Idempotency: nếu đã log id này rồi thì coi như xử lý xong
      try {
        const duplicate = await paymentService.hasWebhookLogByExternalId(
          "sepay_webhook",
          String(id)
        );
        if (duplicate) {
          return apiResponse.success(
            res,
            { duplicate: true },
            "SePay webhook already processed",
            StatusCodes.OK
          );
        }
      } catch (_) {}

      // Helper: extract booking code number
      const extractBK = (text?: string) => {
        if (!text || typeof text !== "string") return null;
        const m1 = text.match(/BK[-_]?(\d+)/i);
        if (m1 && m1[1]) return Number(m1[1]);
        const m2 = text.match(/(\d{1,9})/); // fallback: any digits
        if (m2 && m2[1]) return Number(m2[1]);
        return null;
      };

      const candidates: Array<number> = [];
      const candSet = new Set<number>();
      [content, code, description, des, referenceCode].forEach((t) => {
        const v = extractBK(t as any);
        if (typeof v === "number" && Number.isFinite(v)) {
          if (!candSet.has(v)) {
            candSet.add(v);
            candidates.push(v);
          }
        }
      });

      let payment: any = null;
      for (const c of candidates) {
        const p = await paymentService.getPaymentByBookingCode(c as any);
        if (p) {
          payment = p;
          break;
        }
      }

      // Fallback: match by amount to the most recent pending payment
      if (!payment && isIncomingTransfer && transferAmountValue) {
        try {
          const maybePayment = await paymentService.findPendingPaymentByAmount(
            transferAmountValue
          );
          if (maybePayment) {
            payment = maybePayment;
          }
        } catch (_) {}
      }

      // Log webhook (nếu có payment) để không lỗi FK
      if (payment) {
        await paymentService.logPaymentAction(
          payment.PaymentID,
          "sepay_webhook",
          req.body,
          { status: "processing" },
          String(id),
          0,
          "OK"
        );
      }

      // Nếu là giao dịch vào (in) và có mapping payment thì xác nhận thanh toán
      if (isIncomingTransfer && payment) {
        try {
          await paymentService.updatePaymentStatus(
            payment.PaymentID,
            "paid",
            String(id)
          );
          const result = await paymentService.handlePaymentSuccess(
            payment.PaymentID
          );
          await paymentService.logPaymentAction(
            payment.PaymentID,
            "payment_success",
            { id, transferAmount },
            result,
            String(id),
            0,
            "Success"
          );
          return apiResponse.success(
            res,
            { success: true, matched: true },
            "SePay payment confirmed",
            StatusCodes.OK
          );
        } catch (e) {
          return apiResponse.success(
            res,
            { success: true, matched: true, error: (e as Error)?.message },
            "SePay webhook processed with update error",
            StatusCodes.OK
          );
        }
      }

      // Không match được payment: vẫn trả success để tránh retry loop
      return apiResponse.success(
        res,
        { success: true, matched: !!payment },
        payment
          ? "SePay webhook processed"
          : "SePay webhook received - no matching payment",
        StatusCodes.OK
      );
    } catch (error) {
      return apiResponse.success(
        res,
        { success: true, error: (error as Error)?.message },
        "SePay webhook received",
        StatusCodes.OK
      );
    }
  },

  /**
   * Lấy kết quả thanh toán (sau khi thanh toán hoàn tất)
   * GET /api/payments/result/:bookingCode
   */
  async getPaymentResult(req: Request, res: Response, next: NextFunction) {
    try {
      const { bookingCode } = req.params;

      if (!bookingCode) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "BookingCode là bắt buộc")
        );
      }

      const searchBookingCode = parseBookingCode(String(bookingCode));
      if (!searchBookingCode) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "BookingCode format không hợp lệ"
          )
        );
      }

      const booking = await paymentService.getBookingDetailWithOwner(
        searchBookingCode
      );

      if (!booking) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking")
        );
      }
      ensureBookingAccess(req, booking);

      // Lấy payment info
      const payment = await paymentService.getPaymentByBookingCode(
        searchBookingCode as any
      );

      if (!payment) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payment")
        );
      }

      const slotRows = await paymentService.getFieldSlotsForBooking(
        searchBookingCode
      );

      return apiResponse.success(
        res,
        {
          booking_code: searchBookingCode,
          transaction_id: payment.TransactionCode || `TX-${payment.PaymentID}`,
          payment_status: payment.PaymentStatus,
          field_code: booking.FieldCode,
          field_name: booking.FieldName,
          total_price: payment.Amount,
          slots:
            slotRows?.map((slot: any) => ({
              slot_id: slot.SlotID,
              play_date: slot.PlayDate,
              start_time: slot.StartTime,
              end_time: slot.EndTime,
            })) || [],
          payment_method: payment.PaymentMethod,
          paid_at: payment.PaidAt,
        },
        "Lấy kết quả thanh toán thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi lấy kết quả thanh toán"
        )
      );
    }
  },
};

export default paymentController;
