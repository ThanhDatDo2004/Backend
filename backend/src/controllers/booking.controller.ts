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
               DATE_FORMAT(bs.PlayDate, '%Y-%m-%d') as PlayDate,
               DATE_FORMAT(bs.StartTime, '%H:%i') as StartTime,
               DATE_FORMAT(bs.EndTime, '%H:%i') as EndTime,
               bs.PricePerSlot,
               bs.Status 
             FROM Booking_Slots bs
             LEFT JOIN Field_Quantity fq ON bs.QuantityID = fq.QuantityID
             WHERE bs.BookingCode = ?
             ORDER BY bs.PlayDate, bs.StartTime`,
            [booking.BookingCode]
          );

          const quantityInfo = (slots || []).find(
            (slot: RowDataPacket) => slot.QuantityNumber != null
          );

          return {
            ...booking,
            slots: slots || [],
            quantityId: quantityInfo?.QuantityID ?? null,
            quantityNumber: quantityInfo?.QuantityNumber ?? null,
          };
        })
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
          data: bookingsWithSlots,
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

      // ✅ NEW: Convert quantity_id or quantityID to number
      const finalQuantityID =
        quantity_id !== undefined && quantity_id !== null
          ? Number(quantity_id)
          : quantityID !== undefined && quantityID !== null
          ? Number(quantityID)
          : null;

      // Kiểm tra field tồn tại
      const [fields] = await queryService.query<RowDataPacket[]>(
        `SELECT * FROM Fields WHERE FieldCode = ?`,
        [fieldCode]
      );

      if (!fields?.[0]) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân"));
      }

      const field = fields[0];

      // ✅ NEW: If quantityID provided, validate it's available
      if (finalQuantityID) {
        // Check if quantity exists and belongs to this field
        const [quantities] = await queryService.query<RowDataPacket[]>(
          `SELECT * FROM Field_Quantity WHERE QuantityID = ? AND FieldCode = ?`,
          [finalQuantityID, fieldCode]
        );

        if (!quantities?.[0]) {
          return next(
            new ApiError(
              StatusCodes.NOT_FOUND,
              "Sân không tồn tại hoặc không thuộc sân loại này"
            )
          );
        }

        const quantity = quantities[0];

        // Check if quantity status is available
        if (quantity.Status !== "available") {
          return next(
            new ApiError(
              StatusCodes.CONFLICT,
              `Sân ${quantity.QuantityNumber} không khả dụng (${quantity.Status})`
            )
          );
        }

        // Check if this specific quantity is already booked for this time slot
        const [bookedQuantities] = await queryService.query<RowDataPacket[]>(
          `SELECT COUNT(*) as cnt FROM Bookings b
           JOIN Field_Slots fs ON b.BookingCode = fs.BookingCode
           WHERE b.QuantityID = ? AND fs.PlayDate = ? AND fs.StartTime = ? AND fs.EndTime = ? 
           AND b.BookingStatus IN ('pending', 'confirmed')`,
          [finalQuantityID, playDate, startTime, endTime]
        );

        if (bookedQuantities?.[0]?.cnt > 0) {
          return next(
            new ApiError(
              StatusCodes.CONFLICT,
              "Sân này đã được đặt trong khung giờ này"
            )
          );
        }
      }

      // Check available slots
      let slotQuery = `
        SELECT *
        FROM Field_Slots 
        WHERE FieldCode = ?
          AND PlayDate = ?
          AND StartTime = ?
          AND EndTime = ?
      `;
      const slotParams: any[] = [fieldCode, playDate, startTime, endTime];
      if (finalQuantityID !== null) {
        slotQuery += ` AND (QuantityID = ? OR QuantityID IS NULL)`;
        slotParams.push(finalQuantityID);
      }
      slotQuery += ` AND Status = 'available'`;

      const [slots] = await queryService.query<RowDataPacket[]>(
        slotQuery,
        slotParams
      );

      if (!slots?.[0]) {
        // Nếu không có slot available, tạo slot mới
        try {
          await queryService.query<ResultSetHeader>(
            `INSERT INTO Field_Slots (
              FieldCode,
              QuantityID,
              PlayDate,
              StartTime,
              EndTime,
              Status,
              CreateAt,
              UpdateAt
            ) VALUES (?, ?, ?, ?, ?, 'available', NOW(), NOW())`,
            [fieldCode, finalQuantityID, playDate, startTime, endTime]
          );
        } catch (err: any) {
          // Nếu duplicate key (slot đã tồn tại), update status về available
          if (err.code === "ER_DUP_ENTRY") {
            let updateQuery = `
              UPDATE Field_Slots 
              SET Status = 'available',
                  QuantityID = IFNULL(?, QuantityID),
                  UpdateAt = NOW()
              WHERE FieldCode = ?
                AND PlayDate = ?
                AND StartTime = ?
                AND EndTime = ?
            `;
            const updateParams: any[] = [
              finalQuantityID ?? null,
              fieldCode,
              playDate,
              startTime,
              endTime,
            ];
            if (finalQuantityID !== null) {
              updateQuery += ` AND (QuantityID = ? OR QuantityID IS NULL)`;
              updateParams.push(finalQuantityID);
            }
            await queryService.query<ResultSetHeader>(
              updateQuery,
              updateParams
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

      // ✅ FIXED: Include finalQuantityID in Bookings INSERT
      // Create booking with customer info
      const [bookingResult] = await queryService.query<ResultSetHeader>(
        `INSERT INTO Bookings (
          FieldCode,
          QuantityID,
          CustomerUserID,
          CustomerName,
          CustomerEmail,
          CustomerPhone,
          TotalPrice,
          PlatformFee,
          NetToShop,
          BookingStatus,
          PaymentStatus,
          CreateAt,
          UpdateAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', NOW(), NOW())`,
        [
          fieldCode,
          finalQuantityID,
          userId,
          customerName || null,
          customerEmail || null,
          customerPhone || null,
          totalPrice,
          platformFee,
          netToShop,
        ]
      );

      const bookingCode = (bookingResult as any).insertId;

      // Lưu chi tiết slot đã đặt vào Booking_Slots (bao gồm QuantityID)
      await queryService.query<ResultSetHeader>(
        `INSERT INTO Booking_Slots (
          BookingCode,
          FieldCode,
          QuantityID,
          PlayDate,
          StartTime,
          EndTime,
          PricePerSlot,
          Status,
          CreateAt,
          UpdateAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'booked', NOW(), NOW())`,
        [
          bookingCode,
          fieldCode,
          finalQuantityID,
          playDate,
          startTime,
          endTime,
          pricePerSlot,
        ]
      );

      // Update slot status
      let updateSlotQuery = `
        UPDATE Field_Slots 
        SET Status = 'booked',
            BookingCode = ?,
            QuantityID = IFNULL(?, QuantityID),
            UpdateAt = NOW()
        WHERE FieldCode = ?
          AND PlayDate = ?
          AND StartTime = ?
          AND EndTime = ?
          AND Status = 'available'
      `;
      const updateSlotParams: any[] = [
        bookingCode,
        finalQuantityID ?? null,
        fieldCode,
        playDate,
        startTime,
        endTime,
      ];
      if (finalQuantityID !== null) {
        updateSlotQuery += ` AND (QuantityID = ? OR QuantityID IS NULL)`;
        updateSlotParams.push(finalQuantityID);
      }

      await queryService.query<ResultSetHeader>(
        updateSlotQuery,
        updateSlotParams
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

      // Get all slots for this booking from BOOKING_SLOTS table
      const [slots] = await queryService.query<RowDataPacket[]>(
        `SELECT 
           bs.Slot_ID,
           bs.QuantityID,
           fq.QuantityNumber,
           DATE_FORMAT(bs.PlayDate, '%Y-%m-%d') as PlayDate,
           DATE_FORMAT(bs.StartTime, '%H:%i') as StartTime,
           DATE_FORMAT(bs.EndTime, '%H:%i') as EndTime,
           bs.PricePerSlot,
           bs.Status
         FROM Booking_Slots bs
         LEFT JOIN Field_Quantity fq ON bs.QuantityID = fq.QuantityID
         WHERE bs.BookingCode = ?
         ORDER BY bs.PlayDate, bs.StartTime`,
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

      // Rollback Booking_Slots
      await queryService.query<ResultSetHeader>(
        `UPDATE Booking_Slots 
         SET Status = 'cancelled',
             UpdateAt = NOW()
         WHERE BookingCode = ?`,
        [bookingCode]
      );

      // Rollback Field_Slots
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
      const { bookingCode } = req.params;

      const [bookings] = await queryService.query<RowDataPacket[]>(
        `SELECT CheckinCode, BookingStatus FROM Bookings 
         WHERE BookingCode = ?`,
        [bookingCode]
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

      // Get booking to check current status
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
      const wasConfirmed = booking.BookingStatus === "confirmed";

      // Update booking status to cancelled
      await queryService.query(
        `UPDATE Bookings
         SET BookingStatus = 'cancelled', UpdateAt = NOW()
         WHERE BookingCode = ?`,
        [bookingCode]
      );

      // ✅ DECREMENT RENT if it was confirmed
      if (wasConfirmed) {
        await queryService.query(
          `UPDATE Fields
           SET Rent = GREATEST(Rent - 1, 0)
           WHERE FieldCode = ?`,
          [booking.FieldCode]
        );

        console.log(
          `[BOOKING] Booking ${bookingCode} cancelled - Field ${booking.FieldCode} rent decreased`
        );
      }

      return apiResponse.success(
        res,
        { BookingCode: bookingCode, FieldCode: booking.FieldCode },
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
