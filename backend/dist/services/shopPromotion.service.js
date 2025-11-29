"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const query_1 = __importDefault(require("./query"));
const shopPromotion_model_1 = __importDefault(require("../models/shopPromotion.model"));
const MUTABLE_STATUSES = ["active", "disabled", "draft"];
const STATUS_VALUES = [
    "draft",
    "scheduled",
    "active",
    "expired",
    "disabled",
];
function pad(value) {
    return value.toString().padStart(2, "0");
}
function toMySqlDatetime(value) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}
function toIsoString(value) {
    if (!value)
        return new Date().toISOString();
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString();
}
function computeCurrentStatus(status, startAt, endAt) {
    if (status === "disabled" || status === "draft") {
        return status;
    }
    const now = new Date();
    if (now < startAt) {
        return "scheduled";
    }
    if (now > endAt) {
        return "expired";
    }
    return "active";
}
function mapRow(row) {
    const startAt = new Date(row.StartAt);
    const endAt = new Date(row.EndAt);
    const storedStatus = (row.Status ?? "draft");
    const resolvedStatus = STATUS_VALUES.includes(storedStatus || "draft")
        ? storedStatus
        : "draft";
    return {
        promotion_id: Number(row.PromotionID),
        shop_code: Number(row.ShopCode),
        promotion_code: String(row.PromotionCode),
        title: String(row.Title ?? ""),
        description: row.Description ?? null,
        discount_type: String(row.DiscountType ?? "percent") === "fixed" ? "fixed" : "percent",
        discount_value: Number(row.DiscountValue ?? 0),
        max_discount_amount: row.MaxDiscountAmount !== null && row.MaxDiscountAmount !== undefined
            ? Number(row.MaxDiscountAmount)
            : null,
        min_order_amount: row.MinOrderAmount !== null && row.MinOrderAmount !== undefined
            ? Number(row.MinOrderAmount)
            : null,
        usage_limit: row.UsageLimit !== null && row.UsageLimit !== undefined
            ? Number(row.UsageLimit)
            : null,
        usage_per_customer: row.UsagePerCustomer !== null && row.UsagePerCustomer !== undefined
            ? Number(row.UsagePerCustomer)
            : null,
        start_at: toIsoString(startAt),
        end_at: toIsoString(endAt),
        status: resolvedStatus,
        current_status: computeCurrentStatus(resolvedStatus, startAt, endAt),
        usage_count: row.UsageCount !== null && row.UsageCount !== undefined
            ? Number(row.UsageCount)
            : 0,
        is_deleted: Boolean(row.IsDeleted),
        create_at: toIsoString(row.CreateAt ?? startAt),
        update_at: toIsoString(row.UpdateAt ?? startAt),
    };
}
function resolveStatus(payloadStatus, startAt, endAt) {
    if (payloadStatus === "disabled" || payloadStatus === "draft") {
        return payloadStatus;
    }
    return computeCurrentStatus("active", startAt, endAt);
}
function sanitizePayload(payload) {
    const startAt = payload.start_at;
    const endAt = payload.end_at;
    if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Ngày bắt đầu không hợp lệ");
    }
    if (!(endAt instanceof Date) || Number.isNaN(endAt.getTime())) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Ngày kết thúc không hợp lệ");
    }
    if (startAt >= endAt) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Ngày kết thúc phải lớn hơn ngày bắt đầu");
    }
    const status = resolveStatus(payload.status, startAt, endAt);
    return {
        ...payload,
        status,
        start_at: startAt,
        end_at: endAt,
    };
}
const shopPromotionService = {
    async list(shopCode) {
        const rows = await shopPromotion_model_1.default.listByShop(shopCode);
        return (rows || []).map(mapRow);
    },
    async getById(shopCode, promotionId) {
        const row = await shopPromotion_model_1.default.getById(shopCode, promotionId);
        if (!row) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy chiến dịch khuyến mãi");
        }
        return mapRow(row);
    },
    async create(shopCode, payload) {
        const sanitized = sanitizePayload(payload);
        const insertId = await query_1.default.execTransaction("shopPromotion.create", async (conn) => {
            const codeExists = await shopPromotion_model_1.default.codeExists(conn, shopCode, sanitized.promotion_code);
            if (codeExists) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "Mã khuyến mãi đã tồn tại, vui lòng chọn mã khác");
            }
            const promotionId = await shopPromotion_model_1.default.create(conn, shopCode, {
                promotion_code: sanitized.promotion_code,
                title: sanitized.title,
                description: sanitized.description ?? null,
                discount_type: sanitized.discount_type,
                discount_value: sanitized.discount_value,
                max_discount_amount: sanitized.max_discount_amount ?? null,
                min_order_amount: sanitized.min_order_amount ?? 0,
                usage_limit: sanitized.usage_limit ?? null,
                usage_per_customer: sanitized.usage_per_customer ?? 1,
                start_at: toMySqlDatetime(sanitized.start_at),
                end_at: toMySqlDatetime(sanitized.end_at),
                status: sanitized.status,
            });
            return promotionId;
        });
        return this.getById(shopCode, Number(insertId));
    },
    async update(shopCode, promotionId, payload) {
        const sanitized = sanitizePayload(payload);
        await query_1.default.execTransaction("shopPromotion.update", async (conn) => {
            const existing = await shopPromotion_model_1.default.getById(shopCode, promotionId);
            if (!existing) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy chiến dịch khuyến mãi");
            }
            if (existing.PromotionCode !== sanitized.promotion_code) {
                const codeExists = await shopPromotion_model_1.default.codeExists(conn, shopCode, sanitized.promotion_code, promotionId);
                if (codeExists) {
                    throw new apiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, "Mã khuyến mãi đã tồn tại, vui lòng chọn mã khác");
                }
            }
            await shopPromotion_model_1.default.update(conn, shopCode, promotionId, {
                promotion_code: sanitized.promotion_code,
                title: sanitized.title,
                description: sanitized.description ?? null,
                discount_type: sanitized.discount_type,
                discount_value: sanitized.discount_value,
                max_discount_amount: sanitized.max_discount_amount ?? null,
                min_order_amount: sanitized.min_order_amount ?? 0,
                usage_limit: sanitized.usage_limit ?? null,
                usage_per_customer: sanitized.usage_per_customer ?? 1,
                start_at: toMySqlDatetime(sanitized.start_at),
                end_at: toMySqlDatetime(sanitized.end_at),
                status: sanitized.status,
            });
        });
        return this.getById(shopCode, promotionId);
    },
    async updateStatus(shopCode, promotionId, status) {
        if (!MUTABLE_STATUSES.includes(status)) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Trạng thái không hợp lệ hoặc không thể cập nhật trực tiếp");
        }
        const record = await shopPromotion_model_1.default.getById(shopCode, promotionId);
        if (!record) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy chiến dịch khuyến mãi");
        }
        const startAt = new Date(record.StartAt);
        const endAt = new Date(record.EndAt);
        const currentStatus = computeCurrentStatus(record.Status, startAt, endAt);
        if (status === "active") {
            const now = new Date();
            if (now < startAt) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Chiến dịch chưa đến thời gian áp dụng");
            }
            if (now > endAt) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Chiến dịch đã hết hạn");
            }
        }
        if (status === "draft" && currentStatus !== "draft") {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Không thể chuyển chiến dịch đã chạy về trạng thái Nháp");
        }
        await shopPromotion_model_1.default.updateStatus(shopCode, promotionId, status);
        return this.getById(shopCode, promotionId);
    },
    async listActiveForShop(shopCode, customerUserId) {
        const rows = await shopPromotion_model_1.default.getActiveForShop(shopCode, customerUserId);
        return (rows || []).map((row) => {
            const mapped = mapRow(row);
            return {
                ...mapped,
                customer_usage: row.CustomerUsage !== undefined && row.CustomerUsage !== null
                    ? Number(row.CustomerUsage)
                    : undefined,
            };
        });
    },
    async getByCode(promotionCode) {
        const normalized = promotionCode.trim().toUpperCase();
        if (!normalized) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã khuyến mãi không hợp lệ.");
        }
        const record = await shopPromotion_model_1.default.getByCode(normalized);
        if (!record) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Mã khuyến mãi không tồn tại");
        }
        const mapped = mapRow(record);
        if (record.IsDeleted) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.GONE, "Khuyến mãi này đã bị gỡ khỏi hệ thống.");
        }
        return {
            ...mapped,
            shop_code: Number(record.ShopCode),
        };
    },
    async remove(shopCode, promotionId) {
        const record = await shopPromotion_model_1.default.getById(shopCode, promotionId);
        if (!record) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy chiến dịch khuyến mãi");
        }
        const promotion = mapRow(record);
        const now = Date.now();
        const endedAt = new Date(promotion.end_at).getTime();
        if (Number.isNaN(endedAt) || endedAt > now) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Chỉ có thể xóa khuyến mãi sau khi đã hết hạn.");
        }
        const hasPendingUnpaid = await shopPromotion_model_1.default.hasPendingUnpaidBookings(promotionId);
        if (hasPendingUnpaid) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Khuyến mãi đang được sử dụng trong các đơn chưa thanh toán.");
        }
        const deleted = await shopPromotion_model_1.default.softDelete(shopCode, promotionId);
        if (!deleted) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy chiến dịch khuyến mãi");
        }
        return true;
    },
};
exports.default = shopPromotionService;
