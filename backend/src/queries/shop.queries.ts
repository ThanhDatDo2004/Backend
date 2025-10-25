export const SHOP_QUERIES = {
  GET_BY_USER_ID: `
    SELECT
      s.ShopCode AS shop_code,
      s.UserID AS user_id,
      s.ShopName AS shop_name,
      s.Address AS address,
      s.IsApproved AS is_approved,
      s.CreateAt AS created_at,
      s.UpdateAt AS updated_at,
      s.ApprovedAt AS approved_at,
      COALESCE(sb.AccountNumber, '') AS bank_account_number,
      COALESCE(sb.BankName, '') AS bank_name,
      COALESCE(sw.Balance, 0) AS wallet_balance,
      (SELECT COUNT(*) FROM Fields WHERE ShopCode = s.ShopCode) AS field_count,
      (SELECT COUNT(*) FROM Bookings b JOIN Fields f ON b.FieldCode = f.FieldCode WHERE f.ShopCode = s.ShopCode) AS booking_count
    FROM Shops s
    LEFT JOIN Shop_Bank_Accounts sb
      ON sb.ShopCode = s.ShopCode
     AND (sb.IsDefault = 'Y' OR sb.IsDefault IS NULL)
    LEFT JOIN Shop_Wallets sw ON sw.ShopCode = s.ShopCode
    WHERE s.UserID = ?
    ORDER BY s.ShopCode ASC
    LIMIT 1
  `,

  GET_BY_CODE: `
    SELECT
      s.ShopCode AS shop_code,
      s.UserID AS user_id,
      s.ShopName AS shop_name,
      s.Address AS address,
      s.IsApproved AS is_approved,
      s.CreateAt AS created_at,
      s.UpdateAt AS updated_at,
      s.ApprovedAt AS approved_at,
      COALESCE(sb.AccountNumber, '') AS bank_account_number,
      COALESCE(sb.BankName, '') AS bank_name
    FROM Shops s
    LEFT JOIN Shop_Bank_Accounts sb
      ON sb.ShopCode = s.ShopCode
     AND (sb.IsDefault = 'Y' OR sb.IsDefault IS NULL)
    WHERE s.ShopCode = ?
    LIMIT 1
  `,

  GET_SHOP_CODE_BY_USER_ID: `
    SELECT ShopCode FROM Shops WHERE UserID = ? LIMIT 1
  `,

  CREATE_SHOP: `
    INSERT INTO Shops (UserID, ShopName, Address, IsApproved, CreateAt, UpdateAt)
    VALUES (?, ?, ?, 'Y', NOW(), NOW())
  `,

  UPDATE_SHOP: `
    UPDATE Shops
    SET ShopName = ?, Address = ?, UpdateAt = NOW()
    WHERE ShopCode = ?
  `,

  CLEAR_DEFAULT_BANK_ACCOUNTS: `
    UPDATE Shop_Bank_Accounts
    SET IsDefault = 'N'
    WHERE ShopCode = ?
  `,

  CREATE_BANK_ACCOUNT: `
    INSERT INTO Shop_Bank_Accounts (ShopCode, AccountNumber, BankName, AccountHolder, IsDefault)
    VALUES (?, ?, ?, ?, ?)
  `,

  LIST_BANK_ACCOUNTS_BY_SHOP: `
    SELECT
      ShopBankID,
      ShopCode,
      BankName,
      AccountNumber,
      AccountHolder,
      IsDefault,
      CreateAt,
      UpdateAt
    FROM Shop_Bank_Accounts
    WHERE ShopCode = ?
    ORDER BY CreateAt DESC
  `,

  GET_SHOP_SUMMARY_BY_CODE: `
    SELECT ShopCode, UserID
    FROM Shops
    WHERE ShopCode = ?
    LIMIT 1
  `,
};
