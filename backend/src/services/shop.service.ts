import shopModel from "../models/shop.model";
import queryService from "./query";

const shopService = {
  async getByUserId(userId: number) {
    return await shopModel.getByUserId(userId);
  },

  async getByCode(shopCode: number) {
    return await shopModel.getByCode(shopCode);
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

    const result = await queryService.execTransaction(
      "shopService.updateByUserId",
      async (conn) => {
        let shopCode = await shopModel.getShopCodeByUserId(userId);

        // If no existing shop, create new one
        if (!shopCode) {
          shopCode = await shopModel.createShop(
            conn,
            userId,
            payload.shop_name,
            payload.address
          );

          if (!shopCode) return null;
        } else {
          // Update existing shop
          await shopModel.updateShop(
            conn,
            shopCode,
            payload.shop_name,
            payload.address
          );
        }

        if (
          (payload.bank_account_number && payload.bank_account_number.trim()) ||
          (payload.bank_name && payload.bank_name.trim()) ||
          (payload.bank_account_holder && payload.bank_account_holder.trim())
        ) {
          // Upsert default bank account for the shop
          const accountNumber = (payload.bank_account_number || "").trim();
          const bankName = (payload.bank_name || "").trim();
          const accountHolder =
            (payload.bank_account_holder || "").trim() ||
            payload.shop_name.trim();

          // Mark existing defaults as non-default
          await shopModel.clearDefaultBankAccounts(conn, shopCode);

          // Insert new default record
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
