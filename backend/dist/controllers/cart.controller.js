"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const respone_1 = __importDefault(require("../core/respone"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const cart_service_1 = __importDefault(require("../services/cart.service"));
const cartController = {
    async listUserCart(req, res, next) {
        try {
            const userId = Number(req.user?.UserID);
            const isGuest = Boolean(req.user?.isGuest) ||
                String(req.user?.role || "").toLowerCase() === "guest";
            if (!Number.isFinite(userId) || userId <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Yêu cầu đăng nhập để xem giỏ hàng"));
            }
            if (isGuest) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Khách vãng lai không có quyền truy cập giỏ hàng"));
            }
            const cartItems = await cart_service_1.default.getUserCart(userId);
            return respone_1.default.success(res, { items: cartItems, total: cartItems.length }, "Danh sách giỏ hàng hiện tại", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Không thể lấy giỏ hàng"));
        }
    },
};
exports.default = cartController;
