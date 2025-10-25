export const PAYOUT_QUERIES = {
  GET_SHOP: `
    SELECT ShopCode, ShopName, UserID FROM Shops WHERE ShopCode = ?
  `,

  GET_USER: `
    SELECT PasswordHash FROM Users WHERE UserID = ?
  `,

  GET_DEFAULT_BANK_ACCOUNT: `
    SELECT ShopBankID, BankName, AccountNumber, AccountHolder, IsDefault
    FROM Shop_Bank_Accounts
    WHERE ShopCode = ? AND (IsDefault = 'Y' OR IsDefault = 1)
  `,

  GET_BANK_ACCOUNT_BY_ID: `
    SELECT ShopBankID, BankName, AccountNumber, AccountHolder, IsDefault
    FROM Shop_Bank_Accounts
    WHERE ShopBankID = ? AND ShopCode = ?
  `,

  GET_ALL_BANK_ACCOUNTS: `
    SELECT ShopBankID, BankName, IsDefault, ShopCode FROM Shop_Bank_Accounts WHERE ShopCode = ?
  `,

  GET_WALLET_BALANCE: `
    SELECT Balance FROM Shop_Wallets WHERE ShopCode = ?
  `,

  CREATE_PAYOUT_REQUEST: `
    INSERT INTO Payout_Requests (
      ShopCode,
      ShopBankID,
      Amount,
      Status,
      Note,
      RequestedAt,
      CreateAt
    ) VALUES (?, ?, ?, 'requested', ?, NOW(), NOW())
  `,

  DEDUCT_WALLET: `
    UPDATE Shop_Wallets
    SET Balance = Balance - ?,
        UpdateAt = NOW()
    WHERE ShopCode = ?
  `,

  CREATE_WALLET_TRANSACTION: `
    INSERT INTO Wallet_Transactions (
      ShopCode,
      Type,
      Amount,
      Note,
      Status,
      PayoutID,
      CreateAt
    ) VALUES (?, ?, ?, ?, ?, ?, NOW())
  `,

  GET_PAYOUT_BY_ID: `
    SELECT pr.*, s.ShopName, sba.BankName, sba.AccountNumber, sba.AccountHolder, sba.IsDefault
    FROM Payout_Requests pr
    JOIN Shops s ON pr.ShopCode = s.ShopCode
    JOIN Shop_Bank_Accounts sba ON pr.ShopBankID = sba.ShopBankID
    WHERE pr.PayoutID = ?
  `,

  LIST_PAYOUTS_BY_SHOP: `
    SELECT pr.*, s.ShopName, sba.BankName, sba.AccountNumber
    FROM Payout_Requests pr
    JOIN Shops s ON pr.ShopCode = s.ShopCode
    JOIN Shop_Bank_Accounts sba ON pr.ShopBankID = sba.ShopBankID
    WHERE pr.ShopCode = ? {{STATUS}}
    ORDER BY pr.RequestedAt DESC
    LIMIT ? OFFSET ?
  `,

  COUNT_PAYOUTS_BY_SHOP: `
    SELECT COUNT(*) as total FROM Payout_Requests WHERE ShopCode = ? {{STATUS}}
  `,

  LIST_ALL_PAYOUTS: `
    SELECT pr.*, s.ShopName, s.UserID, u.FullName, sba.BankName, sba.AccountNumber, sba.AccountHolder, sba.IsDefault
    FROM Payout_Requests pr
    JOIN Shops s ON pr.ShopCode = s.ShopCode
    JOIN Users u ON s.UserID = u.UserID
    JOIN Shop_Bank_Accounts sba ON pr.ShopBankID = sba.ShopBankID
    WHERE 1=1 {{FILTERS}}
    ORDER BY pr.RequestedAt DESC
    LIMIT ? OFFSET ?
  `,

  COUNT_ALL_PAYOUTS: `
    SELECT COUNT(*) as total FROM Payout_Requests WHERE 1=1 {{FILTERS}}
  `,

  APPROVE_PAYOUT_REQUEST: `
    UPDATE Payout_Requests
    SET Status = 'paid',
        ProcessedAt = NOW(),
        TransactionCode = CONCAT('PAYOUT-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(?, 6, '0')),
        UpdateAt = NOW()
    WHERE PayoutID = ?
  `,

  COMPLETE_WALLET_TRANSACTION: `
    UPDATE Wallet_Transactions
    SET Status = 'completed'
    WHERE PayoutID = ? AND Type = 'debit_payout'
  `,

  REJECT_PAYOUT_REQUEST: `
    UPDATE Payout_Requests
    SET Status = 'rejected',
        RejectionReason = ?,
        ProcessedAt = NOW(),
        UpdateAt = NOW()
    WHERE PayoutID = ?
  `,

  GET_WALLET_STATS_BALANCE: `
    SELECT Balance FROM Shop_Wallets WHERE ShopCode = ?
  `,

  GET_TOTAL_CREDITED: `
    SELECT SUM(Amount) as total FROM Wallet_Transactions
    WHERE ShopCode = ? AND Type = 'credit_settlement' AND Status = 'completed'
  `,

  GET_TOTAL_DEBITED: `
    SELECT SUM(Amount) as total FROM Wallet_Transactions
    WHERE ShopCode = ? AND Type = 'debit_payout' AND Status = 'completed'
  `,
};
