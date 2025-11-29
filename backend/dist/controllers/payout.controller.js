"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const respone_1 = __importDefault(require("../core/respone"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const payout_service_1 = __importDefault(require("../services/payout.service"));
const shop_service_1 = __importDefault(require("../services/shop.service"));
const payoutController = {
    /**
     * Tạo yêu cầu rút tiền (Shop)
     * POST /api/shops/me/payout-requests
     */
    async createPayoutRequest(req, res, next) {
        try {
            const userId = req.user?.UserID;
            const { amount, bank_id, note, password } = req.body;
            if (!amount || amount <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Số tiền phải lớn hơn 0"));
            }
            if (!password) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Vui lòng nhập mật khẩu để xác nhận"));
            }
            const shop = await shop_service_1.default.getByUserId(Number(userId));
            if (!shop?.shop_code || shop.is_approved !== "Y") {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Bạn không có shop hoặc shop chưa được duyệt"));
            }
            const shopCode = Number(shop.shop_code);
            // Nếu không gửi bank_id, sẽ dùng default (bank_id = 0)
            const bankId = bank_id || 0;
            console.log(`[Payout Controller] Request data:`, {
                userId,
                shopCode,
                amount,
                bank_id_from_request: bank_id,
                bankId_final: bankId,
                has_password: !!password,
            });
            const result = await payout_service_1.default.createPayoutRequest(shopCode, bankId, amount, note, userId, password);
            return respone_1.default.success(res, result, "Tạo yêu cầu rút tiền thành công", http_status_codes_1.StatusCodes.CREATED);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi tạo yêu cầu rút tiền"));
        }
    },
    /**
     * Liệt kê yêu cầu rút tiền của shop
     * GET /api/shops/me/payout-requests
     */
    async listPayoutRequests(req, res, next) {
        try {
            const userId = req.user?.UserID;
            const { status, limit = 10, offset = 0 } = req.query;
            const shop = await shop_service_1.default.getByUserId(Number(userId));
            if (!shop?.shop_code) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Bạn không có shop"));
            }
            const shopCode = Number(shop.shop_code);
            const result = await payout_service_1.default.listPayoutsByShop(shopCode, status, Number(limit), Number(offset));
            return respone_1.default.success(res, result, "Lấy danh sách yêu cầu rút tiền thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi lấy danh sách rút tiền"));
        }
    },
    /**
     * Chi tiết yêu cầu rút tiền
     * GET /api/shops/me/payout-requests/:payoutID
     */
    async getPayoutRequest(req, res, next) {
        try {
            const userId = req.user?.UserID;
            const { payoutID } = req.params;
            const shop = await shop_service_1.default.getByUserId(Number(userId));
            if (!shop?.shop_code) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Bạn không có shop"));
            }
            const result = await payout_service_1.default.getPayoutByID(Number(payoutID));
            if (!result || result.ShopCode !== Number(shop.shop_code)) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Bạn không có quyền truy cập"));
            }
            return respone_1.default.success(res, result, "Chi tiết yêu cầu rút tiền", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi lấy chi tiết rút tiền"));
        }
    },
    /**
     * ADMIN: Liệt kê tất cả yêu cầu rút tiền
     * GET /api/admin/payout-requests
     */
    async adminListPayouts(req, res, next) {
        try {
            const { status, shop_code, limit = 10, offset = 0 } = req.query;
            const result = await payout_service_1.default.listAllPayouts(status, shop_code ? Number(shop_code) : undefined, Number(limit), Number(offset));
            return respone_1.default.success(res, result, "Danh sách yêu cầu rút tiền", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi lấy danh sách"));
        }
    },
    /**
     * ADMIN: Chi tiết yêu cầu rút tiền
     * GET /api/admin/payout-requests/:payoutID
     */
    async adminGetPayout(req, res, next) {
        try {
            const { payoutID } = req.params;
            const result = await payout_service_1.default.getPayoutByID(Number(payoutID));
            if (!result) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy payout"));
            }
            return respone_1.default.success(res, result, "Chi tiết payout", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi lấy chi tiết"));
        }
    },
    /**
     * ADMIN: Duyệt rút tiền
     * PATCH /api/admin/payout-requests/:payoutID/approve
     */
    async adminApprovePayout(req, res, next) {
        try {
            const { payoutID } = req.params;
            const { note } = req.body;
            const result = await payout_service_1.default.approvePayoutRequest(Number(payoutID), note);
            return respone_1.default.success(res, result, "Duyệt rút tiền thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi duyệt rút tiền"));
        }
    },
    /**
     * ADMIN: Từ chối rút tiền
     * PATCH /api/admin/payout-requests/:payoutID/reject
     */
    async adminRejectPayout(req, res, next) {
        try {
            const { payoutID } = req.params;
            const { reason } = req.body;
            if (!reason) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Vui lòng cung cấp lý do từ chối"));
            }
            const result = await payout_service_1.default.rejectPayoutRequest(Number(payoutID), reason);
            return respone_1.default.success(res, result, "Từ chối rút tiền thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi từ chối rút tiền"));
        }
    },
};
exports.default = payoutController;
