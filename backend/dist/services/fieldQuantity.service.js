"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fieldQuantity_model_1 = __importDefault(require("../models/fieldQuantity.model"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const http_status_codes_1 = require("http-status-codes");
const booking_service_1 = require("./booking.service");
const fieldQuantityService = {
    /**
     * Create quantities when a new field is created
     * Automatically called from field.service.ts
     */
    async createQuantitiesForField(fieldCode, count) {
        console.log("[FIELD_QUANTITY.SERVICE] createQuantitiesForField:", {
            fieldCode,
            count,
            type: typeof count,
        });
        if (count <= 0) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Số lượng sân phải lớn hơn 0");
        }
        const created = await fieldQuantity_model_1.default.bulkCreate(fieldCode, count);
        console.log("[FIELD_QUANTITY.SERVICE] bulkCreate result:", {
            fieldCode,
            count,
            created,
        });
        if (created === 0) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, "Lỗi khi tạo sân");
        }
        return created;
    },
    /**
     * Get all quantities for a field with their status
     */
    async getQuantitiesForField(fieldCode) {
        return await fieldQuantity_model_1.default.getByFieldCode(fieldCode);
    },
    /**
     * Get quantities for multiple fields (used in batch hydration)
     */
    async getMultipleFieldQuantities(fieldCodes) {
        if (!fieldCodes.length)
            return [];
        const allQuantities = [];
        for (const fieldCode of fieldCodes) {
            const quantities = await fieldQuantity_model_1.default.getByFieldCode(fieldCode);
            allQuantities.push(...quantities.map((q) => ({
                field_code: fieldCode,
                quantity_id: q.quantity_id,
                quantity_number: q.quantity_number,
                status: q.status,
            })));
        }
        return allQuantities;
    },
    /**
     * Get available quantities for a specific time slot
     * MAIN FUNCTION: Check which courts are free at a given time
     */
    async getAvailableSlot(fieldCode, playDate, startTime, endTime) {
        // Release any expired holds before checking availability
        await (0, booking_service_1.releaseExpiredHeldSlots)(fieldCode);
        // Get all quantities for this field
        const allQuantities = await fieldQuantity_model_1.default.getByFieldCode(fieldCode);
        // Get available quantities (not booked, status=available)
        const availableQuantities = await fieldQuantity_model_1.default.getAvailableForSlot(fieldCode, playDate, startTime, endTime);
        // Get booked quantities
        const bookedQuantities = await fieldQuantity_model_1.default.getBookedForSlot(fieldCode, playDate, startTime, endTime);
        return {
            fieldCode,
            playDate,
            timeSlot: `${startTime}-${endTime}`,
            totalQuantities: allQuantities.length,
            availableQuantities,
            bookedQuantities,
            availableCount: availableQuantities.length,
        };
    },
    /**
     * Check if a specific quantity is available for booking
     */
    async checkAvailability(quantityId, playDate, startTime, endTime) {
        return await fieldQuantity_model_1.default.isAvailableForSlot(quantityId, playDate, startTime, endTime);
    },
    /**
     * Get quantity details by ID
     */
    async getQuantityById(quantityId) {
        const quantity = await fieldQuantity_model_1.default.getById(quantityId);
        if (!quantity) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy sân");
        }
        return quantity;
    },
    /**
     * Update quantity status (for maintenance, etc.)
     */
    async updateQuantityStatus(quantityId, status) {
        const quantity = await fieldQuantity_model_1.default.getById(quantityId);
        if (!quantity) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy sân");
        }
        const updated = await fieldQuantity_model_1.default.updateStatus(quantityId, status);
        if (!updated) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, "Lỗi khi cập nhật trạng thái sân");
        }
        return await fieldQuantity_model_1.default.getById(quantityId);
    },
    /**
     * Validate that quantity belongs to field
     */
    async validateQuantityOwnership(quantityId, fieldCode) {
        const quantity = await fieldQuantity_model_1.default.getById(quantityId);
        if (!quantity)
            return false;
        return quantity.field_code === fieldCode;
    },
    /**
     * Get available quantities count for a field (for quick checks)
     */
    async getAvailableCount(fieldCode) {
        const available = await fieldQuantity_model_1.default.getAvailableQuantities(fieldCode);
        return available.length;
    },
    /**
     * Get total quantities count for a field
     */
    async getTotalCount(fieldCode) {
        return await fieldQuantity_model_1.default.getCountByFieldCode(fieldCode);
    },
    async getMaxQuantityNumber(fieldCode) {
        return await fieldQuantity_model_1.default.getMaxQuantityNumber(fieldCode);
    },
    async countFutureBookedQuantities(fieldCode) {
        return await fieldQuantity_model_1.default.countFutureBookedQuantities(fieldCode);
    },
    async getRemovableQuantityIds(fieldCode, limit) {
        return await fieldQuantity_model_1.default.getRemovableQuantityIds(fieldCode, limit);
    },
    async deleteQuantitiesByIds(quantityIds) {
        if (!quantityIds.length)
            return 0;
        return await fieldQuantity_model_1.default.deleteByIds(quantityIds);
    },
};
exports.default = fieldQuantityService;
