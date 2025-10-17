import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import paymentService from "../services/payment.service";
import queryService from "../services/query";
import { RowDataPacket } from "mysql2";

const paymentController = {
  /**
   * Khởi tạo thanh toán (không gọi Momo - chuẩn bị cho SePay)
   * POST /api/payments/bookings/:bookingCode/initiate
   */
  async initiatePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { bookingCode } = req.params;
      const { payment_method = "bank_transfer" } = req.body;

      if (!bookingCode) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "BookingCode là bắt buộc")
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

      // Normalize booking code for INT column: use digits if present
      let searchBookingCode: number;
      const bookingCodeNum = Number(bookingCode);
      if (!isNaN(bookingCodeNum) && bookingCodeNum > 0) {
        searchBookingCode = bookingCodeNum;
      } else {
        const match = String(bookingCode).match(/(\d+)/);
        if (match) {
          searchBookingCode = Number(match[1]);
        } else {
          return next(
            new ApiError(
              StatusCodes.BAD_REQUEST,
              "BookingCode format không hợp lệ"
            )
          );
        }
      }

      // Kiểm tra booking tồn tại
      const [bookingRows] = await queryService.query<RowDataPacket[]>(
        `SELECT b.*, f.ShopCode FROM Bookings b
         JOIN Fields f ON b.FieldCode = f.FieldCode
         WHERE b.BookingCode = ?`,
        [searchBookingCode]
      );

      if (!bookingRows?.[0]) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking")
        );
      }

      const booking = bookingRows[0];

      // Kiểm tra booking chưa thanh toán
      if (booking.PaymentStatus === "paid") {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Booking đã thanh toán")
        );
      }

      // Lấy admin bank account (default)
      const [bankRows] = await queryService.query<RowDataPacket[]>(
        `SELECT AdminBankID FROM Admin_Bank_Accounts WHERE IsDefault = 'Y' LIMIT 1`,
        []
      );

      if (!bankRows?.[0]) {
        return next(
          new ApiError(
            StatusCodes.NOT_FOUND,
            "Chưa setup tài khoản ngân hàng admin"
          )
        );
      }

      const adminBankID = bankRows[0].AdminBankID;

      // Tạo payment record
      const paymentInfo = await paymentService.initiatePayment(
        searchBookingCode as any,
        booking.TotalPrice,
        adminBankID,
        payment_method
      );

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

      // Normalize booking code for INT column: use digits if present
      let searchBookingCode: number;
      const bookingCodeNum = Number(bookingCode);
      if (!isNaN(bookingCodeNum) && bookingCodeNum > 0) {
        searchBookingCode = bookingCodeNum;
      } else {
        const match = String(bookingCode).match(/(\d+)/);
        if (match) {
          searchBookingCode = Number(match[1]);
        } else {
          return next(
            new ApiError(
              StatusCodes.BAD_REQUEST,
              "BookingCode format không hợp lệ"
            )
          );
        }
      }

      // Lấy payment info
      const payment = await paymentService.getPaymentByBookingCode(
        searchBookingCode as any
      );

      if (!payment) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payment")
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

      // Idempotency: nếu đã log id này rồi thì coi như xử lý xong
      try {
        const [logs] = await queryService.query<RowDataPacket[]>(
          `SELECT LogID FROM Payment_Logs WHERE Action = 'sepay_webhook' AND MomoTransactionID = ? LIMIT 1`,
          [String(id)]
        );
        if (logs?.[0]) {
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
      if (!payment && transferType === "in" && transferAmount) {
        try {
          const [rows] = await queryService.query<RowDataPacket[]>(
            `SELECT * FROM Payments_Admin 
             WHERE PaymentStatus = 'pending' AND Amount = ? 
             ORDER BY CreateAt DESC LIMIT 1`,
            [transferAmount]
          );
          if (rows?.[0]) payment = rows[0];
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
      if (transferType === "in" && payment) {
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
        payment ? "SePay webhook processed" : "SePay webhook received - no matching payment",
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
   * Confirm payment manually (for testing)
   * POST /api/payments/:paymentID/confirm
   */
  async confirmPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentID } = req.params;

      const payment = await paymentService.getPaymentByID(Number(paymentID));
      if (!payment) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payment")
        );
      }

      if (payment.PaymentStatus === "paid") {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Payment đã thanh toán")
        );
      }

      const result = await paymentService.handlePaymentSuccess(
        payment.PaymentID
      );

      return apiResponse.success(
        res,
        result,
        "Xác nhận thanh toán thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi xác nhận thanh toán"
        )
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

      // Normalize booking code for INT column: use digits if present
      let searchBookingCode: number;
      const bookingCodeNum = Number(bookingCode);
      if (!isNaN(bookingCodeNum) && bookingCodeNum > 0) {
        searchBookingCode = bookingCodeNum;
      } else {
        const match = String(bookingCode).match(/(\d+)/);
        if (match) {
          searchBookingCode = Number(match[1]);
        } else {
          return next(
            new ApiError(
              StatusCodes.BAD_REQUEST,
              "BookingCode format không hợp lệ"
            )
          );
        }
      }

      // Lấy payment info
      const payment = await paymentService.getPaymentByBookingCode(
        searchBookingCode as any
      );

      if (!payment) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payment")
        );
      }

      // Lấy booking + slot info
      const [bookingRows] = await queryService.query<RowDataPacket[]>(
        `SELECT b.*, f.ShopCode, f.FieldCode, f.FieldName
         FROM Bookings b
         JOIN Fields f ON b.FieldCode = f.FieldCode
         WHERE b.BookingCode = ?`,
        [searchBookingCode]
      );

      if (!bookingRows?.[0]) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking")
        );
      }

      const booking = bookingRows[0];

      // Lấy slot info
      const [slotRows] = await queryService.query<RowDataPacket[]>(
        `SELECT * FROM Field_Slots
         WHERE BookingCode = ?
         ORDER BY PlayDate, StartTime`,
        [searchBookingCode]
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
            slotRows?.map((slot: RowDataPacket) => ({
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
