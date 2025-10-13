import { ResultSetHeader, RowDataPacket } from "mysql2";
import queryService from "./query";

type UserRow = {
  user_code: number;
  level_code: number;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  password_hash: string | null;
  legacy_password: string | null;
  is_active: number | null;
};

type ShopRow = {
  shop_code: number;
  user_code: number;
  shop_name: string;
  address: string | null;
  isapproved: string | null;
};

type ShopBankRow = {
  shop_code: number;
  bank_name: string | null;
  bank_account_number: string | null;
  is_default: string | null;
};

type ShopRequestRow = {
  request_id: number;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  address: string | null;
  message: string | null;
  status: string | null;
  created_at: string | Date | null;
  processed_at: string | Date | null;
  admin_note: string | null;
  source: "applications" | "inbox";
};

const STATUS_MAP: Record<string, "pending" | "reviewed" | "approved" | "rejected"> =
  {
    submitted: "pending",
    pending: "pending",
    reviewed: "reviewed",
    approved: "approved",
    rejected: "rejected",
  };

const SHOP_LEVEL_FALLBACK = 2;

const ENSURE_INBOX_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS Shop_Request_Inbox (
    RequestID INT AUTO_INCREMENT PRIMARY KEY,
    FullName VARCHAR(255) NOT NULL,
    Email VARCHAR(190) NOT NULL,
    PhoneNumber VARCHAR(30) NOT NULL,
    Address VARCHAR(255) NOT NULL,
    Message TEXT NULL,
    Status ENUM('pending','reviewed','approved','rejected') NOT NULL DEFAULT 'pending',
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const ENSURE_APPLICATIONS_STATUS_SQL = `
  ALTER TABLE Shop_Applications
  MODIFY COLUMN Status ENUM('submitted','reviewed','approved','rejected') DEFAULT 'submitted'
`;

const COMBINED_SHOP_REQUESTS_QUERY = `
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
      r.RequestID AS request_id,
      COALESCE(u.FullName, r.ShopName) AS full_name,
      r.Email AS email,
      r.PhoneNumber AS phone_number,
      r.Address AS address,
      r.AdminNote AS message,
      r.Status AS status,
      r.CreateAt AS created_at,
      r.ProcessedAt AS processed_at,
      r.AdminNote AS admin_note,
      'applications' AS source
    FROM Shop_Applications r
    LEFT JOIN Users u ON u.UserID = r.ApplicantUserID
    UNION ALL
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
`;

function toBooleanInt(value: string | null | undefined) {
  return value === "Y" ? 1 : 0;
}

function normalizeStatus(value: string | null | undefined) {
  if (!value) return "pending";
  const key = value.toLowerCase();
  return STATUS_MAP[key as keyof typeof STATUS_MAP] ?? "pending";
}

function normalizeDate(input: string | Date | null | undefined) {
  if (!input) return "";
  if (input instanceof Date) return input.toISOString();
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return String(input);
  }
  return parsed.toISOString();
}

