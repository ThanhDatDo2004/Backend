"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const zod_1 = require("zod");
const respone_1 = __importDefault(require("../core/respone"));
const mail_service_1 = require("../services/mail.service");
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const shopApplication_service_1 = __importDefault(require("../services/shopApplication.service"));
const shop_service_1 = __importDefault(require("../services/shop.service"));
const shopUtilities_service_1 = require("../services/shopUtilities.service");
const shopRequestSchema = zod_1.z.object({
    full_name: zod_1.z.string().trim().min(2, "Họ và tên phải có ít nhất 2 ký tự"),
    email: zod_1.z.string().trim().email("Email không hợp lệ"),
    phone_number: zod_1.z
        .string()
        .trim()
        .regex(/^[0-9]{10,11}$/, "Số điện thoại phải có 10-11 chữ số"),
    address: zod_1.z.string().trim().min(10, "Địa chỉ phải có ít nhất 10 ký tự"),
    message: zod_1.z.string().trim().optional(),
});
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const normalizeTimeInput = (value) => {
    if (value === null || value === undefined)
        return null;
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
        return trimmed.slice(0, 5);
    }
    return trimmed;
};
const timeToMinutes = (time) => {
    const [hours, minutes] = time.split(":").map((part) => Number(part));
    return hours * 60 + minutes;
};
const toBoolFlexible = (value, fallback = false) => {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "number")
        return value !== 0;
    if (typeof value === "string") {
        const lowered = value.trim().toLowerCase();
        if (["1", "true", "y", "yes"].includes(lowered))
            return true;
        if (["0", "false", "n", "no"].includes(lowered))
            return false;
    }
    return fallback;
};
const shopController = {
    async submitRequest(req, res, next) {
        try {
            const parsed = shopRequestSchema.safeParse(req.body);
            if (!parsed.success) {
                const message = parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, message));
            }
            const payload = parsed.data;
            const savedRequest = await shopApplication_service_1.default.createRequest(payload);
            await (0, mail_service_1.sendShopRequestEmail)(payload);
            return respone_1.default.success(res, { ok: true, request: savedRequest }, "Đã gửi yêu cầu mở shop", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Không thể gửi yêu cầu"));
        }
    },
    async updateMe(req, res, next) {
        try {
            const userId = Number(req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code);
            if (!Number.isFinite(userId) || userId <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục"));
            }
            const schema = zod_1.z.object({
                shop_name: zod_1.z.string().trim().min(2, "Tên shop phải có ít nhất 2 ký tự"),
                address: zod_1.z.string().trim().min(5, "Địa chỉ phải có ít nhất 5 ký tự"),
                bank_account_number: zod_1.z.string().trim().optional(),
                bank_name: zod_1.z.string().trim().optional(),
                bank_account_holder: zod_1.z.string().trim().optional(),
                phone_number: zod_1.z
                    .string()
                    .trim()
                    .optional()
                    .refine((value) => value === undefined ||
                    value === "" ||
                    /^[0-9]{10,11}$/.test(value), "Số điện thoại phải có 10-11 chữ số"),
                opening_time: zod_1.z.union([zod_1.z.string(), zod_1.z.null()]).optional(),
                closing_time: zod_1.z.union([zod_1.z.string(), zod_1.z.null()]).optional(),
                is_open_24h: zod_1.z.union([zod_1.z.boolean(), zod_1.z.string(), zod_1.z.number()]).optional(),
            });
            const parsed = schema.safeParse(req.body);
            if (!parsed.success) {
                const message = parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, message));
            }
            const data = parsed.data;
            let openingTime = normalizeTimeInput(data.opening_time);
            let closingTime = normalizeTimeInput(data.closing_time);
            const isOpen24h = toBoolFlexible(data.is_open_24h, false);
            if (isOpen24h) {
                openingTime = null;
                closingTime = null;
            }
            else {
                if (!openingTime || !closingTime) {
                    return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Vui lòng nhập đầy đủ giờ mở và giờ đóng cửa"));
                }
                if (!TIME_REGEX.test(openingTime) || !TIME_REGEX.test(closingTime)) {
                    return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Giờ mở/đóng cửa phải có định dạng HH:MM"));
                }
                if (timeToMinutes(openingTime) >= timeToMinutes(closingTime)) {
                    return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Giờ mở cửa phải nhỏ hơn giờ đóng cửa"));
                }
            }
            const updated = await shop_service_1.default.updateByUserId(userId, {
                ...data,
                opening_time: openingTime,
                closing_time: closingTime,
                is_open_24h: isOpen24h,
            });
            if (!updated) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy shop"));
            }
            return respone_1.default.success(res, updated, "Cập nhật shop thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async current(req, res, next) {
        try {
            const userId = Number(req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code);
            if (!Number.isFinite(userId) || userId <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục"));
            }
            return respone_1.default.success(res, await shop_service_1.default.getByUserId(userId), "Fetched shop successfully", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * Lấy danh sách tài khoản ngân hàng
     * GET /api/shops/me/bank-accounts
     */
    async getBankAccounts(req, res, next) {
        try {
            const userId = req.user?.UserID;
            const shop = await shop_service_1.default.getByUserId(Number(userId));
            if (!shop?.shop_code) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Bạn không có shop"));
            }
            const bankAccounts = await shop_service_1.default.listBankAccounts(Number(shop.shop_code));
            return respone_1.default.success(res, bankAccounts || [], "Lấy danh sách tài khoản ngân hàng thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi lấy danh sách tài khoản ngân hàng"));
        }
    },
    async getUtilities(req, res, next) {
        try {
            const shopCode = Number(req.params.shopCode);
            if (!Number.isFinite(shopCode) || shopCode <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã shop không hợp lệ"));
            }
            const shop = await shop_service_1.default.getByCode(shopCode);
            if (!shop) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy shop"));
            }
            return respone_1.default.success(res, await (0, shopUtilities_service_1.listShopUtilities)(shopCode), "Danh sách tiện ích của shop", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Không thể lấy danh sách tiện ích"));
        }
    },
    async updateUtilities(req, res, next) {
        try {
            const shopCode = Number(req.params.shopCode);
            if (!Number.isFinite(shopCode) || shopCode <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã shop không hợp lệ"));
            }
            const userId = Number(req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code);
            if (!Number.isFinite(userId) || userId <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục"));
            }
            const shop = await shop_service_1.default.getByCode(shopCode);
            if (!shop) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy shop"));
            }
            if (Number(shop.user_id ?? shop.UserID) !== userId) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Bạn không có quyền cập nhật tiện ích cho shop này"));
            }
            const utilitiesInput = Array.isArray(req.body?.utilities)
                ? req.body.utilities.map((item) => String(item ?? "").trim())
                : [];
            return respone_1.default.success(res, await (0, shopUtilities_service_1.replaceShopUtilities)(shopCode, utilitiesInput), "Cập nhật tiện ích thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Không thể cập nhật tiện ích"));
        }
    },
};
exports.default = shopController;
