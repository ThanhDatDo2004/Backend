import { randomBytes } from "crypto";
import { StatusCodes } from "http-status-codes";
import ApiError from "../utils/apiErrors";
import shopPromotionService, {
  type ShopPromotion,
} from "./shopPromotion.service";
import bookingModel, {
  type NormalizedSlot,
  type SlotRow,
  type BookingSlotWithQuantityRow,
  type CustomerBookingRow,
  type ShopBookingFilters,
  type BookingCancellationRequestRow,
} from "../models/booking.model";
import paymentModel from "../models/payment.model";
import cartService from "./cart.service";
import shopService from "./shop.service";
import {
  sendCancellationDecisionEmail,
  sendCancellationRequestEmail,
} from "./mail.service";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const HOLD_DURATION_MS = 15 * 60 * 1000;
const SAFE_PAID_CANCEL_HOURS = 12;
const SAFE_PENALTY_PERCENT = 50;
const SAFE_REFUND_PERCENT = 50;
const REFUND_RATIO = SAFE_REFUND_PERCENT > 0 ? SAFE_REFUND_PERCENT / 100 : 0.5;

export type BookingSlotInput = {
  slot_id?: number | null;
  play_date: string;
  start_time: string;
  end_time: string;
};

export type ConfirmBookingPayload = {
  slots: BookingSlotInput[];
  total_price?: number;
  payment_method?: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  notes?: string;
  created_by?: number | null;
  quantity_id?: number;
  promotion_code?: string;
  promotionCode?: string;
  isLoggedInCustomer?: boolean;
};

export type ConfirmBookingResult = {
  booking_code: string;
  transaction_id: string;
  payment_status: "mock_success";
  field_code: number;
  qr_code: string;
  paymentID: number;
  amount: number;
  amount_before_discount: number;
  discount_amount: number;
  promotion_code?: string | null;
  promotion_title?: string | null;
  hold_expires_at: string;
  slots: Array<{
    slot_id: number;
    play_date: string;
    start_time: string;
    end_time: string;
    quantity_id: number | null;
  }>;
};

export type CustomerBookingListOptions = {
  status?: string;
  limit: number;
  offset: number;
  sort?: string;
  order?: "ASC" | "DESC" | string;
};

export type ShopBookingListOptions = {
  status?: string;
  search?: string;
  limit: number;
  offset: number;
  sort?: string;
  order?: "ASC" | "DESC" | string;
};

const normalizeTime = (value: string) => {
  const trimmed = String(value ?? "").trim();
  const match = trimmed.match(TIME_REGEX);
  if (!match) return null;
  return `${match[1]}:${match[2]}:00`;
};

const normalizeDate = (value: string) => {
  const trimmed = String(value ?? "").trim();
  if (!DATE_REGEX.test(trimmed)) return null;
  return trimmed;
};

const createHoldExpiryDeadline = () => new Date(Date.now() + HOLD_DURATION_MS);

const buildSlotDateTime = (playDate: string, time: string) => {
  const baseDate = new Date(playDate);
  if (Number.isNaN(baseDate.getTime())) {
    return null;
  }
  const [hours, minutes] = String(time ?? "")
    .split(":")
    .map((value) => Number(value));
  baseDate.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  );
  return baseDate;
};

const calculateHoursUntil = (playDate: string, time: string) => {
  const slotDate = buildSlotDateTime(playDate, time);
  if (!slotDate) return Infinity;
  return (slotDate.getTime() - Date.now()) / (1000 * 60 * 60);
};

function normalizeSlots(slots: BookingSlotInput[]): NormalizedSlot[] {
  if (!Array.isArray(slots) || !slots.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Vui lòng chọn ít nhất một khung giờ để đặt sân."
    );
  }

  const normalized = slots.map((slot, index) => {
    const playDate = normalizeDate(slot.play_date);
    if (!playDate) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Ngày thi đấu không hợp lệ ở vị trí ${index + 1}.`
      );
    }

    const startTime = normalizeTime(slot.start_time);
    const endTime = normalizeTime(slot.end_time);

    if (!startTime || !endTime) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Khung giờ không hợp lệ ở vị trí ${index + 1}.`
      );
    }

    if (startTime >= endTime) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Giờ bắt đầu phải nhỏ hơn giờ kết thúc (slot ${index + 1}).`
      );
    }

    const key = `${playDate}|${startTime}|${endTime}`;

    return {
      key,
      slot_id: typeof slot.slot_id === "number" ? slot.slot_id : null,
      play_date: playDate,
      start_time: startTime.slice(0, 5),
      end_time: endTime.slice(0, 5),
      db_date: playDate,
      db_start_time: startTime,
      db_end_time: endTime,
    };
  });

  const unique = new Map<string, NormalizedSlot>();
  normalized.forEach((slot) => {
    if (!unique.has(slot.key)) {
      unique.set(slot.key, slot);
    }
  });

  return Array.from(unique.values()).sort((a, b) => {
    if (a.play_date !== b.play_date) {
      return a.play_date.localeCompare(b.play_date);
    }
    return a.db_start_time.localeCompare(b.db_start_time);
  });
}

function distributeAmountAcrossSlots(total: number, count: number): number[] {
  if (!Number.isFinite(total) || count <= 0) {
    return Array.from({ length: Math.max(0, count) }, () => 0);
  }
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_value, index) => {
    const cents = base + (index < remainder ? 1 : 0);
    return cents / 100;
  });
}

const generateBookingCode = () => {
  const partA = Date.now().toString(36).toUpperCase();
  const partB = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BK-${partA}-${partB}`;
};

