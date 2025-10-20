import type { Express } from "express";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import fieldService from "../services/field.service";
import shopService from "../services/shop.service";

const listShopFieldsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

const createShopFieldSchema = z.object({
  field_name: z.string().trim().min(3, "Tên sân phải có ít nhất 3 ký tự"),
  sport_type: z.string().trim().min(1, "Vui lòng chọn loại hình thể thao"),
  address: z.string().trim().min(5, "Địa chỉ phải có ít nhất 5 ký tự"),
  price_per_hour: z.coerce
    .number()
    .nonnegative("Giá thuê mỗi giờ phải lớn hơn hoặc bằng 0"),
  status: z.enum(["active", "maintenance", "inactive"]).optional(),
  quantity_count: z.coerce
    .number()
    .int()
    .positive("Số lượng sân phải lớn hơn 0")
    .optional()
    .default(1),
});

// Schema riêng cho việc cập nhật, cho phép các trường là tùy chọn
const updateShopFieldSchema = createShopFieldSchema.partial().extend({
  // Thêm trường để nhận danh sách ảnh cần xóa
  deleted_images: z
    .array(z.coerce.number().int().positive("Mã ảnh không hợp lệ"))
    .optional(),
});

function parseShopCode(req: Request) {
  const candidate =
    req.params.shopCode ?? req.body?.shop_code ?? req.query?.shop_code;
  const parsed = Number(candidate);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Mã shop không hợp lệ");
  }
  return parsed;
}

