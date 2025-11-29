"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const zod_1 = require("zod");
const respone_1 = __importDefault(require("../core/respone"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const pricing_service_1 = __importDefault(require("../services/pricing.service"));
const createOperatingHoursSchema = zod_1.z.object({
    day_of_week: zod_1.z.coerce
        .number()
        .int()
        .min(0, "Thứ trong tuần phải từ 0-6 (Chủ nhật = 0)")
        .max(6, "Thứ trong tuần phải từ 0-6 (Chủ nhật = 0)"),
    start_time: zod_1.z.string()
        .trim()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Thời gian bắt đầu phải có định dạng HH:MM"),
    end_time: zod_1.z.string()
        .trim()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Thời gian kết thúc phải có định dạng HH:MM")
});
const updateOperatingHoursSchema = zod_1.z.object({
    day_of_week: zod_1.z.coerce
        .number()
        .int()
        .min(0, "Thứ trong tuần phải từ 0-6 (Chủ nhật = 0)")
        .max(6, "Thứ trong tuần phải từ 0-6 (Chủ nhật = 0)")
        .optional(),
    start_time: zod_1.z.string()
        .trim()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Thời gian bắt đầu phải có định dạng HH:MM")
        .optional(),
    end_time: zod_1.z.string()
        .trim()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Thời gian kết thúc phải có định dạng HH:MM")
        .optional()
}).refine(data => {
    // At least one field must be provided for update
    return Object.keys(data).length > 0;
}, {
    message: "Phải cung cấp ít nhất một trường để cập nhật"
});
function parseFieldCode(req) {
    const fieldCode = Number(req.params.fieldCode);
    if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ");
    }
    return fieldCode;
}
function parsePricingId(req) {
    const pricingId = Number(req.params.pricingId);
    if (!Number.isFinite(pricingId) || pricingId <= 0) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã giá không hợp lệ");
    }
    return pricingId;
}
function getUserId(req) {
    const userId = Number(req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code);
    if (!Number.isFinite(userId) || userId <= 0) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục");
    }
    return userId;
}
const pricingController = {
    async listOperatingHours(req, res, next) {
        try {
            const fieldCode = parseFieldCode(req);
            const userId = getUserId(req);
            const operatingHours = await pricing_service_1.default.listOperatingHoursByField(fieldCode, userId);
            return respone_1.default.success(res, operatingHours, "Lấy danh sách giờ hoạt động thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            if (error instanceof apiErrors_1.default) {
                return next(error);
            }
            next(new apiErrors_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, "Lỗi hệ thống"));
        }
    },
    async createOperatingHours(req, res, next) {
        try {
            const fieldCode = parseFieldCode(req);
            const userId = getUserId(req);
            const parsed = createOperatingHoursSchema.safeParse(req.body);
            if (!parsed.success) {
                const message = parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, message));
            }
            const operatingHoursData = {
                fieldCode,
                dayOfWeek: parsed.data.day_of_week,
                startTime: parsed.data.start_time,
                endTime: parsed.data.end_time
            };
            const createdHours = await pricing_service_1.default.createOperatingHours(operatingHoursData, userId);
            return respone_1.default.success(res, createdHours, "Tạo giờ hoạt động mới thành công", http_status_codes_1.StatusCodes.CREATED);
        }
        catch (error) {
            if (error instanceof apiErrors_1.default) {
                return next(error);
            }
            next(new apiErrors_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, "Lỗi hệ thống"));
        }
    },
    async updateOperatingHours(req, res, next) {
        try {
            const pricingId = parsePricingId(req);
            const userId = getUserId(req);
            const parsed = updateOperatingHoursSchema.safeParse(req.body);
            if (!parsed.success) {
                const message = parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, message));
            }
            const updateData = {
                dayOfWeek: parsed.data.day_of_week,
                startTime: parsed.data.start_time,
                endTime: parsed.data.end_time
            };
            const updatedHours = await pricing_service_1.default.updateOperatingHours(pricingId, updateData, userId);
            return respone_1.default.success(res, updatedHours, "Cập nhật giờ hoạt động thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            if (error instanceof apiErrors_1.default) {
                return next(error);
            }
            next(new apiErrors_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, "Lỗi hệ thống"));
        }
    },
    async deleteOperatingHours(req, res, next) {
        try {
            const pricingId = parsePricingId(req);
            const userId = getUserId(req);
            const deleted = await pricing_service_1.default.deleteOperatingHours(pricingId, userId);
            if (!deleted) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy giờ hoạt động để xóa"));
            }
            return respone_1.default.success(res, { deleted: true }, "Xóa giờ hoạt động thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            if (error instanceof apiErrors_1.default) {
                return next(error);
            }
            next(new apiErrors_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, "Lỗi hệ thống"));
        }
    }
};
exports.default = pricingController;