const generateTransactionId = () => {
  const partA = Math.random().toString(36).slice(2, 6).toUpperCase();
  const partB = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TX-${partA}${partB}`;
};

const generateCheckinCode = () => {
  // Generate unique checkin code: 6-8 alphanumeric
  return Math.random().toString(36).slice(2, 10).toUpperCase();
};

type ExpiredSlot = {
  slotId: number;
  bookingCode: number | null;
};

async function getExpiredHeldSlots(fieldCode?: number): Promise<ExpiredSlot[]> {
  return await bookingModel.getExpiredHeldSlots(fieldCode);
}

async function cancelExpiredBookings(expiredSlots: ExpiredSlot[]) {
  const bookingCodes = Array.from(
    new Set(
      expiredSlots
        .map((slot) => slot.bookingCode)
        .filter(
          (code): code is number => Number.isFinite(code) && Number(code) > 0
        )
    )
  );

  if (!bookingCodes.length) return;

  await bookingModel.cancelExpiredBookings(bookingCodes);
  await cartService.removeEntriesForBookings(bookingCodes);
}

export async function releaseExpiredHeldSlots(fieldCode: number) {
  try {
    const expiredSlots = await getExpiredHeldSlots(fieldCode);
    if (!expiredSlots.length) return;

    await cancelExpiredBookings(expiredSlots);

    const slotIds = expiredSlots
      .map((slot) => slot.slotId)
      .filter((slotId) => Number.isFinite(slotId) && slotId > 0);

    if (!slotIds.length) return;

    await bookingModel.releaseHeldSlotsByIds(slotIds);
  } catch (e) {
    console.error("Lỗi release expired held slots:", e);
    // Không throw, tiếp tục xử lý
  }
}

export async function confirmFieldBooking(
  fieldCode: number,
  payload: ConfirmBookingPayload,
  quantityId?: number | null
): Promise<ConfirmBookingResult> {
  if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ.");
  }

  // Release expired held slots trước
  await releaseExpiredHeldSlots(fieldCode);

  const normalizedSlots = normalizeSlots(payload.slots);

  const promotionInputRaw =
    typeof payload.promotion_code === "string" && payload.promotion_code.trim()
      ? payload.promotion_code.trim()
      : typeof payload.promotionCode === "string" &&
        payload.promotionCode.trim()
      ? payload.promotionCode.trim()
      : undefined;
  const promotionCode = promotionInputRaw
    ? promotionInputRaw.toUpperCase()
    : undefined;

  // Lấy field info để tính giá
  const fieldInfo = await bookingModel.getFieldInfo(fieldCode);

  if (!fieldInfo) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân.");
  }

  const field = fieldInfo;
  const shopCode = Number(field.ShopCode ?? 0);
  const slotCount = normalizedSlots.length;
  const basePricePerSlot = field.DefaultPricePerHour || 100000;
  const baseTotalPrice = basePricePerSlot * slotCount;

  let finalTotalPrice = baseTotalPrice;
  let discountAmount = 0;
  let appliedPromotion: ShopPromotion | null = null;
  const userIdForUsage = Number(payload.created_by);

  if (promotionCode) {
    const promotion = await shopPromotionService.getByCode(promotionCode);
    if (promotion.is_deleted) {
      throw new ApiError(
        StatusCodes.GONE,
        "Khuyến mãi này không còn khả dụng."
      );
    }

    if (Number(promotion.shop_code) !== shopCode) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Mã khuyến mãi không áp dụng cho sân này."
      );
    }

    const now = Date.now();
    const startAtMs = new Date(promotion.start_at).getTime();
    const endAtMs = new Date(promotion.end_at).getTime();

    if (Number.isNaN(startAtMs) || Number.isNaN(endAtMs)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Thời gian áp dụng khuyến mãi không hợp lệ."
      );
    }

    if (
      promotion.status === "disabled" ||
      promotion.current_status === "disabled"
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Khuyến mãi này đã bị tạm dừng."
      );
    }

    if (now < startAtMs) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Khuyến mãi này chưa đến thời gian áp dụng."
      );
    }

    if (
      now > endAtMs ||
      promotion.status === "expired" ||
      promotion.current_status === "expired"
    ) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Khuyến mãi này đã hết hạn.");
    }

    if (promotion.status === "draft") {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Khuyến mãi này chưa được kích hoạt."
      );
    }

    if (
      promotion.min_order_amount !== null &&
      promotion.min_order_amount > baseTotalPrice
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Đơn hàng chưa đạt giá trị tối thiểu để dùng khuyến mãi."
      );
    }

    if (Number.isFinite(userIdForUsage) && promotion.usage_per_customer) {
      const usage = await bookingModel.checkPromotionUsageByUser(
        promotion.promotion_id,
        userIdForUsage
      );

      if (
        promotion.usage_limit !== null &&
        promotion.usage_limit >= 0 &&
        usage.totalUsage >= promotion.usage_limit
      ) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Mã khuyến mãi đã đạt giới hạn sử dụng."
        );
      }

      if (
        promotion.usage_per_customer !== null &&
        promotion.usage_per_customer > 0 &&
        usage.customerUsage >= promotion.usage_per_customer
      ) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Bạn đã sử dụng mã khuyến mãi này đủ số lần cho phép."
        );
      }
    } else if (promotion.usage_limit !== null && promotion.usage_limit >= 0) {
      const totalUsage = await bookingModel.checkPromotionTotalUsage(
        promotion.promotion_id
      );
      if (totalUsage >= promotion.usage_limit) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Mã khuyến mãi đã đạt giới hạn sử dụng."
        );
      }
    }

    let computedDiscount = 0;
    if (promotion.discount_type === "percent") {
      computedDiscount = (baseTotalPrice * promotion.discount_value) / 100;
      if (
        promotion.max_discount_amount !== null &&
        promotion.max_discount_amount >= 0
      ) {
        computedDiscount = Math.min(
          computedDiscount,
          promotion.max_discount_amount
        );
      }
    } else {
      computedDiscount = promotion.discount_value;
    }

    computedDiscount = Math.min(computedDiscount, baseTotalPrice);
    computedDiscount = Math.round(computedDiscount * 100) / 100;

    finalTotalPrice = Math.max(baseTotalPrice - computedDiscount, 0);
    finalTotalPrice = Math.round(finalTotalPrice * 100) / 100;
    discountAmount = computedDiscount;
    appliedPromotion = promotion;
  }

  const slotPrices = distributeAmountAcrossSlots(finalTotalPrice, slotCount);
  const platformFee = Math.round(finalTotalPrice * 0.05);
  const netToShop = finalTotalPrice - platformFee;

  let bookingCode: number = 0;

  const transactionResult = await bookingModel.runInTransaction<{
    slots: ConfirmBookingResult["slots"];
    holdExpiresAt: Date;
  }>("confirmFieldBooking", async (connection) => {
    // 1. Xử lý slots (lock, update, insert)
    const updatedSlots: ConfirmBookingResult["slots"] = [];

    for (let index = 0; index < normalizedSlots.length; index += 1) {
      const slot = normalizedSlots[index];
      const row = await bookingModel.lockSlot(
        connection,
        fieldCode,
        slot,
        quantityId ?? null
      );

      if (row) {
        if (
          quantityId !== null &&
          quantityId !== undefined &&
          row.QuantityID !== null &&
          row.QuantityID !== quantityId
        ) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            `Khung giờ ${slot.start_time} - ${slot.end_time} ngày ${slot.play_date} đã được giữ cho sân khác.`
          );
        }

        if (row.Status === "held" && row.HoldExpiresAt) {
          const holdExpiryTime = new Date(row.HoldExpiresAt);
          if (new Date() <= holdExpiryTime) {
            throw new ApiError(
              StatusCodes.CONFLICT,
              `Khung giờ ${slot.start_time} - ${slot.end_time} ngày ${slot.play_date} đã được đặt trước đó.`
            );
          }
        } else if (row.Status !== "available") {
          throw new ApiError(
            StatusCodes.CONFLICT,
            `Khung giờ ${slot.start_time} - ${slot.end_time} ngày ${slot.play_date} đã được đặt trước đó.`
          );
        }

        await bookingModel.resetSlotForBooking(
          connection,
          Number(row.SlotID),
          quantityId ?? null
        );
        const resolvedQuantityId =
          row.QuantityID !== null && row.QuantityID !== undefined
            ? Number(row.QuantityID)
            : quantityId ?? null;
        updatedSlots.push({
          slot_id: Number(row.SlotID),
          play_date: slot.play_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          quantity_id: resolvedQuantityId,
        });
      } else {
        const insertedId = await bookingModel.insertNewSlot(
          connection,
          fieldCode,
          slot,
          quantityId ?? null,
          payload.created_by ?? null
        );
        updatedSlots.push({
          slot_id: insertedId,
          play_date: slot.play_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          quantity_id: quantityId ?? null,
        });
      }
    }

    if (!updatedSlots.length) {
      throw new ApiError(500, "Không thể ghi nhận khung giờ đã chọn.");
    }

    // 2. Tạo booking thực vào DB - CHỈ lưu thông tin chung (không lưu time)
    const bookingUserId = Number(payload.created_by);
    if (!Number.isFinite(bookingUserId) || bookingUserId <= 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Người tạo booking không hợp lệ."
      );
    }
    const checkinCode = generateCheckinCode();

    bookingCode = await bookingModel.insertPendingBooking(connection, {
      fieldCode,
      quantityId: quantityId ?? null,
      customerUserID: bookingUserId,
      customerName: payload.customer?.name || null,
      customerEmail: payload.customer?.email || null,
      customerPhone: payload.customer?.phone || null,
      totalPrice: finalTotalPrice,
      platformFee,
      netToShop,
      discountAmount,
      promotionId: appliedPromotion?.promotion_id ?? null,
      promotionCode: appliedPromotion?.promotion_code ?? null,
      checkinCode,
    });

    // 3. Tạo booking slots - MỘT ROW CHO MỖI KHUNG GIỜ
    const holdExpiryTime = createHoldExpiryDeadline();
    for (let index = 0; index < normalizedSlots.length; index += 1) {
      const slot = normalizedSlots[index];
      await bookingModel.insertBookingSlotRecord(connection, {
        bookingCode,
        fieldCode,
        quantityId: quantityId ?? null,
        playDate: slot.db_date,
        startTime: slot.db_start_time,
        endTime: slot.db_end_time,
        pricePerSlot: slotPrices[index] ?? basePricePerSlot,
      });

      await bookingModel.holdFieldSlot(connection, {
        fieldCode,
        bookingCode,
        quantityId: quantityId ?? null,
        slot,
        holdExpiresAt: holdExpiryTime,
        createdBy: payload.created_by ?? null,
      });
    }

    const shouldPersistCart =
      payload.isLoggedInCustomer === true &&
      Number.isFinite(bookingUserId) &&
      bookingUserId > 0;

    if (shouldPersistCart) {
      await cartService.persistEntry(
        connection,
        bookingUserId,
        bookingCode,
        holdExpiryTime
      );
    }

    return { slots: updatedSlots, holdExpiresAt: holdExpiryTime };
  });

  // Return INT booking code thực từ DB
  const transactionId = generateTransactionId();

  const paymentMethod = "bank_transfer";

  // Tạo payment
  const payment = await paymentModel.create(
    bookingCode,
    finalTotalPrice,
    paymentMethod
  );

  const paymentID = Number(payment.PaymentID);

  // Build SePay QR URL
  const sepayAcc = process.env.SEPAY_ACC || "96247THUERE";
  const sepayBank = process.env.SEPAY_BANK || "BIDV";
  const des = `BK${bookingCode}`;
  const qrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(
    sepayAcc
  )}&bank=${encodeURIComponent(sepayBank)}&amount=${encodeURIComponent(
    finalTotalPrice
  )}&des=${encodeURIComponent(des)}`;

  return {
    booking_code: String(bookingCode),
    transaction_id: transactionId,
    payment_status: "mock_success",
    field_code: fieldCode,
    qr_code: qrUrl,
    paymentID: paymentID,
    amount: finalTotalPrice,
    amount_before_discount: baseTotalPrice,
    discount_amount: discountAmount,
    promotion_code: appliedPromotion?.promotion_code ?? null,
    promotion_title: appliedPromotion?.title ?? null,
    hold_expires_at: transactionResult.holdExpiresAt.toISOString(),
    slots: transactionResult.slots,
  };
}

