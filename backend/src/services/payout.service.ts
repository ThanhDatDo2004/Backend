import { RowDataPacket, ResultSetHeader } from "mysql2";
import queryService from "./query";
import ApiError from "../utils/apiErrors";
import { StatusCodes } from "http-status-codes";

/**
 * Tạo yêu cầu rút tiền
 */
export async function createPayoutRequest(
  shopCode: number,
  shopBankID: number,
  amount: number,
  note?: string
) {
  // Kiểm tra shop tồn tại
  const [shopRows] = await queryService.query<RowDataPacket[]>(
    `SELECT ShopCode FROM Shops WHERE ShopCode = ?`,
    [shopCode]
  );
  if (!shopRows?.[0]) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop");
  }

  // Kiểm tra bank account tồn tại
  const [bankRows] = await queryService.query<RowDataPacket[]>(
    `SELECT ShopBankID FROM Shop_Bank_Accounts WHERE ShopBankID = ? AND ShopCode = ?`,
    [shopBankID, shopCode]
  );
  if (!bankRows?.[0]) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy tài khoản ngân hàng");
  }

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

  return {
    payoutID: result.insertId,
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
    `SELECT pr.*, s.ShopName, sba.BankName, sba.AccountNumber, sba.AccountHolder
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
  const [countRows] = await queryService.query<RowDataPacket[]>(countQuery, countParams);
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
  let query = `SELECT pr.*, s.ShopName, s.UserID, u.FullName, sba.BankName, sba.AccountNumber
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
  const [countRows] = await queryService.query<RowDataPacket[]>(countQuery, countParams);
  const total = countRows?.[0]?.total || 0;

  return {
    data: rows,
    pagination: { limit, offset, total },
  };
}

/**
 * Duyệt rút tiền (admin)
 */
export async function approvePayoutRequest(
  payoutID: number,
  note?: string
) {
  const payout = await getPayoutByID(payoutID);
  if (!payout) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payout request");
  }

  if (payout.Status !== "requested") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Chỉ có thể duyệt payout ở trạng thái 'requested'");
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

  // Trừ tiền từ wallet
  await queryService.query<ResultSetHeader>(
    `UPDATE Shop_Wallets
     SET Balance = Balance - ?,
         UpdateAt = NOW()
     WHERE ShopCode = ?`,
    [payout.Amount, payout.ShopCode]
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
    ) VALUES (?, 'debit_payout', ?, 'Payout approved', 'completed', ?, NOW())`,
    [payout.ShopCode, payout.Amount, payoutID]
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
export async function rejectPayoutRequest(
  payoutID: number,
  reason: string
) {
  const payout = await getPayoutByID(payoutID);
  if (!payout) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payout request");
  }

  if (payout.Status !== "requested") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Chỉ có thể từ chối payout ở trạng thái 'requested'");
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
