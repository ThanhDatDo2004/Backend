import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import fieldService from "../services/field.service";
import ApiError from "../utils/apiErrors";
import bookingService from "../services/booking.service";

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
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      const field = await fieldService.getById(id);
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
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
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

      const created = await fieldService.addImage(id, file);
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

  async availability(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
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

      const slots = await fieldService.getAvailability(id, date);

      return apiResponse.success(
        res,
        { field_code: id, date: date ?? null, slots },
        "Fetched field availability successfully",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async confirmBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
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

      const result = await bookingService.confirmFieldBooking(id, {
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
          ...result,
          payment_method:
            typeof payment_method === "string" ? payment_method : "mock_wallet",
        },
        "Thanh toán ảo thành công. Khung giờ đã được giữ chỗ.",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },
};

export default fieldController;
