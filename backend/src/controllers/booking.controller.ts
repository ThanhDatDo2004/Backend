import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import { badRequest, unauthorized } from "../utils/errors";
import {
  cancelBookingByOwner,
  cancelCustomerBooking,
  confirmBookingForOwner,
  confirmFieldBooking,
  getBookingCheckinCode,
  getCustomerBookingDetail,
  listCustomerBookings,
  listShopBookingsForOwner,
  updateBookingStatus,
  verifyBookingCheckin,
} from "../services/booking.service";
import type { ConfirmBookingPayload } from "../services/booking.service";
import cartService from "../services/cart.service";

const parseBookingCodeParam = (value: string): number | null => {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }

  const match = String(value).match(/(\d+)/);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const DEFAULT_GUEST_CUSTOMER_USER_ID = (() => {
  const raw = Number(process.env.GUEST_CUSTOMER_USER_ID ?? 1);
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  return 1;
})();

const resolveBookingUser = (req: Request) => {
  const { UserID, role } = req.user ?? {};
  const userId = toNumber(UserID);
  const isGuest = role === "guest" || userId === DEFAULT_GUEST_CUSTOMER_USER_ID;

  if (userId && userId > 0) {
    return { userId, isLoggedInCustomer: !isGuest, isGuest };
  }

  const guestId = DEFAULT_GUEST_CUSTOMER_USER_ID;
  if (Number(guestId) && guestId > 0) {
    return { userId: guestId, isLoggedInCustomer: false, isGuest: true };
  }

  return { isLoggedInCustomer: false, isGuest: false };
};

