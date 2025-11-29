"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const field_model_1 = __importDefault(require("../models/field.model"));
const pricing_model_1 = __importDefault(require("../models/pricing.model"));
const shop_model_1 = __importDefault(require("../models/shop.model"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const pricingService = {
    async validateFieldOwnership(fieldCode, userId) {
        // Check if the field belongs to the user's shop
        const field = await field_model_1.default.findById(fieldCode);
        if (!field) {
            return false;
        }
        const shop = await field_model_1.default.findShopByCode(field.shop_code);
        if (!shop || shop.user_id !== userId) {
            return false;
        }
        return true;
    },
    async listOperatingHoursByField(fieldCode, userId) {
        // Validate field ownership
        const isOwner = await this.validateFieldOwnership(fieldCode, userId);
        if (!isOwner) {
            throw new apiErrors_1.default(403, "Bạn không có quyền truy cập sân này");
        }
        const pricingData = await field_model_1.default.listPricing(fieldCode);
        // Remove price_per_hour from response since we only manage operating hours
        return pricingData.map((item) => ({
            pricing_id: item.pricing_id,
            field_code: item.field_code,
            day_of_week: item.day_of_week,
            start_time: item.start_time,
            end_time: item.end_time,
        }));
    },
    async createOperatingHours(payload, userId) {
        // Validate field ownership
        const isOwner = await this.validateFieldOwnership(payload.fieldCode, userId);
        if (!isOwner) {
            throw new apiErrors_1.default(403, "Bạn không có quyền quản lý sân này");
        }
        // Validate time format and logic
        this.validateTimeFormat(payload.startTime, payload.endTime);
        await this.ensureWithinShopOperatingWindow(payload.fieldCode, payload.startTime, payload.endTime);
        // Check for overlapping time slots for the same day
        const overlapCount = await pricing_model_1.default.checkTimeOverlap(payload.fieldCode, payload.dayOfWeek, payload.startTime, payload.endTime);
        if (overlapCount > 0) {
            throw new apiErrors_1.default(400, "Khung giờ này đã trùng với khung giờ khác trong cùng ngày");
        }
        const defaultPrice = await pricing_model_1.default.getDefaultPrice(payload.fieldCode);
        const pricingId = await pricing_model_1.default.createOperatingHours(payload.fieldCode, payload.dayOfWeek, payload.startTime, payload.endTime, defaultPrice);
        // Return the created operating hours record
        const createdHours = await pricing_model_1.default.getPricingById(pricingId);
        if (!createdHours) {
            throw new apiErrors_1.default(500, "Không thể lấy thông tin giờ hoạt động vừa tạo");
        }
        return createdHours;
    },
    async updateOperatingHours(pricingId, payload, userId) {
        // Get existing operating hours to validate ownership
        const existingHours = await pricing_model_1.default.getOperatingHoursById(pricingId, userId);
        if (!existingHours) {
            throw new apiErrors_1.default(404, "Không tìm thấy giờ hoạt động");
        }
        // Validate field ownership
        const isOwner = await this.validateFieldOwnership(existingHours.field_code, userId);
        if (!isOwner) {
            throw new apiErrors_1.default(403, "Bạn không có quyền cập nhật giờ hoạt động này");
        }
        // If updating time fields, validate them
        const startTime = payload.startTime ?? existingHours.start_time;
        const endTime = payload.endTime ?? existingHours.end_time;
        if (payload.startTime || payload.endTime) {
            this.validateTimeFormat(startTime, endTime);
        }
        // If updating day or time, check for overlaps (excluding current record)
        const dayOfWeek = payload.dayOfWeek ?? existingHours.day_of_week;
        if (payload.dayOfWeek || payload.startTime || payload.endTime) {
            const overlapCount = await pricing_model_1.default.checkTimeOverlap(existingHours.field_code, dayOfWeek, startTime, endTime, pricingId);
            if (overlapCount > 0) {
                throw new apiErrors_1.default(400, "Khung giờ này đã trùng với khung giờ khác trong cùng ngày");
            }
        }
        await this.ensureWithinShopOperatingWindow(existingHours.field_code, startTime, endTime);
        // Prepare update data
        const updateFields = {};
        if (payload.dayOfWeek !== undefined) {
            updateFields.dayOfWeek = payload.dayOfWeek;
        }
        if (payload.startTime !== undefined) {
            updateFields.startTime = payload.startTime;
        }
        if (payload.endTime !== undefined) {
            updateFields.endTime = payload.endTime;
        }
        const updated = await pricing_model_1.default.updateOperatingHours(pricingId, updateFields);
        if (!updated) {
            throw new apiErrors_1.default(500, "Không thể cập nhật giờ hoạt động");
        }
        // Return updated operating hours
        const updatedHours = await pricing_model_1.default.getOperatingHoursById(pricingId, userId);
        if (!updatedHours) {
            throw new apiErrors_1.default(500, "Không thể lấy thông tin giờ hoạt động đã cập nhật");
        }
        return updatedHours;
    },
    async deleteOperatingHours(pricingId, userId) {
        // Get existing operating hours to validate ownership
        const existingHours = await pricing_model_1.default.getOperatingHoursById(pricingId, userId);
        if (!existingHours) {
            throw new apiErrors_1.default(404, "Không tìm thấy giờ hoạt động");
        }
        // Validate field ownership
        const isOwner = await this.validateFieldOwnership(existingHours.field_code, userId);
        if (!isOwner) {
            throw new apiErrors_1.default(403, "Bạn không có quyền xóa giờ hoạt động này");
        }
        return await pricing_model_1.default.deleteOperatingHours(pricingId);
    },
    async getOperatingHoursById(pricingId, userId) {
        return await pricing_model_1.default.getOperatingHoursById(pricingId, userId);
    },
    validateTimeFormat(startTime, endTime) {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(startTime)) {
            throw new apiErrors_1.default(400, "Thời gian bắt đầu không hợp lệ (định dạng: HH:MM)");
        }
        if (!timeRegex.test(endTime)) {
            throw new apiErrors_1.default(400, "Thời gian kết thúc không hợp lệ (định dạng: HH:MM)");
        }
        // Convert to minutes for comparison
        const startMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);
        if (startMinutes >= endMinutes) {
            throw new apiErrors_1.default(400, "Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc");
        }
    },
    timeToMinutes(time) {
        const parts = time.split(":").map((part) => part.trim());
        const hours = Number(parts[0] ?? "0");
        const minutes = Number(parts[1] ?? "0");
        return hours * 60 + minutes;
    },
    async ensureWithinShopOperatingWindow(fieldCode, startTime, endTime) {
        const field = await field_model_1.default.findById(fieldCode);
        if (!field) {
            throw new apiErrors_1.default(404, "Không tìm thấy sân");
        }
        const shop = await shop_model_1.default.getByCode(field.shop_code);
        if (!shop) {
            throw new apiErrors_1.default(404, "Không tìm thấy shop");
        }
        const openingTime = shop.opening_time;
        const closingTime = shop.closing_time;
        const isOpen24hFlag = shop.is_open_24h;
        const isOpen24h = typeof isOpen24hFlag === "boolean"
            ? isOpen24hFlag
            : Number(isOpen24hFlag ?? 0) === 1;
        if (isOpen24h) {
            return;
        }
        if (!openingTime || !closingTime) {
            throw new apiErrors_1.default(400, "Vui lòng thiết lập giờ mở và đóng cửa của shop trước khi thêm khung giờ hoạt động");
        }
        const shopOpenMinutes = this.timeToMinutes(openingTime);
        const shopCloseMinutes = this.timeToMinutes(closingTime);
        const startMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);
        if (startMinutes < shopOpenMinutes || endMinutes > shopCloseMinutes) {
            throw new apiErrors_1.default(400, `Khung giờ phải nằm trong khoảng ${openingTime} - ${closingTime}`);
        }
    },
};
exports.default = pricingService;
