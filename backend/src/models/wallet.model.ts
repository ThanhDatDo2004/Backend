import { RowDataPacket } from "mysql2";
import queryService from "../core/database";
import { WALLET_QUERIES } from "../queries/wallet.queries";

export type WalletTransactionRow = RowDataPacket & {
  TransactionID: number;
  ShopCode: number;
  Type: string;
  Amount: number;
  Status: string;
  Note?: string | null;
  CreateAt: string;
};

export type WalletTransactionCountRow = RowDataPacket & {
  total: number;
};

const walletModel = {
  async listTransactions(
    shopCode: number,
    limit: number,
    offset: number
  ): Promise<WalletTransactionRow[]> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      WALLET_QUERIES.LIST_TRANSACTIONS,
      [shopCode, limit, offset]
    );
    return rows as WalletTransactionRow[];
  },

  async listTransactionsByType(
    shopCode: number,
    type: string,
    limit: number,
    offset: number
  ): Promise<WalletTransactionRow[]> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      WALLET_QUERIES.LIST_TRANSACTIONS_BY_TYPE,
      [shopCode, type, limit, offset]
    );
    return rows as WalletTransactionRow[];
  },

  async countTransactions(shopCode: number): Promise<number> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      WALLET_QUERIES.COUNT_TRANSACTIONS,
      [shopCode]
    );
    const countRow = rows?.[0] as WalletTransactionCountRow | undefined;
    return Number(countRow?.total ?? 0);
  },
};

export default walletModel;