export async function listCustomerBookings(
  userId: number,
  options: CustomerBookingListOptions
) {
  try {
    await bookingModel.markPastPaidBookingsCompleted();
  } catch (error) {
    console.error("[booking] Failed to auto-complete bookings:", error);
  }

  const limit = Math.max(1, Number(options.limit) || 10);
  const offset = Math.max(0, Number(options.offset) || 0);
  const sortField = typeof options.sort === "string" ? options.sort : undefined;
  const sortOrder = options.order === "ASC" ? "ASC" : "DESC";

  const rows = await bookingModel.listCustomerBookings(userId, {
    status: options.status,
    sortField,
    sortOrder,
    limit,
    offset,
  });

  const bookingCodes = rows
    .map((row) => Number(row.BookingCode))
    .filter((code) => Number.isFinite(code) && code > 0);

  const slotRows = bookingCodes.length
    ? await bookingModel.listSlotsWithQuantity(bookingCodes)
    : [];

  const slotMap = new Map<number, BookingSlotWithQuantityRow[]>();
  slotRows.forEach((slot) => {
    const code = Number(slot.BookingCode);
    if (!slotMap.has(code)) {
      slotMap.set(code, [slot]);
    } else {
      slotMap.get(code)!.push(slot);
    }
  });

  const data = rows.map((booking) => {
    const code = Number(booking.BookingCode);
    const slots = slotMap.get(code) ?? [];
    const quantityInfo = slots.find((slot) => slot.QuantityNumber != null);

    return {
      ...booking,
      CustomerPhone: booking.CustomerPhone || "Chưa cập nhật",
      CheckinCode: booking.CheckinCode || "-",
      slots: slots.map((slot) => ({
        Slot_ID: slot.Slot_ID,
        QuantityID: slot.QuantityID,
        QuantityNumber: slot.QuantityNumber,
        PlayDate: slot.PlayDate,
        StartTime: slot.StartTime,
        EndTime: slot.EndTime,
        PricePerSlot: slot.PricePerSlot,
        Status: slot.Status,
      })),
      quantityId: quantityInfo?.QuantityID ?? null,
      quantityNumber: quantityInfo?.QuantityNumber ?? null,
      cancellationStatus: booking.CancellationStatus ?? null,
      cancellationRefundAmount: booking.CancellationRefundAmount ?? null,
      cancellationPenaltyPercent: booking.CancellationPenaltyPercent ?? null,
      cancellationRequestedAt: booking.CancellationRequestedAt ?? null,
      cancellationDecidedAt: booking.CancellationDecidedAt ?? null,
    };
  });

  const total = await bookingModel.countCustomerBookings(
    userId,
    options.status
  );

  return {
    data,
    pagination: {
      limit,
      offset,
      total,
    },
  };
}

