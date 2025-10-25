export const SHOP_PROMOTION_QUERIES = {
  LIST_BY_SHOP: `
    SELECT p.*,
           COALESCE(b.TotalUsage, 0) AS UsageCount
    FROM Shop_Promotions p
    LEFT JOIN (
      SELECT PromotionID, COUNT(*) AS TotalUsage
      FROM Bookings
      WHERE BookingStatus IN ('pending','confirmed','completed')
        AND PromotionID IS NOT NULL
      GROUP BY PromotionID
    ) b ON b.PromotionID = p.PromotionID
    WHERE p.ShopCode = ?
    ORDER BY p.CreateAt DESC
  `,

  GET_BY_ID: `
    SELECT p.*,
           COALESCE(b.TotalUsage, 0) AS UsageCount
    FROM Shop_Promotions p
    LEFT JOIN (
      SELECT PromotionID, COUNT(*) AS TotalUsage
      FROM Bookings
      WHERE PromotionID = ? AND BookingStatus IN ('pending','confirmed','completed')
      GROUP BY PromotionID
    ) b ON b.PromotionID = p.PromotionID
    WHERE p.ShopCode = ? AND p.PromotionID = ?
    LIMIT 1
  `,

  CREATE: `
    INSERT INTO Shop_Promotions (
      ShopCode,
      PromotionCode,
      Title,
      Description,
      DiscountType,
      DiscountValue,
      MaxDiscountAmount,
      MinOrderAmount,
      UsageLimit,
      UsagePerCustomer,
      StartAt,
      EndAt,
      Status,
      CreateAt,
      UpdateAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `,

  CODE_EXISTS: `
    SELECT PromotionID FROM Shop_Promotions
    WHERE ShopCode = ? AND PromotionCode = ? {{EXCLUDE}}
    LIMIT 1
  `,

  UPDATE: `
    UPDATE Shop_Promotions
    SET PromotionCode = ?,
        Title = ?,
        Description = ?,
        DiscountType = ?,
        DiscountValue = ?,
        MaxDiscountAmount = ?,
        MinOrderAmount = ?,
        UsageLimit = ?,
        UsagePerCustomer = ?,
        StartAt = ?,
        EndAt = ?,
        Status = ?,
        UpdateAt = NOW()
    WHERE ShopCode = ? AND PromotionID = ?
  `,

  UPDATE_STATUS: `
    UPDATE Shop_Promotions
    SET Status = ?, UpdateAt = NOW()
    WHERE ShopCode = ? AND PromotionID = ?
  `,

  GET_ACTIVE_FOR_SHOP_BASE: `
    SELECT p.*,
           COALESCE(b.TotalUsage, 0) AS UsageCount,
           {{CUSTOMER_USAGE}}
    FROM Shop_Promotions p
    LEFT JOIN (
      SELECT PromotionID, COUNT(*) AS TotalUsage
      FROM Bookings
      WHERE BookingStatus IN ('pending','confirmed','completed')
        AND PromotionID IS NOT NULL
      GROUP BY PromotionID
    ) b ON b.PromotionID = p.PromotionID
    {{CUSTOMER_JOIN}}
    WHERE p.ShopCode = ?
      AND p.Status NOT IN ('draft','disabled')
      AND p.StartAt <= NOW()
      AND p.EndAt >= NOW()
    ORDER BY p.EndAt ASC
  `,

  GET_BY_CODE: `
    SELECT p.*,
           COALESCE(b.TotalUsage, 0) AS UsageCount
    FROM Shop_Promotions p
    LEFT JOIN (
      SELECT PromotionID, COUNT(*) AS TotalUsage
      FROM Bookings
      WHERE BookingStatus IN ('pending','confirmed','completed')
        AND PromotionID IS NOT NULL
      GROUP BY PromotionID
    ) b ON b.PromotionID = p.PromotionID
    WHERE p.PromotionCode = ?
    LIMIT 1
  `,

  CHECK_USAGE: `
    SELECT COUNT(*) AS cnt FROM Bookings WHERE PromotionID = ?
  `,

  DELETE: `
    DELETE FROM Shop_Promotions WHERE ShopCode = ? AND PromotionID = ? LIMIT 1
  `,
};
