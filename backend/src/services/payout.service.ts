import payoutModel from "../models/payout.model";
import ApiError from "../utils/apiErrors";
import { StatusCodes } from "http-status-codes";
import authService from "./auth";
import { sendMail, sendPayoutDecisionEmail } from "./mail.service";

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

/**
 * Liệt kê payout requests của shop
 */
export async function listPayoutsByShop(
  shopCode: number,
  status?: string,
  limit: number = 10,
  offset: number = 0
) {
  return await payoutModel.listPayoutsByShop(shopCode, status, limit, offset);
}

/**
 * Liệt kê tất cả payout requests (admin)
 */
export async function listAllPayouts(
  status?: string,
  shopCode?: number,
  limit: number = 10,
  offset: number = 0
) {
  return await payoutModel.listAllPayouts(status, shopCode, limit, offset);
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

  const updatedPayout = await payoutModel.getPayoutByID(payoutID);

  if (updatedPayout?.owner_email) {
    try {
      await sendPayoutDecisionEmail({
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
    } catch (error) {
      console.error(
        "[payoutService] Failed to send payout approval email:",
        error
      );
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

  const normalizedReason = (reason ?? "").toString().trim();

  // Cập nhật payout status
  await payoutModel.rejectPayoutRequest(
    payoutID,
    normalizedReason,
    Number(payout.ShopCode),
    Math.max(0, Number(payout.Amount ?? 0))
  );

  const updatedPayout = await payoutModel.getPayoutByID(payoutID);

  if (updatedPayout?.owner_email) {
    try {
      await sendPayoutDecisionEmail({
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
    } catch (error) {
      console.error(
        "[payoutService] Failed to send payout rejection email:",
        error
      );
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
export async function getShopWalletStats(shopCode: number) {
  return await payoutModel.getWalletStats(shopCode);
}

export async function listWalletTransactions(
  shopCode: number,
  type: string | undefined,
  limit: number,
  offset: number
) {
  return await payoutModel.listWalletTransactions(shopCode, {
    type,
    limit,
    offset,
  });
}

export async function countWalletTransactions(
  shopCode: number,
  type: string | undefined
) {
  return await payoutModel.countWalletTransactions(shopCode, type);
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

export default payoutService;
