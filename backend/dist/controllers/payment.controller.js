"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const respone_1 = __importDefault(require("../core/respone"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const payment_service_1 = __importDefault(require("../services/payment.service"));
function resolveCurrentUser(req) {
    const rawUser = req.user ?? {};
    const userId = Number(rawUser.UserID ?? rawUser.user_id ?? rawUser.user_code ?? rawUser.id);
    const role = String(rawUser.role ?? rawUser.LevelType ?? rawUser.level_type ?? "").toLowerCase();
    return { userId, role };
}
function parseBookingCode(value) {
    const direct = Number(value);
    if (Number.isFinite(direct) && direct > 0)
        return direct;
    const match = String(value).match(/(\d+)/);
    if (match && match[1]) {
        const parsed = Number(match[1]);
        if (Number.isFinite(parsed) && parsed > 0)
            return parsed;
    }
    return null;
}
function ensureBookingAccess(req, booking) {
    const { userId, role } = resolveCurrentUser(req);
    if (role === "admin")
        return;
    if (!Number.isFinite(userId)) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Yêu cầu đăng nhập");
    }
    if (Number(booking.CustomerUserID) === userId ||
        Number(booking.ShopOwnerUserID) === userId) {
        return;
    }
    throw new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Bạn không có quyền truy cập thông tin thanh toán của booking này");
}
const paymentController = {
    // ============================================
    // INITIATE PAYMENT
    // ============================================
    async initiatePayment(req, res, next) {
        try {
            const { bookingCode } = req.params;
            const { payment_method = "bank_transfer" } = req.body;
            const userId = Number(req.user?.UserID);
            if (!bookingCode)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode là bắt buộc"));
            if (!Number.isFinite(userId) || userId <= 0)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Yêu cầu đăng nhập"));
            const validMethods = ["bank_transfer", "card", "ewallet", "cash"];
            if (!validMethods.includes(payment_method)) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `PaymentMethod phải là một trong: ${validMethods.join(", ")}`));
            }
            const normalizedCode = parseBookingCode(String(bookingCode));
            if (!normalizedCode)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode format không hợp lệ"));
            const booking = (await payment_service_1.default.getBookingDetailWithOwner(normalizedCode));
            if (!booking)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy booking"));
            if (Number(booking.CustomerUserID) !== userId &&
                Number(booking.ShopOwnerUserID) !== userId) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "Bạn không có quyền thanh toán cho booking này"));
            }
            if (booking.PaymentStatus === "paid") {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Booking đã thanh toán"));
            }
            const paymentInfo = await payment_service_1.default.initiatePayment(normalizedCode, booking.TotalPrice, payment_method);
            const sepayAcc = process.env.SEPAY_ACC || "96247THUERE";
            const sepayBank = process.env.SEPAY_BANK || "BIDV";
            const amount = Number(booking.TotalPrice);
            const des = `BK${normalizedCode}`;
            const sepayQrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(sepayAcc)}&bank=${encodeURIComponent(sepayBank)}&amount=${encodeURIComponent(amount)}&des=${encodeURIComponent(des)}`;
            return respone_1.default.success(res, {
                paymentID: paymentInfo.paymentID,
                qr_code: sepayQrUrl,
                momo_url: null,
                amount,
                expiresIn: 900,
                bookingId: normalizedCode,
                paymentMethod: payment_method,
                bankAccount: {
                    bankName: process.env.SEPAY_BANK_NAME || process.env.SEPAY_BANK || "BIDV",
                    accountNumber: process.env.SEPAY_ACC || "96247THUERE",
                    accountHolder: process.env.SEPAY_ACC_HOLDER || "ThueRe Platform",
                },
            }, "Khởi tạo thanh toán thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message));
        }
    },
    // ============================================
    // GET PAYMENT STATUS
    // ============================================
    async getPaymentStatus(req, res, next) {
        try {
            const { bookingCode } = req.params;
            if (!bookingCode)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode là bắt buộc"));
            const searchBookingCode = parseBookingCode(String(bookingCode));
            if (!searchBookingCode)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode format không hợp lệ"));
            const bookingInfo = (await payment_service_1.default.getBookingOwnershipInfo(searchBookingCode));
            if (!bookingInfo)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy booking"));
            ensureBookingAccess(req, bookingInfo);
            const payment = (await payment_service_1.default.getPaymentByBookingCode(searchBookingCode));
            if (!payment) {
                return respone_1.default.success(res, {
                    paymentID: null,
                    bookingCode: searchBookingCode,
                    bookingId: searchBookingCode,
                    amount: bookingInfo.TotalPrice,
                    status: bookingInfo.PaymentStatus || "pending",
                    paidAt: null,
                }, "Lấy trạng thái thanh toán thành công (pending)", http_status_codes_1.StatusCodes.OK);
            }
            return respone_1.default.success(res, {
                paymentID: payment.PaymentID,
                bookingCode: searchBookingCode,
                bookingId: searchBookingCode,
                amount: payment.Amount,
                status: payment.PaymentStatus,
                paidAt: payment.PaidAt || null,
            }, "Lấy trạng thái thanh toán thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message));
        }
    },
    // ============================================
    // VERIFY PAYMENT
    // ============================================
    async verifyPayment(req, res, next) {
        try {
            const { bookingCode } = req.params;
            if (!bookingCode)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode là bắt buộc"));
            const searchBookingCode = parseBookingCode(String(bookingCode));
            if (!searchBookingCode)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode format không hợp lệ"));
            const bookingInfo = (await payment_service_1.default.getBookingOwnershipInfo(searchBookingCode));
            if (!bookingInfo)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy booking"));
            ensureBookingAccess(req, bookingInfo);
            const payment = (await payment_service_1.default.getPaymentByBookingCode(searchBookingCode));
            if (!payment)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy payment"));
            if (payment.PaymentStatus === "paid") {
                return respone_1.default.success(res, {
                    paymentID: payment.PaymentID,
                    bookingCode: searchBookingCode,
                    status: "paid",
                    message: "Thanh toán đã được xác nhận",
                }, "Thanh toán đã hoàn tất", http_status_codes_1.StatusCodes.OK);
            }
            const hasWebhookLog = await payment_service_1.default.hasPaymentLog(payment.PaymentID, "sepay_webhook");
            if (hasWebhookLog) {
                return respone_1.default.success(res, {
                    paymentID: payment.PaymentID,
                    bookingCode: searchBookingCode,
                    status: "paid",
                    message: "Thanh toán đã được xác nhận từ SePay",
                }, "Thanh toán thành công", http_status_codes_1.StatusCodes.OK);
            }
            return respone_1.default.success(res, {
                paymentID: payment.PaymentID,
                bookingCode: searchBookingCode,
                status: "pending",
                message: "Vui lòng quét mã QR để chuyển tiền. Hệ thống sẽ tự động cập nhật khi nhận được tiền.",
            }, "Chờ xác nhận thanh toán", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message));
        }
    },
    async sepayCallback(req, res, next) {
        try {
            const { id, gateway, transactionDate, accountNumber, transferType, transferAmount, accumulated, code, content, subAccount, referenceCode, description, des, } = req.body || {};
            const normalizedTransferType = typeof transferType === "string"
                ? transferType.trim().toLowerCase()
                : "";
            const isIncomingTransfer = ["in", "incoming", "credit"].includes(normalizedTransferType) ||
                normalizedTransferType.includes("transfer_in") ||
                normalizedTransferType.includes("nap");
            const normalizedTransferAmount = typeof transferAmount === "string"
                ? Number(transferAmount.replace(/[^\d.-]/g, ""))
                : typeof transferAmount === "number"
                    ? transferAmount
                    : null;
            const transferAmountValue = typeof normalizedTransferAmount === "number" &&
                Number.isFinite(normalizedTransferAmount) &&
                normalizedTransferAmount > 0
                ? normalizedTransferAmount
                : null;
            // DEBUG: Log webhook received
            console.log("=== SePay Webhook Received ===");
            console.log("ID:", id);
            console.log("TransferType:", transferType);
            console.log("Amount:", transferAmountValue ?? transferAmount);
            console.log("Content:", content);
            console.log("Description:", description);
            console.log("Des:", des);
            console.log("ReferenceCode:", referenceCode);
            console.log("==============================");
            // Idempotency: nếu đã log id này rồi thì coi như xử lý xong
            try {
                const duplicate = await payment_service_1.default.hasWebhookLogByExternalId("sepay_webhook", String(id));
                if (duplicate) {
                    return respone_1.default.success(res, { duplicate: true }, "SePay webhook already processed", http_status_codes_1.StatusCodes.OK);
                }
            }
            catch (_) { }
            // Helper: extract booking code number
            const extractBK = (text) => {
                if (!text || typeof text !== "string")
                    return null;
                const m1 = text.match(/BK[-_]?(\d+)/i);
                if (m1 && m1[1])
                    return Number(m1[1]);
                const m2 = text.match(/(\d{1,9})/); // fallback: any digits
                if (m2 && m2[1])
                    return Number(m2[1]);
                return null;
            };
            const candidates = [];
            const candSet = new Set();
            [content, code, description, des, referenceCode].forEach((t) => {
                const v = extractBK(t);
                if (typeof v === "number" && Number.isFinite(v)) {
                    if (!candSet.has(v)) {
                        candSet.add(v);
                        candidates.push(v);
                    }
                }
            });
            let payment = null;
            for (const c of candidates) {
                const p = await payment_service_1.default.getPaymentByBookingCode(c);
                if (p) {
                    payment = p;
                    break;
                }
            }
            // Fallback: match by amount to the most recent pending payment
            if (!payment && isIncomingTransfer && transferAmountValue) {
                try {
                    const maybePayment = await payment_service_1.default.findPendingPaymentByAmount(transferAmountValue);
                    if (maybePayment) {
                        payment = maybePayment;
                    }
                }
                catch (_) { }
            }
            // Log webhook (nếu có payment) để không lỗi FK
            if (payment) {
                await payment_service_1.default.logPaymentAction(payment.PaymentID, "sepay_webhook", req.body, { status: "processing" }, String(id), 0, "OK");
            }
            // Nếu là giao dịch vào (in) và có mapping payment thì xác nhận thanh toán
            if (isIncomingTransfer && payment) {
                try {
                    await payment_service_1.default.updatePaymentStatus(payment.PaymentID, "paid", String(id));
                    const result = await payment_service_1.default.handlePaymentSuccess(payment.PaymentID);
                    await payment_service_1.default.logPaymentAction(payment.PaymentID, "payment_success", { id, transferAmount }, result, String(id), 0, "Success");
                    return respone_1.default.success(res, { success: true, matched: true }, "SePay payment confirmed", http_status_codes_1.StatusCodes.OK);
                }
                catch (e) {
                    return respone_1.default.success(res, { success: true, matched: true, error: e?.message }, "SePay webhook processed with update error", http_status_codes_1.StatusCodes.OK);
                }
            }
            // Không match được payment: vẫn trả success để tránh retry loop
            return respone_1.default.success(res, { success: true, matched: !!payment }, payment
                ? "SePay webhook processed"
                : "SePay webhook received - no matching payment", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            return respone_1.default.success(res, { success: true, error: error?.message }, "SePay webhook received", http_status_codes_1.StatusCodes.OK);
        }
    },
    // ============================================
    // RESULT
    // ============================================
    async getPaymentResult(req, res, next) {
        try {
            const { bookingCode } = req.params;
            if (!bookingCode)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode là bắt buộc"));
            const searchBookingCode = parseBookingCode(String(bookingCode));
            if (!searchBookingCode)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode format không hợp lệ"));
            const booking = (await payment_service_1.default.getBookingDetailWithOwner(searchBookingCode));
            if (!booking)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy booking"));
            ensureBookingAccess(req, booking);
            const payment = (await payment_service_1.default.getPaymentByBookingCode(searchBookingCode));
            if (!payment)
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy payment"));
            const slotRows = await payment_service_1.default.getFieldSlotsForBooking(searchBookingCode);
            return respone_1.default.success(res, {
                booking_code: searchBookingCode,
                transaction_id: payment.TransactionCode || `TX-${payment.PaymentID}`,
                payment_status: payment.PaymentStatus,
                field_code: booking.FieldCode,
                field_name: booking.FieldName,
                total_price: payment.Amount,
                slots: slotRows?.map((slot) => ({
                    slot_id: slot.SlotID,
                    play_date: slot.PlayDate,
                    start_time: slot.StartTime,
                    end_time: slot.EndTime,
                })) || [],
                payment_method: payment.PaymentMethod,
                paid_at: payment.PaidAt,
            }, "Lấy kết quả thanh toán thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message));
        }
    },
};
exports.default = paymentController;
