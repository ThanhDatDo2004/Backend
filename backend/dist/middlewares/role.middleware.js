"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectGuest = exports.requireShopOwner = exports.requireAdmin = void 0;
const http_status_codes_1 = require("http-status-codes");
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
function resolveRole(req) {
    const roleSources = [
        req.user?.role,
        req.user?.LevelType,
        req.user?.level_type,
    ];
    return String(roleSources.find((value) => value)?.toString() ?? "").toLowerCase();
}
const requireAdmin = (message = "Chỉ quản trị viên mới được phép truy cập") => {
    return (req, _res, next) => {
        const role = resolveRole(req);
        if (role !== "admin") {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, message);
        }
        next();
    };
};
exports.requireAdmin = requireAdmin;
const requireShopOwner = (message = "Chỉ chủ cửa hàng mới được phép truy cập") => {
    return (req, _res, next) => {
        const role = resolveRole(req);
        if (role === "admin" || role === "shop") {
            return next();
        }
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, message);
    };
};
exports.requireShopOwner = requireShopOwner;
const rejectGuest = (message = "Khách vãng lai không có quyền truy cập") => (req, _res, next) => {
    const role = resolveRole(req);
    const isGuest = role === "guest" || Boolean(req.user?.isGuest);
    if (isGuest) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, message);
    }
    next();
};
exports.rejectGuest = rejectGuest;
exports.default = {
    rejectGuest: exports.rejectGuest,
    requireAdmin: exports.requireAdmin,
    requireShopOwner: exports.requireShopOwner,
};