export async function listShopBookingsForOwner(
  userId: number,
  options: ShopBookingListOptions
) {
  const shop = await shopService.getByUserId(Number(userId));
  if (!shop?.shop_code) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop của bạn");
  }

  const shopCode = Number(shop.shop_code);
  await cancelStalePendingBookingsForShop(shopCode);
  try {
    await bookingModel.markPastPaidBookingsCompleted();
  } catch (error) {
    console.error("[booking] Failed to auto-complete bookings:", error);
  }

  const limit = Math.min(Math.max(1, Number(options.limit) || 10), 100);
  const offset = Math.max(0, Number(options.offset) || 0);
  const status =
    typeof options.status === "string" && options.status.trim()
      ? options.status.trim()
      : undefined;
  const search =
    typeof options.search === "string" && options.search.trim()
      ? options.search.trim()
      : undefined;
  const sortField =
    typeof options.sort === "string" && options.sort.trim()
      ? options.sort.trim()
      : undefined;

  const filters: ShopBookingFilters = {
    status,
    search,
    sortField,
    sortOrder: options.order === "ASC" ? "ASC" : "DESC",
    limit,
    offset,
  };

  const rows = await bookingModel.listShopBookings(shopCode, filters);
  const bookingCodes = rows
    .map((row) => Number(row.BookingCode))
    .filter((code) => Number.isFinite(code) && code > 0);

  const slotRows = bookingCodes.length
    ? await bookingModel.listSlotsWithQuantity(bookingCodes)
    : [];

  const slotMap = new Map<number, BookingSlotWithQuantityRow[]>();
  slotRows.forEach((slot) => {
    const code = Number(slot.BookingCode);
    if (!slotMap.has(code)) {
      slotMap.set(code, [slot]);
    } else {
      slotMap.get(code)!.push(slot);
    }
  });

  const data = rows.map((booking) => {
    const code = Number(booking.BookingCode);
    const slots = slotMap.get(code) ?? [];
    const quantityInfo = slots.find((slot) => slot.QuantityNumber != null);

    return {
      ...booking,
      CustomerPhone: booking.CustomerPhone || "Chưa cập nhật",
      CheckinCode: booking.CheckinCode || "-",
      slots: slots.map((slot) => ({
        Slot_ID: slot.Slot_ID,
        QuantityID: slot.QuantityID,
        QuantityNumber: slot.QuantityNumber,
        PlayDate: slot.PlayDate,
        StartTime: slot.StartTime,
        EndTime: slot.EndTime,
        PricePerSlot: slot.PricePerSlot,
        Status: slot.Status,
      })),
      quantityId: quantityInfo?.QuantityID ?? null,
      quantityNumber: quantityInfo?.QuantityNumber ?? null,
      cancellationStatus: booking.CancellationStatus ?? null,
      cancellationRefundAmount: booking.CancellationRefundAmount ?? null,
      cancellationPenaltyPercent: booking.CancellationPenaltyPercent ?? null,
      cancellationRequestedAt: booking.CancellationRequestedAt ?? null,
      cancellationDecidedAt: booking.CancellationDecidedAt ?? null,
    };
  });

  const total = await bookingModel.countShopBookings(shopCode, filters);

  const bookingSummaryRows = await bookingModel.getShopBookingStatusSummary(
    shopCode
  );
  const paymentSummaryRows = await bookingModel.getShopPaymentStatusSummary(
    shopCode
  );

  const bookingSummary: Record<string, number> = {
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    cancellation_pending: 0,
  };
  bookingSummaryRows.forEach((row: any) => {
    if (row.BookingStatus) {
      bookingSummary[String(row.BookingStatus)] = Number(row.total || 0);
    }
  });

  const paymentSummary: Record<string, number> = {
    pending: 0,
    paid: 0,
    failed: 0,
    refunded: 0,
  };
  paymentSummaryRows.forEach((row: any) => {
    if (row.PaymentStatus) {
      paymentSummary[String(row.PaymentStatus)] = Number(row.total || 0);
    }
  });

  return {
    data,
    pagination: {
      limit,
      offset,
      total,
    },
    summary: {
      bookingStatus: bookingSummary,
      paymentStatus: paymentSummary,
    },
  };
}

