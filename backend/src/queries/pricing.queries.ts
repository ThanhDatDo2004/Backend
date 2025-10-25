export const PRICING_QUERIES = {
  GET_DEFAULT_PRICE: `
    SELECT DefaultPricePerHour FROM Fields WHERE FieldCode = ?
  `,

  CREATE_OPERATING_HOURS: `
    INSERT INTO Field_Pricing (
      FieldCode,
      DayOfWeek,
      StartTime,
      EndTime,
      PricePerHour
    ) VALUES (?, ?, ?, ?, ?)
  `,

  GET_OPERATING_HOURS_BY_ID: `
    SELECT
      p.PricingID AS pricing_id,
      p.FieldCode AS field_code,
      p.DayOfWeek AS day_of_week,
      DATE_FORMAT(p.StartTime, '%H:%i') AS start_time,
      DATE_FORMAT(p.EndTime, '%H:%i') AS end_time
    FROM Field_Pricing p
    JOIN Fields f ON f.FieldCode = p.FieldCode
    JOIN Shops s ON s.ShopCode = f.ShopCode
    WHERE p.PricingID = ? AND s.UserID = ?
    LIMIT 1
  `,

  UPDATE_OPERATING_HOURS_BASE: `
    UPDATE Field_Pricing
    SET {{FIELDS}}
    WHERE PricingID = ?
  `,

  DELETE_OPERATING_HOURS: `
    DELETE FROM Field_Pricing WHERE PricingID = ?
  `,

  CHECK_TIME_OVERLAP: `
    SELECT COUNT(*) AS count
    FROM Field_Pricing
    WHERE FieldCode = ?
      AND DayOfWeek = ?
      AND NOT (EndTime <= ? OR StartTime >= ?)
      {{EXCLUDE}}
  `,

  GET_PRICING_BY_ID: `
    SELECT
      p.PricingID AS pricing_id,
      p.FieldCode AS field_code,
      p.DayOfWeek AS day_of_week,
      DATE_FORMAT(p.StartTime, '%H:%i') AS start_time,
      DATE_FORMAT(p.EndTime, '%H:%i') AS end_time
    FROM Field_Pricing p
    WHERE p.PricingID = ?
    LIMIT 1
  `,
};
