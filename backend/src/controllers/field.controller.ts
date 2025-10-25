import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import fieldService from "../services/field.service";
import ApiError from "../utils/apiErrors";
import bookingService, {
  releaseExpiredHeldSlots,
} from "../services/booking.service";
import paymentService from "../services/payment.service";
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

const DEFAULT_GUEST_CUSTOMER_USER_ID = (() => {
  const raw = Number(process.env.GUEST_CUSTOMER_USER_ID ?? 1);
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  return 1;
})();

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

      const data = await fieldService.list({
        search: queryString(search),
        sportType: queryString(sportType),
        location: queryString(location),
        priceMin: toNumber(priceMin),
        priceMax: toNumber(priceMax),
        page: toNumber(pageParam),
        pageSize: toNumber(pageSizeParam),
        sortBy: typeof sortBy === "string" ? sortBy : undefined,
        sortDir: sortDir === "desc" || sortDir === "asc" ? sortDir : undefined,
        status: queryString(status) ?? "active", // Mặc định chỉ lấy sân 'active'
        shopStatus: queryString(shopStatus),
        shopActive: 1, // Chỉ lấy sân của shop có chủ shop đang hoạt động
      });

      return apiResponse.success(
        res,
        data,
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

      // Release expired held slots (cập nhật đầy đủ booking + payment)
      await releaseExpiredHeldSlots(fieldCode);

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
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Không thể lấy tiện ích của sân"
        )
      );
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

      const {
        slots,
        customer,
        payment_method,
        total_price,
        notes,
        quantity_id,
        quantityId: quantityIdCamel,
        promotion_code: promotionCodeSnake,
        promotionCode: promotionCodeCamel,
      } = req.body ?? {};

      if (!Array.isArray(slots) || !slots.length) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Vui lòng chọn ít nhất một khung giờ để đặt sân."
          )
        );
      }

      const authUserId = Number((req as any).user?.UserID);
      const bodyCreatedBy =
        req.body?.created_by ??
        req.body?.createdBy ??
        req.body?.customerUserID ??
        req.body?.customer_user_id;
      const parsedBodyUserId =
        typeof bodyCreatedBy === "number" || typeof bodyCreatedBy === "string"
          ? Number(bodyCreatedBy)
          : undefined;

      let resolvedUserId: number | undefined;
      if (Number.isFinite(authUserId) && authUserId > 0) {
        resolvedUserId = authUserId;
      } else if (
        typeof parsedBodyUserId === "number" &&
        Number.isFinite(parsedBodyUserId) &&
        parsedBodyUserId > 0
      ) {
        resolvedUserId = parsedBodyUserId;
      } else if (
        Number.isFinite(DEFAULT_GUEST_CUSTOMER_USER_ID) &&
        DEFAULT_GUEST_CUSTOMER_USER_ID > 0
      ) {
        resolvedUserId = DEFAULT_GUEST_CUSTOMER_USER_ID;
      }

      if (!resolvedUserId || !Number.isFinite(resolvedUserId)) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Không xác định được người đặt sân hợp lệ."
          )
        );
      }

      // NEW: Extract quantityId and convert to number if provided
      const rawQuantityInput =
        quantity_id !== undefined && quantity_id !== null
          ? quantity_id
          : quantityIdCamel !== undefined && quantityIdCamel !== null
          ? quantityIdCamel
          : undefined;

      const quantityId =
        rawQuantityInput !== undefined ? Number(rawQuantityInput) : undefined;

      const promotionCodeInput =
        typeof promotionCodeSnake === "string" && promotionCodeSnake.trim()
          ? promotionCodeSnake.trim()
          : typeof promotionCodeCamel === "string" && promotionCodeCamel.trim()
          ? promotionCodeCamel.trim()
          : undefined;

      const result = await bookingService.confirmFieldBooking(
        fieldCode,
        {
          slots,
          customer: typeof customer === "object" ? customer : undefined,
          payment_method:
            typeof payment_method === "string" ? payment_method : undefined,
          total_price:
            typeof total_price === "number" ? total_price : undefined,
          notes: typeof notes === "string" ? notes : undefined,
          created_by: resolvedUserId,
          promotion_code:
            typeof promotionCodeInput === "string"
              ? promotionCodeInput.toUpperCase()
              : undefined,
        },
        quantityId // NEW: Pass quantityId
      );

      return apiResponse.success(
        res,
        {
          booking_code: result.booking_code,
          qr_code: result.qr_code,
          paymentID: result.paymentID,
          amount: result.amount,
          amountBeforeDiscount: result.amount_before_discount,
          discountAmount: result.discount_amount,
          promotionCode: result.promotion_code,
          promotionTitle: result.promotion_title,
          transaction_id: result.transaction_id,
          payment_status: result.payment_status,
          payment_method:
            typeof payment_method === "string"
              ? payment_method
              : "bank_transfer",
          slots: result.slots,
        },
        "Tạo booking thành công. Mã QR SePay đã sẵn sàng.",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get field statistics including booking count
   * GET /api/fields/:fieldCode/stats
   */
  async getFieldStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { fieldCode } = req.params;
      const numericFieldCode = Number(fieldCode);
      if (!Number.isFinite(numericFieldCode) || numericFieldCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      return apiResponse.success(
        res,
        await fieldService.getStats(numericFieldCode),
        "Thống kê sân",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Get field stats failed"
        )
      );
    }
  },

  /**
   * List fields with booking count for a shop
   * GET /api/fields/shop/:shopCode/with-rent
   */
  async listFieldsWithRent(req: Request, res: Response, next: NextFunction) {
    try {
      const { shopCode } = req.params;
      const numericShopCode = Number(shopCode);
      if (!Number.isFinite(numericShopCode) || numericShopCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã shop không hợp lệ")
        );
      }
      const { limit = "10", offset = "0" } = req.query;

      const validLimit = Math.min(Math.max(1, Number(limit)), 100);
      const validOffset = Math.max(0, Number(offset));

      return apiResponse.success(
        res,
        await fieldService.listWithRent(numericShopCode, {
          limit: validLimit,
          offset: validOffset,
        }),
        "Danh sách sân với thống kê",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "List fields failed"
        )
      );
    }
  },

  /**
   * Sync/Fix field rent count from confirmed bookings
   * PUT /api/fields/:fieldCode/sync-rent
   * Admin endpoint to fix mismatched rent counts
   */
  async syncFieldRent(req: Request, res: Response, next: NextFunction) {
    try {
      const { fieldCode } = req.params;
      const numericFieldCode = Number(fieldCode);
      if (!Number.isFinite(numericFieldCode) || numericFieldCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      return apiResponse.success(
        res,
        await fieldService.syncFieldRent(numericFieldCode),
        "Rent synced thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Sync field rent failed"
        )
      );
    }
  },

  /**
   * Sync all fields rent count (admin/maintenance endpoint)
   * PUT /api/fields/sync/all
   */
  async syncAllFieldsRent(req: Request, res: Response, next: NextFunction) {
    try {
      return apiResponse.success(
        res,
        await fieldService.syncAllFieldsRent(),
        "Đồng bộ số lượt thuê thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Sync all fields rent failed"
        )
      );
    }
  },
};

export default fieldController;
