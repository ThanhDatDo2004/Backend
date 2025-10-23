import type { ResultSetHeader, RowDataPacket } from "mysql2";
import queryService from "../services/query";

// ============ TYPES ============
export type ShopRow = {
  ShopCode: number;
  ShopName: string;
  UserID: number;
};

export type UserRow = {
  PasswordHash: string;
};

export type BankAccountRow = {
  ShopBankID: number;
  BankName: string;
  AccountNumber: string;
  AccountHolder: string;
  IsDefault: string | number;
};

export type WalletRow = {
  Balance: number;
};

export type PayoutRequestRow = any;

// ============ PAYOUT MODEL ============
const payoutModel = {
  /**
   * Get shop by code
   */
  async getShop(shopCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT ShopCode, ShopName, UserID FROM Shops WHERE ShopCode = ?`,
      [shopCode]
    );
    return rows?.[0] || null;
  },

  /**
   * Get user by ID
   */
  async getUser(userId: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT PasswordHash FROM Users WHERE UserID = ?`,
      [userId]
    );
    return rows?.[0] || null;
  },

  /**
   * Get bank account (default or specific)
   */
  async getBankAccount(shopCode: number, shopBankID?: number) {
    let query: string;
    let params: any[];

    if (!shopBankID) {
      query = `SELECT ShopBankID, BankName, AccountNumber, AccountHolder, IsDefault 
               FROM Shop_Bank_Accounts 
               WHERE ShopCode = ? AND (IsDefault = 'Y' OR IsDefault = 1)`;
      params = [shopCode];
    } else {
      query = `SELECT ShopBankID, BankName, AccountNumber, AccountNumber, AccountHolder, IsDefault 
               FROM Shop_Bank_Accounts 
               WHERE ShopBankID = ? AND ShopCode = ?`;
      params = [shopBankID, shopCode];
    }

    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return rows?.[0] || null;
  },

  /**
   * Get all bank accounts for shop (for debugging)
   */
  async getAllBankAccounts(shopCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT ShopBankID, BankName, IsDefault, ShopCode FROM Shop_Bank_Accounts WHERE ShopCode = ?`,
      [shopCode]
    );
    return rows || [];
  },

  /**
   * Get wallet balance
   */
  async getWalletBalance(shopCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT Balance FROM Shop_Wallets WHERE ShopCode = ?`,
      [shopCode]
    );
    return rows?.[0]?.Balance || 0;
  },

  /**
   * Create payout request
   */
  async createPayoutRequest(
    shopCode: number,
    shopBankID: number,
    amount: number,
    note?: string
  ): Promise<number> {
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

    return Number(result.insertId);
  },

  /**
   * Deduct from wallet
   */
  async deductWallet(shopCode: number, amount: number): Promise<void> {
    await queryService.execQuery(
      `UPDATE Shop_Wallets
       SET Balance = Balance - ?,
           UpdateAt = NOW()
       WHERE ShopCode = ?`,
      [amount, shopCode]
    );
  },

  /**
   * Create wallet transaction
   */
  async createWalletTransaction(
    shopCode: number,
    type: string,
    amount: number,
    note: string,
    status: string,
    payoutID: number
  ): Promise<void> {
    await queryService.execQuery(
      `INSERT INTO Wallet_Transactions (
        ShopCode,
        Type,
        Amount,
        Note,
        Status,
        PayoutID,
        CreateAt
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [shopCode, type, amount, note, status, payoutID]
    );
  },

  /**
   * Get payout by ID
   */
  async getPayoutByID(payoutID: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT pr.*, s.ShopName, sba.BankName, sba.AccountNumber, sba.AccountHolder, sba.IsDefault
       FROM Payout_Requests pr
       JOIN Shops s ON pr.ShopCode = s.ShopCode
       JOIN Shop_Bank_Accounts sba ON pr.ShopBankID = sba.ShopBankID
       WHERE pr.PayoutID = ?`,
      [payoutID]
    );
    return rows?.[0] || null;
  },

  /**
   * List payouts by shop
   */
  async listPayoutsByShop(
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

    return { data: rows, total };
  },

  /**
   * List all payouts (admin)
   */
  async listAllPayouts(
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

    return { data: rows, total };
  },

  /**
   * Update payout status to paid
   */
  async approvePayoutRequest(payoutID: number): Promise<void> {
    await queryService.execQuery(
      `UPDATE Payout_Requests
       SET Status = 'paid',
           ProcessedAt = NOW(),
           TransactionCode = CONCAT('PAYOUT-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(?, 6, '0')),
           UpdateAt = NOW()
       WHERE PayoutID = ?`,
      [payoutID, payoutID]
    );
  },

  /**
   * Update wallet transaction status
   */
  async completeWalletTransaction(payoutID: number): Promise<void> {
    await queryService.execQuery(
      `UPDATE Wallet_Transactions
       SET Status = 'completed'
      WHERE PayoutID = ? AND Type = 'debit_payout'`,
      [payoutID]
    );
  },

  /**
   * Reject payout request
   */
  async rejectPayoutRequest(payoutID: number, reason: string): Promise<void> {
    await queryService.execQuery(
      `UPDATE Payout_Requests
       SET Status = 'rejected',
           RejectionReason = ?,
           ProcessedAt = NOW(),
           UpdateAt = NOW()
       WHERE PayoutID = ?`,
      [reason, payoutID]
    );
  },

  /**
   * Get wallet stats
   */
  async getWalletStats(shopCode: number) {
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

    return { balance, totalCredit, totalDebit, available: balance };
  },
};

export default payoutModel;
