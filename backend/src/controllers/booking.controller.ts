import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import { badRequest, unauthorized } from "../utils/errors";
import {
  cancelBookingByOwner,
  cancelCustomerBooking,
  confirmFieldBooking,
  getBookingCheckinCode,
  getCustomerBookingDetail,
  listCustomerBookings,
  updateBookingStatus,
  verifyBookingCheckin,
} from "../services/booking.service";
import type { ConfirmBookingPayload } from "../services/booking.service";
import queryService from "../services/query";
import { RowDataPacket, ResultSetHeader } from "mysql2";
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

const bookingController = {
  /**
   * Liệt kê booking của customer
   * GET /api/bookings
   */
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
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi lấy danh sách booking"
        )
      );
    }
  },

  /**
   * Tạo booking mới
   * POST /api/bookings/create
   */
  async createBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number((req as any).user?.UserID);
      const isGuestUser =
        Boolean((req as any).user?.isGuest) ||
        String((req as any).user?.role || "").toLowerCase() === "guest";
      const {
        fieldCode,
        quantityID,
        quantity_id,
        playDate,
        startTime,
        endTime,
        customerName,
        customerEmail,
        customerPhone,
      } = req.body;

      if (!fieldCode || !playDate || !startTime || !endTime) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "fieldCode, playDate, startTime, endTime là bắt buộc"
          )
        );
      }
      if (!Number.isFinite(userId)) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "Yêu cầu đăng nhập");
      }

      const numericFieldCode = Number(fieldCode);
      if (!Number.isFinite(numericFieldCode) || numericFieldCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "fieldCode không hợp lệ")
        );
      }

      const finalQuantityID =
        quantity_id ?? quantityID ?? null;
      const numericQuantityId =
        finalQuantityID !== null && finalQuantityID !== undefined
          ? Number(finalQuantityID)
          : null;

      const payload: ConfirmBookingPayload = {
        slots: [
          {
            play_date: playDate,
            start_time: startTime,
            end_time: endTime,
          },
        ],
        payment_method: "bank_transfer",
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        },
        created_by: userId,
        isLoggedInCustomer: !isGuestUser,
      };

      if (Number.isFinite(numericQuantityId)) {
        payload.quantity_id = Number(numericQuantityId);
      }

      const confirmation = await confirmFieldBooking(
        numericFieldCode,
        payload,
        Number.isFinite(numericQuantityId) ? Number(numericQuantityId) : null
      );

      const detail = await getCustomerBookingDetail(
        Number(confirmation.booking_code)
      );

      const fieldName = (detail as any)?.FieldName ?? "";

      return apiResponse.success(
        res,
        {
          bookingCode: confirmation.booking_code,
          totalPrice:
            confirmation.amount ?? confirmation.amount_before_discount ?? 0,
          fieldName,
        },
        "Tạo booking thành công",
        StatusCodes.CREATED
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi tạo booking"
        )
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
          StatusCodes.INTERNAL_SERVER_ERROR,
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
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi hủy booking"
        )
      );
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
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi cập nhật booking"
        )
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
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi verify check-in"
        )
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

      return apiResponse.success(
        res,
        result,
        "Mã check-in",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi lấy mã check-in"
        )
      );
    }
  },

  /**
   * Liệt kê booking của shop (tất cả fields)
   * GET /api/shops/me/bookings
   */
  async listShopBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const {
        status,
        search,
        limit = 10,
        offset = 0,
        sort = "CreateAt",
        order = "DESC",
      } = req.query;

      // Validate limit
      const validLimit = Math.min(Math.max(1, Number(limit)), 100);
      const validOffset = Math.max(0, Number(offset));

      // Lấy shopCode của shop owner
      const [shops] = await queryService.query<RowDataPacket[]>(
        `SELECT ShopCode FROM Shops WHERE UserID = ?`,
        [userId]
      );

      if (!shops?.[0]) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop của bạn")
        );
      }

      const shopCode = shops[0].ShopCode;

      // Auto-cancel pending bookings older than 10 minutes
      await queryService.query<ResultSetHeader>(
        `UPDATE Bookings 
         SET BookingStatus = 'cancelled', 
             PaymentStatus = 'failed',
             UpdateAt = NOW()
         WHERE BookingStatus = 'pending' 
         AND TIMESTAMPDIFF(MINUTE, CreateAt, NOW()) > 10
         AND FieldCode IN (SELECT FieldCode FROM Fields WHERE ShopCode = ?)`,
        [shopCode]
      );

      let query = `SELECT b.BookingCode, b.FieldCode, b.CustomerUserID, 
                          b.BookingStatus, b.PaymentStatus, b.TotalPrice, b.NetToShop,
                          b.CheckinCode, b.CheckinTime, b.CreateAt, b.UpdateAt,
                          u.FullName as CustomerName, b.CustomerPhone, f.FieldName
                   FROM Bookings b
                   JOIN Fields f ON b.FieldCode = f.FieldCode
                   LEFT JOIN Users u ON b.CustomerUserID = u.UserID
                   WHERE f.ShopCode = ?`;
      const params: any[] = [shopCode];

      if (status) {
        query += ` AND b.BookingStatus = ?`;
        params.push(status);
      }

      // Add search filter: search by booking code, field name, or customer phone
      if (search) {
        const searchTerm = `%${String(search).trim()}%`;
        query += ` AND (
          CAST(b.BookingCode AS CHAR) LIKE ?
          OR f.FieldName LIKE ?
          OR b.CustomerPhone LIKE ?
          OR u.FullName LIKE ?
        )`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      // Validate sort field
      const validSortFields = [
        "CreateAt",
        "PlayDate",
        "TotalPrice",
        "BookingStatus",
      ];
      const sortField = validSortFields.includes(sort as string)
        ? sort
        : "CreateAt";
      const sortOrder = order === "ASC" ? "ASC" : "DESC";

      query += ` ORDER BY b.${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
      params.push(validLimit, validOffset);

      const [bookings] = await queryService.query<RowDataPacket[]>(
        query,
        params
      );

      // Handle null values for CustomerPhone and CheckinCode
      const enrichedBookings = bookings.map((booking: any) => ({
        ...booking,
        CustomerPhone: booking.CustomerPhone || "Chưa cập nhật",
        CheckinCode: booking.CheckinCode || "-",
      }));

      // Fetch all slots for each booking from BOOKING_SLOTS
      const bookingsWithSlots = await Promise.all(
        enrichedBookings.map(async (booking: any) => {
          const [slots] = await queryService.query<RowDataPacket[]>(
            `SELECT 
               bs.Slot_ID,
               bs.QuantityID,
               fq.QuantityNumber,
               DATE_FORMAT(bs.PlayDate, '%Y-%m-%d') AS PlayDate,
               DATE_FORMAT(bs.StartTime, '%H:%i') AS StartTime,
               DATE_FORMAT(bs.EndTime, '%H:%i') AS EndTime,
               bs.PricePerSlot,
               bs.Status
             FROM Booking_Slots bs
             LEFT JOIN Field_Quantity fq ON bs.QuantityID = fq.QuantityID
             WHERE bs.BookingCode = ?
             ORDER BY bs.PlayDate, bs.StartTime`,
            [booking.BookingCode]
          );

          const quantityInfo = (slots || []).find(
            (slot: any) => slot.QuantityNumber != null
          );

          return {
            ...booking,
            slots: slots || [],
            quantityId: quantityInfo?.QuantityID ?? null,
            quantityNumber: quantityInfo?.QuantityNumber ?? null,
          };
        })
      );

      // Get total - must include search filter
      let countQuery = `SELECT COUNT(*) as total FROM Bookings b
                        JOIN Fields f ON b.FieldCode = f.FieldCode
                        LEFT JOIN Users u ON b.CustomerUserID = u.UserID
                        WHERE f.ShopCode = ?`;
      const countParams: any[] = [shopCode];
      if (status) {
        countQuery += ` AND b.BookingStatus = ?`;
        countParams.push(status);
      }
      if (search) {
        const searchTerm = `%${String(search).trim()}%`;
        countQuery += ` AND (
          CAST(b.BookingCode AS CHAR) LIKE ?
          OR f.FieldName LIKE ?
          OR b.CustomerPhone LIKE ?
          OR u.FullName LIKE ?
        )`;
        countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }
      const [countRows] = await queryService.query<RowDataPacket[]>(
        countQuery,
        countParams
      );

      return apiResponse.success(
        res,
        {
          data: bookingsWithSlots,
          pagination: {
            limit: validLimit,
            offset: validOffset,
            total: countRows?.[0]?.total || 0,
          },
        },
        "Danh sách booking của shop",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
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
      const { bookingCode } = req.params;

      // Get booking details
      const [bookings] = await queryService.query<RowDataPacket[]>(
        `SELECT * FROM Bookings WHERE BookingCode = ?`,
        [bookingCode]
      );

      if (!bookings?.[0]) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Booking không tồn tại")
        );
      }

      const booking = bookings[0];

      // Check if already confirmed
      if (booking.BookingStatus === "confirmed") {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Booking đã được xác nhận")
        );
      }

      // Update booking status to confirmed
      await queryService.query(
        `UPDATE Bookings
         SET BookingStatus = 'confirmed', UpdateAt = NOW()
         WHERE BookingCode = ?`,
        [bookingCode]
      );

      // ✅ INCREMENT RENT for the field
      await queryService.query(
        `UPDATE Fields
         SET Rent = Rent + 1
         WHERE FieldCode = ?`,
        [booking.FieldCode]
      );

      console.log(
        `[BOOKING] Booking ${bookingCode} confirmed - Field ${booking.FieldCode} rent increased`
      );

      return apiResponse.success(
        res,
        { BookingCode: bookingCode, FieldCode: booking.FieldCode },
        "Booking xác nhận thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Confirm booking failed"
        )
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
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Cancel booking failed"
        )
      );
    }
  },
};

export default bookingController;