const shopFieldController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const shopCode = parseShopCode(req);

      const parsed = listShopFieldsSchema.safeParse(req.query);
      if (!parsed.success) {
        const message =
          parsed.error.issues[0]?.message || "Tham số truy vấn không hợp lệ";
        return next(new ApiError(StatusCodes.BAD_REQUEST, message));
      }

      const data = await fieldService.list({
        ...parsed.data,
        shopCode,
      });

      return apiResponse.success(
        res,
        data,
        "Fetched shop fields successfully",
        StatusCodes.OK
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return next(error);
      }
      if (error instanceof z.ZodError) {
        const message = error.issues[0]?.message || "Dữ liệu không hợp lệ";
        return next(new ApiError(StatusCodes.BAD_REQUEST, message));
      }
      next(error);
    }
  },

  async removeForMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number(
        req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code
      );
      if (!Number.isFinite(userId) || userId <= 0) {
        return next(
          new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Vui lòng đăng nhập để tiếp tục"
          )
        );
      }

      const shop = await shopService.getByUserId(userId);
      if (!shop || !shop.shop_code) {
        return next(
          new ApiError(StatusCodes.FORBIDDEN, "Bạn không sở hữu shop nào.")
        );
      }

      const fieldCode = Number(req.params.fieldCode ?? req.params.fieldId);
      if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      const mode = (
        String(req.query?.mode || "hard").toLowerCase() === "soft"
          ? "soft"
          : "hard"
      ) as "hard" | "soft";

      try {
        const result = await fieldService.deleteFieldForShop({
          shopCode: Number(shop.shop_code),
          fieldCode,
          mode,
        });
        if (!result) {
          return next(
            new ApiError(
              StatusCodes.NOT_FOUND,
              "Không tìm thấy sân hoặc bạn không có quyền xóa"
            )
          );
        }
        return apiResponse.success(
          res,
          { deleted: true },
          "Xóa sân thành công",
          StatusCodes.OK
        );
      } catch (error) {
        if (error instanceof ApiError) {
          return next(error);
        }
        return next(error);
      }
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const shopCode = parseShopCode(req);

      const parsed = createShopFieldSchema.safeParse(req.body);
      if (!parsed.success) {
        const message =
          parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
        return next(new ApiError(StatusCodes.BAD_REQUEST, message));
      }

      const files = (req.files as Express.Multer.File[]) ?? [];

      const created = await fieldService.createForShop(
        {
          shopCode,
          fieldName: parsed.data.field_name,
          sportType: parsed.data.sport_type,
          address: parsed.data.address,
          pricePerHour: parsed.data.price_per_hour,
          status: parsed.data.status,
          quantityCount: parsed.data.quantity_count,
        },
        files
      );

      if (!created) {
        return next(
          new ApiError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            "Không thể tạo sân mới"
          )
        );
      }

      return apiResponse.success(
        res,
        created,
        "Tạo sân thành công",
        StatusCodes.CREATED
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return next(error);
      }
      if ((error as any)?.code === "SHOP_NOT_FOUND") {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop"));
      }
      if ((error as any)?.code === "INVALID_SPORT_TYPE") {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Loại hình thể thao không hợp lệ"
          )
        );
      }
      if ((error as any)?.code === "INVALID_PRICE") {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Giá thuê mỗi giờ không hợp lệ")
        );
      }
      console.error("[shopFieldController] create field error:", error);
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const shopCode = parseShopCode(req);
      const fieldId = Number(req.params.fieldId ?? req.params.fieldCode);
      if (!Number.isFinite(fieldId) || fieldId <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      const parsed = updateShopFieldSchema.safeParse(req.body);
      if (!parsed.success) {
        const message =
          parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
        return next(new ApiError(StatusCodes.BAD_REQUEST, message));
      }

      // Xử lý xóa ảnh nếu có
      if (parsed.data.deleted_images && parsed.data.deleted_images.length > 0) {
        await fieldService.deleteImages(
          fieldId,
          parsed.data.deleted_images,
          shopCode
        );
      }

      const updated = await fieldService.updateForShop(
        shopCode,
        fieldId,
        parsed.data
      );
      if (!updated) {
        return next(
          new ApiError(
            StatusCodes.NOT_FOUND,
            "Không tìm thấy sân hoặc bạn không có quyền chỉnh sửa"
          )
        );
      }

      return apiResponse.success(
        res,
        updated,
        "Cập nhật sân thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async listForMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number(
        req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code
      );
      if (!Number.isFinite(userId) || userId <= 0) {
        return next(
          new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Vui lòng đăng nhập để tiếp tục"
          )
        );
      }

      const shop = await shopService.getByUserId(userId);
      if (!shop || !shop.shop_code) {
        return next(
          new ApiError(StatusCodes.FORBIDDEN, "Bạn không sở hữu shop nào.")
        );
      }
      req.params.shopCode = String(shop.shop_code);
      return shopFieldController.list(req, res, next);
    } catch (error) {
      next(error);
    }
  },

  async createForMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number(
        req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code
      );
      if (!Number.isFinite(userId) || userId <= 0) {
        return next(
          new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Vui lòng đăng nhập để tiếp tục"
          )
        );
      }

      const shop = await shopService.getByUserId(userId);
      if (!shop || !shop.shop_code) {
        return next(
          new ApiError(StatusCodes.FORBIDDEN, "Bạn không sở hữu shop nào.")
        );
      }
      req.params.shopCode = String(shop.shop_code);
      return shopFieldController.create(req, res, next);
    } catch (error) {
      next(error);
    }
  },

  async getForMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number(
        req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code
      );
      if (!Number.isFinite(userId) || userId <= 0) {
        return next(
          new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Vui lòng đăng nhập để tiếp tục"
          )
        );
      }

      const shop = await shopService.getByUserId(userId);
      if (!shop || !shop.shop_code) {
        return next(
          new ApiError(StatusCodes.FORBIDDEN, "Bạn không sở hữu shop nào.")
        );
      }

      const fieldCode = Number(req.params.fieldCode);
      if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ")
        );
      }

      const field = await fieldService.getById(fieldCode);
      if (!field || field.shop_code !== shop.shop_code) {
        return next(
          new ApiError(
            StatusCodes.NOT_FOUND,
            "Sân không tồn tại hoặc không thuộc quản lý của bạn"
          )
        );
      }

      return apiResponse.success(res, field, "Chi tiết sân", StatusCodes.OK);
    } catch (error) {
      next(error);
    }
  },

  async updateForMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number(
        req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code
      );
      if (!Number.isFinite(userId) || userId <= 0) {
        return next(
          new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Vui lòng đăng nhập để tiếp tục"
          )
        );
      }

      const shop = await shopService.getByUserId(userId);
      if (!shop || !shop.shop_code) {
        return next(
          new ApiError(StatusCodes.FORBIDDEN, "Bạn không sở hữu shop nào.")
        );
      }
      req.params.shopCode = String(shop.shop_code);
      return shopFieldController.update(req, res, next);
    } catch (error) {
      next(error);
    }
  },
};

export default shopFieldController;
