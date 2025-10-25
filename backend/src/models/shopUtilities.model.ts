import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import queryService from "../core/database";
import { SHOP_UTILITY_IDS, getUtilityLabel } from "../constants/utilities";
import { SHOP_UTILITIES_QUERIES } from "../queries/shopUtilities.queries";

// ============ TYPES ============
export type ShopUtilityRow = {
  utility_id: string;
  utility_name: string;
  shop_code: number;
};

// ============ SHOP UTILITIES MODEL ============
const shopUtilitiesModel = {
  /**
   * List all utilities for a shop
   */
  async listByShop(shopCode: number): Promise<ShopUtilityRow[]> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      SHOP_UTILITIES_QUERIES.LIST_BY_SHOP,
      [shopCode]
    );

    return (rows || []).map((row) => ({
      utility_id: String(row.UtilityID),
      utility_name: String(
        row.UtilityName ?? getUtilityLabel(String(row.UtilityID))
      ),
      shop_code: shopCode,
    }));
  },

  /**
   * Replace all utilities for a shop (within transaction)
   */
  async replaceForShop(
    connection: PoolConnection,
    shopCode: number,
    utilityIds: string[]
  ): Promise<void> {
    // Delete existing
    await connection.query<ResultSetHeader>(
      SHOP_UTILITIES_QUERIES.DELETE_BY_SHOP,
      [shopCode]
    );

    // Insert new ones if provided
    if (!utilityIds.length) {
      return;
    }

    for (const id of utilityIds) {
      await connection.query<ResultSetHeader>(
        SHOP_UTILITIES_QUERIES.INSERT_UTILITY,
        [shopCode, id, getUtilityLabel(id)]
      );
    }
  },

  /**
   * Get field info to retrieve shop code
   */
  async getFieldInfo(fieldCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      SHOP_UTILITIES_QUERIES.GET_FIELD_INFO,
      [fieldCode]
    );

    return rows?.[0] || null;
  },

  async withTransaction<T>(
    label: string,
    handler: (connection: PoolConnection) => Promise<T>
  ): Promise<T> {
    return queryService.execTransaction(label, handler);
  },
};

export default shopUtilitiesModel;

