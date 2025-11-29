"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPayoutRequest = createPayoutRequest;
exports.getPayoutByID = getPayoutByID;
exports.listPayoutsByShop = listPayoutsByShop;
exports.listAllPayouts = listAllPayouts;
exports.approvePayoutRequest = approvePayoutRequest;
exports.rejectPayoutRequest = rejectPayoutRequest;
exports.getShopWalletStats = getShopWalletStats;
exports.listWalletTransactions = listWalletTransactions;
exports.countWalletTransactions = countWalletTransactions;
const payout_model_1 = __importDefault(require("../models/payout.model"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const http_status_codes_1 = require("http-status-codes");
const auth_1 = __importDefault(require("./auth"));
const mail_service_1 = require("./mail.service");
/**
 * Tạo yêu cầu rút tiền
 */
async function createPayoutRequest(shopCode, shopBankID, amount, note, userId, password) {
    // Kiểm tra shop tồn tại
    const shop = await payout_model_1.default.getShop(shopCode);
    if (!shop) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy shop");
    }
    // Xác nhận mật khẩu nếu có userId
    if (userId && password) {
        const user = await payout_model_1.default.getUser(userId);
        if (!user) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy người dùng");
        }
        // Verify password using authService (same as login)
        const isPasswordValid = await auth_1.default.verifyPassword(password, user.PasswordHash);
        if (!isPasswordValid) {
            throw new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Mật khẩu không chính xác");
        }
    }
    // Kiểm tra bank account tồn tại
    const bankAccount = await payout_model_1.default.getBankAccount(shopCode, shopBankID || undefined);
    if (!bankAccount) {
        // Debug: Check what accounts exist for this shop
        const allAccounts = await payout_model_1.default.getAllBankAccounts(shopCode);
        console.log(`[Payout] All bank accounts for shopCode ${shopCode}:`, allAccounts);
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy tài khoản ngân hàng. Vui lòng chọn hoặc thêm tài khoản.");
    }
    // Kiểm tra số dư
    const balance = await payout_model_1.default.getWalletBalance(shopCode);
    if (balance < amount) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Số dư không đủ");
    }
    // Tạo payout request
    const payoutID = await payout_model_1.default.createPayoutRequest(shopCode, shopBankID, amount, note);
    // ⭐ IMMEDIATELY DEDUCT FROM WALLET (Trừ ngay)
    await payout_model_1.default.deductWallet(shopCode, amount);
    // Tạo wallet transaction
    await payout_model_1.default.createWalletTransaction(shopCode, "debit_payout", amount, "Yêu cầu rút tiền", "pending", payoutID);
    // ⭐ SEND EMAIL TO ADMIN
    try {
        const emailContent = `
<h2>🔔 Yêu Cầu Rút Tiền Mới</h2>
<p><strong>Shop:</strong> ${shop.ShopName}</p>
<p><strong>Mã Yêu Cầu:</strong> PAYOUT-${payoutID}</p>
<p><strong>Số Tiền:</strong> ${amount.toLocaleString("vi-VN")}đ</p>
<p><strong>Ngân Hàng:</strong> ${bankAccount.BankName}</p>
<p><strong>Số Tài Khoản:</strong> ${bankAccount.AccountNumber}</p>
<p><strong>Chủ Tài Khoản:</strong> ${bankAccount.AccountHolder}</p>
<p><strong>Ghi Chú:</strong> ${note || "N/A"}</p>
<p><strong>Thời Gian:</strong> ${new Date().toLocaleString("vi-VN")}</p>
<hr>
<p>Vui lòng xác nhận và xử lý yêu cầu này trong admin dashboard.</p>
    `;
        await (0, mail_service_1.sendMail)("thuere2004@gmail.com", `[Yêu Cầu Rút Tiền] ${shop.ShopName} - ${amount.toLocaleString("vi-VN")}đ`, emailContent);
    }
    catch (e) {
        console.error("Lỗi gửi email:", e);
        // Không throw, tiếp tục xử lý
    }
    return {
        payoutID,
        shopCode,
        amount,
        status: "requested",
        requestedAt: new Date(),
    };
}
/**
 * Lấy chi tiết payout request
 */
async function getPayoutByID(payoutID) {
    return await payout_model_1.default.getPayoutByID(payoutID);
}
/**
 * Liệt kê payout requests của shop
 */
