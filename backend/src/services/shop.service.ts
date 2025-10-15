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

  async updateByUserId(
    userId: number,
    payload: {
      shop_name: string;
      address: string;
      bank_account_number?: string;
      bank_name?: string;
      bank_account_holder?: string;
    }
  ) {
    if (!Number.isFinite(userId)) return null;
    const result = await queryService.execTransaction(
      "shopService.updateByUserId",
      async (conn) => {
        const [shopRows] = await conn.query(
          `
            SELECT ShopCode
            FROM Shops
            WHERE UserID = ?
            LIMIT 1
          `,
          [userId]
        );
        let shopCode = Number(
          (shopRows as Array<{ ShopCode: number }>)?.[0]?.ShopCode ?? 0
        );
        
        // If no existing shop, create new one
        if (!shopCode) {
          const [insertRes] = await conn.query(
            `
              INSERT INTO Shops (UserID, ShopName, Address, IsApproved, CreateAt, UpdateAt)
              VALUES (?, ?, ?, 'Y', NOW(), NOW())
            `,
            [userId, payload.shop_name.trim(), payload.address.trim()]
          );
          // mysql2 ResultSetHeader
          shopCode = Number((insertRes as any)?.insertId ?? 0);
          if (!shopCode) return null;
        } else {
          // Update existing shop
          await conn.query(
            `
              UPDATE Shops
              SET ShopName = ?, Address = ?, UpdateAt = NOW()
              WHERE ShopCode = ?
            `,
            [payload.shop_name.trim(), payload.address.trim(), shopCode]
          );
        }

        if (
          (payload.bank_account_number && payload.bank_account_number.trim()) ||
          (payload.bank_name && payload.bank_name.trim()) ||
          (payload.bank_account_holder && payload.bank_account_holder.trim())
        ) {
          // Upsert default bank account for the shop
          const accountNumber = (payload.bank_account_number || "").trim();
          const bankName = (payload.bank_name || "").trim();
          const accountHolder =
            (payload.bank_account_holder || "").trim() ||
            payload.shop_name.trim();

          // Mark existing defaults as non-default
          await conn.query(
            `
              UPDATE Shop_Bank_Accounts
              SET IsDefault = 'N'
              WHERE ShopCode = ?
            `,
            [shopCode]
          );

          // Insert new default record
          await conn.query(
            `
              INSERT INTO Shop_Bank_Accounts (ShopCode, AccountNumber, BankName, AccountHolder, IsDefault)
              VALUES (?, ?, ?, ?, 'Y')
            `,
            [shopCode, accountNumber, bankName, accountHolder]
          );
        }

        return shopCode;
      }
    );

    if (!result) return null;
    return this.getByUserId(userId);
  },
};

export default shopService;