const adminService = {
  async listUsers() {
    const rows = await queryService.execQueryList(
      `
        SELECT
          u.UserID AS user_code,
          u.LevelCode AS level_code,
          u.FullName AS full_name,
          u.Email AS email,
          u.PhoneNumber AS phone_number,
          u.Password AS legacy_password,
          u.PasswordHash AS password_hash,
          u.IsActive AS is_active
        FROM Users u
        WHERE u._destroy IS NULL OR u._destroy = 0
        ORDER BY u.UserID DESC
      `,
      []
    );

    return rows.map(mapUserRow);
  },

  async listUserLevels() {
    const rows = await queryService.execQueryList(
      `
        SELECT
          LevelCode AS level_code,
          LevelType AS level_type,
          isActive AS is_active
        FROM Users_Level
        WHERE _destroy IS NULL OR _destroy = 0
        ORDER BY LevelCode ASC
      `,
      []
    );

    return rows.map((row: any) => ({
      level_code: Number(row.level_code),
      level_type: (row.level_type ?? "cus") as "cus" | "shop" | "admin",
      isActive: Number(row.is_active ?? 0) ? 1 : 0,
    }));
  },

  async updateUserStatus(userId: number, isActive: boolean) {
    const rows = (await queryService.execQueryList(
      `
        SELECT
          u.UserID AS user_code,
          u.LevelCode AS level_code,
          u.FullName AS full_name,
          u.Email AS email,
          u.PhoneNumber AS phone_number,
          u.Password AS legacy_password,
          u.PasswordHash AS password_hash,
          u.IsActive AS is_active
        FROM Users u
        WHERE u.UserID = ?
          AND (u._destroy IS NULL OR u._destroy = 0)
        LIMIT 1
      `,
      [userId]
    )) as UserRow[];

    const existing = rows?.[0];
    if (!existing) {
      return null;
    }

    await queryService.execQuery(
      `
        UPDATE Users
        SET IsActive = ?, UpdateAt = NOW()
        WHERE UserID = ?
        LIMIT 1
      `,
      [isActive ? 1 : 0, userId]
    );

    const updatedRows = (await queryService.execQueryList(
      `
        SELECT
          u.UserID AS user_code,
          u.LevelCode AS level_code,
          u.FullName AS full_name,
          u.Email AS email,
          u.PhoneNumber AS phone_number,
          u.Password AS legacy_password,
          u.PasswordHash AS password_hash,
          u.IsActive AS is_active
        FROM Users u
        WHERE u.UserID = ?
        LIMIT 1
      `,
      [userId]
    )) as UserRow[];

    const updated = updatedRows?.[0];
    if (!updated) {
      return null;
    }

    return mapUserRow(updated);
  },

  async listShops() {
    const shops = (await queryService.execQueryList(
      `
        SELECT
          s.ShopCode AS shop_code,
          s.UserID AS user_code,
          s.ShopName AS shop_name,
          s.Address AS address,
          s.IsApproved AS isapproved
        FROM Shops s
        ORDER BY s.ShopCode DESC
      `,
      []
    )) as ShopRow[];

    if (!shops.length) {
      return [];
    }

    const shopCodes = shops.map((shop) => shop.shop_code);

    const banks = (await queryService.execQueryList(
      `
        SELECT
          ShopCode AS shop_code,
          BankName AS bank_name,
          AccountNumber AS bank_account_number,
          IsDefault AS is_default
        FROM Shop_Bank_Accounts
        WHERE ShopCode IN (?)
        ORDER BY ShopCode, IsDefault DESC, ShopBankID ASC
      `,
      [shopCodes]
    )) as ShopBankRow[];

    const bankByShop = new Map<
      number,
      { bank_name: string; bank_account_number: string; isDefault: boolean }
    >();

    banks.forEach((bank) => {
      const normalized = {
        bank_name: bank.bank_name ?? "",
        bank_account_number: bank.bank_account_number ?? "",
        isDefault: (bank.is_default ?? "").toUpperCase() === "Y",
      };

      const existing = bankByShop.get(bank.shop_code);
      if (!existing) {
        bankByShop.set(bank.shop_code, normalized);
        return;
      }

      if (!existing.isDefault && normalized.isDefault) {
        bankByShop.set(bank.shop_code, normalized);
      }
    });

    return shops.map((shop) => {
      const bank = bankByShop.get(shop.shop_code);
      return {
        shop_code: shop.shop_code,
        user_code: shop.user_code,
        shop_name: shop.shop_name,
        address: shop.address ?? "",
        bank_name: bank?.bank_name ?? "",
        bank_account_number: bank?.bank_account_number ?? "",
        isapproved: toBooleanInt(shop.isapproved ?? null),
      };
    });
  },

  async listShopRequests() {
    await queryService.execQuery(ENSURE_INBOX_TABLE_SQL, []);

    const rows = await queryService.execQueryList(
      `${COMBINED_SHOP_REQUESTS_QUERY} ORDER BY created_at DESC, request_id DESC`,
      []
    );

    return (rows as ShopRequestRow[]).map(mapShopRequestRow);
  },

  async getShopRequestById(requestId: number) {
    await queryService.execQuery(ENSURE_INBOX_TABLE_SQL, []);

    const rows = (await queryService.execQueryList(
      `${COMBINED_SHOP_REQUESTS_QUERY} WHERE request_id = ? ORDER BY created_at DESC LIMIT 1`,
      [requestId]
    )) as ShopRequestRow[];

    const row = rows?.[0];
    if (!row) return null;

    return mapShopRequestRow(row);
  },

  async updateShopRequestStatus(
    requestId: number,
    status: "pending" | "reviewed" | "approved" | "rejected"
  ) {
    const updatedRow = await queryService.execTransaction<ShopRequestRow | null>(
      "update_shop_request_status",
      async (connection) => {
        await connection.query(ENSURE_INBOX_TABLE_SQL);
        try {
          await connection.query(ENSURE_APPLICATIONS_STATUS_SQL);
        } catch (error) {
          // ignore ALTER errors (column already in desired state)
        }

        const [existingRows] = await connection.query<RowDataPacket[]>(
          `${COMBINED_SHOP_REQUESTS_QUERY} WHERE request_id = ? LIMIT 1`,
          [requestId]
        );

        const existing = (existingRows?.[0] as ShopRequestRow | undefined) ?? null;
        if (!existing) {
          return null;
        }

        const requestEmail = existing.email?.trim() ?? "";

        if (status === "approved") {
          if (!requestEmail) {
            throw new Error("SHOP_REQUEST_EMAIL_REQUIRED");
          }

          const [userRows] = await connection.query<RowDataPacket[]>(
            `
              SELECT UserID, LevelCode
              FROM Users
              WHERE LOWER(Email) = LOWER(?)
              LIMIT 1
            `,
            [requestEmail.toLowerCase()]
          );

          const user = userRows?.[0];
          if (!user) {
            throw new Error("SHOP_REQUEST_USER_NOT_FOUND");
          }

          const [levelRows] = await connection.query<RowDataPacket[]>(
            `
              SELECT LevelCode
              FROM Users_Level
              WHERE LevelType = 'shop'
              LIMIT 1
            `
          );

          const targetLevelCode =
            Number(levelRows?.[0]?.LevelCode ?? SHOP_LEVEL_FALLBACK) ||
            SHOP_LEVEL_FALLBACK;

          if (Number(user.LevelCode) !== targetLevelCode) {
            await connection.query<ResultSetHeader>(
              `
                UPDATE Users
                SET LevelCode = ?, UpdateAt = NOW()
                WHERE UserID = ?
                LIMIT 1
              `,
              [targetLevelCode, user.UserID]
            );
          }
        }

        const [inboxUpdate] = await connection.query<ResultSetHeader>(
          `
            UPDATE Shop_Request_Inbox
            SET Status = ?
            WHERE RequestID = ?
          `,
          [status, requestId]
        );

        if (inboxUpdate.affectedRows > 0) {
          const [rows] = await connection.query<RowDataPacket[]>(
            `${COMBINED_SHOP_REQUESTS_QUERY} WHERE request_id = ? LIMIT 1`,
            [requestId]
          );
          return (rows?.[0] as ShopRequestRow) ?? null;
        }

        const statusForApplications =
          status === "pending" ? "submitted" : status;

        const processedAtExpr =
          status === "approved" || status === "rejected"
            ? "NOW()"
            : status === "pending"
            ? "NULL"
            : "ProcessedAt";

        const [appUpdate] = await connection.query<ResultSetHeader>(
          `
            UPDATE Shop_Applications
            SET Status = ?, ProcessedAt = ${processedAtExpr}
            WHERE RequestID = ?
          `,
          [statusForApplications, requestId]
        );

        if (appUpdate.affectedRows === 0) {
          return null;
        }

        const [rows] = await connection.query<RowDataPacket[]>(
          `${COMBINED_SHOP_REQUESTS_QUERY} WHERE request_id = ? LIMIT 1`,
          [requestId]
        );
        return (rows?.[0] as ShopRequestRow) ?? null;
      }
    );

    return updatedRow ? mapShopRequestRow(updatedRow) : null;
  },
};

export default adminService;

function mapUserRow(row: UserRow) {
  return {
    user_code: Number(row.user_code),
    level_code: Number(row.level_code),
    user_name: row.full_name ?? "",
    user_id: row.email ?? "",
    user_password: row.legacy_password ?? row.password_hash ?? "",
    email: row.email ?? "",
    phone_number: row.phone_number ?? "",
    isActive: Number(row.is_active ?? 0) ? 1 : 0,
  };
}

function mapShopRequestRow(row: ShopRequestRow) {
  return {
    request_id: Number(row.request_id),
    full_name: row.full_name ?? "",
    email: row.email ?? "",
    phone_number: row.phone_number ?? "",
    address: row.address ?? "",
    message: row.message ?? row.admin_note ?? "",
    created_at: normalizeDate(row.created_at),
    status: normalizeStatus(row.status),
  };
}