const bookingController = {
  async listBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number((req as any).user?.UserID);
      if (!Number.isFinite(userId)) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "Yêu cầu đăng nhập");
      }
      const {
        status,
        limit = 10,
        offset = 0,
        sort = "CreateAt",
        order = "DESC",
      } = req.query;
      const result = await listCustomerBookings(userId, {
        status: typeof status === "string" ? status : undefined,
        limit: Number(limit) || 10,
        offset: Number(offset) || 0,
        sort: typeof sort === "string" ? sort : undefined,
        order: typeof order === "string" ? order : undefined,
      });

      return apiResponse.success(
        res,
        result,
        "Danh sách booking",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          500,
          (error as Error)?.message || "Lỗi lấy danh sách booking"
        )
      );
    }
  },

  /**
   * Tạo booking mới
   * POST /api/bookings
   */
  async createBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        fieldCode,
        field_code,
        quantityID,
        quantity_id,
        quantityId,
        slots,
        playDate,
        startTime,
        endTime,
        customer,
        customerName,
        customerEmail,
        customerPhone,
        payment_method,
        total_price,
        notes,
        promotion_code: promotionCodeSnake,
        promotionCode: promotionCodeCamel,
      } = req.body ?? {};

      const numericFieldCode = Number(fieldCode ?? field_code);
      if (!Number.isFinite(numericFieldCode) || numericFieldCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      const resolvedSlots: ConfirmBookingPayload["slots"] = Array.isArray(slots)
        ? slots.map((slot: any) => {
            const play_date = slot.play_date ?? slot.playDate;
            const start_time = slot.start_time ?? slot.startTime;
            const end_time = slot.end_time ?? slot.endTime;
            if (!play_date || !start_time || !end_time) {
              throw new ApiError(
                StatusCodes.BAD_REQUEST,
                "Mỗi khung giờ phải có play_date, start_time, end_time"
              );
            }
            return {
              play_date,
              start_time,
              end_time,
            };
          })
        : [];

      if (!resolvedSlots.length) {
        if (!playDate || !startTime || !endTime) {
          return next(
            new ApiError(
              StatusCodes.BAD_REQUEST,
              "Vui lòng chọn ít nhất một khung giờ để đặt sân."
            )
          );
        }
        resolvedSlots.push({
          play_date: playDate,
          start_time: startTime,
          end_time: endTime,
        });
      }

      const customerPayload =
        typeof customer === "object" && customer
          ? customer
          : {
              name: customerName,
              email: customerEmail,
              phone: customerPhone,
            };

      const quantityNumeric = toNumber(
        quantity_id ?? quantityId ?? quantityID ?? undefined
      );
      const normalizedQuantityId =
        typeof quantityNumeric === "number" && Number.isFinite(quantityNumeric)
          ? Number(quantityNumeric)
          : null;

      const promotionCodeInput = (
        [promotionCodeSnake, promotionCodeCamel].find(
          (code) => typeof code === "string" && code.trim()
        ) as string | undefined
      )?.trim();

      const {
        userId: resolvedUserId,
        isLoggedInCustomer,
        isGuest,
      } = resolveBookingUser(req);

      if (!resolvedUserId) {
        return next(
          new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Vui lòng đăng nhập để đặt sân"
          )
        );
      }

      if (promotionCodeInput && isGuest) {
        return next(
          new ApiError(
            StatusCodes.FORBIDDEN,
            "Khách vãng lai không được áp dụng mã giảm giá."
          )
        );
      }

      const payload: ConfirmBookingPayload = {
        slots: resolvedSlots,
        customer:
          typeof customerPayload === "object" ? customerPayload : undefined,
        payment_method:
          typeof payment_method === "string" ? payment_method : undefined,
        total_price: typeof total_price === "number" ? total_price : undefined,
        notes: typeof notes === "string" ? notes : undefined,
        created_by: resolvedUserId,
        promotion_code: promotionCodeInput?.toUpperCase(),
        isLoggedInCustomer,
      };

      const confirmation = await confirmFieldBooking(
        numericFieldCode,
        payload,
        normalizedQuantityId
      );

      return apiResponse.success(
        res,
        {
          booking_code: confirmation.booking_code,
          qr_code: confirmation.qr_code,
          paymentID: confirmation.paymentID,
          amount: confirmation.amount,
          amountBeforeDiscount: confirmation.amount_before_discount,
          discountAmount: confirmation.discount_amount,
          promotionCode: confirmation.promotion_code,
          promotionTitle: confirmation.promotion_title,
          transaction_id: confirmation.transaction_id,
          payment_status: confirmation.payment_status,
          payment_method:
            typeof payment_method === "string"
              ? payment_method
              : "bank_transfer",
          slots: confirmation.slots,
        },
        "Đặt sân thành công",
        StatusCodes.CREATED
      );
    } catch (error) {
      next(
        new ApiError(500, (error as Error)?.message || "Không thể tạo booking")
      );
    }
  },

  /**
   * Chi tiết booking
   * GET /api/bookings/:bookingCode
   */
  async getBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number((req as any).user?.UserID);
      const { bookingCode } = req.params;

      const normalizedCode = parseBookingCodeParam(bookingCode);
      if (!normalizedCode) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "BookingCode format không hợp lệ"
          )
        );
      }

      const detail = await getCustomerBookingDetail(
        normalizedCode,
        Number.isFinite(userId) ? userId : undefined
      );

      if (!detail) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking")
        );
      }

      return apiResponse.success(
        res,
        detail,
        "Chi tiết booking",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          500,
          (error as Error)?.message || "Lỗi lấy chi tiết booking"
        )
      );
    }
  },

  /**
   * Hủy booking
   * PATCH /api/bookings/:bookingCode/cancel
   */
  async cancelBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number((req as any).user?.UserID);
      const { bookingCode } = req.params;
      const { reason } = req.body;
      if (!Number.isFinite(userId)) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "Yêu cầu đăng nhập");
      }

      const normalizedCode = parseBookingCodeParam(bookingCode);
      if (!normalizedCode) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "BookingCode format không hợp lệ"
          )
        );
      }

      const result = await cancelCustomerBooking(
        normalizedCode,
        userId,
        typeof reason === "string" ? reason : undefined
      );

      return apiResponse.success(
        res,
        result,
        "Hủy booking thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(new ApiError(500, (error as Error)?.message || "Lỗi hủy booking"));
    }
  },

  /**
   * Cập nhật trạng thái booking (ADMIN)
   * PATCH /api/bookings/:bookingCode/status
   */
  async updateBookingStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { bookingCode } = req.params;
      const { status } = req.body;

      if (
        !["pending", "confirmed", "completed", "cancelled"].includes(status)
      ) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Trạng thái không hợp lệ")
        );
      }

      const normalizedCode = parseBookingCodeParam(bookingCode);
      if (!normalizedCode) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "BookingCode format không hợp lệ"
          )
        );
      }

      const result = await updateBookingStatus(normalizedCode, status);

      return apiResponse.success(
        res,
        result,
        "Cập nhật trạng thái booking thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(500, (error as Error)?.message || "Lỗi cập nhật booking")
      );
    }
  },

  /**
   * Verify checkin code
   * POST /api/bookings/:bookingCode/verify-checkin
   */
  async verifyCheckinCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { bookingCode } = req.params;
      const { checkin_code } = req.body;

      if (!checkin_code) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã check-in là bắt buộc")
        );
      }

      const normalizedCode = parseBookingCodeParam(bookingCode);
      if (!normalizedCode) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "BookingCode format không hợp lệ"
          )
        );
      }

      const result = await verifyBookingCheckin(normalizedCode, checkin_code);

      return apiResponse.success(
        res,
        result,
        "Check-in thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(500, (error as Error)?.message || "Lỗi verify check-in")
      );
    }
  },

  /**
   * Get checkin code (customer)
   * GET /api/bookings/:bookingCode/checkin-code
   */
  async getCheckinCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { bookingCode } = req.params;

      const normalizedCode = parseBookingCodeParam(bookingCode);
      if (!normalizedCode) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "BookingCode format không hợp lệ"
          )
        );
      }

      const result = await getBookingCheckinCode(normalizedCode);

      return apiResponse.success(res, result, "Mã check-in", StatusCodes.OK);
    } catch (error) {
      next(
        new ApiError(500, (error as Error)?.message || "Lỗi lấy mã check-in")
      );
    }
  },

  /**
   * Liệt kê booking của shop (tất cả fields)
   * GET /api/shops/me/bookings
   */
  async listShopBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number((req as any).user?.UserID);
      if (!Number.isFinite(userId)) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "Yêu cầu đăng nhập");
      }

      const {
        status,
        search,
        limit = 10,
        offset = 0,
        sort = "CreateAt",
        order = "DESC",
      } = req.query;

      const result = await listShopBookingsForOwner(userId, {
        status: typeof status === "string" ? status : undefined,
        search: typeof search === "string" ? search : undefined,
        limit: Number(limit) || 10,
        offset: Number(offset) || 0,
        sort: typeof sort === "string" ? sort : undefined,
        order: typeof order === "string" ? order : undefined,
      });

      return apiResponse.success(
        res,
        result,
        "Danh sách booking của shop",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          500,
          (error as Error)?.message || "Lỗi lấy danh sách booking"
        )
      );
    }
  },

  /**
   * Confirm a booking - also increment field Rent
   * PUT /api/bookings/:bookingCode/confirm
   */
  async confirmBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const normalizedCode = parseBookingCodeParam(req.params.bookingCode);
      if (!normalizedCode) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "BookingCode format không hợp lệ"
          )
        );
      }

      const result = await confirmBookingForOwner(normalizedCode);

      return apiResponse.success(
        res,
        result,
        "Booking xác nhận thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(500, (error as Error)?.message || "Confirm booking failed")
      );
    }
  },

  /**
   * Cancel a booking - also decrement field Rent if it was confirmed
   * PUT /api/bookings/:bookingCode/cancel
   */
  async cancelBookingMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const { bookingCode } = req.params;

      const normalizedCode = parseBookingCodeParam(bookingCode);
      if (!normalizedCode) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "BookingCode format không hợp lệ"
          )
        );
      }

      const result = await cancelBookingByOwner(normalizedCode);

      return apiResponse.success(
        res,
        result,
        "Booking hủy thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(500, (error as Error)?.message || "Cancel booking failed")
      );
    }
  },
};

export default bookingController;
