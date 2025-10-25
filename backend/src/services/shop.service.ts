import { StatusCodes } from "http-status-codes";
import shopModel from "../models/shop.model";
import ApiError from "../utils/apiErrors";

const shopService = {
  async getByUserId(userId: number) {
    return shopModel.getByUserId(userId);
  },

  async getByCode(shopCode: number) {
    return shopModel.getByCode(shopCode);
  },

  async getShopCodeByUserId(userId: number) {
    return shopModel.getShopCodeByUserId(userId);
  },

  async ensureShopByUser(userId: number) {
    const shop = await shopModel.getByUserId(userId);
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop");
    }
    return shop;
  },

  async ensureShopOwnership(shopCode: number, userId: number) {
    const summary = await shopModel.getShopSummaryByCode(shopCode);
    if (!summary) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop");
    }
    if (Number(summary.UserID) !== Number(userId)) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Bạn không có quyền truy cập shop này"
      );
    }
    return summary;
  },

  async listBankAccountsByUser(userId: number) {
    const shop = await this.ensureShopByUser(userId);
    return shopModel.listBankAccounts(Number(shop.shop_code));
  },

  async listBankAccountsByShop(shopCode: number) {
    return shopModel.listBankAccounts(shopCode);
  },

  async updateByUserId(
    userId: number,
    payload: {
      shop_name: string;
      address: string;
      bank_account_number?: string;
      bank_name?: string;
      bank_account_holder?: string;
    }
  ) {
    if (!Number.isFinite(userId)) return null;

    const result = await shopModel.withTransaction(
      "shopService.updateByUserId",
      async (conn) => {
        let shopCode = await shopModel.getShopCodeByUserId(userId);

        if (!shopCode) {
          shopCode = await shopModel.createShop(
            conn,
            userId,
            payload.shop_name,
            payload.address
          );
          if (!shopCode) return null;
        } else {
          await shopModel.updateShop(
            conn,
            shopCode,
            payload.shop_name,
            payload.address
          );
        }

        const hasBankDetails =
          (payload.bank_account_number || "").trim().length > 0 ||
          (payload.bank_name || "").trim().length > 0 ||
          (payload.bank_account_holder || "").trim().length > 0;

        if (hasBankDetails) {
          const accountNumber = (payload.bank_account_number || "").trim();
          const bankName = (payload.bank_name || "").trim();
          const accountHolder =
            (payload.bank_account_holder || "").trim() ||
            payload.shop_name.trim();

          await shopModel.clearDefaultBankAccounts(conn, shopCode);
          await shopModel.createBankAccount(
            conn,
            shopCode,
            accountNumber,
            bankName,
            accountHolder,
            "Y"
          );
        }

        return shopCode;
      }
    );

    if (!result) return null;
    return this.getByUserId(userId);
  },
};

export default shopService;
