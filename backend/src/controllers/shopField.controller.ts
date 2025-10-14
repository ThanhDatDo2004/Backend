import type { Express } from "express";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import fieldService from "../services/field.service";

const listShopFieldsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

const createShopFieldSchema = z.object({
  field_name: z.string().trim().min(3, "Tên sân phải có ít nhất 3 ký tự"),
  sport_type: z.string().trim().min(1, "Vui lòng chọn loại hình thể thao"),
  address: z
    .string()
    .trim()
    .min(5, "Địa chỉ phải có ít nhất 5 ký tự"),
  price_per_hour: z.coerce
    .number()
    .nonnegative("Giá thuê mỗi giờ phải lớn hơn hoặc bằng 0"),
  status: z
    .enum(["active", "maintenance", "inactive"])
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
        const message =
          error.issues[0]?.message || "Dữ liệu không hợp lệ";
        return next(new ApiError(StatusCodes.BAD_REQUEST, message));
      }
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
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop")
        );
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
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Giá thuê mỗi giờ không hợp lệ"
          )
        );
      }
      console.error("[shopFieldController] create field error:", error);
      next(error);
    }
  },
};

export default shopFieldController;
