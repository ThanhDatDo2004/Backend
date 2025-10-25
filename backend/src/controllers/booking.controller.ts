import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import bookingService from "../services/booking.service";

const bookingController = {
  /**
   * Liệt kê booking của customer
   * GET /api/bookings
   */
  async listBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const {
        status,
        limit = 10,
        offset = 0,
        sort = "CreateAt",
        order = "DESC",
      } = req.query;

      const result = await bookingService.listBookings(userId, {
        status: status as string,
        limit: Number(limit),
        offset: Number(offset),
        sort: sort as string,
        order: order as string,
      });

      return apiResponse.success(
        res,
        result,
        "Danh sách booking",
        StatusCodes.OK
      );
    } catch (error: any) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          error?.message || "Lỗi lấy danh sách booking"
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
      const userId = (req as any).user?.UserID;
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

      // Input validation
      if (!fieldCode || !playDate || !startTime || !endTime) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "fieldCode, playDate, startTime, endTime là bắt buộc"
          )
        );
      }

      // Convert quantity_id or quantityID to number
      const finalQuantityID =
        quantity_id !== undefined && quantity_id !== null
          ? Number(quantity_id)
          : quantityID !== undefined && quantityID !== null
          ? Number(quantityID)
          : null;

      // Call service to handle all business logic
      const result = await bookingService.createSimpleBooking({
        userId,
        fieldCode,
        quantityID: finalQuantityID,
        playDate,
        startTime,
        endTime,
        customerName: customerName || null,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
      });

      return apiResponse.success(
        res,
        result,
        "Tạo booking thành công",
        StatusCodes.CREATED
      );
    } catch (error: any) {
      if (error instanceof ApiError) return next(error);
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
      const userId = (req as any).user?.UserID;
      const { bookingCode } = req.params;

      try {
        // Call service to get booking detail
        const bookingData = await bookingService.getBooking(bookingCode, userId);

        return apiResponse.success(
          res,
          bookingData,
          "Chi tiết booking",
          StatusCodes.OK
        );
      } catch (error: any) {
        if (error instanceof ApiError) {
          return next(error);
        }
        throw error;
      }
    } catch (error: any) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          error?.message || "Lỗi lấy chi tiết booking"
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
      const userId = (req as any).user?.UserID;
      const { bookingCode } = req.params;

      // Call service to handle cancel logic
      const result = await bookingService.cancelBooking(bookingCode);

      return apiResponse.success(
        res,
        result,
        "Hủy booking thành công",
        StatusCodes.OK
      );
    } catch (error: any) {
      if (error instanceof ApiError) return next(error);
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          error?.message || "Lỗi hủy booking"
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

      return apiResponse.success(
        res,
        await bookingService.updateBookingStatus(bookingCode, status),
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

      return apiResponse.success(
        res,
        await bookingService.verifyCheckin(bookingCode, checkin_code),
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

      return apiResponse.success(
        res,
        await bookingService.getCheckinCode(bookingCode),
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

      return apiResponse.success(
        res,
        await bookingService.listShopBookings(userId, {
          status: status as string,
          search: search as string,
          limit: validLimit,
          offset: validOffset,
          sort: sort as string,
          order: order as string,
        }),
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

      return apiResponse.success(
        res,
        await bookingService.confirmBooking(bookingCode),
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

      try {
        // Call service to cancel booking
        const result = await bookingService.cancelBooking(bookingCode);

        return apiResponse.success(
          res,
          result,
          "Booking hủy thành công",
          StatusCodes.OK
        );
      } catch (error: any) {
        if (error instanceof ApiError) {
          return next(error);
        }
        throw error;
      }
    } catch (error: any) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          error?.message || "Cancel booking failed"
        )
      );
    }
  },
};

export default bookingController;
