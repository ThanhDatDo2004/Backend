"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.releaseExpiredHeldSlots = releaseExpiredHeldSlots;
exports.confirmFieldBooking = confirmFieldBooking;
exports.listCustomerBookings = listCustomerBookings;
exports.listShopBookingsForOwner = listShopBookingsForOwner;
exports.getCustomerBookingDetail = getCustomerBookingDetail;
exports.cancelCustomerBooking = cancelCustomerBooking;
exports.getBookingCheckinCode = getBookingCheckinCode;
exports.verifyBookingCheckin = verifyBookingCheckin;
exports.updateBookingStatus = updateBookingStatus;
exports.cancelBookingByOwner = cancelBookingByOwner;
exports.confirmBookingForOwner = confirmBookingForOwner;
exports.cleanupExpiredHeldSlots = cleanupExpiredHeldSlots;
exports.cancelStalePendingBookingsForShop = cancelStalePendingBookingsForShop;
const http_status_codes_1 = require("http-status-codes");
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const shopPromotion_service_1 = __importDefault(require("./shopPromotion.service"));
const booking_model_1 = __importDefault(require("../models/booking.model"));
const payment_model_1 = __importDefault(require("../models/payment.model"));
const cart_service_1 = __importDefault(require("./cart.service"));
const shop_service_1 = __importDefault(require("./shop.service"));
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const HOLD_DURATION_MS = 15 * 60 * 1000;
const normalizeTime = (value) => {
    const trimmed = String(value ?? "").trim();
    const match = trimmed.match(TIME_REGEX);
    if (!match)
        return null;
    return `${match[1]}:${match[2]}:00`;
};
const normalizeDate = (value) => {
    const trimmed = String(value ?? "").trim();
    if (!DATE_REGEX.test(trimmed))
        return null;
    return trimmed;
};
const createHoldExpiryDeadline = () => new Date(Date.now() + HOLD_DURATION_MS);
function normalizeSlots(slots) {
    if (!Array.isArray(slots) || !slots.length) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Vui lòng chọn ít nhất một khung giờ để đặt sân.");
    }
    const normalized = slots.map((slot, index) => {
        const playDate = normalizeDate(slot.play_date);
        if (!playDate) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Ngày thi đấu không hợp lệ ở vị trí ${index + 1}.`);
        }
        const startTime = normalizeTime(slot.start_time);
        const endTime = normalizeTime(slot.end_time);
        if (!startTime || !endTime) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Khung giờ không hợp lệ ở vị trí ${index + 1}.`);
        }
        if (startTime >= endTime) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Giờ bắt đầu phải nhỏ hơn giờ kết thúc (slot ${index + 1}).`);
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
    const unique = new Map();
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
function distributeAmountAcrossSlots(total, count) {
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
async function getExpiredHeldSlots(fieldCode) {
    return await booking_model_1.default.getExpiredHeldSlots(fieldCode);
}
async function cancelExpiredBookings(expiredSlots) {
    const bookingCodes = Array.from(new Set(expiredSlots
        .map((slot) => slot.bookingCode)
        .filter((code) => Number.isFinite(code) && Number(code) > 0)));
    if (!bookingCodes.length)
        return;
    await booking_model_1.default.cancelExpiredBookings(bookingCodes);
    await cart_service_1.default.removeEntriesForBookings(bookingCodes);
}
async function releaseExpiredHeldSlots(fieldCode) {
    try {
        const expiredSlots = await getExpiredHeldSlots(fieldCode);
        if (!expiredSlots.length)
            return;
        await cancelExpiredBookings(expiredSlots);
        const slotIds = expiredSlots
            .map((slot) => slot.slotId)
            .filter((slotId) => Number.isFinite(slotId) && slotId > 0);
        if (!slotIds.length)
            return;
        await booking_model_1.default.releaseHeldSlotsByIds(slotIds);
    }
    catch (e) {
        console.error("Lỗi release expired held slots:", e);
        // Không throw, tiếp tục xử lý
    }
}
async function confirmFieldBooking(fieldCode, payload, quantityId) {
    if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ.");
    }
    // Release expired held slots trước
    await releaseExpiredHeldSlots(fieldCode);
    const normalizedSlots = normalizeSlots(payload.slots);
    const promotionInputRaw = typeof payload.promotion_code === "string" && payload.promotion_code.trim()
        ? payload.promotion_code.trim()
        : typeof payload.promotionCode === "string" &&
            payload.promotionCode.trim()
            ? payload.promotionCode.trim()
            : undefined;
    const promotionCode = promotionInputRaw
        ? promotionInputRaw.toUpperCase()
        : undefined;
    // Lấy field info để tính giá
    const fieldInfo = await booking_model_1.default.getFieldInfo(fieldCode);
    if (!fieldInfo) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy sân.");
    }
    const field = fieldInfo;
    const shopCode = Number(field.ShopCode ?? 0);
    const slotCount = normalizedSlots.length;
    const basePricePerSlot = field.DefaultPricePerHour || 100000;
    const baseTotalPrice = basePricePerSlot * slotCount;
    let finalTotalPrice = baseTotalPrice;
    let discountAmount = 0;
    let appliedPromotion = null;
    const userIdForUsage = Number(payload.created_by);
    if (promotionCode) {
        const promotion = await shopPromotion_service_1.default.getByCode(promotionCode);
        if (promotion.is_deleted) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.GONE, "Khuyến mãi này không còn khả dụng.");
        }
        if (Number(promotion.shop_code) !== shopCode) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã khuyến mãi không áp dụng cho sân này.");
        }
        const now = Date.now();
        const startAtMs = new Date(promotion.start_at).getTime();
        const endAtMs = new Date(promotion.end_at).getTime();
        if (Number.isNaN(startAtMs) || Number.isNaN(endAtMs)) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Thời gian áp dụng khuyến mãi không hợp lệ.");
        }
        if (promotion.status === "disabled" ||
            promotion.current_status === "disabled") {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Khuyến mãi này đã bị tạm dừng.");
        }
        if (now < startAtMs) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Khuyến mãi này chưa đến thời gian áp dụng.");
        }
        if (now > endAtMs ||
            promotion.status === "expired" ||
            promotion.current_status === "expired") {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Khuyến mãi này đã hết hạn.");
        }
        if (promotion.status === "draft") {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Khuyến mãi này chưa được kích hoạt.");
        }
        if (promotion.min_order_amount !== null &&
            promotion.min_order_amount > baseTotalPrice) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Đơn hàng chưa đạt giá trị tối thiểu để dùng khuyến mãi.");
        }
        if (Number.isFinite(userIdForUsage) && promotion.usage_per_customer) {
            const usage = await booking_model_1.default.checkPromotionUsageByUser(promotion.promotion_id, userIdForUsage);
            if (promotion.usage_limit !== null &&
                promotion.usage_limit >= 0 &&
                usage.totalUsage >= promotion.usage_limit) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã khuyến mãi đã đạt giới hạn sử dụng.");
            }
            if (promotion.usage_per_customer !== null &&
                promotion.usage_per_customer > 0 &&
                usage.customerUsage >= promotion.usage_per_customer) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Bạn đã sử dụng mã khuyến mãi này đủ số lần cho phép.");
            }
        }
        else if (promotion.usage_limit !== null && promotion.usage_limit >= 0) {
            const totalUsage = await booking_model_1.default.checkPromotionTotalUsage(promotion.promotion_id);
            if (totalUsage >= promotion.usage_limit) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã khuyến mãi đã đạt giới hạn sử dụng.");
            }
        }
        let computedDiscount = 0;
        if (promotion.discount_type === "percent") {
            computedDiscount = (baseTotalPrice * promotion.discount_value) / 100;
            if (promotion.max_discount_amount !== null &&
                promotion.max_discount_amount >= 0) {
                computedDiscount = Math.min(computedDiscount, promotion.max_discount_amount);
            }
        }
        else {
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
    let bookingCode = 0;
    const transactionResult = await booking_model_1.default.runInTransaction("confirmFieldBooking", async (connection) => {
        // 1. Xử lý slots (lock, update, insert)
        const updatedSlots = [];
        for (let index = 0; index < normalizedSlots.length; index += 1) {
            const slot = normalizedSlots[index];
            const row = await booking_model_1.default.lockSlot(connection, fieldCode, slot, quantityId ?? null);
            if (row) {
                if (quantityId !== null &&
                    quantityId !== undefined &&
                    row.QuantityID !== null &&
                    row.QuantityID !== quantityId) {
                    throw new apiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, `Khung giờ ${slot.start_time} - ${slot.end_time} ngày ${slot.play_date} đã được giữ cho sân khác.`);
                }
                if (row.Status === "held" && row.HoldExpiresAt) {
                    const holdExpiryTime = new Date(row.HoldExpiresAt);
                    if (new Date() <= holdExpiryTime) {
                        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, `Khung giờ ${slot.start_time} - ${slot.end_time} ngày ${slot.play_date} đã được đặt trước đó.`);
                    }
                }
                else if (row.Status !== "available") {
                    throw new apiErrors_1.default(http_status_codes_1.StatusCodes.CONFLICT, `Khung giờ ${slot.start_time} - ${slot.end_time} ngày ${slot.play_date} đã được đặt trước đó.`);
                }
                await booking_model_1.default.resetSlotForBooking(connection, Number(row.SlotID), quantityId ?? null);
                const resolvedQuantityId = row.QuantityID !== null && row.QuantityID !== undefined
                    ? Number(row.QuantityID)
                    : quantityId ?? null;
                updatedSlots.push({
                    slot_id: Number(row.SlotID),
                    play_date: slot.play_date,
                    start_time: slot.start_time,
                    end_time: slot.end_time,
                    quantity_id: resolvedQuantityId,
                });
            }
            else {
                const insertedId = await booking_model_1.default.insertNewSlot(connection, fieldCode, slot, quantityId ?? null, payload.created_by ?? null);
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
            throw new apiErrors_1.default(500, "Không thể ghi nhận khung giờ đã chọn.");
        }
        // 2. Tạo booking thực vào DB - CHỈ lưu thông tin chung (không lưu time)
        const bookingUserId = Number(payload.created_by);
        if (!Number.isFinite(bookingUserId) || bookingUserId <= 0) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Người tạo booking không hợp lệ.");
        }
        const checkinCode = generateCheckinCode();
        bookingCode = await booking_model_1.default.insertPendingBooking(connection, {
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
            await booking_model_1.default.insertBookingSlotRecord(connection, {
                bookingCode,
                fieldCode,
                quantityId: quantityId ?? null,
                playDate: slot.db_date,
                startTime: slot.db_start_time,
                endTime: slot.db_end_time,
                pricePerSlot: slotPrices[index] ?? basePricePerSlot,
            });
            await booking_model_1.default.holdFieldSlot(connection, {
                fieldCode,
                bookingCode,
                quantityId: quantityId ?? null,
                slot,
                holdExpiresAt: holdExpiryTime,
                createdBy: payload.created_by ?? null,
            });
        }
        const shouldPersistCart = payload.isLoggedInCustomer === true &&
            Number.isFinite(bookingUserId) &&
            bookingUserId > 0;
        if (shouldPersistCart) {
            await cart_service_1.default.persistEntry(connection, bookingUserId, bookingCode, holdExpiryTime);
        }
        return { slots: updatedSlots, holdExpiresAt: holdExpiryTime };
    });
    // Return INT booking code thực từ DB
    const transactionId = generateTransactionId();
    const paymentMethod = "bank_transfer";
    // Tạo payment
    const payment = await payment_model_1.default.create(bookingCode, finalTotalPrice, paymentMethod);
    const paymentID = Number(payment.PaymentID);
    // Build SePay QR URL
    const sepayAcc = process.env.SEPAY_ACC || "96247THUERE";
    const sepayBank = process.env.SEPAY_BANK || "BIDV";
    const des = `BK${bookingCode}`;
    const qrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(sepayAcc)}&bank=${encodeURIComponent(sepayBank)}&amount=${encodeURIComponent(finalTotalPrice)}&des=${encodeURIComponent(des)}`;
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
async function listCustomerBookings(userId, options) {
    const limit = Math.max(1, Number(options.limit) || 10);
    const offset = Math.max(0, Number(options.offset) || 0);
    const sortField = typeof options.sort === "string" ? options.sort : undefined;
    const sortOrder = options.order === "ASC" ? "ASC" : "DESC";
    const rows = await booking_model_1.default.listCustomerBookings(userId, {
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
        ? await booking_model_1.default.listSlotsWithQuantity(bookingCodes)
        : [];
    const slotMap = new Map();
    slotRows.forEach((slot) => {
        const code = Number(slot.BookingCode);
        if (!slotMap.has(code)) {
            slotMap.set(code, [slot]);
        }
        else {
            slotMap.get(code).push(slot);
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
        };
    });
    const total = await booking_model_1.default.countCustomerBookings(userId, options.status);
    return {
        data,
        pagination: {
            limit,
            offset,
            total,
        },
    };
}
async function listShopBookingsForOwner(userId, options) {
    const shop = await shop_service_1.default.getByUserId(Number(userId));
    if (!shop?.shop_code) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy shop của bạn");
    }
    const shopCode = Number(shop.shop_code);
    await cancelStalePendingBookingsForShop(shopCode);
    const limit = Math.min(Math.max(1, Number(options.limit) || 10), 100);
    const offset = Math.max(0, Number(options.offset) || 0);
    const status = typeof options.status === "string" && options.status.trim()
        ? options.status.trim()
        : undefined;
    const search = typeof options.search === "string" && options.search.trim()
        ? options.search.trim()
        : undefined;
    const sortField = typeof options.sort === "string" && options.sort.trim()
        ? options.sort.trim()
        : undefined;
    const filters = {
        status,
        search,
        sortField,
        sortOrder: options.order === "ASC" ? "ASC" : "DESC",
        limit,
        offset,
    };
    const rows = await booking_model_1.default.listShopBookings(shopCode, filters);
    const bookingCodes = rows
        .map((row) => Number(row.BookingCode))
        .filter((code) => Number.isFinite(code) && code > 0);
    const slotRows = bookingCodes.length
        ? await booking_model_1.default.listSlotsWithQuantity(bookingCodes)
        : [];
    const slotMap = new Map();
    slotRows.forEach((slot) => {
        const code = Number(slot.BookingCode);
        if (!slotMap.has(code)) {
            slotMap.set(code, [slot]);
        }
        else {
            slotMap.get(code).push(slot);
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
        };
    });
    const total = await booking_model_1.default.countShopBookings(shopCode, filters);
    const bookingSummaryRows = await booking_model_1.default.getShopBookingStatusSummary(shopCode);
    const paymentSummaryRows = await booking_model_1.default.getShopPaymentStatusSummary(shopCode);
    const bookingSummary = {
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
    };
    bookingSummaryRows.forEach((row) => {
        if (row.BookingStatus) {
            bookingSummary[String(row.BookingStatus)] = Number(row.total || 0);
        }
    });
    const paymentSummary = {
        pending: 0,
        paid: 0,
        failed: 0,
        refunded: 0,
    };
    paymentSummaryRows.forEach((row) => {
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
async function getCustomerBookingDetail(bookingCode, userId) {
    const detail = await booking_model_1.default.getBookingDetail(bookingCode, userId);
    if (!detail) {
        return null;
    }
    const slots = await booking_model_1.default.listSlotsWithQuantity([bookingCode]);
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
    };
}
async function cancelCustomerBooking(bookingCode, userId, reason) {
    const booking = await booking_model_1.default.getBookingByCustomer(bookingCode, userId);
    if (!booking) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy booking");
    }
    if (booking.BookingStatus === "completed") {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Không thể hủy booking đã hoàn thành");
    }
    if (booking.BookingStatus !== "pending") {
        const earliestSlot = await booking_model_1.default.getEarliestSlot(bookingCode);
        if (earliestSlot?.PlayDate && earliestSlot?.StartTime) {
            const playDateTime = new Date(earliestSlot.PlayDate);
            const [hours, minutes] = String(earliestSlot.StartTime)
                .split(":")
                .map((value) => Number(value));
            if (!Number.isNaN(playDateTime.getTime())) {
                playDateTime.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
                const diffHours = (playDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
                if (diffHours < 2) {
                    throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Chỉ có thể hủy booking trước 2 giờ");
                }
            }
        }
    }
    await booking_model_1.default.setBookingStatus(bookingCode, "cancelled");
    await booking_model_1.default.setBookingSlotsStatus(bookingCode, "cancelled");
    await booking_model_1.default.resetFieldSlotsToAvailable(bookingCode);
    await cart_service_1.default.removeEntriesForBookings([bookingCode]);
    if (booking.PaymentStatus === "paid") {
        const refundReason = reason || "Customer requested cancellation";
        await booking_model_1.default.insertBookingRefund(bookingCode, Number(booking.TotalPrice || 0), refundReason);
        const shopCode = await booking_model_1.default.getFieldShopCode(booking.FieldCode);
        if (shopCode) {
            await payment_model_1.default.debitShopWallet(Number(shopCode), Number(booking.NetToShop || 0));
        }
    }
    return {
        bookingCode,
        status: "cancelled",
    };
}
async function getBookingCheckinCode(bookingCode) {
    const booking = await booking_model_1.default.getByBookingCode(String(bookingCode));
    if (!booking) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy booking");
    }
    if (booking.BookingStatus !== "confirmed") {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Chỉ booking confirmed mới có mã check-in");
    }
    return {
        bookingCode,
        checkinCode: booking.CheckinCode,
    };
}
async function verifyBookingCheckin(bookingCode, checkinCode) {
    const booking = await booking_model_1.default.getByBookingCode(String(bookingCode));
    if (!booking) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy booking");
    }
    if (booking.CheckinCode !== checkinCode) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã check-in không đúng");
    }
    if (booking.CheckinTime) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Booking đã check-in");
    }
    await booking_model_1.default.setBookingCheckinTime(bookingCode);
    return {
        bookingCode,
        checkinTime: new Date(),
    };
}
async function updateBookingStatus(bookingCode, status) {
    const detail = await booking_model_1.default.getBookingDetail(bookingCode);
    if (!detail) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy booking");
    }
    const currentStatus = detail.BookingStatus;
    const allowedTransitions = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
    };
    if (!allowedTransitions[currentStatus]?.includes(status)) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Không thể chuyển từ ${currentStatus} sang ${status}`);
    }
    await booking_model_1.default.setBookingStatus(bookingCode, status);
    if (status === "completed") {
        await booking_model_1.default.setBookingCompletedAt(bookingCode);
    }
    if (status !== "pending") {
        await cart_service_1.default.removeEntriesForBookings([bookingCode]);
    }
    return { bookingCode, status };
}
async function cancelBookingByOwner(bookingCode) {
    const booking = await booking_model_1.default.getByBookingCode(String(bookingCode));
    if (!booking) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Booking không tồn tại");
    }
    const wasConfirmed = booking.BookingStatus === "confirmed";
    await booking_model_1.default.setBookingStatus(bookingCode, "cancelled");
    await cart_service_1.default.removeEntriesForBookings([bookingCode]);
    if (wasConfirmed) {
        await booking_model_1.default.decrementFieldRent(Number(booking.FieldCode));
    }
    return {
        BookingCode: bookingCode,
        FieldCode: booking.FieldCode,
    };
}
async function confirmBookingForOwner(bookingCode) {
    const booking = await booking_model_1.default.getByBookingCode(String(bookingCode));
    if (!booking) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Booking không tồn tại");
    }
    if (booking.BookingStatus === "confirmed") {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Booking đã được xác nhận");
    }
    await booking_model_1.default.setBookingStatus(bookingCode, "confirmed");
    if (Number.isFinite(Number(booking.FieldCode))) {
        await booking_model_1.default.incrementFieldRent(Number(booking.FieldCode));
    }
    return {
        BookingCode: bookingCode,
        FieldCode: booking.FieldCode,
    };
}
async function cleanupExpiredHeldSlots() {
    try {
        const expiredSlots = await getExpiredHeldSlots();
        if (!expiredSlots.length)
            return;
        await cancelExpiredBookings(expiredSlots);
        const slotIds = expiredSlots
            .map((slot) => slot.slotId)
            .filter((slotId) => Number.isFinite(slotId) && slotId > 0);
        if (!slotIds.length)
            return;
        await booking_model_1.default.releaseHeldSlotsByIds(slotIds);
        console.log(`Đã giải phóng ${slotIds.length} khung giờ giữ chỗ hết hạn.`);
    }
    catch (e) {
        console.error("Lỗi xóa khung giờ đã hết hạn:", e);
    }
}
async function cancelStalePendingBookingsForShop(shopCode) {
    if (!Number.isFinite(shopCode) || shopCode <= 0) {
        return;
    }
    const codes = await booking_model_1.default.listStalePendingBookingCodes(shopCode);
    if (!codes.length)
        return;
    await booking_model_1.default.cancelExpiredBookings(codes);
    await cart_service_1.default.removeEntriesForBookings(codes);
}
const bookingService = {
    confirmFieldBooking,
};
exports.default = bookingService;
