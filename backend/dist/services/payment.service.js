"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFees = calculateFees;
exports.initiatePayment = initiatePayment;
exports.getPaymentByID = getPaymentByID;
exports.getPaymentByBookingCode = getPaymentByBookingCode;
exports.updatePaymentStatus = updatePaymentStatus;
exports.handlePaymentSuccess = handlePaymentSuccess;
exports.logPaymentAction = logPaymentAction;
exports.getBookingOwnershipInfo = getBookingOwnershipInfo;
exports.hasPaymentLog = hasPaymentLog;
exports.hasWebhookLogByExternalId = hasWebhookLogByExternalId;
exports.findPendingPaymentByAmount = findPendingPaymentByAmount;
exports.getBookingDetailWithOwner = getBookingDetailWithOwner;
exports.getFieldSlotsForBooking = getFieldSlotsForBooking;
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const http_status_codes_1 = require("http-status-codes");
const payment_model_1 = __importDefault(require("../models/payment.model"));
const mail_service_1 = require("./mail.service");
const cart_service_1 = __importDefault(require("./cart.service"));
const PLATFORM_FEE_PERCENT = 5;
const SHOP_EARNING_PERCENT = 95;
/**
 * Tính toán phí
 */
function calculateFees(totalPrice) {
    const platformFee = +(totalPrice * PLATFORM_FEE_PERCENT / 100).toFixed(2);
    const netToShop = +(totalPrice - platformFee).toFixed(2);
    return {
        totalPrice: +totalPrice.toFixed(2),
        platformFee,
        netToShop,
    };
}
/**
 * Tạo record payment
 */
async function initiatePayment(bookingCode, totalPrice, paymentMethod = "bank_transfer") {
    const bCode = Number(bookingCode);
    if (!Number.isFinite(bCode)) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "BookingCode không hợp lệ");
    }
    const fees = calculateFees(totalPrice);
    const payment = await payment_model_1.default.create(bCode, fees.totalPrice, paymentMethod);
    return {
        paymentID: payment.PaymentID,
        bookingCode: bCode,
        amount: fees.totalPrice,
        platformFee: fees.platformFee,
        netToShop: fees.netToShop,
        paymentStatus: "pending",
    };
}
/**
 * Get payment info
 */
async function getPaymentByID(paymentID) {
    return await payment_model_1.default.getById(paymentID);
}
async function getPaymentByBookingCode(bookingCode) {
    const code = Number(bookingCode);
    if (!Number.isFinite(code))
        return null;
    return await payment_model_1.default.getByBookingCode(code);
}
async function updatePaymentStatus(paymentID, status, momoTransactionID, momoRequestID) {
    return await payment_model_1.default.updateStatus(paymentID, status, momoTransactionID, momoRequestID);
}
/**
 * Payment Success
 */
async function handlePaymentSuccess(paymentID) {
    const payment = (await payment_model_1.default.getById(paymentID));
    if (!payment) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy payment");
    }
    const bookingInfo = (await payment_model_1.default.getBookingInfoByPaymentId(paymentID));
    if (!bookingInfo) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy booking");
    }
    const wasAlreadyConfirmed = bookingInfo.BookingStatus === "confirmed";
    await payment_model_1.default.updateStatus(paymentID, "paid");
    await payment_model_1.default.confirmBooking(payment.BookingCode, paymentID);
    const bookingCodeNumeric = Number(payment.BookingCode);
    if (Number.isFinite(bookingCodeNumeric)) {
        await cart_service_1.default.removeEntriesForBookings([bookingCodeNumeric]);
    }
    await payment_model_1.default.updateBookingSlotsToBooked(payment.BookingCode);
    await payment_model_1.default.updateFieldSlotsToBooked(payment.BookingCode);
    const fees = calculateFees(payment.Amount);
    await payment_model_1.default.creditShopWallet(bookingInfo.ShopCode, fees.netToShop);
    if (!wasAlreadyConfirmed) {
        await payment_model_1.default.incrementFieldRent(bookingInfo.FieldCode);
    }
    await payment_model_1.default.createWalletTransaction(bookingInfo.ShopCode, payment.BookingCode, "credit_settlement", fees.netToShop, "Payment from booking");
    // Email gửi sau thanh toán
    try {
        if (payment.BookingCode) {
            const bookingSlot = await payment_model_1.default.getBookingSlotForEmail(payment.BookingCode);
            if (bookingSlot) {
                const playDateStr = new Date(bookingSlot.PlayDate).toLocaleDateString("vi-VN");
                const timeSlot = `${bookingSlot.StartTime} - ${bookingSlot.EndTime}`;
                await (0, mail_service_1.sendBookingConfirmationEmail)(bookingSlot.CustomerEmail, String(bookingSlot.BookingCode), bookingSlot.CheckinCode, bookingSlot.FieldName, playDateStr, timeSlot);
            }
        }
    }
    catch (e) {
        console.error("Lỗi gửi email:", e);
    }
    return {
        success: true,
        paymentID,
        bookingCode: payment.BookingCode,
        amountToPay: fees.totalPrice,
        platformFee: fees.platformFee,
        netToShop: fees.netToShop,
    };
}
async function logPaymentAction(paymentID, action, requestData, responseData, momoTransactionID, resultCode, resultMessage) {
    return await payment_model_1.default.logAction(paymentID, action, requestData, responseData, momoTransactionID, resultCode, resultMessage);
}
async function getBookingOwnershipInfo(bookingCode) {
    return await payment_model_1.default.getBookingOwnershipInfo(bookingCode);
}
async function hasPaymentLog(paymentID, action, externalId) {
    return await payment_model_1.default.hasPaymentLog(paymentID, action, externalId);
}
async function hasWebhookLogByExternalId(action, externalId) {
    return await payment_model_1.default.hasWebhookLogByExternalId(action, externalId);
}
async function findPendingPaymentByAmount(amount) {
    return await payment_model_1.default.findPendingPaymentByAmount(amount);
}
async function getBookingDetailWithOwner(bookingCode) {
    return await payment_model_1.default.getBookingDetailWithOwner(bookingCode);
}
async function getFieldSlotsForBooking(bookingCode) {
    return await payment_model_1.default.getFieldSlotsForBooking(bookingCode);
}
const paymentService = {
    calculateFees,
    initiatePayment,
    getPaymentByID,
    getPaymentByBookingCode,
    updatePaymentStatus,
    handlePaymentSuccess,
    logPaymentAction,
    getBookingOwnershipInfo,
    hasPaymentLog,
    hasWebhookLogByExternalId,
    findPendingPaymentByAmount,
    getBookingDetailWithOwner,
    getFieldSlotsForBooking,
};
exports.default = paymentService;
