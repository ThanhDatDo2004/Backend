import shopModel from "../models/shop.model";
import queryService from "./query";

type ShopUpdatePayload = {
  shop_name: string;
  address: string;
  bank_account_number?: string;
  bank_name?: string;
  bank_account_holder?: string;
  phone_number?: string;
  opening_time?: string | null;
  closing_time?: string | null;
  is_open_24h?: boolean;
};

const shopService = {
  async getByUserId(userId: number) {
    return await shopModel.getByUserId(userId);
  },

  async getByCode(shopCode: number) {
    return await shopModel.getByCode(shopCode);
  },

  async getShopCodeByUserId(userId: number) {
    return await shopModel.getShopCodeByUserId(userId);
  },

  async listBankAccounts(shopCode: number) {
    return await shopModel.listBankAccounts(shopCode);
  },

  async updateByUserId(
    userId: number,
    payload: ShopUpdatePayload
  ) {
    if (!Number.isFinite(userId)) return null;

    const isOpen24Hours = Boolean(payload.is_open_24h);
    const normalizeTime = (value?: string | null) => {
      const trimmed = value?.trim();
      if (!trimmed) return null;
      return trimmed;
    };
    const openingTime = isOpen24Hours ? null : normalizeTime(payload.opening_time);
    const closingTime = isOpen24Hours ? null : normalizeTime(payload.closing_time);
    const phoneNumber = (payload.phone_number || "").trim() || null;

    const result = await queryService.execTransaction(
      "shopService.updateByUserId",
      async (conn) => {
        let shopCode = await shopModel.getShopCodeByUserId(userId);

        if (!shopCode) {
          shopCode = await shopModel.createShop(
            conn,
            userId,
            payload.shop_name,
            payload.address,
            phoneNumber,
            openingTime,
            closingTime,
            isOpen24Hours
          );

          if (!shopCode) return null;
        } else {
          // Update existing shop
          await shopModel.updateShop(
            conn,
            shopCode,
            payload.shop_name,
            payload.address,
            phoneNumber,
            openingTime,
            closingTime,
            isOpen24Hours
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
