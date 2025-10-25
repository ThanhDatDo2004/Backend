// SQL templates cho field operations
export const FIELD_QUERIES = {
  // Base SELECT with JOINs - used as foundation for listing
  BASE_SELECT: `
    SELECT
      f.FieldCode AS field_code,
      f.ShopCode AS shop_code,
      f.FieldName AS field_name,
      f.SportType AS sport_type,
      f.Address AS address,
      f.DefaultPricePerHour AS price_per_hour,
      f.Status AS status,
      f.Rent AS rent,
      s.ShopName AS shop_name,
      s.Address AS shop_address,
      s.UserID AS shop_user_id,
      s.IsApproved AS shop_is_approved
    FROM Fields f
    JOIN Shops s ON s.ShopCode = f.ShopCode
    JOIN Users u ON u.UserID = s.UserID
  `,

  // Count fields with filters (for pagination)
  COUNT_FIELDS: `
    SELECT COUNT(DISTINCT f.FieldCode) AS total
    FROM Fields f
    JOIN Shops s ON s.ShopCode = f.ShopCode
    JOIN Users u ON u.UserID = s.UserID
  `,

  // Count fields by status
  COUNT_BY_STATUS: `
    SELECT f.Status AS status, COUNT(DISTINCT f.FieldCode) AS total
    FROM Fields f
    JOIN Shops s ON s.ShopCode = f.ShopCode
    JOIN Users u ON u.UserID = s.UserID
  `,

  // Count fields by shop approval status
  COUNT_BY_SHOP_APPROVAL: `
    SELECT s.IsApproved AS approval, COUNT(DISTINCT f.FieldCode) AS total
    FROM Fields f
    JOIN Shops s ON s.ShopCode = f.ShopCode
    JOIN Users u ON u.UserID = s.UserID
  `,

  // List distinct addresses (for faceting)
  LIST_ADDRESSES: `
    SELECT DISTINCT f.Address AS address
    FROM Fields f
    JOIN Shops s ON s.ShopCode = f.ShopCode
    JOIN Users u ON u.UserID = s.UserID
  `,

  // List distinct sport types (for faceting)
  LIST_SPORT_TYPES: `
    SELECT DISTINCT f.SportType AS sport_type
    FROM Fields f
    JOIN Shops s ON s.ShopCode = f.ShopCode
    JOIN Users u ON u.UserID = s.UserID
    ORDER BY f.SportType
  `,

  // Get field by code with all details
  GET_FIELD_BY_CODE: `
    SELECT * FROM Fields WHERE FieldCode = ?
  `,

  // Get shop by code
  GET_SHOP_BY_CODE: `
    SELECT * FROM Shops WHERE ShopCode = ?
  `,

  // Get field images by codes
  GET_FIELD_IMAGES: `
    SELECT
      ImageCode AS image_code,
      FieldCode AS field_code,
      ImageUrl AS image_url,
      SortOrder AS sort_order
    FROM Field_Images
    WHERE FieldCode = ? AND ImageCode IN (?)
    ORDER BY SortOrder, ImageCode
  `,

  // List all images for a field
  LIST_ALL_IMAGES_FOR_FIELD: `
    SELECT
      ImageCode AS image_code,
      FieldCode AS field_code,
      ImageUrl AS image_url,
      SortOrder AS sort_order
    FROM Field_Images
    WHERE FieldCode = ?
    ORDER BY SortOrder, ImageCode
  `,

  // Delete field images
  DELETE_FIELD_IMAGES: `
    DELETE FROM Field_Images
    WHERE FieldCode = ? AND ImageCode IN (?)
  `,

  // Delete all images for a field
  DELETE_ALL_IMAGES_FOR_FIELD: `
    DELETE FROM Field_Images WHERE FieldCode = ?
  `,

  // List field slots (availability check)
  LIST_FIELD_SLOTS: `
    SELECT
      fs.SlotID AS slot_id,
      fs.FieldCode AS field_code,
      fs.QuantityID AS quantity_id,
      fq.QuantityNumber AS quantity_number,
      DATE_FORMAT(fs.PlayDate, '%Y-%m-%d') AS play_date,
      DATE_FORMAT(fs.StartTime, '%H:%i') AS start_time,
      DATE_FORMAT(fs.EndTime, '%H:%i') AS end_time,
      fs.Status AS status,
      DATE_FORMAT(fs.HoldExpiresAt, '%Y-%m-%d %H:%i:%s') AS hold_expires_at,
      UNIX_TIMESTAMP(CONVERT_TZ(fs.HoldExpiresAt, '+07:00', '+00:00')) AS hold_exp_ts,
      UNIX_TIMESTAMP(fs.UpdateAt) AS update_at_ts
    FROM Field_Slots fs
    LEFT JOIN Field_Quantity fq ON fs.QuantityID = fq.QuantityID
  `,

  // List booking slots (booked/held slots)
  LIST_BOOKING_SLOTS: `
    SELECT
      bs.Slot_ID AS booking_slot_id,
      bs.FieldCode AS field_code,
      bs.QuantityID AS quantity_id,
      fq.QuantityNumber AS quantity_number,
      DATE_FORMAT(bs.PlayDate, '%Y-%m-%d') AS play_date,
      DATE_FORMAT(bs.StartTime, '%H:%i') AS start_time,
      DATE_FORMAT(bs.EndTime, '%H:%i') AS end_time,
      bs.Status AS booking_slot_status,
      b.BookingStatus AS booking_status,
      b.PaymentStatus AS payment_status
    FROM Booking_Slots bs
    INNER JOIN Bookings b ON bs.BookingCode = b.BookingCode
    LEFT JOIN Field_Quantity fq ON bs.QuantityID = fq.QuantityID
    WHERE bs.FieldCode = ?
      AND bs.PlayDate = ?
      AND b.BookingStatus IN ('pending', 'confirmed')
  `,

  // Check if field has future bookings
  HAS_FUTURE_BOOKINGS: `
    SELECT COUNT(*) AS cnt
    FROM Field_Slots
    WHERE FieldCode = ?
      AND (
        (PlayDate > CURDATE()) OR
        (PlayDate = CURDATE() AND EndTime > DATE_FORMAT(CONVERT_TZ(NOW(), '+00:00', '+07:00'), '%H:%i'))
      )
      AND Status IN ('booked', 'held')
  `,

  // Check if field has any bookings
  HAS_ANY_BOOKINGS: `
    SELECT COUNT(*) AS cnt
    FROM Bookings
    WHERE FieldCode = ?
  `,

  // List field pricing
  LIST_FIELD_PRICING: `
    SELECT
      PricingCode AS pricing_code,
      FieldCode AS field_code,
      DayOfWeek AS day_of_week,
      StartTime AS start_time,
      EndTime AS end_time,
      PricePerHour AS price_per_hour
    FROM Field_Pricing
    WHERE FieldCode = ?
    ORDER BY DayOfWeek, StartTime
  `,

  // List field images
  LIST_FIELD_IMAGES: `
    SELECT
      ImageCode AS image_code,
      FieldCode AS field_code,
      ImageUrl AS image_url,
      SortOrder AS sort_order
    FROM Field_Images
    WHERE FieldCode IN (?)
    ORDER BY FieldCode, SortOrder, ImageCode
  `,

  // Create field
  CREATE_FIELD: `
    INSERT INTO Fields (ShopCode, FieldName, SportType, Address, DefaultPricePerHour, Status, Rent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,

  // Create field image
  CREATE_FIELD_IMAGE: `
    INSERT INTO Field_Images (FieldCode, ImageUrl, SortOrder)
    VALUES (?, ?, ?)
  `,

  // Update field
  UPDATE_FIELD: `
    UPDATE Fields
    SET FieldName = ?, SportType = ?, Address = ?, DefaultPricePerHour = ?
    WHERE FieldCode = ?
  `,

  // Update field status
  UPDATE_FIELD_STATUS: `
    UPDATE Fields SET Status = ? WHERE FieldCode = ?
  `,

  // Update field rent
  UPDATE_FIELD_RENT: `
    UPDATE Fields SET Rent = ? WHERE FieldCode = ?
  `,

  GET_FIELD_STATS: `
    SELECT
      f.FieldCode,
      f.FieldName,
      f.Rent,
      f.Rent AS booking_count,
      f.Status,
      f.DefaultPricePerHour,
      f.SportType,
      s.ShopName,
      (
        SELECT COUNT(*)
        FROM Bookings
        WHERE FieldCode = f.FieldCode
          AND BookingStatus = 'confirmed'
      ) AS confirmed_count,
      (
        SELECT COUNT(*)
        FROM Bookings
        WHERE FieldCode = f.FieldCode
      ) AS total_bookings
    FROM Fields f
    JOIN Shops s ON f.ShopCode = s.ShopCode
    WHERE f.FieldCode = ?
  `,

  LIST_FIELDS_WITH_RENT: `
    SELECT
      f.FieldCode,
      f.FieldName,
      f.Rent,
      f.Rent AS booking_count,
      f.Status,
      f.DefaultPricePerHour,
      f.SportType,
      s.ShopName
    FROM Fields f
    JOIN Shops s ON f.ShopCode = s.ShopCode
    WHERE f.ShopCode = ?
    ORDER BY f.Rent DESC
    LIMIT ? OFFSET ?
  `,

  COUNT_FIELDS_BY_SHOP: `
    SELECT COUNT(*) AS total
    FROM Fields
    WHERE ShopCode = ?
  `,

  COUNT_CONFIRMED_BOOKINGS_FOR_FIELD: `
    SELECT COUNT(*) AS rent_count
    FROM Bookings
    WHERE FieldCode = ?
      AND BookingStatus = 'confirmed'
  `,

  LIST_ALL_FIELD_CODES: `
    SELECT FieldCode FROM Fields
  `,

  // Soft delete field
  SOFT_DELETE_FIELD: `
    UPDATE Fields SET Status = 'inactive' WHERE FieldCode = ?
  `,

  // Hard delete field
  HARD_DELETE_FIELD: `
    DELETE FROM Fields WHERE FieldCode = ?
  `,

  // Delete all pricing for field
  DELETE_ALL_PRICING_FOR_FIELD: `
    DELETE FROM Field_Pricing WHERE FieldCode = ?
  `,

  // Delete all bookings for field
  DELETE_ALL_BOOKINGS_FOR_FIELD: `
    DELETE FROM Bookings WHERE FieldCode = ?
  `,

  // Insert field image
  INSERT_FIELD_IMAGE: `
    INSERT INTO Field_Images (FieldCode, ImageUrl, SortOrder)
    VALUES (?, ?, ?)
  `,

  // Insert field
  INSERT_FIELD: `
    INSERT INTO Fields (ShopCode, FieldName, SportType, Address, DefaultPricePerHour, Status, Rent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,

  // Update field (detailed)
  UPDATE_FIELD_DETAILED: `
    UPDATE Fields
    SET FieldName = ?, SportType = ?, Address = ?, DefaultPricePerHour = ?
    WHERE FieldCode = ?
  `,

  // Insert field pricing
  INSERT_FIELD_PRICING: `
    INSERT INTO Field_Pricing (FieldCode, DayOfWeek, StartTime, EndTime, PricePerHour)
    VALUES (?, ?, ?, ?, ?)
  `,
};
