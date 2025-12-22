import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import fieldService from "../services/field.service";
import ApiError from "../utils/apiErrors";
import { releaseExpiredHeldSlots } from "../services/booking.service";
import { listFieldUtilities } from "../services/shopUtilities.service";

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

      const allowedSorts = new Set(["price", "rating", "name", "rent"]);
      const sortKey =
        typeof sortBy === "string" && allowedSorts.has(sortBy)
          ? (sortBy as "price" | "rating" | "name" | "rent")
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
        status: queryString(status) ?? "active", 
        shopStatus: queryString(shopStatus),
        shopActive: 1, 
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
        "Lấy sân thành công",
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
        return next(
          new ApiError(
            StatusCodes.NOT_FOUND,
            "Không tìm thấy sân hoặc không thể tải ảnh"
          )
        );
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

      await releaseExpiredHeldSlots(fieldCode);

      const slots = await fieldService.getAvailability(fieldCode, date);

      return apiResponse.success(
        res,
        { field_code: fieldCode, date: date ?? null, slots },
        "Lấy lịch sử dụng sân thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async utilities(req: Request, res: Response, next: NextFunction) {
    try {
      const fieldCode = Number(req.params.fieldCode);
      if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      const utilities = await listFieldUtilities(fieldCode);

      return apiResponse.success(
        res,
        utilities,
        "Danh sách tiện ích của sân",
        StatusCodes.OK
      );
    } catch (error) {
      if ((error as Error)?.message === "FIELD_NOT_FOUND") {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân"));
      }
      next(
        new ApiError(
          500,
          (error as Error)?.message || "Không thể lấy tiện ích của sân"
        )
      );
    }
  },

  /**
   * GET /api/fields/:fieldCode/stats
   */
  async getFieldStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { fieldCode } = req.params;

      const stats = await fieldService.getFieldStatsByCode(Number(fieldCode));

      if (!stats) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Sân không tồn tại"));
      }

      return apiResponse.success(res, stats, "Thống kê sân", StatusCodes.OK);
    } catch (error) {
      next(
        new ApiError(500, (error as Error)?.message || "Lấy thống kê sân thất bại")
      );
    }
  },

  /**
   * GET /api/fields/shop/:shopCode/with-rent
   */
  async listFieldsWithRent(req: Request, res: Response, next: NextFunction) {
    try {
      const { shopCode } = req.params;
      const { limit = "10", offset = "0" } = req.query;

      const validLimit = Math.min(Math.max(1, Number(limit)), 100);
      const validOffset = Math.max(0, Number(offset));

      const result = await fieldService.listFieldsWithRent(
        Number(shopCode),
        validLimit,
        validOffset
      );

      return apiResponse.success(
        res,
        {
          data: result.data,
          pagination: {
            limit: validLimit,
            offset: validOffset,
            total: result.total,
          },
        },
        "Danh sách sân với thống kê",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(500, (error as Error)?.message || "Lấy danh sách sân thất bại")
      );
    }
  },

  /**
   * PUT /api/fields/:fieldCode/sync-rent
   */
  async syncFieldRent(req: Request, res: Response, next: NextFunction) {
    try {
      const { fieldCode } = req.params;

      const actualRent = await fieldService.syncFieldRent(Number(fieldCode));

      return apiResponse.success(
        res,
        { FieldCode: fieldCode, Rent: actualRent },
        `${actualRent}`,
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(500, (error as Error)?.message || "Tính lại lượt đặt thất bại")
      );
    }
  },

  /**
   * PUT /api/fields/sync/all
   */
  async syncAllFieldsRent(req: Request, res: Response, next: NextFunction) {
    try {
      const syncedCount = await fieldService.syncAllFieldRents();

      return apiResponse.success(
        res,
        { synced: syncedCount },
        `${syncedCount} sân`,
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          500,
          (error as Error)?.message || "Tính lại lượt đặt tất cả sân thất bại"
        )
      );
    }
  },
};

export default fieldController;
