import queryService from "./query";
import shopUtilitiesModel from "../models/shopUtilities.model";
import { SHOP_UTILITY_IDS, getUtilityLabel } from "../constants/utilities";

export type ShopUtilityRow = {
  utility_id: string;
  utility_name: string;
  shop_code: number;
};

export async function listShopUtilities(
  shopCode: number
): Promise<ShopUtilityRow[]> {
  return await shopUtilitiesModel.listByShop(shopCode);
}

export async function replaceShopUtilities(
  shopCode: number,
  utilityIds: string[]
): Promise<ShopUtilityRow[]> {
  const uniqueIds = Array.from(
    new Set(
      utilityIds
        .map((id) => String(id ?? "").trim())
        .filter((id) => id.length > 0 && SHOP_UTILITY_IDS.has(id))
    )
  );

  await queryService.execTransaction("shopUtilities.replace", async (conn) => {
    await shopUtilitiesModel.replaceForShop(conn, shopCode, uniqueIds);
  });

  return listShopUtilities(shopCode);
}

export async function listFieldUtilities(fieldCode: number) {
  const field = await shopUtilitiesModel.getFieldInfo(fieldCode);

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
