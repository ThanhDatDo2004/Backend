import type { ResultSetHeader, RowDataPacket } from "mysql2";
import queryService from "../core/database";
import { PAYOUT_QUERIES } from "../queries/payout.queries";

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
      PAYOUT_QUERIES.GET_SHOP,
      [shopCode]
    );
    return rows?.[0] || null;
  },

  /**
   * Get user by ID
   */
  async getUser(userId: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      PAYOUT_QUERIES.GET_USER,
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
      query = PAYOUT_QUERIES.GET_DEFAULT_BANK_ACCOUNT;
      params = [shopCode];
    } else {
      query = PAYOUT_QUERIES.GET_BANK_ACCOUNT_BY_ID;
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
      PAYOUT_QUERIES.GET_ALL_BANK_ACCOUNTS,
      [shopCode]
    );
    return rows || [];
  },

  /**
   * Get wallet balance
   */
  async getWalletBalance(shopCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      PAYOUT_QUERIES.GET_WALLET_BALANCE,
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
      PAYOUT_QUERIES.CREATE_PAYOUT_REQUEST,
      [shopCode, shopBankID, amount, note || null]
    );

    return Number(result.insertId);
  },

  /**
   * Deduct from wallet
   */
  async deductWallet(shopCode: number, amount: number): Promise<void> {
    await queryService.execQuery(PAYOUT_QUERIES.DEDUCT_WALLET, [
      amount,
      shopCode,
    ]);
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
    await queryService.execQuery(PAYOUT_QUERIES.CREATE_WALLET_TRANSACTION, [
      shopCode,
      type,
      amount,
      note,
      status,
      payoutID,
    ]);
  },

  /**
   * Get payout by ID
   */
  async getPayoutByID(payoutID: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      PAYOUT_QUERIES.GET_PAYOUT_BY_ID,
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
    const statusClause = status ? " AND pr.Status = ?" : "";
    const listQuery = PAYOUT_QUERIES.LIST_PAYOUTS_BY_SHOP.replace(
      "{{STATUS}}",
      statusClause
    );
    const listParams = status
      ? [shopCode, status, limit, offset]
      : [shopCode, limit, offset];

    const [rows] = await queryService.query<RowDataPacket[]>(
      listQuery,
      listParams
    );

    const countQuery = PAYOUT_QUERIES.COUNT_PAYOUTS_BY_SHOP.replace(
      "{{STATUS}}",
      status ? " AND Status = ?" : ""
    );
    const countParams = status ? [shopCode, status] : [shopCode];
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
    const filters: string[] = [];
    const params: any[] = [];

    if (status) {
      filters.push("AND pr.Status = ?");
      params.push(status);
    }

    if (shopCode) {
      filters.push("AND pr.ShopCode = ?");
      params.push(shopCode);
    }

    const filterClause = filters.length ? ` ${filters.join(" ")}` : "";
    const listQuery = PAYOUT_QUERIES.LIST_ALL_PAYOUTS.replace(
      "{{FILTERS}}",
      filterClause
    );
    const [rows] = await queryService.query<RowDataPacket[]>(
      listQuery,
      [...params, limit, offset]
    );

    const countQuery = PAYOUT_QUERIES.COUNT_ALL_PAYOUTS.replace(
      "{{FILTERS}}",
      filterClause
    );
    const [countRows] = await queryService.query<RowDataPacket[]>(
      countQuery,
      params
    );
    const total = countRows?.[0]?.total || 0;

    return { data: rows, total };
  },

  /**
   * Update payout status to paid
   */
  async approvePayoutRequest(payoutID: number): Promise<void> {
    await queryService.execQuery(
      PAYOUT_QUERIES.APPROVE_PAYOUT_REQUEST,
      [payoutID, payoutID]
    );
  },

  /**
   * Update wallet transaction status
   */
  async completeWalletTransaction(payoutID: number): Promise<void> {
    await queryService.execQuery(
      PAYOUT_QUERIES.COMPLETE_WALLET_TRANSACTION,
      [payoutID]
    );
  },

  /**
   * Reject payout request
   */
  async rejectPayoutRequest(payoutID: number, reason: string): Promise<void> {
    await queryService.execQuery(PAYOUT_QUERIES.REJECT_PAYOUT_REQUEST, [
      reason,
      payoutID,
    ]);
  },

  /**
   * Get wallet stats
   */
  async getWalletStats(shopCode: number) {
    const [walletRows] = await queryService.query<RowDataPacket[]>(
      PAYOUT_QUERIES.GET_WALLET_STATS_BALANCE,
      [shopCode]
    );
    const balance = walletRows?.[0]?.Balance || 0;

    // Get total credited
    const [creditRows] = await queryService.query<RowDataPacket[]>(
      PAYOUT_QUERIES.GET_TOTAL_CREDITED,
      [shopCode]
    );
    const totalCredit = creditRows?.[0]?.total || 0;

    // Get total debited
    const [debitRows] = await queryService.query<RowDataPacket[]>(
      PAYOUT_QUERIES.GET_TOTAL_DEBITED,
      [shopCode]
    );
    const totalDebit = debitRows?.[0]?.total || 0;

    return { balance, totalCredit, totalDebit, available: balance };
  },
};

export default payoutModel;