export async function getCustomerBookingDetail(
  bookingCode: number,
  userId?: number
) {
  const detail = await bookingModel.getBookingDetail(bookingCode, userId);
  if (!detail) {
    return null;
  }

  const slots = await bookingModel.listSlotsWithQuantity([bookingCode]);

  return {
    ...detail,
    slots: slots.map((slot) => ({
      Slot_ID: slot.Slot_ID,
      QuantityID: slot.QuantityID,
      QuantityNumber: slot.QuantityNumber,
      PlayDate: slot.PlayDate,
      StartTime: slot.StartTime,
      EndTime: slot.EndTime,
      PricePerSlot: slot.PricePerSlot,
      Status: slot.Status,
    })),
    cancellation: detail.CancellationStatus
      ? {
          status: detail.CancellationStatus,
          refundAmount: detail.CancellationRefundAmount,
          penaltyPercent: detail.CancellationPenaltyPercent,
          requestedAt: detail.CancellationRequestedAt,
          decidedAt: detail.CancellationDecidedAt,
        }
      : null,
  };
}

const summarizeSlotWindows = (slots: BookingSlotWithQuantityRow[]) =>
  slots.map(
    (slot) =>
      `${new Date(slot.PlayDate).toLocaleDateString("vi-VN")} ${
        slot.StartTime
      } - ${slot.EndTime}`
  );

