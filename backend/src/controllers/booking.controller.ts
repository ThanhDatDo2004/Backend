import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import queryService from "../services/query";
import { RowDataPacket, ResultSetHeader } from "mysql2";

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

      let query = `SELECT b.*, f.FieldName, f.SportType, s.ShopName
                   FROM Bookings b
                   JOIN Fields f ON b.FieldCode = f.FieldCode
                   JOIN Shops s ON f.ShopCode = s.ShopCode
                   WHERE b.CustomerUserID = ?`;
      const params: any[] = [userId];

      if (status) {
        query += ` AND b.BookingStatus = ?`;
        params.push(status);
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

      query += ` ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
      params.push(Number(limit), Number(offset));

      const [bookings] = await queryService.query<RowDataPacket[]>(
        query,
        params
      );

      // Get total
      let countQuery = `SELECT COUNT(*) as total FROM Bookings WHERE CustomerUserID = ?`;
      const countParams: any[] = [userId];
      if (status) {
        countQuery += ` AND BookingStatus = ?`;
        countParams.push(status);
      }
      const [countRows] = await queryService.query<RowDataPacket[]>(
        countQuery,
        countParams
      );

      return apiResponse.success(
        res,
        {
          data: bookings,
          pagination: {
            limit: Number(limit),
            offset: Number(offset),
            total: countRows?.[0]?.total || 0,
          },
        },
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
      const userId = (req as any).user?.UserID;
      const {
        fieldCode,
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

      // Kiểm tra field tồn tại
      const [fields] = await queryService.query<RowDataPacket[]>(
        `SELECT * FROM Fields WHERE FieldCode = ?`,
        [fieldCode]
      );

      if (!fields?.[0]) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân"));
      }

      const field = fields[0];

      // Check available slots
      const [slots] = await queryService.query<RowDataPacket[]>(
        `SELECT * FROM Field_Slots 
         WHERE FieldCode = ? AND PlayDate = ? 
         AND StartTime = ? AND EndTime = ? AND Status = 'available'`,
        [fieldCode, playDate, startTime, endTime]
      );

      if (!slots?.[0]) {
        // Nếu không có slot available, tạo slot mới
        try {
          await queryService.query<ResultSetHeader>(
            `INSERT INTO Field_Slots (
              FieldCode,
              PlayDate,
              StartTime,
              EndTime,
              Status,
              CreateAt,
              UpdateAt
            ) VALUES (?, ?, ?, ?, 'available', NOW(), NOW())`,
            [fieldCode, playDate, startTime, endTime]
          );
        } catch (err: any) {
          // Nếu duplicate key (slot đã tồn tại), update status về available
          if (err.code === "ER_DUP_ENTRY") {
            await queryService.query<ResultSetHeader>(
              `UPDATE Field_Slots 
               SET Status = 'available', UpdateAt = NOW()
               WHERE FieldCode = ? AND PlayDate = ? AND StartTime = ? AND EndTime = ?`,
              [fieldCode, playDate, startTime, endTime]
            );
          } else {
            throw err;
          }
        }
      }

      // Calculate total price
      const pricePerSlot = field.DefaultPricePerHour || 100000;
      const totalPrice = pricePerSlot;

      // Calculate platform fee (5%)
      const platformFee = Math.round(totalPrice * 0.05);
      const netToShop = totalPrice - platformFee;

      // Create booking with customer info
      const [bookingResult] = await queryService.query<ResultSetHeader>(
        `INSERT INTO Bookings (
          FieldCode,
          CustomerUserID,
          CustomerName,
          CustomerEmail,
          CustomerPhone,
          PlayDate,
          StartTime,
          EndTime,
          TotalPrice,
          PlatformFee,
          NetToShop,
          BookingStatus,
          PaymentStatus,
          CreateAt,
          UpdateAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', NOW(), NOW())`,
        [
          fieldCode,
          userId,
          customerName || null,
          customerEmail || null,
          customerPhone || null,
          playDate,
          startTime,
          endTime,
          totalPrice,
          platformFee,
          netToShop,
        ]
      );

      const bookingCode = (bookingResult as any).insertId;

      // Update slot status
      await queryService.query<ResultSetHeader>(
        `UPDATE Field_Slots 
         SET Status = 'booked', BookingCode = ?, UpdateAt = NOW()
         WHERE FieldCode = ? AND PlayDate = ? AND StartTime = ? AND EndTime = ? AND Status = 'available'`,
        [bookingCode, fieldCode, playDate, startTime, endTime]
      );

      return apiResponse.success(
        res,
        {
          bookingCode,
          totalPrice,
          fieldName: field.FieldName,
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
      const userId = (req as any).user?.UserID;
      const { bookingCode } = req.params;

      // Normalize booking code for INT column
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

      // Nếu có userId, chỉ lấy booking của user đó; nếu không thì lấy bất kỳ booking nào
      let query = `SELECT b.*, f.FieldName, f.SportType, f.Address, s.ShopName, s.ShopCode,
                CASE WHEN b.PaymentStatus = 'paid' THEN p.Amount ELSE 0 END as paid_amount
         FROM Bookings b
         JOIN Fields f ON b.FieldCode = f.FieldCode
         JOIN Shops s ON f.ShopCode = s.ShopCode
         LEFT JOIN Payments_Admin p ON b.PaymentID = p.PaymentID
         WHERE b.BookingCode = ?`;

      const params: any[] = [searchBookingCode];

      if (userId) {
        query += ` AND b.CustomerUserID = ?`;
        params.push(userId);
      }

      const [bookings] = await queryService.query<RowDataPacket[]>(
        query,
        params
      );

      if (!bookings?.[0]) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking")
        );
      }

      // Get slots
      const [slots] = await queryService.query<RowDataPacket[]>(
        `SELECT SlotID, PlayDate, StartTime, EndTime, Status 
         FROM Field_Slots 
         WHERE BookingCode = ?`,
        [searchBookingCode]
      );

      return apiResponse.success(
        res,
        {
          ...bookings[0],
          slots: slots || [],
        },
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
      const userId = (req as any).user?.UserID;
      const { bookingCode } = req.params;
      const { reason } = req.body;

      // Lấy booking
      const [bookings] = await queryService.query<RowDataPacket[]>(
        `SELECT * FROM Bookings WHERE BookingCode = ? AND CustomerUserID = ?`,
        [bookingCode, userId]
      );

      if (!bookings?.[0]) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking")
        );
      }

      const booking = bookings[0];

      // Kiểm tra trạng thái
      if (booking.BookingStatus === "completed") {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Không thể hủy booking đã hoàn thành"
          )
        );
      }

      if (booking.BookingStatus === "cancelled") {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Booking đã bị hủy rồi")
        );
      }

      // Kiểm tra thời gian (chỉ hủy được trước 2 giờ)
      const playDate = new Date(booking.PlayDate);
      const [startTimeStr] = booking.StartTime.toString().split(".");
      const [hours, minutes] = startTimeStr.split(":").map(Number);
      playDate.setHours(hours, minutes, 0, 0);

      const now = new Date();
      const diffMs = playDate.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 2 && booking.BookingStatus !== "pending") {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Chỉ có thể hủy booking trước 2 giờ"
          )
        );
      }

      // Cập nhật booking status
      await queryService.query<ResultSetHeader>(
        `UPDATE Bookings 
         SET BookingStatus = 'cancelled',
             UpdateAt = NOW()
         WHERE BookingCode = ?`,
        [bookingCode]
      );

      // Rollback slots
      await queryService.query<ResultSetHeader>(
        `UPDATE Field_Slots 
         SET Status = 'available',
             BookingCode = NULL,
             UpdateAt = NOW()
         WHERE BookingCode = ?`,
        [bookingCode]
      );

      // Nếu đã thanh toán, tạo refund
      if (booking.PaymentStatus === "paid") {
        const [refundResult] = await queryService.query<ResultSetHeader>(
          `INSERT INTO Booking_Refunds (
            BookingCode,
            RefundAmount,
            Reason,
            Status,
            RequestedAt,
            CreateAt
          ) VALUES (?, ?, ?, 'approved', NOW(), NOW())`,
          [
            bookingCode,
            booking.TotalPrice,
            reason || "Customer requested cancellation",
          ]
        );

        // Trừ tiền từ wallet của shop
        const [fieldRows] = await queryService.query<RowDataPacket[]>(
          `SELECT ShopCode FROM Fields WHERE FieldCode = ?`,
          [booking.FieldCode]
        );

        if (fieldRows?.[0]) {
          await queryService.query<ResultSetHeader>(
            `UPDATE Shop_Wallets 
             SET Balance = GREATEST(0, Balance - ?),
                 UpdateAt = NOW()
             WHERE ShopCode = ?`,
            [booking.NetToShop, fieldRows[0].ShopCode]
          );
        }
      }

      return apiResponse.success(
        res,
        { bookingCode, status: "cancelled" },
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
      const { status, note } = req.body;

      if (
        !["pending", "confirmed", "completed", "cancelled"].includes(status)
      ) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Trạng thái không hợp lệ")
        );
      }

      const [bookings] = await queryService.query<RowDataPacket[]>(
        `SELECT * FROM Bookings WHERE BookingCode = ?`,
        [bookingCode]
      );

      if (!bookings?.[0]) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking")
        );
      }

      const booking = bookings[0];

      // Validate status flow
      const validTransitions: { [key: string]: string[] } = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
      };

      if (!validTransitions[booking.BookingStatus]?.includes(status)) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            `Không thể chuyển từ ${booking.BookingStatus} sang ${status}`
          )
        );
      }

      await queryService.query<ResultSetHeader>(
        `UPDATE Bookings 
         SET BookingStatus = ?,
             UpdateAt = NOW()
         WHERE BookingCode = ?`,
        [status, bookingCode]
      );

      if (status === "completed") {
        // Update CompletedAt
        await queryService.query<ResultSetHeader>(
          `UPDATE Bookings SET CompletedAt = NOW() WHERE BookingCode = ?`,
          [bookingCode]
        );
      }

      return apiResponse.success(
        res,
        { bookingCode, status },
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

      const [bookings] = await queryService.query<RowDataPacket[]>(
        `SELECT * FROM Bookings WHERE BookingCode = ?`,
        [bookingCode]
      );

      if (!bookings?.[0]) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking")
        );
      }

      const booking = bookings[0];

      if (booking.CheckinCode !== checkin_code) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã check-in không đúng")
        );
      }

      if (booking.CheckinTime) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Booking đã check-in")
        );
      }

      // Update checkin info
      await queryService.query<ResultSetHeader>(
        `UPDATE Bookings 
         SET CheckinTime = NOW(),
             UpdateAt = NOW()
         WHERE BookingCode = ?`,
        [bookingCode]
      );

      return apiResponse.success(
        res,
        { bookingCode, checkinTime: new Date() },
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
      const userId = (req as any).user?.UserID;
      const { bookingCode } = req.params;

      const [bookings] = await queryService.query<RowDataPacket[]>(
        `SELECT CheckinCode, BookingStatus FROM Bookings 
         WHERE BookingCode = ? AND CustomerUserID = ?`,
        [bookingCode, userId]
      );

      if (!bookings?.[0]) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking")
        );
      }

      const booking = bookings[0];

      if (booking.BookingStatus !== "confirmed") {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Chỉ booking confirmed mới có mã check-in"
          )
        );
      }

      return apiResponse.success(
        res,
        { bookingCode, checkinCode: booking.CheckinCode },
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
};

export default bookingController;
