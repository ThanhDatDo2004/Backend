import { RowDataPacket, ResultSetHeader } from "mysql2";
import queryService from "./query";
import ApiError from "../utils/apiErrors";
import { StatusCodes } from "http-status-codes";
import authService from "./auth";
import mailService from "./mail.service";

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
  const [shopRows] = await queryService.query<RowDataPacket[]>(
    `SELECT ShopCode, ShopName, UserID FROM Shops WHERE ShopCode = ?`,
    [shopCode]
  );
  if (!shopRows?.[0]) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop");
  }

  const shop = shopRows[0];

  // Xác nhận mật khẩu nếu có userId
  if (userId && password) {
    const [userRows] = await queryService.query<RowDataPacket[]>(
      `SELECT PasswordHash FROM Users WHERE UserID = ?`,
      [userId]
    );

    if (!userRows?.[0]) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy người dùng");
    }

    const user = userRows[0];

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
  // Nếu bank_id = 0, lấy tài khoản default
  let bankQuery: string;
  let bankParams: any[];

  if (shopBankID === 0 || !shopBankID) {
    // Lấy tài khoản ngân hàng mặc định
    bankQuery = `SELECT ShopBankID, BankName, AccountNumber, AccountHolder, IsDefault 
                 FROM Shop_Bank_Accounts 
                 WHERE ShopCode = ? AND (IsDefault = 'Y' OR IsDefault = 1)`;
    bankParams = [shopCode];
    console.log(`[Payout] Looking for DEFAULT account - shopCode: ${shopCode}`);
  } else {
    // Lấy tài khoản ngân hàng cụ thể
    bankQuery = `SELECT ShopBankID, BankName, AccountNumber, AccountHolder, IsDefault 
                 FROM Shop_Bank_Accounts 
                 WHERE ShopBankID = ? AND ShopCode = ?`;
    bankParams = [shopBankID, shopCode];
    console.log(`[Payout] Looking for SPECIFIC account - bank_id: ${shopBankID}, shopCode: ${shopCode}`);
  }

  const [bankRows] = await queryService.query<RowDataPacket[]>(
    bankQuery,
    bankParams
  );
  
  console.log(`[Payout] Bank query result:`, {
    query: bankQuery.substring(0, 50) + '...',
    params: bankParams,
    rowCount: bankRows?.length || 0,
    data: bankRows?.[0] || null
  });

  if (!bankRows?.[0]) {
    // Debug: Check what accounts exist for this shop
    const [allAccounts] = await queryService.query<RowDataPacket[]>(
      `SELECT ShopBankID, BankName, IsDefault, ShopCode FROM Shop_Bank_Accounts WHERE ShopCode = ?`,
      [shopCode]
    );
    console.log(`[Payout] All bank accounts for shopCode ${shopCode}:`, allAccounts);
    
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "Không tìm thấy tài khoản ngân hàng. Vui lòng chọn hoặc thêm tài khoản."
    );
  }

  const bankAccount = bankRows[0];

  // Kiểm tra số dư
  const [walletRows] = await queryService.query<RowDataPacket[]>(
    `SELECT Balance FROM Shop_Wallets WHERE ShopCode = ?`,
    [shopCode]
  );

  const balance = walletRows?.[0]?.Balance || 0;
  if (balance < amount) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Số dư không đủ");
  }

  // Tạo payout request
  const [result] = await queryService.query<ResultSetHeader>(
    `INSERT INTO Payout_Requests (
      ShopCode,
      ShopBankID,
      Amount,
      Status,
      Note,
      RequestedAt,
      CreateAt
    ) VALUES (?, ?, ?, 'requested', ?, NOW(), NOW())`,
    [shopCode, shopBankID, amount, note || null]
  );

  const payoutID = result.insertId;

  // ⭐ IMMEDIATELY DEDUCT FROM WALLET (Trừ ngay)
  await queryService.query<ResultSetHeader>(
    `UPDATE Shop_Wallets
     SET Balance = Balance - ?,
         UpdateAt = NOW()
     WHERE ShopCode = ?`,
    [amount, shopCode]
  );

  // Tạo wallet transaction
  await queryService.query<ResultSetHeader>(
    `INSERT INTO Wallet_Transactions (
      ShopCode,
      Type,
      Amount,
      Note,
      Status,
      PayoutID,
      CreateAt
    ) VALUES (?, 'debit_payout', ?, 'Yêu cầu rút tiền', 'pending', ?, NOW())`,
    [shopCode, amount, payoutID]
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

    await mailService.sendMail(
      "kubjmisu1999@gmail.com",
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
  const [rows] = await queryService.query<RowDataPacket[]>(
    `SELECT pr.*, s.ShopName, sba.BankName, sba.AccountNumber, sba.AccountHolder, sba.IsDefault
     FROM Payout_Requests pr
     JOIN Shops s ON pr.ShopCode = s.ShopCode
     JOIN Shop_Bank_Accounts sba ON pr.ShopBankID = sba.ShopBankID
     WHERE pr.PayoutID = ?`,
    [payoutID]
  );
  return rows?.[0] || null;
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
  let query = `SELECT pr.*, s.ShopName, sba.BankName, sba.AccountNumber
               FROM Payout_Requests pr
               JOIN Shops s ON pr.ShopCode = s.ShopCode
               JOIN Shop_Bank_Accounts sba ON pr.ShopBankID = sba.ShopBankID
               WHERE pr.ShopCode = ?`;
  const params: any[] = [shopCode];

  if (status) {
    query += ` AND pr.Status = ?`;
    params.push(status);
  }

  query += ` ORDER BY pr.RequestedAt DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const [rows] = await queryService.query<RowDataPacket[]>(query, params);

  // Get total count
  let countQuery = `SELECT COUNT(*) as total FROM Payout_Requests WHERE ShopCode = ?`;
  const countParams: any[] = [shopCode];
  if (status) {
    countQuery += ` AND Status = ?`;
    countParams.push(status);
  }
  const [countRows] = await queryService.query<RowDataPacket[]>(
    countQuery,
    countParams
  );
  const total = countRows?.[0]?.total || 0;

  return {
    data: rows,
    pagination: { limit, offset, total },
  };
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
  let query = `SELECT pr.*, s.ShopName, s.UserID, u.FullName, sba.BankName, sba.AccountNumber, sba.AccountHolder, sba.IsDefault
               FROM Payout_Requests pr
               JOIN Shops s ON pr.ShopCode = s.ShopCode
               JOIN Users u ON s.UserID = u.UserID
               JOIN Shop_Bank_Accounts sba ON pr.ShopBankID = sba.ShopBankID
               WHERE 1=1`;
  const params: any[] = [];

  if (status) {
    query += ` AND pr.Status = ?`;
    params.push(status);
  }

  if (shopCode) {
    query += ` AND pr.ShopCode = ?`;
    params.push(shopCode);
  }

  query += ` ORDER BY pr.RequestedAt DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const [rows] = await queryService.query<RowDataPacket[]>(query, params);

  // Get total count
  let countQuery = `SELECT COUNT(*) as total FROM Payout_Requests WHERE 1=1`;
  const countParams: any[] = [];
  if (status) {
    countQuery += ` AND Status = ?`;
    countParams.push(status);
  }
  if (shopCode) {
    countQuery += ` AND ShopCode = ?`;
    countParams.push(shopCode);
  }
  const [countRows] = await queryService.query<RowDataPacket[]>(
    countQuery,
    countParams
  );
  const total = countRows?.[0]?.total || 0;

  return {
    data: rows,
    pagination: { limit, offset, total },
  };
}

/**
 * Duyệt rút tiền (admin)
 */
export async function approvePayoutRequest(payoutID: number, note?: string) {
  const payout = await getPayoutByID(payoutID);
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
  const [result] = await queryService.query<ResultSetHeader>(
    `UPDATE Payout_Requests
     SET Status = 'paid',
         ProcessedAt = NOW(),
         TransactionCode = CONCAT('PAYOUT-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(?, 6, '0')),
         UpdateAt = NOW()
     WHERE PayoutID = ?`,
    [payoutID, payoutID]
  );

  // ⭐ UPDATE wallet transaction status from pending to completed
  // (Wallet đã bị trừ ngay khi tạo request)
  await queryService.query<ResultSetHeader>(
    `UPDATE Wallet_Transactions
     SET Status = 'completed',
         UpdateAt = NOW()
     WHERE PayoutID = ? AND Type = 'debit_payout'`,
    [payoutID]
  );

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
  const payout = await getPayoutByID(payoutID);
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
  await queryService.query<ResultSetHeader>(
    `UPDATE Payout_Requests
     SET Status = 'rejected',
         RejectionReason = ?,
         ProcessedAt = NOW(),
         UpdateAt = NOW()
     WHERE PayoutID = ?`,
    [reason, payoutID]
  );

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
  const [walletRows] = await queryService.query<RowDataPacket[]>(
    `SELECT Balance FROM Shop_Wallets WHERE ShopCode = ?`,
    [shopCode]
  );

  const balance = walletRows?.[0]?.Balance || 0;

  // Get total credited
  const [creditRows] = await queryService.query<RowDataPacket[]>(
    `SELECT SUM(Amount) as total FROM Wallet_Transactions
     WHERE ShopCode = ? AND Type = 'credit_settlement' AND Status = 'completed'`,
    [shopCode]
  );

  const totalCredit = creditRows?.[0]?.total || 0;

  // Get total debited
  const [debitRows] = await queryService.query<RowDataPacket[]>(
    `SELECT SUM(Amount) as total FROM Wallet_Transactions
     WHERE ShopCode = ? AND Type = 'debit_payout' AND Status = 'completed'`,
    [shopCode]
  );

  const totalDebit = debitRows?.[0]?.total || 0;

  return {
    balance,
    totalCredit,
    totalDebit,
    available: balance,
  };
}

const payoutService = {
  createPayoutRequest,
  getPayoutByID,
  listPayoutsByShop,
  listAllPayouts,
  approvePayoutRequest,
  rejectPayoutRequest,
  getShopWalletStats,
};

export default payoutService;
