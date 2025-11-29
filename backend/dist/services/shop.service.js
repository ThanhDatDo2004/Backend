"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const shop_model_1 = __importDefault(require("../models/shop.model"));
const query_1 = __importDefault(require("./query"));
const shopService = {
    async getByUserId(userId) {
        return await shop_model_1.default.getByUserId(userId);
    },
    async getByCode(shopCode) {
        return await shop_model_1.default.getByCode(shopCode);
    },
    async getShopCodeByUserId(userId) {
        return await shop_model_1.default.getShopCodeByUserId(userId);
    },
    async listBankAccounts(shopCode) {
        return await shop_model_1.default.listBankAccounts(shopCode);
    },
    async updateByUserId(userId, payload) {
        if (!Number.isFinite(userId))
            return null;
        const isOpen24Hours = Boolean(payload.is_open_24h);
        const normalizeTime = (value) => {
            const trimmed = value?.trim();
            if (!trimmed)
                return null;
            return trimmed;
        };
        const openingTime = isOpen24Hours ? null : normalizeTime(payload.opening_time);
        const closingTime = isOpen24Hours ? null : normalizeTime(payload.closing_time);
        const phoneNumber = (payload.phone_number || "").trim() || null;
        const result = await query_1.default.execTransaction("shopService.updateByUserId", async (conn) => {
            let shopCode = await shop_model_1.default.getShopCodeByUserId(userId);
            if (!shopCode) {
                shopCode = await shop_model_1.default.createShop(conn, userId, payload.shop_name, payload.address, phoneNumber, openingTime, closingTime, isOpen24Hours);
                if (!shopCode)
                    return null;
            }
            else {
                // Update existing shop
                await shop_model_1.default.updateShop(conn, shopCode, payload.shop_name, payload.address, phoneNumber, openingTime, closingTime, isOpen24Hours);
            }
            if ((payload.bank_account_number && payload.bank_account_number.trim()) ||
                (payload.bank_name && payload.bank_name.trim()) ||
                (payload.bank_account_holder && payload.bank_account_holder.trim())) {
                // Upsert default bank account for the shop
                const accountNumber = (payload.bank_account_number || "").trim();
                const bankName = (payload.bank_name || "").trim();
                const accountHolder = (payload.bank_account_holder || "").trim() ||
                    payload.shop_name.trim();
                // Mark existing defaults as non-default
                await shop_model_1.default.clearDefaultBankAccounts(conn, shopCode);
                // Insert new default record
                await shop_model_1.default.createBankAccount(conn, shopCode, accountNumber, bankName, accountHolder, "Y");
            }
            return shopCode;
        });
        if (!result)
            return null;
        return this.getByUserId(userId);
    },
};
exports.default = shopService;
