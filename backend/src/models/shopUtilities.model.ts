import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import queryService from "../services/query";
import { SHOP_UTILITY_IDS, getUtilityLabel } from "../constants/utilities";

// ============ TYPES ============
export type ShopUtilityRow = {
  utility_id: string;
  utility_name: string;
  shop_code: number;
};

// ============ CONSTANTS ============
const SHOP_UTILITIES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS Shop_Utilities (
    ShopUtilityID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ShopCode INT NOT NULL,
    UtilityID VARCHAR(50) NOT NULL,
    UtilityName VARCHAR(120) NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_shop_utility (ShopCode, UtilityID),
    CONSTRAINT FK_ShopUtilities_Shops FOREIGN KEY (ShopCode)
      REFERENCES Shops(ShopCode) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

// ============ SHOP UTILITIES MODEL ============
const shopUtilitiesModel = {
  /**
   * Ensure utilities table exists
   */
  async ensureTable(): Promise<void> {
    await queryService.query<ResultSetHeader>(SHOP_UTILITIES_TABLE_SQL, []);
  },

  /**
   * List all utilities for a shop
   */
  async listByShop(shopCode: number): Promise<ShopUtilityRow[]> {
    await this.ensureTable();

    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT UtilityID, UtilityName
       FROM Shop_Utilities
       WHERE ShopCode = ?
       ORDER BY UtilityName`,
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
      `DELETE FROM Shop_Utilities WHERE ShopCode = ?`,
      [shopCode]
    );

    // Insert new ones if provided
    if (!utilityIds.length) {
      return;
    }

    const placeholders = utilityIds.map(() => "(?, ?, ?)").join(",");
    const values = utilityIds.flatMap((id) => [
      shopCode,
      id,
      getUtilityLabel(id),
    ]);

    await connection.query<ResultSetHeader>(
      `INSERT INTO Shop_Utilities (ShopCode, UtilityID, UtilityName)
       VALUES ${placeholders}`,
      values
    );
  },

  /**
   * Get field info to retrieve shop code
   */
  async getFieldInfo(fieldCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT FieldCode, ShopCode FROM Fields WHERE FieldCode = ?`,
      [fieldCode]
    );

    return rows?.[0] || null;
  },
};

export default shopUtilitiesModel;



