"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listShopUtilities = listShopUtilities;
exports.replaceShopUtilities = replaceShopUtilities;
exports.listFieldUtilities = listFieldUtilities;
const query_1 = __importDefault(require("./query"));
const shopUtilities_model_1 = __importDefault(require("../models/shopUtilities.model"));
const utilities_1 = require("../constants/utilities");
async function listShopUtilities(shopCode) {
    return await shopUtilities_model_1.default.listByShop(shopCode);
}
async function replaceShopUtilities(shopCode, utilityIds) {
    const uniqueIds = Array.from(new Set(utilityIds
        .map((id) => String(id ?? "").trim())
        .filter((id) => id.length > 0 && utilities_1.SHOP_UTILITY_IDS.has(id))));
    await query_1.default.execTransaction("shopUtilities.replace", async (conn) => {
        await shopUtilities_model_1.default.replaceForShop(conn, shopCode, uniqueIds);
    });
    return listShopUtilities(shopCode);
}
async function listFieldUtilities(fieldCode) {
    const field = await shopUtilities_model_1.default.getFieldInfo(fieldCode);
    if (!field) {
        throw new Error("FIELD_NOT_FOUND");
    }
    const shopCode = Number(field.ShopCode);
    const utilities = await listShopUtilities(shopCode);
    return utilities.map((item) => ({
        utility_id: item.utility_id,
        utility_name: item.utility_name,
        field_code: fieldCode,
        is_available: 1,
    }));
}
