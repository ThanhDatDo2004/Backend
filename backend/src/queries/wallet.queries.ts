// SQL templates cho wallet operations
export const WALLET_QUERIES = {
  // Lấy shop theo code
  GET_SHOP: `SELECT * FROM Shops WHERE ShopCode = ?`,

  // Lấy shop approved theo user
  GET_APPROVED_SHOP_BY_USER: `
    SELECT ShopCode FROM Shops 
    WHERE UserID = ? AND IsApproved = 'Y'
    LIMIT 1
  `,

  // Lấy shop bất kỳ theo user
  GET_SHOP_BY_USER: `
    SELECT ShopCode FROM Shops 
    WHERE UserID = ?
    LIMIT 1
  `,

  // Lấy balance
  GET_WALLET_BALANCE: `
    SELECT Balance FROM Shop_Wallets 
    WHERE ShopCode = ?
  `,

  // Lấy stats ví
  GET_WALLET_STATS: `
    SELECT Balance, TotalEarnings, TotalPayouts
    FROM Shop_Wallets
    WHERE ShopCode = ?
  `,

  LIST_TRANSACTIONS: `
    SELECT * FROM Wallet_Transactions
    WHERE ShopCode = ?
    ORDER BY CreateAt DESC
    LIMIT ? OFFSET ?
  `,

  COUNT_TRANSACTIONS: `
    SELECT COUNT(*) as total FROM Wallet_Transactions
    WHERE ShopCode = ?
  `,

  LIST_TRANSACTIONS_BY_TYPE: `
    SELECT * FROM Wallet_Transactions
    WHERE ShopCode = ? AND Type = ?
    ORDER BY CreateAt DESC
    LIMIT ? OFFSET ?
  `,
};
