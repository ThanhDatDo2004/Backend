"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const zod_1 = require("zod");
const respone_1 = __importDefault(require("../core/respone"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const shop_service_1 = __importDefault(require("../services/shop.service"));
const shopPromotion_service_1 = __importDefault(require("../services/shopPromotion.service"));
const statusEnum = zod_1.z.enum([
    "draft",
    "scheduled",
    "active",
    "expired",
    "disabled",
]);
const promotionSchema = zod_1.z
    .object({
    promotion_code: zod_1.z
        .string()
        .trim()
        .min(3, "Mã khuyến mãi phải có ít nhất 3 ký tự")
        .max(50, "Mã khuyến mãi không được vượt quá 50 ký tự")
        .regex(/^[A-Z0-9_-]+$/i, "Mã khuyến mãi chỉ gồm chữ, số, -, _")
        .transform((value) => value.toUpperCase()),
    title: zod_1.z
        .string()
        .trim()
        .min(3, "Tiêu đề phải có ít nhất 3 ký tự")
        .max(150, "Tiêu đề không được vượt quá 150 ký tự"),
    description: zod_1.z
        .string()
        .trim()
        .max(2000, "Mô tả không được vượt quá 2000 ký tự")
        .optional()
        .transform((val) => (val && val.length ? val : null)),
    discount_type: zod_1.z.enum(["percent", "fixed"]),
    discount_value: zod_1.z.preprocess((value) => value === "" || value === null || value === undefined
        ? undefined
        : value, zod_1.z.number().positive("Giá trị giảm phải lớn hơn 0")),
    max_discount_amount: zod_1.z
        .preprocess((value) => value === "" || value === null || value === undefined
        ? undefined
        : value, zod_1.z.number().positive("Giá trị giảm tối đa phải lớn hơn 0"))
        .optional(),
    min_order_amount: zod_1.z
        .preprocess((value) => value === "" || value === null || value === undefined
        ? undefined
        : value, zod_1.z.number().nonnegative("Đơn tối thiểu phải lớn hơn hoặc bằng 0"))
        .optional(),
    usage_limit: zod_1.z
        .preprocess((value) => value === "" || value === null || value === undefined
        ? undefined
        : value, zod_1.z
        .number()
        .int("Giới hạn lượt dùng phải là số nguyên")
        .positive("Giới hạn lượt dùng phải lớn hơn 0"))
        .optional(),
    usage_per_customer: zod_1.z
        .preprocess((value) => value === "" || value === null || value === undefined
        ? undefined
        : value, zod_1.z
        .number()
        .int("Giới hạn mỗi khách phải là số nguyên")
        .positive("Giới hạn mỗi khách phải lớn hơn 0"))
        .optional(),
    start_at: zod_1.z.coerce.date(),
    end_at: zod_1.z.coerce.date(),
    status: statusEnum.optional(),
})
    .superRefine((data, ctx) => {
    if (data.discount_type === "percent" && data.discount_value > 100) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Giá trị giảm theo % không được vượt quá 100",
            path: ["discount_value"],
        });
    }
    if (data.usage_limit && data.usage_per_customer) {
        if (data.usage_per_customer > data.usage_limit) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "Số lượt mỗi khách không được vượt quá tổng lượt dùng",
                path: ["usage_per_customer"],
            });
        }
    }
    if (data.start_at >= data.end_at) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Ngày kết thúc phải sau ngày bắt đầu",
            path: ["end_at"],
        });
    }
});
const statusSchema = zod_1.z.object({
    status: zod_1.z.enum(["active", "disabled", "draft"]),
});
function normalizePayload(data) {
    return {
        promotion_code: data.promotion_code,
        title: data.title,
        description: data.description ?? null,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        start_at: data.start_at,
        end_at: data.end_at,
        status: data.status,
        max_discount_amount: data.max_discount_amount === undefined ? null : data.max_discount_amount,
        min_order_amount: data.min_order_amount === undefined ? 0 : data.min_order_amount,
        usage_limit: data.usage_limit === undefined ? null : data.usage_limit,
        usage_per_customer: data.usage_per_customer === undefined ? 1 : data.usage_per_customer,
    };
}
async function resolveShopCode(req) {
    const userId = Number(req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code);
    if (!Number.isFinite(userId) || userId <= 0) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục");
    }
    const shop = await shop_service_1.default.getByUserId(userId);
    if (!shop?.shop_code) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Bạn chưa có cửa hàng để quản lý khuyến mãi");
    }
    return Number(shop.shop_code);
}
function parsePromotionId(req) {
    const promotionId = Number(req.params.promotionId ?? req.params.id);
    if (!Number.isFinite(promotionId) || promotionId <= 0) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã khuyến mãi không hợp lệ");
    }
    return promotionId;
}
const shopPromotionController = {
    async listActive(req, res, next) {
        try {
            const shopCode = Number(req.params.shopCode);
            if (!Number.isFinite(shopCode) || shopCode <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã shop không hợp lệ"));
            }
            const customerUserId = Number(req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code);
            const promotions = await shopPromotion_service_1.default.listActiveForShop(shopCode, Number.isFinite(customerUserId) && customerUserId > 0
                ? customerUserId
                : undefined);
            return respone_1.default.success(res, promotions, "Danh sách khuyến mãi đang áp dụng", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async listForMe(req, res, next) {
        try {
            const shopCode = await resolveShopCode(req);
            const data = await shopPromotion_service_1.default.list(shopCode);
            return respone_1.default.success(res, data, "Danh sách chiến dịch khuyến mãi", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async createForMe(req, res, next) {
        try {
            const shopCode = await resolveShopCode(req);
            const parsed = promotionSchema.safeParse(req.body);
            if (!parsed.success) {
                const message = parsed.error.issues[0]?.message || "Dữ liệu khuyến mãi không hợp lệ";
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, message));
            }
            const payload = normalizePayload(parsed.data);
            const promotion = await shopPromotion_service_1.default.create(shopCode, payload);
            return respone_1.default.success(res, promotion, "Tạo chiến dịch khuyến mãi thành công", http_status_codes_1.StatusCodes.CREATED);
        }
        catch (error) {
            next(error);
        }
    },
    async updateForMe(req, res, next) {
        try {
            const shopCode = await resolveShopCode(req);
            const promotionId = parsePromotionId(req);
            const parsed = promotionSchema.safeParse(req.body);
            if (!parsed.success) {
                const message = parsed.error.issues[0]?.message || "Dữ liệu khuyến mãi không hợp lệ";
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, message));
            }
            const payload = normalizePayload(parsed.data);
            const promotion = await shopPromotion_service_1.default.update(shopCode, promotionId, payload);
            return respone_1.default.success(res, promotion, "Cập nhật chiến dịch khuyến mãi thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async updateStatusForMe(req, res, next) {
        try {
            const shopCode = await resolveShopCode(req);
            const promotionId = parsePromotionId(req);
            const parsed = statusSchema.safeParse(req.body);
            if (!parsed.success) {
                const message = parsed.error.issues[0]?.message || "Trạng thái không hợp lệ";
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, message));
            }
            const { status } = parsed.data;
            const promotion = await shopPromotion_service_1.default.updateStatus(shopCode, promotionId, status);
            return respone_1.default.success(res, promotion, "Cập nhật trạng thái chiến dịch thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async removeForMe(req, res, next) {
        try {
            const shopCode = await resolveShopCode(req);
            const promotionId = parsePromotionId(req);
            await shopPromotion_service_1.default.remove(shopCode, promotionId);
            return respone_1.default.success(res, { promotionId }, "Đã xóa khuyến mãi", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
};
exports.default = shopPromotionController;
