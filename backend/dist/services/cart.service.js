"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cart_model_1 = __importDefault(require("../models/cart.model"));
const normalizeSlot = (slot) => ({
    bookingCode: Number(slot.BookingCode),
    playDate: slot.PlayDate,
    startTime: slot.StartTime,
    endTime: slot.EndTime,
    quantityId: slot.QuantityID === null || slot.QuantityID === undefined
        ? null
        : Number(slot.QuantityID),
    status: slot.Status,
    pricePerSlot: Number(slot.PricePerSlot ?? 0),
});
const normalizeCartRow = (row, slots) => {
    const expires = new Date(row.ExpiresAt);
    const now = Date.now();
    const expiresMs = expires.getTime();
    const secondsUntilExpiry = Number.isFinite(expiresMs) && expiresMs > now
        ? Math.max(0, Math.floor((expiresMs - now) / 1000))
        : 0;
    return {
        cartId: Number(row.CartID),
        bookingCode: Number(row.BookingCode),
        fieldCode: Number(row.FieldCode),
        fieldName: row.FieldName,
        sportType: row.SportType,
        shopName: row.ShopName,
        address: row.Address ?? null,
        totalPrice: Number(row.TotalPrice ?? 0),
        discountAmount: Number(row.DiscountAmount ?? 0),
        promotionCode: row.PromotionCode ?? null,
        bookingStatus: row.BookingStatus,
        paymentStatus: row.PaymentStatus,
        expiresAt: new Date(row.ExpiresAt).toISOString(),
        secondsUntilExpiry,
        createdAt: new Date(row.CreateAt).toISOString(),
        slots,
    };
};
const cartService = {
    async persistEntry(connection, userId, bookingCode, expiresAt) {
        await cart_model_1.default.upsert(connection, userId, bookingCode, expiresAt);
    },
    async removeEntriesForBookings(bookingCodes, connection) {
        await cart_model_1.default.deleteByBookingCodes(bookingCodes, connection);
    },
    async getUserCart(userId) {
        if (!Number.isFinite(userId) || userId <= 0) {
            return [];
        }
        await cart_model_1.default.purgeByUser(userId);
        const rows = await cart_model_1.default.listActiveByUser(userId);
        if (!rows.length) {
            return [];
        }
        const bookingCodes = rows.map((row) => Number(row.BookingCode));
        const slotRows = await cart_model_1.default.getSlotsForBookings(bookingCodes);
        const slotMap = new Map();
        slotRows.forEach((slot) => {
            const code = Number(slot.BookingCode);
            const normalized = normalizeSlot(slot);
            if (!slotMap.has(code)) {
                slotMap.set(code, [normalized]);
            }
            else {
                slotMap.get(code).push(normalized);
            }
        });
        return rows.map((row) => {
            const code = Number(row.BookingCode);
            const slots = slotMap.get(code) ?? [];
            return normalizeCartRow(row, slots);
        });
    },
};
exports.default = cartService;
