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
const walletController = {
    /**
     * Lấy thông tin ví hiện tại (Shop)
     * GET /api/shops/me/wallet
     */
    async getWallet(req, res, next) {
        try {
            const userId = req.user?.UserID;
            const shop = await shop_service_1.default.getByUserId(Number(userId));
            if (!shop?.shop_code) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Bạn không có shop"));
            }
            const shopCode = Number(shop.shop_code);
            const stats = await payout_service_1.default.getShopWalletStats(shopCode);
            return respone_1.default.success(res, stats, "Thông tin ví", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi lấy thông tin ví"));
        }
    },
    /**
     * Lịch sử giao dịch (Shop)
     * GET /api/shops/me/wallet/transactions
     */
    async getWalletTransactions(req, res, next) {
        try {
            const userId = req.user?.UserID;
            const { type, limit = 10, offset = 0 } = req.query;
            const shop = await shop_service_1.default.getByUserId(Number(userId));
            if (!shop?.shop_code) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Bạn không có shop"));
            }
            const shopCode = Number(shop.shop_code);
            const numericLimit = Number(limit) || 10;
            const numericOffset = Number(offset) || 0;
            const transactions = await payout_service_1.default.listWalletTransactions(shopCode, typeof type === "string" ? type : undefined, numericLimit, numericOffset);
            const total = await payout_service_1.default.countWalletTransactions(shopCode, typeof type === "string" ? type : undefined);
            return respone_1.default.success(res, {
                data: transactions,
                pagination: {
                    limit: numericLimit,
                    offset: numericOffset,
                    total,
                },
            }, "Lịch sử giao dịch", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi lấy lịch sử giao dịch"));
        }
    },
    /**
     * ADMIN: Xem ví của shop
     * GET /api/admin/shops/:shopCode/wallet
     */
    async adminGetShopWallet(req, res, next) {
        try {
            const { shopCode } = req.params;
            const stats = await payout_service_1.default.getShopWalletStats(Number(shopCode));
            return respone_1.default.success(res, stats, "Thông tin ví shop", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi lấy ví shop"));
        }
    },
    /**
     * ADMIN: Lịch sử giao dịch của shop
     * GET /api/admin/shops/:shopCode/wallet/transactions
     */
    async adminGetShopTransactions(req, res, next) {
        try {
            const { shopCode } = req.params;
            const { type, limit = 10, offset = 0 } = req.query;
            const numericLimit = Number(limit) || 10;
            const numericOffset = Number(offset) || 0;
            const numericShopCode = Number(shopCode);
            const transactions = await payout_service_1.default.listWalletTransactions(numericShopCode, typeof type === "string" ? type : undefined, numericLimit, numericOffset);
            const total = await payout_service_1.default.countWalletTransactions(numericShopCode, typeof type === "string" ? type : undefined);
            return respone_1.default.success(res, {
                data: transactions,
                pagination: {
                    limit: numericLimit,
                    offset: numericOffset,
                    total,
                },
            }, "Lịch sử giao dịch", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi lấy lịch sử"));
        }
    },
};
exports.default = walletController;
