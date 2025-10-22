import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import shopService from "../services/shop.service";
import shopPromotionService, {
  ShopPromotionPayload,
  ShopPromotionStatus,
} from "../services/shopPromotion.service";

const statusEnum = z.enum([
  "draft",
  "scheduled",
  "active",
  "expired",
  "disabled",
]);

const promotionSchema = z
  .object({
    promotion_code: z
      .string()
      .trim()
      .min(3, "Mã khuyến mãi phải có ít nhất 3 ký tự")
      .max(50, "Mã khuyến mãi không được vượt quá 50 ký tự")
      .regex(/^[A-Z0-9_-]+$/i, "Mã khuyến mãi chỉ gồm chữ, số, -, _")
      .transform((value) => value.toUpperCase()),
    title: z
      .string()
      .trim()
      .min(3, "Tiêu đề phải có ít nhất 3 ký tự")
      .max(150, "Tiêu đề không được vượt quá 150 ký tự"),
    description: z
      .string()
      .trim()
      .max(2000, "Mô tả không được vượt quá 2000 ký tự")
      .optional()
      .transform((val) => (val && val.length ? val : null)),
    discount_type: z.enum(["percent", "fixed"]),
    discount_value: z
      .preprocess(
        (value) =>
          value === "" || value === null || value === undefined
            ? undefined
            : value,
        z.number().positive("Giá trị giảm phải lớn hơn 0")
      ),
    max_discount_amount: z
      .preprocess(
        (value) =>
          value === "" || value === null || value === undefined
            ? undefined
            : value,
        z.number().positive("Giá trị giảm tối đa phải lớn hơn 0")
      )
      .optional(),
    min_order_amount: z
      .preprocess(
        (value) =>
          value === "" || value === null || value === undefined
            ? undefined
            : value,
        z.number().nonnegative("Đơn tối thiểu phải lớn hơn hoặc bằng 0")
      )
      .optional(),
    usage_limit: z
      .preprocess(
        (value) =>
          value === "" || value === null || value === undefined
            ? undefined
            : value,
        z
          .number()
          .int("Giới hạn lượt dùng phải là số nguyên")
          .positive("Giới hạn lượt dùng phải lớn hơn 0")
      )
      .optional(),
    usage_per_customer: z
      .preprocess(
        (value) =>
          value === "" || value === null || value === undefined
            ? undefined
            : value,
        z
          .number()
          .int("Giới hạn mỗi khách phải là số nguyên")
          .positive("Giới hạn mỗi khách phải lớn hơn 0")
      )
      .optional(),
    start_at: z.coerce.date(),
    end_at: z.coerce.date(),
    status: statusEnum.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.discount_type === "percent" && data.discount_value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Giá trị giảm theo % không được vượt quá 100",
        path: ["discount_value"],
      });
    }

    if (data.usage_limit && data.usage_per_customer) {
      if (data.usage_per_customer > data.usage_limit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Số lượt mỗi khách không được vượt quá tổng lượt dùng",
          path: ["usage_per_customer"],
        });
      }
    }

    if (data.start_at >= data.end_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ngày kết thúc phải sau ngày bắt đầu",
        path: ["end_at"],
      });
    }
  });

const statusSchema = z.object({
  status: z.enum(["active", "disabled", "draft"]),
});

type PromotionSchema = z.infer<typeof promotionSchema>;

function normalizePayload(data: PromotionSchema): ShopPromotionPayload {
  return {
    promotion_code: data.promotion_code,
    title: data.title,
    description: data.description ?? null,
    discount_type: data.discount_type,
    discount_value: data.discount_value as number,
    start_at: data.start_at,
    end_at: data.end_at,
    status: data.status,
    max_discount_amount:
      data.max_discount_amount === undefined ? null : data.max_discount_amount,
    min_order_amount:
      data.min_order_amount === undefined ? 0 : data.min_order_amount,
    usage_limit: data.usage_limit === undefined ? null : data.usage_limit,
    usage_per_customer:
      data.usage_per_customer === undefined ? 1 : data.usage_per_customer,
  };
}

async function resolveShopCode(req: Request) {
  const userId = Number(
    req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code
  );
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      "Vui lòng đăng nhập để tiếp tục"
    );
  }
  const shop = await shopService.getByUserId(userId);
  if (!shop?.shop_code) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Bạn chưa có cửa hàng để quản lý khuyến mãi"
    );
  }
  return Number(shop.shop_code);
}

function parsePromotionId(req: Request) {
  const promotionId = Number(req.params.promotionId ?? req.params.id);
  if (!Number.isFinite(promotionId) || promotionId <= 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Mã khuyến mãi không hợp lệ"
    );
  }
  return promotionId;
}

const shopPromotionController = {
  async listActive(req: Request, res: Response, next: NextFunction) {
    try {
      const shopCode = Number(req.params.shopCode);
      if (!Number.isFinite(shopCode) || shopCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã shop không hợp lệ")
        );
      }
      const customerUserId = Number(
        req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code
      );
      const promotions = await shopPromotionService.listActiveForShop(
        shopCode,
        Number.isFinite(customerUserId) && customerUserId > 0
          ? customerUserId
          : undefined
      );
      return apiResponse.success(
        res,
        promotions,
        "Danh sách khuyến mãi đang áp dụng",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async listForMe(req: Request, res: Response, next: NextFunction) {
    try {
      const shopCode = await resolveShopCode(req);
      const data = await shopPromotionService.list(shopCode);
      return apiResponse.success(
        res,
        data,
        "Danh sách chiến dịch khuyến mãi",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async createForMe(req: Request, res: Response, next: NextFunction) {
    try {
      const shopCode = await resolveShopCode(req);
      const parsed = promotionSchema.safeParse(req.body);
      if (!parsed.success) {
        const message =
          parsed.error.issues[0]?.message || "Dữ liệu khuyến mãi không hợp lệ";
        return next(new ApiError(StatusCodes.BAD_REQUEST, message));
      }

      const payload = normalizePayload(parsed.data);
      const promotion = await shopPromotionService.create(shopCode, payload);
      return apiResponse.success(
        res,
        promotion,
        "Tạo chiến dịch khuyến mãi thành công",
        StatusCodes.CREATED
      );
    } catch (error) {
      next(error);
    }
  },

  async updateForMe(req: Request, res: Response, next: NextFunction) {
    try {
      const shopCode = await resolveShopCode(req);
      const promotionId = parsePromotionId(req);
      const parsed = promotionSchema.safeParse(req.body);
      if (!parsed.success) {
        const message =
          parsed.error.issues[0]?.message || "Dữ liệu khuyến mãi không hợp lệ";
        return next(new ApiError(StatusCodes.BAD_REQUEST, message));
      }

      const payload = normalizePayload(parsed.data);
      const promotion = await shopPromotionService.update(
        shopCode,
        promotionId,
        payload
      );
      return apiResponse.success(
        res,
        promotion,
        "Cập nhật chiến dịch khuyến mãi thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async updateStatusForMe(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const shopCode = await resolveShopCode(req);
      const promotionId = parsePromotionId(req);
      const parsed = statusSchema.safeParse(req.body);
      if (!parsed.success) {
        const message =
          parsed.error.issues[0]?.message || "Trạng thái không hợp lệ";
        return next(new ApiError(StatusCodes.BAD_REQUEST, message));
      }

      const { status } = parsed.data;
      const promotion = await shopPromotionService.updateStatus(
        shopCode,
        promotionId,
        status as ShopPromotionStatus
      );
      return apiResponse.success(
        res,
        promotion,
        "Cập nhật trạng thái chiến dịch thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },
};

export default shopPromotionController;
