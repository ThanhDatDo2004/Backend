import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import fieldService from "../services/field.service";
import ApiError from "../utils/apiErrors";
import bookingService from "../services/booking.service";
import paymentService from "../services/payment.service";
import { RowDataPacket } from "mysql2";
import queryService from "../services/query";

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const queryString = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
};

const fieldController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        search,
        sportType,
        location,
        priceMin,
        priceMax,
        page: pageParam,
        pageSize: pageSizeParam,
        sortBy,
        sortDir,
        status,
        shopStatus,
      } = req.query;

      const sortKey =
        sortBy === "price" || sortBy === "rating" || sortBy === "name"
          ? sortBy
          : undefined;
      const sortDirection =
        sortDir === "desc" || sortDir === "asc" ? sortDir : undefined;

      const data = await fieldService.list({
        search: queryString(search),
        sportType: queryString(sportType),
        location: queryString(location),
        priceMin: toNumber(priceMin),
        priceMax: toNumber(priceMax),
        page: toNumber(pageParam),
        pageSize: toNumber(pageSizeParam),
        sortBy: sortKey,
        sortDir: sortDirection,
        status: queryString(status) ?? "active", // Mặc định chỉ lấy sân 'active'
        shopStatus: queryString(shopStatus),
        shopActive: 1, // Chỉ lấy sân của shop có chủ shop đang hoạt động
      });

      const {
        items,
        facets,
        summary,
        total,
        page,
        pageSize,
        totalPages,
        hasNext,
        hasPrev,
        pagination,
      } = data;

      const appliedFilters = {
        search: queryString(search),
        sportType: queryString(sportType),
        location: queryString(location),
        priceMin: toNumber(priceMin),
        priceMax: toNumber(priceMax),
        status: queryString(status) ?? "active",
        shopStatus: queryString(shopStatus),
        sortBy: sortKey,
        sortDir: sortDirection,
      };

      const paginationMeta = pagination ?? {
        total,
        page,
        pageSize,
        totalPages,
        hasNext,
        hasPrev,
      };

      return apiResponse.success(
        res,
        {
          items,
          total,
          page,
          pageSize,
          facets,
          summary,
          meta: {
            pagination: paginationMeta,
            filters: appliedFilters,
          },
        },
        "Fetched fields successfully",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      const fieldCode = Number(req.params.fieldCode);
      if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      const field = await fieldService.getById(fieldCode);
      if (!field) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân"));
      }

      return apiResponse.success(
        res,
        field,
        "Fetched field successfully",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async uploadImage(req: Request, res: Response, next: NextFunction) {
    try {
      const fieldCode = Number(req.params.fieldCode);
      if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Vui lòng chọn một tập tin hình ảnh để tải lên"
          )
        );
      }

      const created = await fieldService.addImage(fieldCode, file);
      if (!created) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân"));
      }

      return apiResponse.success(
        res,
        created,
        "Tải ảnh sân thành công",
        StatusCodes.CREATED
      );
    } catch (error) {
      next(error);
    }
  },

  async uploadImages(req: Request, res: Response, next: NextFunction) {
    try {
      const fieldCode = Number(req.params.fieldCode);
      if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Vui lòng chọn ít nhất một tập tin hình ảnh để tải lên"
          )
        );
      }

      const uploadedImages = [];
      for (const file of files) {
        const created = await fieldService.addImage(fieldCode, file);
        if (created) {
          uploadedImages.push(created);
        }
      }

      if (uploadedImages.length === 0) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân hoặc không thể tải ảnh"));
      }

      return apiResponse.success(
        res,
        { images: uploadedImages },
        `Tải ${uploadedImages.length} ảnh sân thành công`,
        StatusCodes.CREATED
      );
    } catch (error) {
      next(error);
    }
  },

  async availability(req: Request, res: Response, next: NextFunction) {
    try {
      const fieldCode = Number(req.params.fieldCode);
      if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      const date =
        typeof req.query.date === "string" ? req.query.date.trim() : undefined;

      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Định dạng ngày không hợp lệ (YYYY-MM-DD)"
          )
        );
      }

      // Release expired held slots before getting availability
      try {
        await queryService.query(
          `UPDATE Field_Slots 
           SET Status = 'available', HoldExpiresAt = NULL, UpdateAt = NOW()
           WHERE FieldCode = ? 
           AND Status = 'held' 
           AND HoldExpiresAt IS NOT NULL 
           AND HoldExpiresAt < NOW()`,
          [fieldCode]
        );
      } catch (e) {
        console.error('Lỗi release expired held slots:', e);
        // Không throw, tiếp tục xử lý
      }

      const slots = await fieldService.getAvailability(fieldCode, date);

      return apiResponse.success(
        res,
        { field_code: fieldCode, date: date ?? null, slots },
        "Fetched field availability successfully",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async confirmBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const fieldCode = Number(req.params.fieldCode);
      if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      const { slots, customer, payment_method, total_price, notes } =
        req.body ?? {};

      if (!Array.isArray(slots) || !slots.length) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Vui lòng chọn ít nhất một khung giờ để đặt sân."
          )
        );
      }

      const result = await bookingService.confirmFieldBooking(fieldCode, {
        slots,
        customer: typeof customer === "object" ? customer : undefined,
        payment_method:
          typeof payment_method === "string" ? payment_method : undefined,
        total_price: typeof total_price === "number" ? total_price : undefined,
        notes: typeof notes === "string" ? notes : undefined,
      });

      return apiResponse.success(
        res,
        {
          booking_code: result.booking_code,
          qr_code: result.qr_code,
          paymentID: result.paymentID,
          amount: result.amount,
          transaction_id: result.transaction_id,
          payment_status: result.payment_status,
          payment_method:
            typeof payment_method === "string" ? payment_method : "bank_transfer",
          slots: result.slots,
        },
        "Tạo booking thành công. Mã QR SePay đã sẵn sàng.",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },
};

export default fieldController;
