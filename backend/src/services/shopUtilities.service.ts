import { ResultSetHeader, RowDataPacket } from "mysql2";
import queryService from "./query";
import { SHOP_UTILITY_IDS, getUtilityLabel } from "../constants/utilities";

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

async function ensureTable() {
  await queryService.query<ResultSetHeader>(SHOP_UTILITIES_TABLE_SQL, []);
}

export type ShopUtilityRow = {
  utility_id: string;
  utility_name: string;
  shop_code: number;
};

export async function listShopUtilities(shopCode: number): Promise<ShopUtilityRow[]> {
  await ensureTable();
  const [rows] = await queryService.query<RowDataPacket[]>(
    `SELECT UtilityID, UtilityName
     FROM Shop_Utilities
     WHERE ShopCode = ?
     ORDER BY UtilityName`,
    [shopCode]
  );
  const mapped = (rows || []).map((row) => ({
    utility_id: String(row.UtilityID),
    utility_name: String(row.UtilityName ?? getUtilityLabel(String(row.UtilityID))),
    shop_code: shopCode,
  }));
  return mapped;
}

export async function replaceShopUtilities(shopCode: number, utilityIds: string[]): Promise<ShopUtilityRow[]> {
  await ensureTable();
  const uniqueIds = Array.from(
    new Set(
      utilityIds
        .map((id) => String(id ?? "").trim())
        .filter((id) => id.length > 0 && SHOP_UTILITY_IDS.has(id))
    )
  );

  await queryService.execTransaction(
    "shopUtilities.replace",
    async (conn) => {
      await conn.query<ResultSetHeader>(
        `DELETE FROM Shop_Utilities WHERE ShopCode = ?`,
        [shopCode]
      );

      if (!uniqueIds.length) {
        return;
      }

      const placeholders = uniqueIds.map(() => "(?, ?, ?)").join(",");
      const values = uniqueIds.flatMap((id) => [
        shopCode,
        id,
        getUtilityLabel(id),
      ]);

      await conn.query<ResultSetHeader>(
        `INSERT INTO Shop_Utilities (ShopCode, UtilityID, UtilityName)
         VALUES ${placeholders}`,
        values
      );
    }
  );

  return listShopUtilities(shopCode);
}

export async function listFieldUtilities(fieldCode: number) {
  const [fieldRows] = await queryService.query<RowDataPacket[]>(
    `SELECT FieldCode, ShopCode FROM Fields WHERE FieldCode = ?`,
    [fieldCode]
  );

  const field = fieldRows?.[0];
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
