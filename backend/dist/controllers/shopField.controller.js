"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const zod_1 = require("zod");
const respone_1 = __importDefault(require("../core/respone"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const field_service_1 = __importDefault(require("../services/field.service"));
const shop_service_1 = __importDefault(require("../services/shop.service"));
const listShopFieldsSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).optional(),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).optional(),
    search: zod_1.z.string().trim().optional(),
    status: zod_1.z.string().trim().optional(),
});
const createShopFieldSchema = zod_1.z.object({
    field_name: zod_1.z.string().trim().min(3, "Tên sân phải có ít nhất 3 ký tự"),
    sport_type: zod_1.z.string().trim().min(1, "Vui lòng chọn loại hình thể thao"),
    address: zod_1.z.string().trim().min(5, "Địa chỉ phải có ít nhất 5 ký tự"),
    price_per_hour: zod_1.z.coerce
        .number()
        .nonnegative("Giá thuê mỗi giờ phải lớn hơn hoặc bằng 0"),
    status: zod_1.z.enum(["active", "maintenance", "inactive"]).optional(),
    quantity_count: zod_1.z.coerce
        .number()
        .int()
        .positive("Số lượng sân phải lớn hơn 0")
        .optional()
        .default(1),
});
// Schema riêng cho việc cập nhật, cho phép các trường là tùy chọn
const updateShopFieldSchema = createShopFieldSchema.partial().extend({
    // Thêm trường để nhận danh sách ảnh cần xóa
    deleted_images: zod_1.z
        .array(zod_1.z.coerce.number().int().positive("Mã ảnh không hợp lệ"))
        .optional(),
});
function parseShopCode(req) {
    const candidate = req.params.shopCode ?? req.body?.shop_code ?? req.query?.shop_code;
    const parsed = Number(candidate);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã shop không hợp lệ");
    }
    return parsed;
}
const shopFieldController = {
    async list(req, res, next) {
        try {
            const shopCode = parseShopCode(req);
            const parsed = listShopFieldsSchema.safeParse(req.query);
            if (!parsed.success) {
                const message = parsed.error.issues[0]?.message || "Tham số truy vấn không hợp lệ";
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, message));
            }
            const data = await field_service_1.default.list({
                ...parsed.data,
                shopCode,
            });
            return respone_1.default.success(res, data, "Fetched shop fields successfully", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            if (error instanceof apiErrors_1.default) {
                return next(error);
            }
            if (error instanceof zod_1.z.ZodError) {
                const message = error.issues[0]?.message || "Dữ liệu không hợp lệ";
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, message));
            }
            next(error);
        }
    },
    async removeForMe(req, res, next) {
        try {
            const userId = Number(req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code);
            if (!Number.isFinite(userId) || userId <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục"));
            }
            const shop = await shop_service_1.default.getByUserId(userId);
            if (!shop || !shop.shop_code) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Bạn không sở hữu shop nào."));
            }
            const fieldCode = Number(req.params.fieldCode ?? req.params.fieldId);
            if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ"));
            }
            const mode = (String(req.query?.mode || "hard").toLowerCase() === "soft"
                ? "soft"
                : "hard");
            try {
                const result = await field_service_1.default.deleteFieldForShop({
                    shopCode: Number(shop.shop_code),
                    fieldCode,
                    mode,
                });
                if (!result) {
                    return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy sân hoặc bạn không có quyền xóa"));
                }
                return respone_1.default.success(res, { deleted: true }, "Xóa sân thành công", http_status_codes_1.StatusCodes.OK);
            }
            catch (error) {
                if (error instanceof apiErrors_1.default) {
                    return next(error);
                }
                return next(error);
            }
        }
        catch (error) {
            next(error);
        }
    },
    async create(req, res, next) {
        try {
            const shopCode = parseShopCode(req);
            const parsed = createShopFieldSchema.safeParse(req.body);
            if (!parsed.success) {
                const message = parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, message));
            }
            const files = req.files ?? [];
            const created = await field_service_1.default.createForShop({
                shopCode,
                fieldName: parsed.data.field_name,
                sportType: parsed.data.sport_type,
                address: parsed.data.address,
                pricePerHour: parsed.data.price_per_hour,
                status: parsed.data.status,
                quantityCount: parsed.data.quantity_count,
            }, files);
            if (!created) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, "Không thể tạo sân mới"));
            }
            return respone_1.default.success(res, created, "Tạo sân thành công", http_status_codes_1.StatusCodes.CREATED);
        }
        catch (error) {
            if (error instanceof apiErrors_1.default) {
                return next(error);
            }
            if (error?.code === "SHOP_NOT_FOUND") {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy shop"));
            }
            if (error?.code === "INVALID_SPORT_TYPE") {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Loại hình thể thao không hợp lệ"));
            }
            if (error?.code === "INVALID_PRICE") {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Giá thuê mỗi giờ không hợp lệ"));
            }
            console.error("[shopFieldController] create field error:", error);
            next(error);
        }
    },
    async update(req, res, next) {
        try {
            const shopCode = parseShopCode(req);
            const fieldId = Number(req.params.fieldId ?? req.params.fieldCode);
            if (!Number.isFinite(fieldId) || fieldId <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ"));
            }
            const parsed = updateShopFieldSchema.safeParse(req.body);
            if (!parsed.success) {
                const message = parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, message));
            }
            // Xử lý xóa ảnh nếu có
            if (parsed.data.deleted_images && parsed.data.deleted_images.length > 0) {
                await field_service_1.default.deleteImages(fieldId, parsed.data.deleted_images, shopCode);
            }
            const updated = await field_service_1.default.updateForShop(shopCode, fieldId, parsed.data);
            if (!updated) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy sân hoặc bạn không có quyền chỉnh sửa"));
            }
            return respone_1.default.success(res, updated, "Cập nhật sân thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async listForMe(req, res, next) {
        try {
            const userId = Number(req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code);
            if (!Number.isFinite(userId) || userId <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục"));
            }
            const shop = await shop_service_1.default.getByUserId(userId);
            if (!shop || !shop.shop_code) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Bạn không sở hữu shop nào."));
            }
            req.params.shopCode = String(shop.shop_code);
            return shopFieldController.list(req, res, next);
        }
        catch (error) {
            next(error);
        }
    },
    async createForMe(req, res, next) {
        try {
            const userId = Number(req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code);
            if (!Number.isFinite(userId) || userId <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục"));
            }
            const shop = await shop_service_1.default.getByUserId(userId);
            if (!shop || !shop.shop_code) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Bạn không sở hữu shop nào."));
            }
            req.params.shopCode = String(shop.shop_code);
            return shopFieldController.create(req, res, next);
        }
        catch (error) {
            next(error);
        }
    },
    async getForMe(req, res, next) {
        try {
            const userId = Number(req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code);
            if (!Number.isFinite(userId) || userId <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục"));
            }
            const shop = await shop_service_1.default.getByUserId(userId);
            if (!shop || !shop.shop_code) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Bạn không sở hữu shop nào."));
            }
            const fieldCode = Number(req.params.fieldCode);
            if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ"));
            }
            const field = await field_service_1.default.getById(fieldCode);
            if (!field || field.shop_code !== shop.shop_code) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Sân không tồn tại hoặc không thuộc quản lý của bạn"));
            }
            return respone_1.default.success(res, field, "Chi tiết sân", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async updateForMe(req, res, next) {
        try {
            const userId = Number(req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code);
            if (!Number.isFinite(userId) || userId <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục"));
            }
            const shop = await shop_service_1.default.getByUserId(userId);
            if (!shop || !shop.shop_code) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Bạn không sở hữu shop nào."));
            }
            req.params.shopCode = String(shop.shop_code);
            return shopFieldController.update(req, res, next);
        }
        catch (error) {
            next(error);
        }
    },
};
exports.default = shopFieldController;
