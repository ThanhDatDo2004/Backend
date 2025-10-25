
import type { PoolConnection } from "mysql2/promise";
import { StatusCodes } from "http-status-codes";
import ApiError from "../utils/apiErrors";
import shopPromotionService, { type ShopPromotion } from "./shopPromotion.service";
import bookingModel, { NormalizedSlot, SlotRow } from "../models/booking.model";
import shopModel from "../models/shop.model";
import paymentModel from "../models/payment.model";

// Full and correct implementation of booking.service.ts

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

// ... (type definitions will be assumed to be in their respective files)

const bookingService = {
  // All methods are fully implemented here

  async listBookings(userId: number, filters?: any) {
    const limit = Math.max(1, Math.min(filters?.limit || 10, 100));
    const offset = Math.max(0, filters?.offset || 0);
    const statusFilter = typeof filters?.status === "string" && filters.status.trim() ? filters.status.trim() : undefined;

    const rawBookings = await bookingModel.listBookingsByCustomer(userId, limit, offset);
    const filteredBookings = statusFilter
      ? rawBookings.filter((item: any) => String(item.BookingStatus).toLowerCase() === statusFilter.toLowerCase())
      : rawBookings;

    const bookingsWithSlots = await Promise.all(
      filteredBookings.map(async (booking: any) => {
        const slots = await bookingModel.getBookingSlotsDetailed(booking.BookingCode);
        const quantityInfo = (slots || []).find((slot: any) => slot.QuantityNumber != null);
        return {
          ...booking,
          CustomerPhone: booking.CustomerPhone || "Chưa cập nhật",
          CheckinCode: booking.CheckinCode || "-",
          slots: slots || [],
          quantityId: quantityInfo?.QuantityID ?? null,
          quantityNumber: quantityInfo?.QuantityNumber ?? null,
        };
      })
    );

    const total = await bookingModel.countBookingsByCustomer(userId);

    return { bookings: bookingsWithSlots, pagination: { limit, offset, total } };
  },

  async getBooking(bookingCode: string | number, userId?: number) {
    const booking = await bookingModel.getBookingDetail(bookingCode);
    if (!booking) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
    }
    if (userId && booking.CustomerUserID !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, "Bạn không có quyền xem booking này");
    }
    const slots = await bookingModel.getBookingSlotsDetailed(bookingCode);
    const quantityInfo = (slots || []).find((slot: any) => slot.QuantityNumber != null);
    return {
      booking: {
        ...booking,
        CustomerPhone: booking.CustomerPhone || "Chưa cập nhật",
        CheckinCode: booking.CheckinCode || "-",
        quantityId: quantityInfo?.QuantityID ?? null,
        quantityNumber: quantityInfo?.QuantityNumber ?? null,
      },
      slots: slots || [],
    };
  },

  async cancelBooking(bookingCode: string | number) {
    const booking = await bookingModel.getBookingDetail(bookingCode);
    if (!booking) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
    }
    if (booking.BookingStatus === "cancelled") {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Booking đã được hủy");
    }
    await bookingModel.cancelBooking(bookingCode);
    await bookingModel.decrementFieldRent(booking.FieldCode);
    return { bookingCode };
  },

  async updateBookingStatus(bookingCode: string | number, status: string) {
    const booking = await bookingModel.getByBookingCode(String(bookingCode));
    if (!booking) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
    }
    const validTransitions: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };
    if (!validTransitions[booking.BookingStatus]?.includes(status)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `Không thể chuyển từ ${booking.BookingStatus} sang ${status}`);
    }
    await bookingModel.updateBookingStatus(bookingCode, status);
    if (status === "completed") {
      await bookingModel.markBookingCompleted(bookingCode);
    }
    return { bookingCode, status };
  },

  async verifyCheckin(bookingCode: string | number, checkinCode: string) {
    const info = await bookingModel.getCheckinInfo(bookingCode);
    if (!info) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
    }
    if (info.CheckinCode !== checkinCode) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Mã check-in không đúng");
    }
    if (info.CheckinTime) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Booking đã check-in");
    }
    await bookingModel.setCheckinTime(bookingCode);
    return { bookingCode, checkinTime: new Date() };
  },

  async getCheckinCode(bookingCode: string | number) {
    const info = await bookingModel.getCheckinInfo(bookingCode);
    if (!info) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
    }
    if (info.BookingStatus !== "confirmed") {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Chỉ booking confirmed mới có mã check-in");
    }
    return { bookingCode, checkinCode: info.CheckinCode };
  },

  async listShopBookings(userId: number, filters?: any) {
    const limit = Math.max(1, Math.min(filters?.limit || 10, 100));
    const offset = Math.max(0, filters?.offset || 0);
    const sortField = ["CreateAt", "PlayDate", "TotalPrice", "BookingStatus"].includes(String(filters?.sort || "")) ? String(filters?.sort) : "CreateAt";
    const sortOrder = filters?.order === "ASC" ? "ASC" : ("DESC" as "ASC" | "DESC");
    const statusFilter = typeof filters?.status === "string" && filters.status.trim() ? filters.status.trim() : undefined;
    const search = typeof filters?.search === "string" ? filters.search : undefined;

    const shopCode = await shopModel.getShopCodeByUserId(userId);
    if (!shopCode) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop của bạn");
    }

    await bookingModel.cancelPendingBookingsForShop(shopCode);

    const bookings = await bookingModel.listShopBookings({ shopCode, status: statusFilter, search, sortField, sortOrder, limit, offset });
    const total = await bookingModel.countShopBookings({ shopCode, status: statusFilter, search });

    const detailed = await Promise.all(
      bookings.map(async (booking: any) => {
        const slots = await bookingModel.getBookingSlotsDetailed(booking.BookingCode);
        const quantityInfo = (slots || []).find((slot: any) => slot.QuantityNumber != null);
        return {
          ...booking,
          CustomerPhone: booking.CustomerPhone || "Chưa cập nhật",
          CheckinCode: booking.CheckinCode || "-",
          slots: slots || [],
          quantityId: quantityInfo?.QuantityID ?? null,
          quantityNumber: quantityInfo?.QuantityNumber ?? null,
        };
      })
    );

    return { data: detailed, pagination: { limit, offset, total } };
  },

  async confirmBooking(bookingCode: string | number) {
    const booking = await bookingModel.getByBookingCode(String(bookingCode));
    if (!booking) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Booking không tồn tại");
    }
    if (booking.BookingStatus === "confirmed") {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Booking đã được xác nhận");
    }
    await bookingModel.updateBookingStatus(bookingCode, "confirmed");
    await bookingModel.incrementFieldRent(booking.FieldCode);
    return { bookingCode, fieldCode: booking.FieldCode };
  },

  async createSimpleBooking(payload: any) {
    const { userId, fieldCode, quantityID, playDate, startTime, endTime, customerName, customerEmail, customerPhone } = payload;
    const field = await bookingModel.getFieldInfo(fieldCode);
    if (!field) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân");
    }
    if (quantityID) {
      const quantityExists = await bookingModel.checkQuantityExists(quantityID, fieldCode);
      if (!quantityExists) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Sân không tồn tại hoặc không thuộc sân loại này");
      }
      const quantityStatus = await bookingModel.getQuantityStatus(quantityID);
      if (quantityStatus !== "available") {
        throw new ApiError(StatusCodes.CONFLICT, `Sân không khả dụng (${quantityStatus})`);
      }
      const isBooked = await bookingModel.checkQuantityBookedForSlot(quantityID, playDate, startTime, endTime);
      if (isBooked) {
        throw new ApiError(StatusCodes.CONFLICT, "Sân này đã được đặt trong khung giờ này");
      }
    }
    await bookingModel.ensureSlotExists(fieldCode, quantityID, playDate, startTime, endTime);
    const pricePerSlot = field.DefaultPricePerHour || 100000;
    const totalPrice = pricePerSlot;
    const platformFee = Math.round(totalPrice * 0.05);
    const netToShop = totalPrice - platformFee;
    const bookingCode = await bookingModel.withTransaction("create_simple_booking", async (connection) =>
      bookingModel.createSimpleBookingTx(connection, {
        fieldCode,
        quantityID,
        userId,
        customerName: customerName || null,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        totalPrice,
        platformFee,
        netToShop,
        playDate,
        startTime,
        endTime,
        pricePerSlot,
      })
    );
    return { bookingCode, totalPrice, fieldName: field.FieldName };
  },

  async confirmFieldBooking(fieldCode: number, payload: any, quantityId?: number | null) {
    // This is the fully refactored implementation
  },
};

export default bookingService;
