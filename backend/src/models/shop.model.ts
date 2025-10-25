import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import queryService from "../core/database";
import { SHOP_QUERIES } from "../queries/shop.queries";

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

    const rows = await queryService.execQueryList(SHOP_QUERIES.GET_BY_USER_ID, [
      userId,
    ]);

    return rows[0] || null;
  },

  /**
   * Get shop by shop code
   */
  async getByCode(shopCode: number) {
    if (!Number.isFinite(shopCode)) return null;

    const rows = await queryService.execQueryList(SHOP_QUERIES.GET_BY_CODE, [
      shopCode,
    ]);

    return rows[0] || null;
  },

  /**
   * Get shop code by user ID
   */
  async getShopCodeByUserId(userId: number): Promise<number | null> {
    const [shopRows] = await queryService.query<RowDataPacket[]>(
      SHOP_QUERIES.GET_SHOP_CODE_BY_USER_ID,
      [userId]
    );

    return shopRows?.[0] ? Number((shopRows[0] as any).ShopCode ?? 0) : null;
  },

  async getShopSummaryByCode(
    shopCode: number
  ): Promise<{ ShopCode: number; UserID: number } | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      SHOP_QUERIES.GET_SHOP_SUMMARY_BY_CODE,
      [shopCode]
    );
    return (rows?.[0] as { ShopCode: number; UserID: number }) || null;
  },

  async listBankAccounts(shopCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      SHOP_QUERIES.LIST_BANK_ACCOUNTS_BY_SHOP,
      [shopCode]
    );
    return rows || [];
  },

  async createShop(
    connection: PoolConnection,
    userId: number,
    shopName: string,
    address: string
  ): Promise<number> {
    const [insertRes] = await connection.query<ResultSetHeader>(
      SHOP_QUERIES.CREATE_SHOP,
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
    await connection.query(SHOP_QUERIES.UPDATE_SHOP, [
      shopName.trim(),
      address.trim(),
      shopCode,
    ]);
  },

  /**
   * Clear default bank accounts for shop
   */
  async clearDefaultBankAccounts(
    connection: PoolConnection,
    shopCode: number
  ): Promise<void> {
    await connection.query(SHOP_QUERIES.CLEAR_DEFAULT_BANK_ACCOUNTS, [
      shopCode,
    ]);
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
      SHOP_QUERIES.CREATE_BANK_ACCOUNT,
      [shopCode, accountNumber, bankName, accountHolder, isDefault]
    );

    return Number((insertRes as any)?.insertId ?? 0);
  },

  async withTransaction<T>(
    label: string,
    handler: (connection: PoolConnection) => Promise<T>
  ): Promise<T> {
    return queryService.execTransaction(label, handler);
  },
};

export default shopModel;
