import { StatusCodes } from "http-status-codes";
import payoutModel from "../models/payout.model";
import walletModel from "../models/wallet.model";
import shopService from "./shop.service";
import ApiError from "../utils/apiErrors";

type TransactionFilters = {
  type?: string;
  limit?: number;
  offset?: number;
};

export async function getWalletStatsByUser(userId: number) {
  const shop = await shopService.ensureShopByUser(userId);
  return payoutModel.getWalletStats(Number(shop.shop_code));
}

export async function getWalletStatsByShop(shopCode: number) {
  const stats = await payoutModel.getWalletStats(shopCode);
  if (!stats) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy ví của shop");
  }
  return stats;
}

export async function getTransactionsByUser(
  userId: number,
  filters?: TransactionFilters
) {
  const shop = await shopService.ensureShopByUser(userId);
  return getTransactionsByShop(Number(shop.shop_code), filters);
}

export async function getTransactionsByShop(
  shopCode: number,
  filters?: TransactionFilters
) {
  const limit = Math.max(1, Math.min(filters?.limit ?? 10, 100));
  const offset = Math.max(0, filters?.offset ?? 0);

  const rows =
    filters?.type && filters.type.trim()
      ? await walletModel.listTransactionsByType(
          shopCode,
          filters.type.trim(),
          limit,
          offset
        )
      : await walletModel.listTransactions(shopCode, limit, offset);

  const total = await walletModel.countTransactions(shopCode);

  return {
    data: rows,
    pagination: {
      limit,
      offset,
      total,
    },
  };
}

const walletService = {
  getWalletStatsByUser,
  getWalletStatsByShop,
  getTransactionsByUser,
  getTransactionsByShop,
};

export default walletService;