async function listPayoutsByShop(shopCode, status, limit = 10, offset = 0) {
    return await payout_model_1.default.listPayoutsByShop(shopCode, status, limit, offset);
}
/**
 * Liệt kê tất cả payout requests (admin)
 */
async function listAllPayouts(status, shopCode, limit = 10, offset = 0) {
    return await payout_model_1.default.listAllPayouts(status, shopCode, limit, offset);
}
/**
 * Duyệt rút tiền (admin)
 */
async function approvePayoutRequest(payoutID, note) {
    const payout = await payout_model_1.default.getPayoutByID(payoutID);
    if (!payout) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy payout request");
    }
    if (payout.Status !== "requested") {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Chỉ có thể duyệt payout ở trạng thái 'requested'");
    }
    // Cập nhật payout status
    await payout_model_1.default.approvePayoutRequest(payoutID);
    // ⭐ UPDATE wallet transaction status from pending to completed
    // (Wallet đã bị trừ ngay khi tạo request)
    await payout_model_1.default.completeWalletTransaction(payoutID);
    const updatedPayout = await payout_model_1.default.getPayoutByID(payoutID);
    if (updatedPayout?.owner_email) {
        try {
            await (0, mail_service_1.sendPayoutDecisionEmail)({
                to: updatedPayout.owner_email,
                fullName: updatedPayout.owner_full_name,
                shopName: updatedPayout.ShopName ?? `Shop #${payout.ShopCode}`,
                amount: Number(updatedPayout.Amount ?? payout.Amount ?? 0),
                status: "approved",
                note,
                processedAt: updatedPayout.ProcessedAt ?? new Date(),
                bankName: updatedPayout.BankName,
                bankAccountNumber: updatedPayout.AccountNumber,
            });
        }
        catch (error) {
            console.error("[payoutService] Failed to send payout approval email:", error);
        }
    }
    return {
        success: true,
        payoutID,
        status: "paid",
        processedAt: new Date(),
    };
}
/**
 * Từ chối rút tiền (admin)
 */
async function rejectPayoutRequest(payoutID, reason) {
    const payout = await payout_model_1.default.getPayoutByID(payoutID);
    if (!payout) {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "Không tìm thấy payout request");
    }
    if (payout.Status !== "requested") {
        throw new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Chỉ có thể từ chối payout ở trạng thái 'requested'");
    }
    const normalizedReason = (reason ?? "").toString().trim();
    // Cập nhật payout status
    await payout_model_1.default.rejectPayoutRequest(payoutID, normalizedReason, Number(payout.ShopCode), Math.max(0, Number(payout.Amount ?? 0)));
    const updatedPayout = await payout_model_1.default.getPayoutByID(payoutID);
    if (updatedPayout?.owner_email) {
        try {
            await (0, mail_service_1.sendPayoutDecisionEmail)({
                to: updatedPayout.owner_email,
                fullName: updatedPayout.owner_full_name,
                shopName: updatedPayout.ShopName ?? `Shop #${payout.ShopCode}`,
                amount: Number(updatedPayout.Amount ?? payout.Amount ?? 0),
                status: "rejected",
                reason: normalizedReason,
                processedAt: updatedPayout.ProcessedAt ?? new Date(),
                bankName: updatedPayout.BankName,
                bankAccountNumber: updatedPayout.AccountNumber,
            });
        }
        catch (error) {
            console.error("[payoutService] Failed to send payout rejection email:", error);
        }
    }
    return {
        success: true,
        payoutID,
        status: "rejected",
        rejectionReason: normalizedReason,
        refundedAmount: Number(payout.Amount ?? 0),
    };
}
/**
 * Lấy thống kê wallet
 */
async function getShopWalletStats(shopCode) {
    return await payout_model_1.default.getWalletStats(shopCode);
}
async function listWalletTransactions(shopCode, type, limit, offset) {
    return await payout_model_1.default.listWalletTransactions(shopCode, {
        type,
        limit,
        offset,
    });
}
async function countWalletTransactions(shopCode, type) {
    return await payout_model_1.default.countWalletTransactions(shopCode, type);
}
const payoutService = {
    createPayoutRequest,
    getPayoutByID,
    listPayoutsByShop,
    listAllPayouts,
    approvePayoutRequest,
    rejectPayoutRequest,
    getShopWalletStats,
    listWalletTransactions,
    countWalletTransactions,
};
exports.default = payoutService;
