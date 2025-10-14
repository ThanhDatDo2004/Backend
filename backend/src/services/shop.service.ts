import queryService from "./query";

const shopService = {
  async getByUserId(userId: number) {
    if (!Number.isFinite(userId)) return null;
    const rows = await queryService.execQueryList(
      `
        SELECT
          s.ShopCode AS shop_code,
          s.UserID AS user_id,
          s.ShopName AS shop_name,
          s.Address AS address,
          s.IsApproved AS is_approved,
          s.CreateAt AS created_at,
          s.UpdateAt AS updated_at,
          s.ApprovedAt AS approved_at,
          COALESCE(
            sb.AccountNumber,
            ''
          ) AS bank_account_number,
          COALESCE(sb.BankName, '') AS bank_name
        FROM Shops s
        LEFT JOIN Shop_Bank_Accounts sb
          ON sb.ShopCode = s.ShopCode
         AND (sb.IsDefault = 'Y' OR sb.IsDefault IS NULL)
        WHERE s.UserID = ?
        ORDER BY s.ShopCode ASC
        LIMIT 1
      `,
      [userId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      shop_code: Number(row.shop_code),
      user_code: Number(row.user_id),
      shop_name: row.shop_name ?? "",
      address: row.address ?? "",
      bank_account_number: row.bank_account_number ?? "",
      bank_name: row.bank_name ?? "",
      isapproved: row.is_approved === "Y" ? 1 : 0,
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
      approved_at: row.approved_at ?? null,
    };
  },

  async getByCode(shopCode: number) {
    if (!Number.isFinite(shopCode)) return null;
    const rows = await queryService.execQueryList(
      `
        SELECT
          s.ShopCode AS shop_code,
          s.UserID AS user_id,
          s.ShopName AS shop_name,
          s.Address AS address,
          s.IsApproved AS is_approved,
          s.CreateAt AS created_at,
          s.UpdateAt AS updated_at,
          s.ApprovedAt AS approved_at,
          COALESCE(
            sb.AccountNumber,
            ''
          ) AS bank_account_number,
          COALESCE(sb.BankName, '') AS bank_name
        FROM Shops s
        LEFT JOIN Shop_Bank_Accounts sb
          ON sb.ShopCode = s.ShopCode
         AND (sb.IsDefault = 'Y' OR sb.IsDefault IS NULL)
        WHERE s.ShopCode = ?
        LIMIT 1
      `,
      [shopCode]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      shop_code: Number(row.shop_code),
      user_code: Number(row.user_id),
      shop_name: row.shop_name ?? "",
      address: row.address ?? "",
      bank_account_number: row.bank_account_number ?? "",
      bank_name: row.bank_name ?? "",
      isapproved: row.is_approved === "Y" ? 1 : 0,
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
      approved_at: row.approved_at ?? null,
    };
  },
};

export default shopService;
