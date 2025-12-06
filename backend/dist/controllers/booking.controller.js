"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const respone_1 = __importDefault(require("../core/respone"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const booking_service_1 = require("../services/booking.service");
const parseBookingCodeParam = (value) => {
    const direct = Number(value);
    if (Number.isFinite(direct) && direct > 0) {
        return direct;
    }
    const match = String(value).match(/(\d+)/);
    if (match) {
        const parsed = Number(match[1]);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }
    return null;
};
const toNumber = (value) => {
    if (typeof value === "number")
        return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
};
const DEFAULT_GUEST_CUSTOMER_USER_ID = (() => {
    const raw = Number(process.env.GUEST_CUSTOMER_USER_ID ?? 1);
    if (Number.isFinite(raw) && raw > 0) {
        return raw;
    }
    return 1;
})();
const resolveBookingUser = (req) => {
    const { UserID, role } = req.user ?? {};
    const userId = toNumber(UserID);
    const isGuest = role === "guest" || userId === DEFAULT_GUEST_CUSTOMER_USER_ID;
    if (userId && userId > 0) {
        return { userId, isLoggedInCustomer: !isGuest, isGuest };
    }
    const guestId = DEFAULT_GUEST_CUSTOMER_USER_ID;
    if (Number(guestId) && guestId > 0) {
        return { userId: guestId, isLoggedInCustomer: false, isGuest: true };
    }
    return { isLoggedInCustomer: false, isGuest: false };
};
const bookingController = {
    async listBookings(req, res, next) {
        try {
            const userId = Number(req.user?.UserID);
            if (!Number.isFinite(userId)) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Yêu cầu đăng nhập");
            }
            const { status, limit = 10, offset = 0, sort = "CreateAt", order = "DESC", } = req.query;
            const result = await (0, booking_service_1.listCustomerBookings)(userId, {
                status: typeof status === "string" ? status : undefined,
                limit: Number(limit) || 10,
                offset: Number(offset) || 0,
                sort: typeof sort === "string" ? sort : undefined,
                order: typeof order === "string" ? order : undefined,
            });
            return respone_1.default.success(res, result, "Danh sách booking", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi lấy danh sách booking"));
        }
    },
    /**
     * Tạo booking mới
     * POST /api/bookings
     */
    async createBooking(req, res, next) {
        try {
            const { fieldCode, field_code, quantityID, quantity_id, quantityId, slots, playDate, startTime, endTime, customer, customerName, customerEmail, customerPhone, payment_method, total_price, notes, promotion_code: promotionCodeSnake, promotionCode: promotionCodeCamel, } = req.body ?? {};
            const numericFieldCode = Number(fieldCode ?? field_code);
            if (!Number.isFinite(numericFieldCode) || numericFieldCode <= 0) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ"));
            }
            const resolvedSlots = Array.isArray(slots)
                ? slots.map((slot) => {
                    const play_date = slot.play_date ?? slot.playDate;
                    const start_time = slot.start_time ?? slot.startTime;
                    const end_time = slot.end_time ?? slot.endTime;
                    if (!play_date || !start_time || !end_time) {
                        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mỗi khung giờ phải có play_date, start_time, end_time");
                    }
                    return {
                        play_date,
                        start_time,
                        end_time,
                    };
                })
                : [];
            if (!resolvedSlots.length) {
                if (!playDate || !startTime || !endTime) {
                    return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Vui lòng chọn ít nhất một khung giờ để đặt sân."));
                }
                resolvedSlots.push({
                    play_date: playDate,
                    start_time: startTime,
                    end_time: endTime,
                });
            }
            const customerPayload = typeof customer === "object" && customer
                ? customer
                : {
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone,
                };
            const quantityNumeric = toNumber(quantity_id ?? quantityId ?? quantityID ?? undefined);
            const normalizedQuantityId = typeof quantityNumeric === "number" && Number.isFinite(quantityNumeric)
                ? Number(quantityNumeric)
                : null;
            const promotionCodeInput = [promotionCodeSnake, promotionCodeCamel].find((code) => typeof code === "string" && code.trim())?.trim();
            const { userId: resolvedUserId, isLoggedInCustomer, isGuest, } = resolveBookingUser(req);
            if (!resolvedUserId) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để đặt sân"));
            }
            if (promotionCodeInput && isGuest) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Khách vãng lai không được áp dụng mã giảm giá."));
            }
            const payload = {
                slots: resolvedSlots,
                customer: typeof customerPayload === "object" ? customerPayload : undefined,
                payment_method: typeof payment_method === "string" ? payment_method : undefined,
                total_price: typeof total_price === "number" ? total_price : undefined,
                notes: typeof notes === "string" ? notes : undefined,
                created_by: resolvedUserId,
                promotion_code: promotionCodeInput?.toUpperCase(),
                isLoggedInCustomer,
            };
            const confirmation = await (0, booking_service_1.confirmFieldBooking)(numericFieldCode, payload, normalizedQuantityId);
            return respone_1.default.success(res, {
                booking_code: confirmation.booking_code,
                qr_code: confirmation.qr_code,
                paymentID: confirmation.paymentID,
                amount: confirmation.amount,
                amountBeforeDiscount: confirmation.amount_before_discount,
                discountAmount: confirmation.discount_amount,
                promotionCode: confirmation.promotion_code,
                promotionTitle: confirmation.promotion_title,
                transaction_id: confirmation.transaction_id,
                payment_status: confirmation.payment_status,
                payment_method: typeof payment_method === "string"
                    ? payment_method
                    : "bank_transfer",
                slots: confirmation.slots,
            }, "Đặt sân thành công", http_status_codes_1.StatusCodes.CREATED);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Không thể tạo booking"));
        }
    },
    /**
     * Chi tiết booking
     * GET /api/bookings/:bookingCode
     */
    async getBooking(req, res, next) {
        try {
            const userId = Number(req.user?.UserID);
            const { bookingCode } = req.params;
            const normalizedCode = parseBookingCodeParam(bookingCode);
            if (!normalizedCode) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode format không hợp lệ"));
            }
            const detail = await (0, booking_service_1.getCustomerBookingDetail)(normalizedCode, Number.isFinite(userId) ? userId : undefined);
            if (!detail) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy booking"));
            }
            return respone_1.default.success(res, detail, "Chi tiết booking", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi lấy chi tiết booking"));
        }
    },
    /**
     * Hủy booking
     * PATCH /api/bookings/:bookingCode/cancel
     */
    async cancelBooking(req, res, next) {
        try {
            const userId = Number(req.user?.UserID);
            const { bookingCode } = req.params;
            const { reason } = req.body;
            if (!Number.isFinite(userId)) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Yêu cầu đăng nhập");
            }
            const normalizedCode = parseBookingCodeParam(bookingCode);
            if (!normalizedCode) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode format không hợp lệ"));
            }
            const result = await (0, booking_service_1.cancelCustomerBooking)(normalizedCode, userId, typeof reason === "string" ? reason : undefined);
            return respone_1.default.success(res, result, result?.message || "Hủy booking thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi hủy booking"));
        }
    },
    async respondCancellationRequest(req, res, next) {
        try {
            const token = typeof req.body?.token === "string" ? req.body.token : "";
            const decisionRaw = typeof req.body?.decision === "string" ? req.body.decision : "";
            if (!token || !decisionRaw) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Thiếu token hoặc quyết định xử lý"));
            }
            const normalizedDecision = decisionRaw.toLowerCase().startsWith("a")
                ? "approve"
                : "reject";
            const result = await (0, booking_service_1.respondCancellationRequestByToken)(token.trim(), normalizedDecision);
            const message = normalizedDecision === "approve"
                ? "Đã chấp nhận yêu cầu hủy sân"
                : "Đã từ chối yêu cầu hủy sân";
            return respone_1.default.success(res, result, message, http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(error?.statusCode || 500, error?.message || "Không thể xử lý yêu cầu hủy sân"));
        }
    },
    /**
     * Cập nhật trạng thái booking (ADMIN)
     * PATCH /api/bookings/:bookingCode/status
     */
    async updateBookingStatus(req, res, next) {
        try {
            const { bookingCode } = req.params;
            const { status } = req.body;
            if (!["pending", "confirmed", "completed", "cancelled"].includes(status)) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Trạng thái không hợp lệ"));
            }
            const normalizedCode = parseBookingCodeParam(bookingCode);
            if (!normalizedCode) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode format không hợp lệ"));
            }
            const result = await (0, booking_service_1.updateBookingStatus)(normalizedCode, status);
            return respone_1.default.success(res, result, "Cập nhật trạng thái booking thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi cập nhật booking"));
        }
    },
    /**
     * Verify checkin code
     * POST /api/bookings/:bookingCode/verify-checkin
     */
    async verifyCheckinCode(req, res, next) {
        try {
            const { bookingCode } = req.params;
            const { checkin_code } = req.body;
            if (!checkin_code) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Mã check-in là bắt buộc"));
            }
            const normalizedCode = parseBookingCodeParam(bookingCode);
            if (!normalizedCode) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode format không hợp lệ"));
            }
            const result = await (0, booking_service_1.verifyBookingCheckin)(normalizedCode, checkin_code);
            return respone_1.default.success(res, result, "Check-in thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi verify check-in"));
        }
    },
    /**
     * Get checkin code (customer)
     * GET /api/bookings/:bookingCode/checkin-code
     */
    async getCheckinCode(req, res, next) {
        try {
            const { bookingCode } = req.params;
            const normalizedCode = parseBookingCodeParam(bookingCode);
            if (!normalizedCode) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode format không hợp lệ"));
            }
            const result = await (0, booking_service_1.getBookingCheckinCode)(normalizedCode);
            return respone_1.default.success(res, result, "Mã check-in", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi lấy mã check-in"));
        }
    },
    /**
     * Liệt kê booking của shop (tất cả fields)
     * GET /api/shops/me/bookings
     */
    async listShopBookings(req, res, next) {
        try {
            const userId = Number(req.user?.UserID);
            if (!Number.isFinite(userId)) {
                throw new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Yêu cầu đăng nhập");
            }
            const { status, search, limit = 10, offset = 0, sort = "CreateAt", order = "DESC", } = req.query;
            const result = await (0, booking_service_1.listShopBookingsForOwner)(userId, {
                status: typeof status === "string" ? status : undefined,
                search: typeof search === "string" ? search : undefined,
                limit: Number(limit) || 10,
                offset: Number(offset) || 0,
                sort: typeof sort === "string" ? sort : undefined,
                order: typeof order === "string" ? order : undefined,
            });
            return respone_1.default.success(res, result, "Danh sách booking của shop", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Lỗi lấy danh sách booking"));
        }
    },
    /**
     * Confirm a booking - also increment field Rent
     * PUT /api/bookings/:bookingCode/confirm
     */
    async confirmBooking(req, res, next) {
        try {
            const normalizedCode = parseBookingCodeParam(req.params.bookingCode);
            if (!normalizedCode) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode format không hợp lệ"));
            }
            const result = await (0, booking_service_1.confirmBookingForOwner)(normalizedCode);
            return respone_1.default.success(res, result, "Booking xác nhận thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Confirm booking failed"));
        }
    },
    /**
     * Cancel a booking - also decrement field Rent if it was confirmed
     * PUT /api/bookings/:bookingCode/cancel
     */
    async cancelBookingMethod(req, res, next) {
        try {
            const { bookingCode } = req.params;
            const normalizedCode = parseBookingCodeParam(bookingCode);
            if (!normalizedCode) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode format không hợp lệ"));
            }
            const result = await (0, booking_service_1.cancelBookingByOwner)(normalizedCode);
            return respone_1.default.success(res, result, "Booking hủy thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Cancel booking failed"));
        }
    },
};
exports.default = bookingController;
