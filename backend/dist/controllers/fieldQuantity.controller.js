"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const fieldQuantity_service_1 = __importDefault(require("../services/fieldQuantity.service"));
const field_model_1 = __importDefault(require("../models/field.model"));
const shop_service_1 = __importDefault(require("../services/shop.service"));
const respone_1 = __importDefault(require("../core/respone"));
const fieldQuantityController = {
    /**
     * GET /api/fields/:fieldCode/available-quantities
     * Get available quantities for a specific time slot
     */
    async getAvailableQuantities(req, res, next) {
        try {
            const { fieldCode } = req.params;
            const { playDate, startTime, endTime } = req.query;
            if (!fieldCode || !playDate || !startTime || !endTime) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Thiếu thông tin: fieldCode, playDate, startTime, endTime"));
            }
            // Validate field exists
            const field = await field_model_1.default.findById(Number(fieldCode));
            if (!field) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy sân loại"));
            }
            // Get availability
            const availability = await fieldQuantity_service_1.default.getAvailableSlot(Number(fieldCode), String(playDate), String(startTime), String(endTime));
            return respone_1.default.success(res, availability, "Danh sách sân trống", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * GET /api/fields/:fieldCode/quantities
     * Get all quantities for a field
     */
    async getQuantities(req, res, next) {
        try {
            const { fieldCode } = req.params;
            const field = await field_model_1.default.findById(Number(fieldCode));
            if (!field) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy sân loại"));
            }
            const quantities = await fieldQuantity_service_1.default.getQuantitiesForField(Number(fieldCode));
            return respone_1.default.success(res, {
                fieldCode: Number(fieldCode),
                totalQuantities: quantities.length,
                quantities,
            }, "Danh sách sân", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * PUT /api/fields/:fieldCode/quantities/:quantityNumber/status
     * Update quantity status (for admin - maintenance, inactive)
     */
    async updateQuantityStatus(req, res, next) {
        try {
            const userId = Number(req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code);
            if (!Number.isFinite(userId) || userId <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục"));
            }
            const { fieldCode, quantityNumber } = req.params;
            const { status } = req.body;
            if (!["available", "maintenance", "inactive"].includes(status)) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Trạng thái không hợp lệ: available, maintenance, inactive"));
            }
            // Validate ownership
            const field = await field_model_1.default.findById(Number(fieldCode));
            if (!field) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy sân loại"));
            }
            const shop = await shop_service_1.default.getByCode(field.shop_code);
            if (!shop || shop.user_id !== userId) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Bạn không có quyền cập nhật sân này"));
            }
            // Find quantity by fieldCode and quantityNumber
            const quantities = await fieldQuantity_service_1.default.getQuantitiesForField(Number(fieldCode));
            const quantity = quantities.find((q) => q.quantity_number === Number(quantityNumber));
            if (!quantity) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy sân"));
            }
            // Update status
            const updated = await fieldQuantity_service_1.default.updateQuantityStatus(quantity.quantity_id, status);
            return respone_1.default.success(res, updated, "Cập nhật trạng thái sân thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * GET /api/fields/:fieldCode/quantities/:quantityId
     * Get single quantity details
     */
    async getQuantityById(req, res, next) {
        try {
            const { quantityId } = req.params;
            const quantity = await fieldQuantity_service_1.default.getQuantityById(Number(quantityId));
            return respone_1.default.success(res, quantity, "Chi tiết sân", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
};
exports.default = fieldQuantityController;
