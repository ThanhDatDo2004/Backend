import payoutModel from "../models/payout.model";
import walletModel from "../models/wallet.model";
import ApiError from "../utils/apiErrors";
import { StatusCodes } from "http-status-codes";
import authService from "./auth";
import { sendMail } from "./mail.service";
import shopService from "./shop.service";

export async function getApprovedShopByUserId(userId: number) {
  const shop = await shopService.ensureShopByUser(userId);
  const approved = String(shop?.is_approved ?? shop?.IsApproved ?? "").toUpperCase() === "Y";
  if (!approved) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Shop chưa được duyệt");
  }
  return Number(shop.shop_code ?? shop.ShopCode);
}

export async function getShopCodeByUserId(userId: number) {
  const shop = await shopService.ensureShopByUser(userId);
  return Number(shop.shop_code ?? shop.ShopCode);
}

/**
 * Tạo yêu cầu rút tiền
 */
export async function createPayoutRequest(
  shopCode: number,
  shopBankID: number,
  amount: number,
  note?: string,
  userId?: number,
  password?: string
) {
  // Kiểm tra shop tồn tại
  const shop = await payoutModel.getShop(shopCode);
  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop");
  }

  // Xác nhận mật khẩu nếu có userId
  if (userId && password) {
    const user = await payoutModel.getUser(userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy người dùng");
    }

    // Verify password using authService (same as login)
    const isPasswordValid = await authService.verifyPassword(
      password,
      user.PasswordHash
    );

    if (!isPasswordValid) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Mật khẩu không chính xác");
    }
  }

  // Kiểm tra bank account tồn tại
  const bankAccount = await payoutModel.getBankAccount(
    shopCode,
    shopBankID || undefined
  );

  if (!bankAccount) {
    // Debug: Check what accounts exist for this shop
    const allAccounts = await payoutModel.getAllBankAccounts(shopCode);
    console.log(
      `[Payout] All bank accounts for shopCode ${shopCode}:`,
      allAccounts
    );

    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "Không tìm thấy tài khoản ngân hàng. Vui lòng chọn hoặc thêm tài khoản."
    );
  }

  // Kiểm tra số dư
  const balance = await payoutModel.getWalletBalance(shopCode);
  if (balance < amount) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Số dư không đủ");
  }

  // Tạo payout request
  const payoutID = await payoutModel.createPayoutRequest(
    shopCode,
    shopBankID,
    amount,
    note
  );

  // ⭐ IMMEDIATELY DEDUCT FROM WALLET (Trừ ngay)
  await payoutModel.deductWallet(shopCode, amount);

  // Tạo wallet transaction
  await payoutModel.createWalletTransaction(
    shopCode,
    "debit_payout",
    amount,
    "Yêu cầu rút tiền",
    "pending",
    payoutID
  );

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

    await sendMail(
      "thuere2004@gmail.com",
      `[Yêu Cầu Rút Tiền] ${shop.ShopName} - ${amount.toLocaleString(
        "vi-VN"
      )}đ`,
      emailContent
    );
  } catch (e) {
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
export async function getPayoutByID(payoutID: number) {
  return await payoutModel.getPayoutByID(payoutID);
}

export async function getPayoutForOwner(userId: number, payoutID: number) {
  const shopCode = await getShopCodeByUserId(userId);
  const payout = await payoutModel.getPayoutByID(payoutID);

  if (!payout || payout.ShopCode !== shopCode) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Bạn không có quyền truy cập");
  }

  return payout;
}

export async function listPayoutsByShop(
  shopCode: number,
  status?: string,
  limit: number = 10,
  offset: number = 0
) {
  return payoutModel.listPayoutsByShop(shopCode, status, limit, offset);
}

export async function listPayoutsForOwner(
  userId: number,
  status: string | undefined,
  limit: number,
  offset: number
) {
  const shopCode = await getShopCodeByUserId(userId);
  return payoutModel.listPayoutsByShop(shopCode, status, limit, offset);
}

export async function listAllPayouts(
  status?: string,
  shopCode?: number,
  limit: number = 10,
  offset: number = 0
) {
  return payoutModel.listAllPayouts(status, shopCode, limit, offset);
}

/**
 * Duyệt rút tiền (admin)
 */
export async function approvePayoutRequest(payoutID: number, note?: string) {
  const payout = await payoutModel.getPayoutByID(payoutID);
  if (!payout) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payout request");
  }

  if (payout.Status !== "requested") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Chỉ có thể duyệt payout ở trạng thái 'requested'"
    );
  }

  // Cập nhật payout status
  await payoutModel.approvePayoutRequest(payoutID);

  // ⭐ UPDATE wallet transaction status from pending to completed
  // (Wallet đã bị trừ ngay khi tạo request)
  await payoutModel.completeWalletTransaction(payoutID);

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
export async function rejectPayoutRequest(payoutID: number, reason: string) {
  const payout = await payoutModel.getPayoutByID(payoutID);
  if (!payout) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payout request");
  }

  if (payout.Status !== "requested") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Chỉ có thể từ chối payout ở trạng thái 'requested'"
    );
  }

  // Cập nhật payout status
  await payoutModel.rejectPayoutRequest(payoutID, reason);

  return {
    success: true,
    payoutID,
    status: "rejected",
    rejectionReason: reason,
  };
}

/**
 * Lấy thống kê wallet
 */
export async function getShopWalletStats(shopCode: number) {
  return await payoutModel.getWalletStats(shopCode);
}

/**
 * Get shop code by user ID (already approved or not)
 */
/**
 * Get wallet transactions for a shop
 */
export async function getShopTransactions(
  shopCode: number,
  filters?: { type?: string; limit?: number; offset?: number }
) {
  const limit = Math.max(1, Math.min(filters?.limit || 10, 100));
  const offset = Math.max(0, filters?.offset || 0);

  let transactions;
  if (filters?.type) {
    transactions = await walletModel.listTransactionsByType(
      shopCode,
      filters.type,
      limit,
      offset
    );
  } else {
    transactions = await walletModel.listTransactions(shopCode, limit, offset);
  }

  const total = await walletModel.countTransactions(shopCode);

  return {
    data: transactions,
    pagination: {
      limit,
      offset,
      total,
    },
  };
}
const payoutService = {
  getApprovedShopByUserId,
  getShopCodeByUserId,
  createPayoutRequest,
  getPayoutByID,
  getPayoutForOwner,
  listPayoutsByShop,
  listPayoutsForOwner,
  listAllPayouts,
  approvePayoutRequest,
  rejectPayoutRequest,
  getShopWalletStats,
  getShopTransactions,
};

export default payoutService;

