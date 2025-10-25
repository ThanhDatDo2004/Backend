export const ADMIN_QUERIES = {
  LIST_USERS: `
    SELECT
      u.UserID AS user_code,
      u.LevelCode AS level_code,
      u.FullName AS full_name,
      u.Email AS email,
      u.PasswordHash AS password_hash,
      u.IsActive AS is_active
    FROM Users u
    WHERE u._destroy IS NULL OR u._destroy = 0
    ORDER BY u.UserID DESC
  `,

  LIST_USER_LEVELS: `
    SELECT
      LevelCode AS level_code,
      LevelType AS level_type,
      isActive AS is_active
    FROM Users_Level
    WHERE _destroy IS NULL OR _destroy = 0
    ORDER BY LevelCode ASC
  `,

  GET_USER_BY_ID: `
    SELECT
      u.UserID AS user_code,
      u.LevelCode AS level_code,
      u.FullName AS full_name,
      u.Email AS email,
      u.PasswordHash AS password_hash,
      u.IsActive AS is_active
    FROM Users u
    WHERE u.UserID = ?
      AND (u._destroy IS NULL OR u._destroy = 0)
    LIMIT 1
  `,

  UPDATE_USER_STATUS: `
    UPDATE Users
    SET IsActive = ?, UpdateAt = NOW()
    WHERE UserID = ?
    LIMIT 1
  `,

  UPDATE_SHOP_STATUS: `
    UPDATE Shops
    SET IsApproved = ?, UpdateAt = NOW()
    WHERE UserID = ?
  `,

  LIST_SHOPS: `
    SELECT
      s.ShopCode AS shop_code,
      s.UserID AS user_code,
      s.ShopName AS shop_name,
      s.Address AS address,
      s.IsApproved AS isapproved
    FROM Shops s
    ORDER BY s.ShopCode DESC
  `,

  GET_SHOP_BANKS: `
    SELECT
      ShopCode AS shop_code,
      BankName AS bank_name,
      AccountNumber AS bank_account_number,
      IsDefault AS is_default
    FROM Shop_Bank_Accounts
    WHERE ShopCode IN (?)
    ORDER BY ShopCode, IsDefault DESC, ShopBankID ASC
  `,

  ENSURE_INBOX_TABLE: `
    CREATE TABLE IF NOT EXISTS Shop_Request_Inbox (
      RequestID INT AUTO_INCREMENT PRIMARY KEY,
      FullName VARCHAR(255) NOT NULL,
      Email VARCHAR(190) NOT NULL,
      PhoneNumber VARCHAR(30) NOT NULL,
      Address VARCHAR(255) NOT NULL,
      Message TEXT NULL,
      Status ENUM('pending','reviewed','approved','rejected') NOT NULL DEFAULT 'pending',
      CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,

  COMBINED_SHOP_REQUESTS_SUBQUERY: `
    SELECT
      request_id,
      full_name,
      email,
      phone_number,
      address,
      message,
      status,
      created_at,
      processed_at,
      admin_note,
      source
    FROM (
      SELECT
        inbox.RequestID AS request_id,
        inbox.FullName AS full_name,
        inbox.Email AS email,
        inbox.PhoneNumber AS phone_number,
        inbox.Address AS address,
        inbox.Message AS message,
        inbox.Status AS status,
        inbox.CreatedAt AS created_at,
        NULL AS processed_at,
        NULL AS admin_note,
        'inbox' AS source
      FROM Shop_Request_Inbox inbox
    ) AS combined
  `,

  LIST_SHOP_REQUESTS: `
    SELECT
      request_id,
      full_name,
      email,
      phone_number,
      address,
      message,
      status,
      created_at,
      processed_at,
      admin_note,
      source
    FROM (
      SELECT
        inbox.RequestID AS request_id,
        inbox.FullName AS full_name,
        inbox.Email AS email,
        inbox.PhoneNumber AS phone_number,
        inbox.Address AS address,
        inbox.Message AS message,
        inbox.Status AS status,
        inbox.CreatedAt AS created_at,
        NULL AS processed_at,
        NULL AS admin_note,
        'inbox' AS source
      FROM Shop_Request_Inbox inbox
    ) AS combined
    ORDER BY created_at DESC, request_id DESC
  `,

  GET_SHOP_REQUEST_BY_ID: `
    SELECT
      request_id,
      full_name,
      email,
      phone_number,
      address,
      message,
      status,
      created_at,
      processed_at,
      admin_note,
      source
    FROM (
      SELECT
        inbox.RequestID AS request_id,
        inbox.FullName AS full_name,
        inbox.Email AS email,
        inbox.PhoneNumber AS phone_number,
        inbox.Address AS address,
        inbox.Message AS message,
        inbox.Status AS status,
        inbox.CreatedAt AS created_at,
        NULL AS processed_at,
        NULL AS admin_note,
        'inbox' AS source
      FROM Shop_Request_Inbox inbox
    ) AS combined
    WHERE request_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `,

  LIST_FINANCE_BOOKINGS: `
    SELECT
      b.BookingCode AS booking_code,
      b.FieldCode AS field_code,
      f.FieldName AS field_name,
      b.CustomerUserID AS customer_user_id,
      b.CustomerName AS customer_name,
      b.CustomerEmail AS customer_email,
      b.CustomerPhone AS customer_phone,
      b.TotalPrice AS total_price,
      b.PlatformFee AS platform_fee,
      b.NetToShop AS net_to_shop,
      b.BookingStatus AS booking_status,
      b.PaymentStatus AS payment_status,
      b.CheckinCode AS checkin_code,
      DATE_FORMAT(b.CreateAt, '%Y-%m-%d %H:%i:%s') AS create_at,
      b.QuantityID AS quantity_id
    FROM Bookings b
    LEFT JOIN Fields f ON f.FieldCode = b.FieldCode
    WHERE {{WHERE}}
    ORDER BY b.CreateAt DESC
    LIMIT ? OFFSET ?
  `,

  GET_FINANCE_SUMMARY: `
    SELECT
      COUNT(*) AS total_bookings,
      COALESCE(SUM(CASE WHEN b.BookingStatus = 'confirmed' THEN 1 ELSE 0 END), 0) AS confirmed_bookings,
      COALESCE(SUM(CASE WHEN b.PaymentStatus = 'paid' THEN 1 ELSE 0 END), 0) AS paid_bookings,
      COALESCE(SUM(b.TotalPrice), 0) AS total_revenue,
      COALESCE(SUM(b.PlatformFee), 0) AS platform_fee,
      COALESCE(SUM(b.NetToShop), 0) AS net_to_shop
    FROM Bookings b
    WHERE {{WHERE}}
  `,

  COUNT_FINANCE_BOOKINGS: `
    SELECT COUNT(*) AS total FROM Bookings b WHERE {{WHERE}}
  `,

  GET_FINANCE_BOOKINGS_SUMMARY: `
    SELECT
      COUNT(*) AS total_records,
      COALESCE(SUM(b.TotalPrice), 0) AS total_total_price,
      COALESCE(SUM(b.PlatformFee), 0) AS total_platform_fee,
      COALESCE(SUM(b.NetToShop), 0) AS total_net_to_shop,
      COALESCE(SUM(CASE WHEN b.CheckinCode IS NOT NULL AND b.CheckinCode <> '' THEN 1 ELSE 0 END), 0) AS total_checkins,
      COALESCE(SUM(CASE WHEN b.QuantityID IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_quantity_ids,
      DATE_FORMAT(MIN(b.CreateAt), '%Y-%m-%d %H:%i:%s') AS first_create_at,
      DATE_FORMAT(MAX(b.CreateAt), '%Y-%m-%d %H:%i:%s') AS last_create_at
    FROM Bookings b
    WHERE {{WHERE}}
  `,

  // Transaction queries - used within updateShopRequestStatus
  ENSURE_INBOX_TABLE_TX: `
    CREATE TABLE IF NOT EXISTS Shop_Request_Inbox (
      RequestID INT AUTO_INCREMENT PRIMARY KEY,
      FullName VARCHAR(255) NOT NULL,
      Email VARCHAR(190) NOT NULL,
      PhoneNumber VARCHAR(30) NOT NULL,
      Address VARCHAR(255) NOT NULL,
      Message TEXT NULL,
      Status ENUM('pending','reviewed','approved','rejected') NOT NULL DEFAULT 'pending',
      CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,

  GET_INBOX_REQUEST: `
    SELECT
      RequestID AS request_id,
      FullName AS full_name,
      Email AS email,
      PhoneNumber AS phone_number,
      Address AS address,
      Message AS message,
      Status AS status,
      CreatedAt AS created_at,
      NULL AS processed_at,
      NULL AS admin_note,
      'inbox' AS source
    FROM Shop_Request_Inbox
    WHERE RequestID = ?
    LIMIT 1
  `,

  GET_USER_BY_EMAIL: `
    SELECT UserID, LevelCode
    FROM Users
    WHERE LOWER(Email) = LOWER(?)
    LIMIT 1
  `,

  GET_SHOP_LEVEL: `
    SELECT LevelCode
    FROM Users_Level
    WHERE LevelType = 'shop'
    LIMIT 1
  `,

  UPDATE_USER_LEVEL: `
    UPDATE Users
    SET LevelCode = ?, UpdateAt = NOW()
    WHERE UserID = ?
    LIMIT 1
  `,

  UPDATE_INBOX_REQUEST_STATUS: `
    UPDATE Shop_Request_Inbox
    SET Status = ?
    WHERE RequestID = ?
  `,

  GET_UPDATED_INBOX_REQUEST: `
    SELECT
      RequestID AS request_id,
      FullName AS full_name,
      Email AS email,
      PhoneNumber AS phone_number,
      Address AS address,
      Message AS message,
      Status AS status,
      CreatedAt AS created_at,
      NULL AS processed_at,
      NULL AS admin_note,
      'inbox' AS source
    FROM Shop_Request_Inbox
    WHERE RequestID = ?
    LIMIT 1
  `,
};
