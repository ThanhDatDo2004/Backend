"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const query_1 = __importDefault(require("../services/query"));
const utilities_1 = require("../constants/utilities");
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
    async ensureTable() {
        await query_1.default.query(SHOP_UTILITIES_TABLE_SQL, []);
    },
    /**
     * List all utilities for a shop
     */
    async listByShop(shopCode) {
        await this.ensureTable();
        const [rows] = await query_1.default.query(`SELECT UtilityID, UtilityName
       FROM Shop_Utilities
       WHERE ShopCode = ?
       ORDER BY UtilityName`, [shopCode]);
        return (rows || []).map((row) => ({
            utility_id: String(row.UtilityID),
            utility_name: String(row.UtilityName ?? (0, utilities_1.getUtilityLabel)(String(row.UtilityID))),
            shop_code: shopCode,
        }));
    },
    /**
     * Replace all utilities for a shop (within transaction)
     */
    async replaceForShop(connection, shopCode, utilityIds) {
        // Delete existing
        await connection.query(`DELETE FROM Shop_Utilities WHERE ShopCode = ?`, [shopCode]);
        // Insert new ones if provided
        if (!utilityIds.length) {
            return;
        }
        const placeholders = utilityIds.map(() => "(?, ?, ?)").join(",");
        const values = utilityIds.flatMap((id) => [
            shopCode,
            id,
            (0, utilities_1.getUtilityLabel)(id),
        ]);
        await connection.query(`INSERT INTO Shop_Utilities (ShopCode, UtilityID, UtilityName)
       VALUES ${placeholders}`, values);
    },
    /**
     * Get field info to retrieve shop code
     */
    async getFieldInfo(fieldCode) {
        const [rows] = await query_1.default.query(`SELECT FieldCode, ShopCode FROM Fields WHERE FieldCode = ?`, [fieldCode]);
        return rows?.[0] || null;
    },
};
exports.default = shopUtilitiesModel;
