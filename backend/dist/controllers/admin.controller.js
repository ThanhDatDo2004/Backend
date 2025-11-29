"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const respone_1 = __importDefault(require("../core/respone"));
const admin_service_1 = __importDefault(require("../services/admin.service"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const toInt = (v) => {
    if (v === null || v === undefined || v === "")
        return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
};
const toNonNegInt = (v, fallback = 0) => {
    const n = toInt(v);
    return n !== undefined && n >= 0 ? n : fallback;
};
const toPosInt = (v, fallback = 1) => {
    const n = toInt(v);
    return n !== undefined && n > 0 ? n : fallback;
};
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const toBoolFlexible = (v) => {
    if (typeof v === "boolean")
        return v;
    if (typeof v === "number")
        return v !== 0;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (["1", "true", "yes", "y", "on"].includes(s))
            return true;
        if (["0", "false", "no", "n", "off"].includes(s))
            return false;
    }
    return undefined;
};
const toDateStringLoose = (v) => {
    if (typeof v !== "string")
        return undefined;
    const s = v.trim();
    if (!s)
        return undefined;
    return s;
};
const isOneOf = (val, list) => typeof val === "string" && list.includes(val);
const adminController = {
    async listShops(req, res, next) {
        try {
            const shops = await admin_service_1.default.listShops();
            return respone_1.default.success(res, shops, "Fetched shops successfully", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async listUsers(req, res, next) {
        try {
            const users = await admin_service_1.default.listUsers();
            return respone_1.default.success(res, users, "Fetched users successfully", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async listUserLevels(req, res, next) {
        try {
            const levels = await admin_service_1.default.listUserLevels();
            return respone_1.default.success(res, levels, "Fetched user levels successfully", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async updateUserStatus(req, res, next) {
        try {
            const userId = toPosInt(req.params.id);
            if (!userId) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã người dùng không hợp lệ"));
            }
            const desired = toBoolFlexible(req.body?.isActive);
            if (desired === undefined) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Trạng thái không hợp lệ"));
            }
            const updated = await admin_service_1.default.updateUserStatus(userId, desired);
            if (!updated) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy người dùng"));
            }
            return respone_1.default.success(res, updated, desired ? "Đã mở khóa tài khoản người dùng" : "Đã khóa tài khoản người dùng", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async listShopRequests(req, res, next) {
        try {
            const requests = await admin_service_1.default.listShopRequests();
            return respone_1.default.success(res, requests, "Fetched shop requests successfully", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async getShopRequestById(req, res, next) {
        try {
            const id = toPosInt(req.params.id);
            if (!id) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã yêu cầu không hợp lệ"));
            }
            const request = await admin_service_1.default.getShopRequestById(id);
            if (!request) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy yêu cầu"));
            }
            return respone_1.default.success(res, request, "Fetched shop request successfully", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    /** Chỉ giữ enum rất mỏng, không Zod */
    async updateShopRequestStatus(req, res, next) {
        try {
            const id = toPosInt(req.params.id);
            if (!id) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã yêu cầu không hợp lệ"));
            }
            const allowed = ["pending", "reviewed", "approved", "rejected"];
            const status = req.body?.status;
            if (!isOneOf(status, allowed)) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Trạng thái không hợp lệ"));
            }
            const updated = await admin_service_1.default.updateShopRequestStatus(id, status);
            if (!updated) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy yêu cầu"));
            }
            return respone_1.default.success(res, updated, `Đã cập nhật trạng thái yêu cầu sang "${status}"`, http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            if (error instanceof apiErrors_1.default)
                return next(error);
            if (error instanceof Error) {
                if (error.message === "SHOP_REQUEST_EMAIL_REQUIRED") {
                    return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Yêu cầu không có email hợp lệ. Vui lòng cập nhật email trước khi duyệt."));
                }
                if (error.message === "SHOP_REQUEST_USER_NOT_FOUND") {
                    return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Không tìm thấy người dùng có email trùng khớp. Vui lòng tạo tài khoản shop trước khi duyệt."));
                }
            }
            next(new apiErrors_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, error?.message || "Không thể cập nhật trạng thái yêu cầu"));
        }
    },
    /** Bộ lọc tài chính “tự nhiên”: chấp nhận chuỗi ngày thoáng, số ép mềm, có mặc định */
    async listFinanceBookings(req, res, next) {
        try {
            const q = req.query;
            const startDate = toDateStringLoose(q.startDate);
            const endDate = toDateStringLoose(q.endDate);
            const fieldCode = toInt(q.fieldCode);
            const customerUID = toInt(q.customerUserID);
            const bookingStatus = typeof q.bookingStatus === "string" && q.bookingStatus.trim()
                ? q.bookingStatus.trim()
                : undefined;
            const numericLimit = clamp(toPosInt(q.limit, 200), 1, 500);
            const numericOffset = toNonNegInt(q.offset, 0);
            const data = await admin_service_1.default.listFinanceBookings({
                startDate,
                endDate,
                fieldCode: fieldCode,
                customerUserID: customerUID,
                bookingStatus,
                limit: numericLimit,
                offset: numericOffset,
            });
            return respone_1.default.success(res, data, "Danh sách booking tài chính", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
};
exports.default = adminController;
