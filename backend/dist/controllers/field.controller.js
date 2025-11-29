"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const respone_1 = __importDefault(require("../core/respone"));
const field_service_1 = __importDefault(require("../services/field.service"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const booking_service_1 = require("../services/booking.service");
const shopUtilities_service_1 = require("../services/shopUtilities.service");
const toNumber = (value) => {
    if (typeof value === "number")
        return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
};
const queryString = (value) => {
    return typeof value === "string" && value.trim() !== ""
        ? value.trim()
        : undefined;
};
const fieldController = {
    async list(req, res, next) {
        try {
            const { search, sportType, location, priceMin, priceMax, page: pageParam, pageSize: pageSizeParam, sortBy, sortDir, status, shopStatus, } = req.query;
            const allowedSorts = new Set(["price", "rating", "name", "rent"]);
            const sortKey = typeof sortBy === "string" && allowedSorts.has(sortBy)
                ? sortBy
                : undefined;
            const sortDirection = sortDir === "desc" || sortDir === "asc" ? sortDir : undefined;
            const data = await field_service_1.default.list({
                search: queryString(search),
                sportType: queryString(sportType),
                location: queryString(location),
                priceMin: toNumber(priceMin),
                priceMax: toNumber(priceMax),
                page: toNumber(pageParam),
                pageSize: toNumber(pageSizeParam),
                sortBy: sortKey,
                sortDir: sortDirection,
                status: queryString(status) ?? "active", // Mặc định chỉ lấy sân 'active'
                shopStatus: queryString(shopStatus),
                shopActive: 1, // Chỉ lấy sân của shop có chủ shop đang hoạt động
            });
            const { items, facets, summary, total, page, pageSize, totalPages, hasNext, hasPrev, pagination, } = data;
            const appliedFilters = {
                search: queryString(search),
                sportType: queryString(sportType),
                location: queryString(location),
                priceMin: toNumber(priceMin),
                priceMax: toNumber(priceMax),
                status: queryString(status) ?? "active",
                shopStatus: queryString(shopStatus),
                sortBy: sortKey,
                sortDir: sortDirection,
            };
            const paginationMeta = pagination ?? {
                total,
                page,
                pageSize,
                totalPages,
                hasNext,
                hasPrev,
            };
            return respone_1.default.success(res, {
                items,
                total,
                page,
                pageSize,
                facets,
                summary,
                meta: {
                    pagination: paginationMeta,
                    filters: appliedFilters,
                },
            }, "Lấy sân thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async detail(req, res, next) {
        try {
            const fieldCode = Number(req.params.fieldCode);
            if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ"));
            }
            const field = await field_service_1.default.getById(fieldCode);
            if (!field) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy sân"));
            }
            return respone_1.default.success(res, field, "Fetched field successfully", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async uploadImage(req, res, next) {
        try {
            const fieldCode = Number(req.params.fieldCode);
            if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ"));
            }
            const file = req.file;
            if (!file) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Vui lòng chọn một tập tin hình ảnh để tải lên"));
            }
            const created = await field_service_1.default.addImage(fieldCode, file);
            if (!created) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy sân"));
            }
            return respone_1.default.success(res, created, "Tải ảnh sân thành công", http_status_codes_1.StatusCodes.CREATED);
        }
        catch (error) {
            next(error);
        }
    },
    async uploadImages(req, res, next) {
        try {
            const fieldCode = Number(req.params.fieldCode);
            if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ"));
            }
            const files = req.files;
            if (!files || files.length === 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Vui lòng chọn ít nhất một tập tin hình ảnh để tải lên"));
            }
            const uploadedImages = [];
            for (const file of files) {
                const created = await field_service_1.default.addImage(fieldCode, file);
                if (created) {
                    uploadedImages.push(created);
                }
            }
            if (uploadedImages.length === 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy sân hoặc không thể tải ảnh"));
            }
            return respone_1.default.success(res, { images: uploadedImages }, `Tải ${uploadedImages.length} ảnh sân thành công`, http_status_codes_1.StatusCodes.CREATED);
        }
        catch (error) {
            next(error);
        }
    },
    async availability(req, res, next) {
        try {
            const fieldCode = Number(req.params.fieldCode);
            if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ"));
            }
            const date = typeof req.query.date === "string" ? req.query.date.trim() : undefined;
            if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Định dạng ngày không hợp lệ (YYYY-MM-DD)"));
            }
            // Release expired held slots (cập nhật đầy đủ booking + payment)
            await (0, booking_service_1.releaseExpiredHeldSlots)(fieldCode);
            const slots = await field_service_1.default.getAvailability(fieldCode, date);
            return respone_1.default.success(res, { field_code: fieldCode, date: date ?? null, slots }, "Fetched field availability successfully", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(error);
        }
    },
    async utilities(req, res, next) {
        try {
            const fieldCode = Number(req.params.fieldCode);
            if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ"));
            }
            const utilities = await (0, shopUtilities_service_1.listFieldUtilities)(fieldCode);
            return respone_1.default.success(res, utilities, "Danh sách tiện ích của sân", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            if (error?.message === "FIELD_NOT_FOUND") {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy sân"));
            }
            next(new apiErrors_1.default(500, error?.message || "Không thể lấy tiện ích của sân"));
        }
    },
    /**
     * Get field statistics including booking count
     * GET /api/fields/:fieldCode/stats
     */
    async getFieldStats(req, res, next) {
        try {
            const { fieldCode } = req.params;
            const stats = await field_service_1.default.getFieldStatsByCode(Number(fieldCode));
            if (!stats) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Sân không tồn tại"));
            }
            return respone_1.default.success(res, stats, "Thống kê sân", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Get field stats failed"));
        }
    },
    /**
     * List fields with booking count for a shop
     * GET /api/fields/shop/:shopCode/with-rent
     */
    async listFieldsWithRent(req, res, next) {
        try {
            const { shopCode } = req.params;
            const { limit = "10", offset = "0" } = req.query;
            const validLimit = Math.min(Math.max(1, Number(limit)), 100);
            const validOffset = Math.max(0, Number(offset));
            const result = await field_service_1.default.listFieldsWithRent(Number(shopCode), validLimit, validOffset);
            return respone_1.default.success(res, {
                data: result.data,
                pagination: {
                    limit: validLimit,
                    offset: validOffset,
                    total: result.total,
                },
            }, "Danh sách sân với thống kê", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "List fields failed"));
        }
    },
    /**
     * Sync/Fix field rent count from confirmed bookings
     * PUT /api/fields/:fieldCode/sync-rent
     * Admin endpoint to fix mismatched rent counts
     */
    async syncFieldRent(req, res, next) {
        try {
            const { fieldCode } = req.params;
            const actualRent = await field_service_1.default.syncFieldRent(Number(fieldCode));
            return respone_1.default.success(res, { FieldCode: fieldCode, Rent: actualRent }, `Rent synced to ${actualRent}`, http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Sync field rent failed"));
        }
    },
    /**
     * Sync all fields rent count (admin/maintenance endpoint)
     * PUT /api/fields/sync/all
     */
    async syncAllFieldsRent(req, res, next) {
        try {
            const syncedCount = await field_service_1.default.syncAllFieldRents();
            return respone_1.default.success(res, { synced: syncedCount }, `Synced ${syncedCount} fields`, http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Sync all fields rent failed"));
        }
    },
};
exports.default = fieldController;
