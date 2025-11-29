"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const query_1 = __importDefault(require("../services/query"));
// ============ PAYOUT MODEL ============
const payoutModel = {
    /**
     * Get shop by code
     */
    async getShop(shopCode) {
        const [rows] = await query_1.default.query(`SELECT ShopCode, ShopName, UserID FROM Shops WHERE ShopCode = ?`, [shopCode]);
        return rows?.[0] || null;
    },
    /**
     * Get user by ID
     */
    async getUser(userId) {
        const [rows] = await query_1.default.query(`SELECT PasswordHash FROM Users WHERE UserID = ?`, [userId]);
        return rows?.[0] || null;
    },
    /**
     * Get bank account (default or specific)
     */
    async getBankAccount(shopCode, shopBankID) {
        let query;
        let params;
        if (!shopBankID) {
            query = `SELECT ShopBankID, BankName, AccountNumber, AccountHolder, IsDefault 
               FROM Shop_Bank_Accounts 
               WHERE ShopCode = ? AND (IsDefault = 'Y' OR IsDefault = 1)`;
            params = [shopCode];
        }
        else {
            query = `SELECT ShopBankID, BankName, AccountNumber, AccountNumber, AccountHolder, IsDefault 
               FROM Shop_Bank_Accounts 
               WHERE ShopBankID = ? AND ShopCode = ?`;
            params = [shopBankID, shopCode];
        }
        const [rows] = await query_1.default.query(query, params);
        return rows?.[0] || null;
    },
    /**
     * Get all bank accounts for shop (for debugging)
     */
    async getAllBankAccounts(shopCode) {
        const [rows] = await query_1.default.query(`SELECT ShopBankID, BankName, IsDefault, ShopCode FROM Shop_Bank_Accounts WHERE ShopCode = ?`, [shopCode]);
        return rows || [];
    },
    /**
     * Get wallet balance
     */
    async getWalletBalance(shopCode) {
        const [rows] = await query_1.default.query(`SELECT Balance FROM Shop_Wallets WHERE ShopCode = ?`, [shopCode]);
        return rows?.[0]?.Balance || 0;
    },
    /**
     * Create payout request
     */
    async createPayoutRequest(shopCode, shopBankID, amount, note) {
        const [result] = await query_1.default.query(`INSERT INTO Payout_Requests (
        ShopCode,
        ShopBankID,
        Amount,
        Status,
        Note,
        RequestedAt,
        CreateAt
      ) VALUES (?, ?, ?, 'requested', ?, NOW(), NOW())`, [shopCode, shopBankID, amount, note || null]);
        return Number(result.insertId);
    },
    /**
     * Deduct from wallet
     */
    async deductWallet(shopCode, amount) {
        await query_1.default.execQuery(`UPDATE Shop_Wallets
       SET Balance = Balance - ?,
           UpdateAt = NOW()
       WHERE ShopCode = ?`, [amount, shopCode]);
    },
    /**
     * Create wallet transaction
     */
    async createWalletTransaction(shopCode, type, amount, note, status, payoutID) {
        await query_1.default.execQuery(`INSERT INTO Wallet_Transactions (
        ShopCode,
        Type,
        Amount,
        Note,
        Status,
        PayoutID,
        CreateAt
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`, [shopCode, type, amount, note, status, payoutID]);
    },
    /**
     * Get payout by ID
     */
    async getPayoutByID(payoutID) {
        const [rows] = await query_1.default.query(`SELECT pr.*,
              s.ShopName,
              sba.BankName,
              sba.AccountNumber,
              sba.AccountHolder,
              sba.IsDefault,
              u.Email AS owner_email,
              u.FullName AS owner_full_name
       FROM Payout_Requests pr
       JOIN Shops s ON pr.ShopCode = s.ShopCode
       JOIN Users u ON s.UserID = u.UserID
       JOIN Shop_Bank_Accounts sba ON pr.ShopBankID = sba.ShopBankID
       WHERE pr.PayoutID = ?`, [payoutID]);
        return rows?.[0] || null;
    },
    /**
     * List payouts by shop
     */
    async listPayoutsByShop(shopCode, status, limit = 10, offset = 0) {
        let query = `SELECT pr.*, s.ShopName, sba.BankName, sba.AccountNumber
                 FROM Payout_Requests pr
                 JOIN Shops s ON pr.ShopCode = s.ShopCode
                 JOIN Shop_Bank_Accounts sba ON pr.ShopBankID = sba.ShopBankID
                 WHERE pr.ShopCode = ?`;
        const params = [shopCode];
        if (status) {
            query += ` AND pr.Status = ?`;
            params.push(status);
        }
        query += ` ORDER BY pr.RequestedAt DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        const [rows] = await query_1.default.query(query, params);
        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM Payout_Requests WHERE ShopCode = ?`;
        const countParams = [shopCode];
        if (status) {
            countQuery += ` AND Status = ?`;
            countParams.push(status);
        }
        const [countRows] = await query_1.default.query(countQuery, countParams);
        const total = countRows?.[0]?.total || 0;
        return { data: rows, total };
    },
    /**
     * List all payouts (admin)
     */
    async listAllPayouts(status, shopCode, limit = 10, offset = 0) {
        let query = `SELECT pr.*, s.ShopName, s.UserID, u.FullName, sba.BankName, sba.AccountNumber, sba.AccountHolder, sba.IsDefault
                 FROM Payout_Requests pr
                 JOIN Shops s ON pr.ShopCode = s.ShopCode
                 JOIN Users u ON s.UserID = u.UserID
                 JOIN Shop_Bank_Accounts sba ON pr.ShopBankID = sba.ShopBankID
                 WHERE 1=1`;
        const params = [];
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
        const [rows] = await query_1.default.query(query, params);
        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM Payout_Requests WHERE 1=1`;
        const countParams = [];
        if (status) {
            countQuery += ` AND Status = ?`;
            countParams.push(status);
        }
        if (shopCode) {
            countQuery += ` AND ShopCode = ?`;
            countParams.push(shopCode);
        }
        const [countRows] = await query_1.default.query(countQuery, countParams);
        const total = countRows?.[0]?.total || 0;
        return { data: rows, total };
    },
    /**
     * Update payout status to paid
     */
    async approvePayoutRequest(payoutID) {
        await query_1.default.execQuery(`UPDATE Payout_Requests
       SET Status = 'paid',
           ProcessedAt = NOW(),
           TransactionCode = CONCAT('PAYOUT-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(?, 6, '0')),
           UpdateAt = NOW()
       WHERE PayoutID = ?`, [payoutID, payoutID]);
    },
    /**
     * Update wallet transaction status
     */
    async completeWalletTransaction(payoutID) {
        await query_1.default.execQuery(`UPDATE Wallet_Transactions
       SET Status = 'completed'
      WHERE PayoutID = ? AND Type = 'debit_payout'`, [payoutID]);
    },
    /**
     * Reject payout request
     */
    async rejectPayoutRequest(payoutID, reason, shopCode, amount) {
        const normalizedReason = reason?.trim() ?? "";
        const refundNoteBase = `Hoàn tiền do từ chối yêu cầu rút #${payoutID}`;
        const refundNote = normalizedReason
            ? `${refundNoteBase}: ${normalizedReason}`.slice(0, 250)
            : refundNoteBase;
        await query_1.default.execTransaction("payout_reject_with_refund", async (connection) => {
            await connection.query(`UPDATE Payout_Requests
           SET Status = 'rejected',
               RejectionReason = ?,
               ProcessedAt = NOW(),
               UpdateAt = NOW()
           WHERE PayoutID = ?`, [normalizedReason || null, payoutID]);
            await connection.query(`UPDATE Shop_Wallets
             SET Balance = Balance + ?,
                 UpdateAt = NOW()
           WHERE ShopCode = ?`, [amount, shopCode]);
            await connection.query(`UPDATE Wallet_Transactions
             SET Status = 'failed',
                 Note = CASE
                          WHEN ? = '' THEN Note
                          WHEN Note IS NULL OR Note = '' THEN ?
                          ELSE CONCAT(Note, ' | Lý do từ chối: ', ?)
                        END
           WHERE PayoutID = ? AND Type = 'debit_payout'`, [normalizedReason, normalizedReason, normalizedReason, payoutID]);
            await connection.query(`INSERT INTO Wallet_Transactions (
             ShopCode,
             Type,
             Amount,
             Note,
             Status,
             PayoutID,
             CreateAt
           ) VALUES (?, 'adjustment', ?, ?, 'completed', ?, NOW())`, [shopCode, amount, refundNote, payoutID]);
        });
    },
    /**
     * Get wallet stats
     */
    async getWalletStats(shopCode) {
        const [walletRows] = await query_1.default.query(`SELECT Balance FROM Shop_Wallets WHERE ShopCode = ?`, [shopCode]);
        const balance = walletRows?.[0]?.Balance || 0;
        // Get total credited
        const [creditRows] = await query_1.default.query(`SELECT SUM(Amount) as total FROM Wallet_Transactions
       WHERE ShopCode = ? AND Type = 'credit_settlement' AND Status = 'completed'`, [shopCode]);
        const totalCredit = creditRows?.[0]?.total || 0;
        // Get total debited
        const [debitRows] = await query_1.default.query(`SELECT SUM(Amount) as total FROM Wallet_Transactions
       WHERE ShopCode = ? AND Type = 'debit_payout' AND Status = 'completed'`, [shopCode]);
        const totalDebit = debitRows?.[0]?.total || 0;
        return { balance, totalCredit, totalDebit, available: balance };
    },
    async listWalletTransactions(shopCode, options) {
        let query = `SELECT wt.*, b.BookingCode, pr.PayoutID
                 FROM Wallet_Transactions wt
                 LEFT JOIN Bookings b ON wt.BookingCode = b.BookingCode
                 LEFT JOIN Payout_Requests pr ON wt.PayoutID = pr.PayoutID
                 WHERE wt.ShopCode = ?`;
        const params = [shopCode];
        if (options.type) {
            query += ` AND wt.Type = ?`;
            params.push(options.type);
        }
        query += ` ORDER BY wt.CreateAt DESC LIMIT ? OFFSET ?`;
        params.push(options.limit, options.offset);
        const [rows] = await query_1.default.query(query, params);
        return rows || [];
    },
    async countWalletTransactions(shopCode, type) {
        let query = `SELECT COUNT(*) as total FROM Wallet_Transactions WHERE ShopCode = ?`;
        const params = [shopCode];
        if (type) {
            query += ` AND Type = ?`;
            params.push(type);
        }
        const [rows] = await query_1.default.query(query, params);
        return Number(rows?.[0]?.total ?? 0);
    },
};
exports.default = payoutModel;
