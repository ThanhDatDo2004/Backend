import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import queryService from "../services/query";

// ============ TYPES ============
export type ShopDetailRow = {
  shop_code: number;
  user_id: number;
  shop_name: string;
  address: string | null;
  is_approved: string;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  approved_at: string | Date | null;
  bank_account_number: string;
  bank_name: string;
  wallet_balance?: number;
  field_count?: number;
  booking_count?: number;
};

// ============ SHOP MODEL ============
const shopModel = {
  /**
   * Get shop by user ID
   */
  async getByUserId(userId: number) {
    if (!Number.isFinite(userId)) return null;

    const rows = await queryService.execQueryList(
      `
        SELECT
          s.ShopCode AS shop_code,
          s.UserID AS user_id,
          s.ShopName AS shop_name,
          s.Address AS address,
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
      `,
      [userId]
    );

    return rows[0] || null;
  },

  /**
   * Get shop by shop code
   */
  async getByCode(shopCode: number) {
    if (!Number.isFinite(shopCode)) return null;

    const rows = await queryService.execQueryList(
      `
        SELECT
          s.ShopCode AS shop_code,
          s.UserID AS user_id,
          s.ShopName AS shop_name,
          s.Address AS address,
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
      `,
      [shopCode]
    );

    return rows[0] || null;
  },

  /**
   * Get shop code by user ID
   */
  async getShopCodeByUserId(userId: number): Promise<number | null> {
    const [shopRows] = await queryService.query<RowDataPacket[]>(
      `SELECT ShopCode FROM Shops WHERE UserID = ? LIMIT 1`,
      [userId]
    );

    return shopRows?.[0] ? Number((shopRows[0] as any).ShopCode ?? 0) : null;
  },

  /**
   * Create new shop
   */
  async createShop(
    connection: PoolConnection,
    userId: number,
    shopName: string,
    address: string
  ): Promise<number> {
    const [insertRes] = await connection.query<ResultSetHeader>(
      `
        INSERT INTO Shops (UserID, ShopName, Address, IsApproved, CreateAt, UpdateAt)
        VALUES (?, ?, ?, 'Y', NOW(), NOW())
      `,
      [userId, shopName.trim(), address.trim()]
    );

    return Number((insertRes as any)?.insertId ?? 0);
  },

  /**
   * Update shop details
   */
  async updateShop(
    connection: PoolConnection,
    shopCode: number,
    shopName: string,
    address: string
  ): Promise<void> {
    await connection.query(
      `
        UPDATE Shops
        SET ShopName = ?, Address = ?, UpdateAt = NOW()
        WHERE ShopCode = ?
      `,
      [shopName.trim(), address.trim(), shopCode]
    );
  },

  /**
   * Clear default bank accounts for shop
   */
  async clearDefaultBankAccounts(
    connection: PoolConnection,
    shopCode: number
  ): Promise<void> {
    await connection.query(
      `
        UPDATE Shop_Bank_Accounts
        SET IsDefault = 'N'
        WHERE ShopCode = ?
      `,
      [shopCode]
    );
  },

  /**
   * Create bank account for shop
   */
  async createBankAccount(
    connection: PoolConnection,
    shopCode: number,
    accountNumber: string,
    bankName: string,
    accountHolder: string,
    isDefault: string = "Y"
  ): Promise<number> {
    const [insertRes] = await connection.query<ResultSetHeader>(
      `
        INSERT INTO Shop_Bank_Accounts (ShopCode, AccountNumber, BankName, AccountHolder, IsDefault)
        VALUES (?, ?, ?, ?, ?)
      `,
      [shopCode, accountNumber, bankName, accountHolder, isDefault]
    );

    return Number((insertRes as any)?.insertId ?? 0);
  },
};

export default shopModel;