async function createCancellationRequest(
  booking: any,
  userId: number,
  reason?: string
) {
  const earliestSlot = await bookingModel.getEarliestSlot(booking.BookingCode);
  if (earliestSlot?.PlayDate && earliestSlot?.StartTime) {
    const diffHours = calculateHoursUntil(
      earliestSlot.PlayDate,
      earliestSlot.StartTime
    );
    if (diffHours < SAFE_PAID_CANCEL_HOURS) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Chỉ có thể hủy booking trước ${SAFE_PAID_CANCEL_HOURS} giờ`
      );
    }
  }

  const bookingOwner = await bookingModel.getBookingWithOwnerContact(
    booking.BookingCode
  );
  if (!bookingOwner) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy thông tin sân");
  }

  const shopCode = Number(bookingOwner.ShopCode);
  if (!Number.isFinite(shopCode)) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy chủ sân");
  }

  const totalPrice = Number(booking.TotalPrice || 0);
  const refundAmount =
    booking.PaymentStatus === "paid"
      ? Number((totalPrice * REFUND_RATIO).toFixed(0))
      : 0;
  const penaltyPercent =
    booking.PaymentStatus === "paid" ? SAFE_PENALTY_PERCENT : 0;
  const previousStatus =
    typeof booking.BookingStatus === "string"
      ? booking.BookingStatus
      : "pending";

  const token = randomBytes(24).toString("hex");
  const request = await bookingModel.upsertCancellationRequest({
    bookingCode: Number(booking.BookingCode),
    customerUserId: userId,
    shopCode,
    fieldCode: Number(booking.FieldCode) || null,
    reason: reason || null,
    penaltyPercent,
    refundAmount,
    decisionToken: token,
    customerPhone: booking.CustomerPhone || null,
    customerName: booking.CustomerName || null,
    customerEmail: booking.CustomerEmail || null,
    previousStatus,
  });

  if (booking.BookingStatus !== "cancellation_pending") {
    await bookingModel.setBookingStatus(
      Number(booking.BookingCode),
      "cancellation_pending"
    );
  }

  const slotRows = await bookingModel.listSlotsWithQuantity([
    Number(booking.BookingCode),
  ]);

  if (bookingOwner.OwnerEmail) {
    try {
      await sendCancellationRequestEmail({
        to: bookingOwner.OwnerEmail,
        ownerName: bookingOwner.OwnerFullName || bookingOwner.OwnerEmail,
        shopName: bookingOwner.ShopName || "",
        fieldName: bookingOwner.FieldName || "",
        bookingCode: Number(booking.BookingCode),
        slots: summarizeSlotWindows(slotRows),
        customerName: booking.CustomerName || undefined,
        customerPhone: booking.CustomerPhone || undefined,
        customerEmail: booking.CustomerEmail || undefined,
        refundAmount,
        penaltyPercent,
        token,
      });
    } catch (error) {
      console.error("[mail] Failed to send cancellation request email:", error);
    }
  } else {
    console.warn(
      `[booking] Không tìm thấy email chủ sân cho booking ${booking.BookingCode}`
    );
  }

  return {
    bookingCode: Number(booking.BookingCode),
    status: "cancellation_requested" as const,
    cancellation: {
      status: "pending" as const,
      refundAmount,
      penaltyPercent,
      requestedAt: request?.CreateAt || new Date().toISOString(),
    },
    customerPhone: booking.CustomerPhone || null,
    message: booking.CustomerPhone
      ? `Chủ sân sẽ liên lạc với bạn qua số điện thoại ${booking.CustomerPhone}`
      : "Chủ sân sẽ liên lạc với bạn qua số điện thoại bạn đã cung cấp.",
  };
}

async function finalizeApprovedCancellation(
  booking: any,
  request: BookingCancellationRequestRow
) {
  const bookingCode = Number(request.BookingCode);
  await bookingModel.setBookingStatus(bookingCode, "cancelled");
  await bookingModel.setBookingSlotsStatus(bookingCode, "cancelled");
  await bookingModel.resetFieldSlotsToAvailable(bookingCode);
  await cartService.removeEntriesForBookings([bookingCode]);

  if (Number(booking.FieldCode)) {
    await bookingModel.decrementFieldRent(Number(booking.FieldCode));
  }

  const refundAmount = Number(request.RefundAmount || 0);
  if (booking.PaymentStatus === "paid" && refundAmount > 0) {
    await bookingModel.insertBookingRefund(
      bookingCode,
      refundAmount,
      "Customer cancellation approved"
    );

    const netToShop = Number(booking.NetToShop || 0);
    const totalPrice = Number(booking.TotalPrice || 0);
    const refundRatio = totalPrice > 0 ? refundAmount / totalPrice : 0;
    const debitAmount =
      refundRatio > 0 ? Number((netToShop * refundRatio).toFixed(2)) : 0;

    const shopCode =
      Number(request.ShopCode) ||
      Number(booking.ShopCode) ||
      (Number(booking.FieldCode)
        ? await bookingModel.getFieldShopCode(Number(booking.FieldCode))
        : null);

    if (shopCode && debitAmount > 0) {
      await paymentModel.debitShopWallet(Number(shopCode), debitAmount);
    }
  }
}

export async function cancelCustomerBooking(
  bookingCode: number,
  userId: number,
  reason?: string
) {
  const booking = await bookingModel.getBookingByCustomer(bookingCode, userId);
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
  }

  if (booking.BookingStatus === "completed") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Không thể hủy booking đã hoàn thành"
    );
  }

  const existingRequest = await bookingModel.getCancellationRequestByBooking(
    bookingCode
  );
  if (existingRequest && existingRequest.Status === "pending") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Bạn đã gửi yêu cầu hủy cho booking này. Vui lòng chờ chủ sân xử lý."
    );
  }

  return await createCancellationRequest(booking, userId, reason);
}

export async function respondCancellationRequestByToken(
  token: string,
  decision: "approve" | "reject"
) {
  if (!token || !decision) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Thiếu mã xác thực hoặc quyết định"
    );
  }

  const request = await bookingModel.getCancellationRequestByToken(token);
  if (!request) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "Yêu cầu hủy sân không tồn tại hoặc đã hết hạn"
    );
  }

  if (request.Status !== "pending") {
    throw new ApiError(
      StatusCodes.GONE,
      "Yêu cầu hủy sân đã được xử lý trước đó"
    );
  }

  const booking = await bookingModel.getBookingDetail(request.BookingCode);
  if (!booking) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "Không tìm thấy thông tin booking cho yêu cầu này"
    );
  }

  if (decision === "approve") {
    await finalizeApprovedCancellation(booking, request);
  }

  await bookingModel.updateCancellationRequestStatus(request.RequestID, {
    status: decision === "approve" ? "approved" : "rejected",
  });

  if (decision === "reject") {
    const fallbackStatus =
      request.PreviousStatus &&
      request.PreviousStatus !== "cancellation_pending"
        ? request.PreviousStatus
        : booking.BookingStatus || "pending";
    await bookingModel.setBookingStatus(
      request.BookingCode,
      fallbackStatus as string
    );
  }

  const customerEmail =
    booking.CustomerEmail || request.CustomerEmail || undefined;

  if (customerEmail) {
    try {
      await sendCancellationDecisionEmail({
        to: customerEmail,
        approved: decision === "approve",
        bookingCode: request.BookingCode,
        refundAmount: request.RefundAmount,
        shopName: booking.ShopName,
        fieldName: booking.FieldName,
      });
    } catch (error) {
      console.error(
        "[mail] Failed to send cancellation decision email:",
        error
      );
    }
  }

  return {
    bookingCode: request.BookingCode,
    decision: decision === "approve" ? "approved" : "rejected",
    refundAmount: request.RefundAmount,
  };
}

export async function getBookingCheckinCode(bookingCode: number) {
  const booking = await bookingModel.getByBookingCode(String(bookingCode));
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
  }

  if (booking.BookingStatus !== "confirmed") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Chỉ booking confirmed mới có mã check-in"
    );
  }

  return {
    bookingCode,
    checkinCode: booking.CheckinCode,
  };
}

export async function verifyBookingCheckin(
  bookingCode: number,
  checkinCode: string
) {
  const booking = await bookingModel.getByBookingCode(String(bookingCode));
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
  }

  if (booking.CheckinCode !== checkinCode) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Mã check-in không đúng");
  }

  if (booking.CheckinTime) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Booking đã check-in");
  }

  await bookingModel.setBookingCheckinTime(bookingCode);

  return {
    bookingCode,
    checkinTime: new Date(),
  };
}

export async function updateBookingStatus(
  bookingCode: number,
  status:
    | "pending"
    | "confirmed"
    | "completed"
    | "cancelled"
    | "cancellation_pending"
) {
  const detail = await bookingModel.getBookingDetail(bookingCode);
  if (!detail) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy booking");
  }

  const currentStatus = detail.BookingStatus as string;
  const allowedTransitions: Record<string, string[]> = {
    pending: ["confirmed", "cancelled", "cancellation_pending"],
    confirmed: ["completed", "cancelled", "cancellation_pending"],
    completed: [],
    cancelled: [],
    cancellation_pending: ["cancelled", "confirmed", "pending"],
  };

  if (!allowedTransitions[currentStatus]?.includes(status)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Không thể chuyển từ ${currentStatus} sang ${status}`
    );
  }

  await bookingModel.setBookingStatus(bookingCode, status);

  if (status === "completed") {
    await bookingModel.setBookingCompletedAt(bookingCode);
  }

  if (status !== "pending") {
    await cartService.removeEntriesForBookings([bookingCode]);
  }

  return { bookingCode, status };
}

