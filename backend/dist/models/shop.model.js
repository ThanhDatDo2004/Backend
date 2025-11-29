"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const query_1 = __importDefault(require("../services/query"));
// ============ SHOP MODEL ============
const shopModel = {
    /**
     * Get shop by user ID
     */
    async getByUserId(userId) {
        if (!Number.isFinite(userId))
            return null;
        const rows = await query_1.default.execQueryList(`
        SELECT
          s.ShopCode AS shop_code,
          s.UserID AS user_id,
          s.ShopName AS shop_name,
          s.Address AS address,
          s.PhoneNumber AS phone_number,
          DATE_FORMAT(s.OpeningTime, '%H:%i') AS opening_time,
          DATE_FORMAT(s.ClosingTime, '%H:%i') AS closing_time,
          CASE WHEN s.IsOpen24Hours = 'Y' THEN 1 ELSE 0 END AS is_open_24h,
          s.IsApproved AS is_approved,
          s.CreateAt AS created_at,
          s.UpdateAt AS updated_at,
          s.ApprovedAt AS approved_at,
          COALESCE(sb.AccountNumber, '') AS bank_account_number,
          COALESCE(sb.BankName, '') AS bank_name,
          COALESCE(sw.Balance, 0) AS wallet_balance,
          (SELECT COUNT(*) FROM Fields WHERE ShopCode = s.ShopCode) AS field_count,
          (SELECT COUNT(*) FROM Bookings b JOIN Fields f ON b.FieldCode = f.FieldCode WHERE f.ShopCode = s.ShopCode) AS booking_count
        FROM Shops s
        LEFT JOIN Shop_Bank_Accounts sb
          ON sb.ShopCode = s.ShopCode
         AND (sb.IsDefault = 'Y' OR sb.IsDefault IS NULL)
        LEFT JOIN Shop_Wallets sw ON sw.ShopCode = s.ShopCode
        WHERE s.UserID = ?
        ORDER BY s.ShopCode ASC
        LIMIT 1
      `, [userId]);
        return rows[0] || null;
    },
    /**
     * Get shop by shop code
     */
    async getByCode(shopCode) {
        if (!Number.isFinite(shopCode))
            return null;
        const rows = await query_1.default.execQueryList(`
        SELECT
          s.ShopCode AS shop_code,
          s.UserID AS user_id,
          s.ShopName AS shop_name,
          s.Address AS address,
          s.PhoneNumber AS phone_number,
          DATE_FORMAT(s.OpeningTime, '%H:%i') AS opening_time,
          DATE_FORMAT(s.ClosingTime, '%H:%i') AS closing_time,
          CASE WHEN s.IsOpen24Hours = 'Y' THEN 1 ELSE 0 END AS is_open_24h,
          s.IsApproved AS is_approved,
          s.CreateAt AS created_at,
          s.UpdateAt AS updated_at,
          s.ApprovedAt AS approved_at,
          COALESCE(sb.AccountNumber, '') AS bank_account_number,
          COALESCE(sb.BankName, '') AS bank_name
        FROM Shops s
        LEFT JOIN Shop_Bank_Accounts sb
          ON sb.ShopCode = s.ShopCode
         AND (sb.IsDefault = 'Y' OR sb.IsDefault IS NULL)
        WHERE s.ShopCode = ?
        LIMIT 1
      `, [shopCode]);
        return rows[0] || null;
    },
    /**
     * Get shop code by user ID
     */
    async getShopCodeByUserId(userId) {
        const [shopRows] = await query_1.default.query(`SELECT ShopCode FROM Shops WHERE UserID = ? LIMIT 1`, [userId]);
        return shopRows?.[0] ? Number(shopRows[0].ShopCode ?? 0) : null;
    },
    async listBankAccounts(shopCode) {
        const [rows] = await query_1.default.query(`SELECT ShopBankID, ShopCode, BankName, AccountNumber, AccountHolder, IsDefault,
              CreateAt, UpdateAt
       FROM Shop_Bank_Accounts
       WHERE ShopCode = ?
       ORDER BY CreateAt DESC`, [shopCode]);
        return rows || [];
    },
    /**
     * Create new shop
     */
    async createShop(connection, userId, shopName, address, phoneNumber, openingTime, closingTime, isOpen24Hours) {
        const sanitizedOpening = isOpen24Hours ? null : openingTime;
        const sanitizedClosing = isOpen24Hours ? null : closingTime;
        const [insertRes] = await connection.query(`
        INSERT INTO Shops (
          UserID,
          ShopName,
          Address,
          PhoneNumber,
          OpeningTime,
          ClosingTime,
          IsOpen24Hours,
          IsApproved,
          CreateAt,
          UpdateAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Y', NOW(), NOW())
      `, [
            userId,
            shopName.trim(),
            address.trim(),
            phoneNumber,
            sanitizedOpening,
            sanitizedClosing,
            isOpen24Hours ? "Y" : "N",
        ]);
        return Number(insertRes?.insertId ?? 0);
    },
    /**
     * Update shop details
     */
    async updateShop(connection, shopCode, shopName, address, phoneNumber, openingTime, closingTime, isOpen24Hours) {
        const sanitizedOpening = isOpen24Hours ? null : openingTime;
        const sanitizedClosing = isOpen24Hours ? null : closingTime;
        await connection.query(`
        UPDATE Shops
        SET ShopName = ?,
            Address = ?,
            PhoneNumber = ?,
            OpeningTime = ?,
            ClosingTime = ?,
            IsOpen24Hours = ?,
            UpdateAt = NOW()
        WHERE ShopCode = ?
      `, [
            shopName.trim(),
            address.trim(),
            phoneNumber,
            sanitizedOpening,
            sanitizedClosing,
            isOpen24Hours ? "Y" : "N",
            shopCode,
        ]);
    },
    /**
     * Clear default bank accounts for shop
     */
    async clearDefaultBankAccounts(connection, shopCode) {
        await connection.query(`
        UPDATE Shop_Bank_Accounts
        SET IsDefault = 'N'
        WHERE ShopCode = ?
      `, [shopCode]);
    },
    /**
     * Create bank account for shop
     */
    async createBankAccount(connection, shopCode, accountNumber, bankName, accountHolder, isDefault = "Y") {
        const [insertRes] = await connection.query(`
        INSERT INTO Shop_Bank_Accounts (ShopCode, AccountNumber, BankName, AccountHolder, IsDefault)
        VALUES (?, ?, ?, ?, ?)
      `, [shopCode, accountNumber, bankName, accountHolder, isDefault]);
        return Number(insertRes?.insertId ?? 0);
    },
};
exports.default = shopModel;
