export const SHOP_UTILITIES_QUERIES = {
  LIST_BY_SHOP: `
    SELECT UtilityID, UtilityName
    FROM Shop_Utilities
    WHERE ShopCode = ?
    ORDER BY UtilityName
  `,

  DELETE_BY_SHOP: `
    DELETE FROM Shop_Utilities
    WHERE ShopCode = ?
  `,

  INSERT_UTILITY: `
    INSERT INTO Shop_Utilities (ShopCode, UtilityID, UtilityName)
    VALUES (?, ?, ?)
  `,

  GET_FIELD_INFO: `
    SELECT FieldCode, ShopCode
    FROM Fields
    WHERE FieldCode = ?
    LIMIT 1
  `,
};
