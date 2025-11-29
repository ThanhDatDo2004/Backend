"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin_model_1 = __importDefault(require("../models/admin.model"));
const mail_service_1 = require("./mail.service");
const STATUS_MAP = {
    submitted: "pending",
    pending: "pending",
    reviewed: "reviewed",
    approved: "approved",
    rejected: "rejected",
};
function toBooleanInt(value) {
    return value === "Y" ? 1 : 0;
}
function normalizeStatus(value) {
    if (!value)
        return "pending";
    const key = value.toLowerCase();
    return STATUS_MAP[key] ?? "pending";
}
function normalizeDate(input) {
    if (!input)
        return "";
    if (input instanceof Date)
        return input.toISOString();
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
        return String(input);
    }
    return parsed.toISOString();
}
const adminService = {
    async listUsers() {
        const rows = await admin_model_1.default.listUsers();
        return rows.map(mapUserRow);
    },
    async listUserLevels() {
        return await admin_model_1.default.listUserLevels();
    },
    async updateUserStatus(userId, isActive) {
        const existing = await admin_model_1.default.getUserById(userId);
        if (!existing) {
            return null;
        }
        await admin_model_1.default.updateUserStatus(userId, isActive);
        const updated = await admin_model_1.default.getUserById(userId);
        if (!updated) {
            return null;
        }
        return mapUserRow(updated);
    },
    async listShops() {
        const shops = await admin_model_1.default.listShops();
        if (!shops.length) {
            return [];
        }
        const shopCodes = shops.map((shop) => shop.shop_code);
        const banks = await admin_model_1.default.getShopBanks(shopCodes);
        const bankByShop = new Map();
        banks.forEach((bank) => {
            const normalized = {
                bank_name: bank.bank_name ?? "",
                bank_account_number: bank.bank_account_number ?? "",
                isDefault: (bank.is_default ?? "").toUpperCase() === "Y",
            };
            const existing = bankByShop.get(bank.shop_code);
            if (!existing) {
                bankByShop.set(bank.shop_code, normalized);
                return;
            }
            if (!existing.isDefault && normalized.isDefault) {
                bankByShop.set(bank.shop_code, normalized);
            }
        });
        return shops.map((shop) => {
            const bank = bankByShop.get(shop.shop_code);
            return {
                shop_code: shop.shop_code,
                user_code: shop.user_code,
                shop_name: shop.shop_name,
                address: shop.address ?? "",
                phone_number: shop.phone_number ?? "",
                bank_name: bank?.bank_name ?? "",
                bank_account_number: bank?.bank_account_number ?? "",
                isapproved: toBooleanInt(shop.isapproved ?? null),
            };
        });
    },
    async listShopRequests() {
        const rows = await admin_model_1.default.listShopRequests();
        return rows.map(mapShopRequestRow);
    },
    async getShopRequestById(requestId) {
        const row = await admin_model_1.default.getShopRequestById(requestId);
        if (!row)
            return null;
        return mapShopRequestRow(row);
    },
    async listFinanceBookings(filters) {
        const items = await admin_model_1.default.listFinanceBookings(filters.startDate, filters.endDate, filters.fieldCode, filters.customerUserID, filters.bookingStatus, filters.limit, filters.offset);
        const summary = await admin_model_1.default.getFinanceBookingsSummary(filters.startDate, filters.endDate, filters.fieldCode, filters.customerUserID, filters.bookingStatus);
        const mappedItems = items.map((row) => ({
            booking_code: Number(row.booking_code),
            field_code: Number(row.field_code),
            field_name: row.field_name ?? "",
            customer_user_id: row.customer_user_id !== null ? Number(row.customer_user_id) : null,
            customer_name: row.customer_name ?? "",
            customer_email: row.customer_email ?? "",
            customer_phone: row.customer_phone ?? "",
            total_price: Number(row.total_price ?? 0),
            platform_fee: Number(row.platform_fee ?? 0),
            net_to_shop: Number(row.net_to_shop ?? 0),
            booking_status: row.booking_status ?? "",
            payment_status: row.payment_status ?? "",
            checkin_code: row.checkin_code ?? "",
            create_at: row.create_at ?? null,
            quantity_id: row.quantity_id !== null ? Number(row.quantity_id) : null,
        }));
        return {
            items: mappedItems,
            summary: {
                total_records: summary.total_records,
                total_total_price: summary.total_total_price,
                total_platform_fee: summary.total_platform_fee,
                total_net_to_shop: summary.total_net_to_shop,
                total_checkins: summary.total_checkins,
                total_quantity_ids: summary.total_quantity_ids,
                first_create_at: summary.first_create_at,
                last_create_at: summary.last_create_at,
            },
            pagination: {
                limit: filters.limit,
                offset: filters.offset,
            },
        };
    },
    async updateShopRequestStatus(requestId, status) {
        const updatedRow = await admin_model_1.default.updateShopRequestStatus(requestId, status);
        if (!updatedRow) {
            return null;
        }
        const mapped = mapShopRequestRow(updatedRow);
        if (mapped.email &&
            (status === "approved" || status === "rejected")) {
            void (0, mail_service_1.sendShopRequestStatusEmail)({
                to: mapped.email,
                fullName: updatedRow.full_name,
                status: status === "approved" ? "approved" : "rejected",
            }).catch((error) => {
                console.error("[adminService] Failed to send shop request status email:", error);
            });
        }
        return mapped;
    },
};
exports.default = adminService;
function mapUserRow(row) {
    return {
        user_code: Number(row.user_code),
        level_code: Number(row.level_code),
        user_name: row.full_name ?? "",
        user_id: row.email ?? "",
        user_password: row.legacy_password ?? row.password_hash ?? "",
        email: row.email ?? "",
        phone_number: row.phone_number ?? "",
        isActive: Number(row.is_active ?? 0) ? 1 : 0,
    };
}
function mapShopRequestRow(row) {
    return {
        request_id: Number(row.request_id),
        full_name: row.full_name ?? "",
        email: row.email ?? "",
        phone_number: row.phone_number ?? "",
        address: row.address ?? "",
        message: row.message ?? row.admin_note ?? "",
        created_at: normalizeDate(row.created_at),
        status: normalizeStatus(row.status),
    };
}
