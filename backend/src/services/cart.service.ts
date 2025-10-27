import type { PoolConnection } from "mysql2/promise";
import cartModel, { type CartDbRow, type CartSlotRow } from "../models/cart.model";

export type CartSlot = {
  bookingCode: number;
  playDate: string;
  startTime: string;
  endTime: string;
  quantityId: number | null;
  status: string;
  pricePerSlot: number;
};

export type CartItem = {
  cartId: number;
  bookingCode: number;
  fieldCode: number;
  fieldName: string;
  sportType: string;
  shopName: string;
  address: string | null;
  totalPrice: number;
  discountAmount: number;
  promotionCode: string | null;
  bookingStatus: string;
  paymentStatus: string;
  expiresAt: string;
  secondsUntilExpiry: number;
  createdAt: string;
  slots: CartSlot[];
};

const normalizeSlot = (slot: CartSlotRow): CartSlot => ({
  bookingCode: Number(slot.BookingCode),
  playDate: slot.PlayDate,
  startTime: slot.StartTime,
  endTime: slot.EndTime,
  quantityId:
    slot.QuantityID === null || slot.QuantityID === undefined
      ? null
      : Number(slot.QuantityID),
  status: slot.Status,
  pricePerSlot: Number(slot.PricePerSlot ?? 0),
});

const normalizeCartRow = (row: CartDbRow, slots: CartSlot[]): CartItem => {
  const expires = new Date(row.ExpiresAt);
  const now = Date.now();
  const expiresMs = expires.getTime();
  const secondsUntilExpiry =
    Number.isFinite(expiresMs) && expiresMs > now
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
  async persistEntry(
    connection: PoolConnection,
    userId: number,
    bookingCode: number,
    expiresAt: Date
  ): Promise<void> {
    await cartModel.upsert(connection, userId, bookingCode, expiresAt);
  },

  async removeEntriesForBookings(
    bookingCodes: number[],
    connection?: PoolConnection | null
  ): Promise<void> {
    await cartModel.deleteByBookingCodes(bookingCodes, connection);
  },

  async getUserCart(userId: number): Promise<CartItem[]> {
    if (!Number.isFinite(userId) || userId <= 0) {
      return [];
    }

    await cartModel.purgeByUser(userId);

    const rows = await cartModel.listActiveByUser(userId);
    if (!rows.length) {
      return [];
    }

    const bookingCodes = rows.map((row) => Number(row.BookingCode));
    const slotRows = await cartModel.getSlotsForBookings(bookingCodes);

    const slotMap = new Map<number, CartSlot[]>();
    slotRows.forEach((slot) => {
      const code = Number(slot.BookingCode);
      const normalized = normalizeSlot(slot);
      if (!slotMap.has(code)) {
        slotMap.set(code, [normalized]);
      } else {
        slotMap.get(code)!.push(normalized);
      }
    });

    return rows.map((row) => {
      const code = Number(row.BookingCode);
      const slots = slotMap.get(code) ?? [];
      return normalizeCartRow(row, slots);
    });
  },
};

export default cartService;