export async function cancelBookingByOwner(bookingCode: number) {
  const booking = await bookingModel.getByBookingCode(String(bookingCode));
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking không tồn tại");
  }

  const wasConfirmed = booking.BookingStatus === "confirmed";

  await bookingModel.setBookingStatus(bookingCode, "cancelled");
  await cartService.removeEntriesForBookings([bookingCode]);

  if (wasConfirmed) {
    await bookingModel.decrementFieldRent(Number(booking.FieldCode));
  }

  return {
    BookingCode: bookingCode,
    FieldCode: booking.FieldCode,
  };
}

export async function confirmBookingForOwner(bookingCode: number) {
  const booking = await bookingModel.getByBookingCode(String(bookingCode));
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking không tồn tại");
  }

  if (booking.BookingStatus === "confirmed") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Booking đã được xác nhận");
  }

  await bookingModel.setBookingStatus(bookingCode, "confirmed");

  if (Number.isFinite(Number(booking.FieldCode))) {
    await bookingModel.incrementFieldRent(Number(booking.FieldCode));
  }

  return {
    BookingCode: bookingCode,
    FieldCode: booking.FieldCode,
  };
}

export async function cleanupExpiredHeldSlots() {
  try {
    const expiredSlots = await getExpiredHeldSlots();
    if (!expiredSlots.length) return;

    await cancelExpiredBookings(expiredSlots);

    const slotIds = expiredSlots
      .map((slot) => slot.slotId)
      .filter((slotId) => Number.isFinite(slotId) && slotId > 0);

    if (!slotIds.length) return;

    await bookingModel.releaseHeldSlotsByIds(slotIds);
    console.log(`Đã giải phóng ${slotIds.length} khung giờ giữ chỗ hết hạn.`);
  } catch (e) {
    console.error("Lỗi xóa khung giờ đã hết hạn:", e);
  }
}

export async function cancelStalePendingBookingsForShop(shopCode: number) {
  if (!Number.isFinite(shopCode) || shopCode <= 0) {
    return;
  }

  const codes = await bookingModel.listStalePendingBookingCodes(shopCode);

  if (!codes.length) return;

  await bookingModel.cancelExpiredBookings(codes);
  await cartService.removeEntriesForBookings(codes);
}

export async function autoCompleteFinishedBookings() {
  try {
    const updated = await bookingModel.markPastPaidBookingsCompleted();
    if (updated > 0) {
      console.log(
        `[booking] Đã chuyển ${updated} booking sang trạng thái hoàn tất.`
      );
    }
  } catch (error) {
    console.error(
      "[booking] Failed to auto-complete finished bookings:",
      error
    );
  }
}

const bookingService = {
  confirmFieldBooking,
};

export default bookingService;
