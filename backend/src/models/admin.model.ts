import type { ResultSetHeader, RowDataPacket } from "mysql2";
import queryService from "../services/query";

// ============ TYPES ============
export type UserRow = {
  user_code: number;
  level_code: number;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  password_hash: string | null;
  legacy_password: string | null;
  is_active: number | null;
};

export type ShopRow = {
  shop_code: number;
  user_code: number;
  shop_name: string;
  address: string | null;
  isapproved: string | null;
};

export type ShopBankRow = {
  shop_code: number;
  bank_name: string | null;
  bank_account_number: string | null;
  is_default: string | null;
};

export type ShopRequestRow = {
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
  source: "inbox";
};

export type FinanceBookingRow = {
  booking_code: number;
  field_code: number;
  field_name: string | null;
  customer_user_id: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  total_price: number;
  platform_fee: number;
  net_to_shop: number;
  booking_status: string | null;
  payment_status: string | null;
  checkin_code: string | null;
  create_at: string | null;
  quantity_id: number | null;
};

// ============ CONSTANTS ============
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

// ============ ADMIN MODEL ============
const adminModel = {
  /**
   * List all users
   */
  async listUsers(): Promise<UserRow[]> {
    const rows = await queryService.execQueryList(
      `
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
      []
    );

    return rows as UserRow[];
  },

  /**
   * List all user levels
   */
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

  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<UserRow | null> {
    const rows = (await queryService.execQueryList(
      `
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
      [userId]
    )) as UserRow[];

    return rows?.[0] || null;
  },

  /**
   * Update user status
   */
  async updateUserStatus(userId: number, isActive: boolean): Promise<void> {
    await queryService.execQuery(
      `
        UPDATE Users
        SET IsActive = ?, UpdateAt = NOW()
        WHERE UserID = ?
        LIMIT 1
      `,
      [isActive ? 1 : 0, userId]
    );

    await queryService.execQuery(
      `UPDATE Shops
        SET IsApproved =?, UpdateAt = NOW()
        WHERE UserID = ?
        `,
      [isActive ? "Y" : "N", userId]
    );
  },

  /**
   * List all shops with bank details
   */
  async listShops(): Promise<ShopRow[]> {
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

    return shops;
  },

  /**
   * Get shop banks
   */
  async getShopBanks(shopCodes: number[]): Promise<ShopBankRow[]> {
    if (!shopCodes.length) return [];

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

    return banks;
  },

  /**
   * Ensure shop request inbox table exists
   */
  async ensureInboxTable(): Promise<void> {
    await queryService.execQuery(ENSURE_INBOX_TABLE_SQL, []);
  },

  /**
   * List all shop requests
   */
  async listShopRequests(): Promise<ShopRequestRow[]> {
    await adminModel.ensureInboxTable();

    const rows = await queryService.execQueryList(
      `${COMBINED_SHOP_REQUESTS_QUERY} ORDER BY created_at DESC, request_id DESC`,
      []
    );

    return rows as ShopRequestRow[];
  },

  /**
   * Get shop request by ID
   */
  async getShopRequestById(requestId: number): Promise<ShopRequestRow | null> {
    await adminModel.ensureInboxTable();

    const rows = (await queryService.execQueryList(
      `${COMBINED_SHOP_REQUESTS_QUERY} WHERE request_id = ? ORDER BY created_at DESC LIMIT 1`,
      [requestId]
    )) as ShopRequestRow[];

    return rows?.[0] || null;
  },

  /**
   * List finance bookings with filters
   */
  async listFinanceBookings(
    startDate?: string,
    endDate?: string,
    fieldCode?: number,
    customerUserID?: number,
    bookingStatus?: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<FinanceBookingRow[]> {
    const clauses: string[] = [];
    const params: any[] = [];

    if (startDate) {
      clauses.push("b.CreateAt >= ?");
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      clauses.push("b.CreateAt <= ?");
      params.push(`${endDate} 23:59:59`);
    }

    if (fieldCode) {
      clauses.push("b.FieldCode = ?");
      params.push(fieldCode);
    }

    if (customerUserID) {
      clauses.push("b.CustomerUserID = ?");
      params.push(customerUserID);
    }

    if (bookingStatus) {
      clauses.push("b.BookingStatus = ?");
      params.push(bookingStatus);
    }

    const whereClause = clauses.length ? clauses.join(" AND ") : "1=1";

    const items = (await queryService.execQueryList(
      `SELECT
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
       WHERE ${whereClause}
       ORDER BY b.CreateAt DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )) as FinanceBookingRow[];

    return items;
  },

  /**
   * Get finance summary
   */
  async getFinanceSummary(
    startDate?: string,
    endDate?: string,
    fieldCode?: number,
    customerUserID?: number,
    bookingStatus?: string
  ) {
    const clauses: string[] = [];
    const params: any[] = [];

    if (startDate) {
      clauses.push("b.CreateAt >= ?");
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      clauses.push("b.CreateAt <= ?");
      params.push(`${endDate} 23:59:59`);
    }

    if (fieldCode) {
      clauses.push("b.FieldCode = ?");
      params.push(fieldCode);
    }

    if (customerUserID) {
      clauses.push("b.CustomerUserID = ?");
      params.push(customerUserID);
    }

    if (bookingStatus) {
      clauses.push("b.BookingStatus = ?");
      params.push(bookingStatus);
    }

    const whereClause = clauses.length ? clauses.join(" AND ") : "1=1";

    const summaryRows = (await queryService.execQueryList(
      `SELECT
         COUNT(*) AS total_bookings,
         COALESCE(SUM(CASE WHEN b.BookingStatus = 'confirmed' THEN 1 ELSE 0 END), 0) AS confirmed_bookings,
         COALESCE(SUM(CASE WHEN b.PaymentStatus = 'paid' THEN 1 ELSE 0 END), 0) AS paid_bookings,
         COALESCE(SUM(b.TotalPrice), 0) AS total_revenue,
         COALESCE(SUM(b.PlatformFee), 0) AS platform_fee,
         COALESCE(SUM(b.NetToShop), 0) AS net_to_shop
       FROM Bookings b
       WHERE ${whereClause}`,
      params
    )) as Array<{
      total_bookings: number;
      confirmed_bookings: number;
      paid_bookings: number;
      total_revenue: number;
      platform_fee: number;
      net_to_shop: number;
    }>;

    const summary = summaryRows?.[0] || {
      total_bookings: 0,
      confirmed_bookings: 0,
      paid_bookings: 0,
      total_revenue: 0,
      platform_fee: 0,
      net_to_shop: 0,
    };

    return {
      total_bookings: Number(summary.total_bookings),
      confirmed_bookings: Number(summary.confirmed_bookings),
      paid_bookings: Number(summary.paid_bookings),
      total_revenue: Number(summary.total_revenue),
      platform_fee: Number(summary.platform_fee),
      net_to_shop: Number(summary.net_to_shop),
    };
  },

  /**
   * Count finance bookings
   */
  async countFinanceBookings(
    startDate?: string,
    endDate?: string,
    fieldCode?: number,
    customerUserID?: number,
    bookingStatus?: string
  ): Promise<number> {
    const clauses: string[] = [];
    const params: any[] = [];

    if (startDate) {
      clauses.push("b.CreateAt >= ?");
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      clauses.push("b.CreateAt <= ?");
      params.push(`${endDate} 23:59:59`);
    }

    if (fieldCode) {
      clauses.push("b.FieldCode = ?");
      params.push(fieldCode);
    }

    if (customerUserID) {
      clauses.push("b.CustomerUserID = ?");
      params.push(customerUserID);
    }

    if (bookingStatus) {
      clauses.push("b.BookingStatus = ?");
      params.push(bookingStatus);
    }

    const whereClause = clauses.length ? clauses.join(" AND ") : "1=1";

    const countRows = (await queryService.execQueryList(
      `SELECT COUNT(*) AS total FROM Bookings b WHERE ${whereClause}`,
      params
    )) as Array<{ total: number }>;

    return Number(countRows?.[0]?.total ?? 0);
  },

  /**
   * Get finance bookings summary
   */
  async getFinanceBookingsSummary(
    startDate?: string,
    endDate?: string,
    fieldCode?: number,
    customerUserID?: number,
    bookingStatus?: string
  ) {
    const clauses: string[] = [];
    const params: any[] = [];

    if (startDate) {
      clauses.push("b.CreateAt >= ?");
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      clauses.push("b.CreateAt <= ?");
      params.push(`${endDate} 23:59:59`);
    }

    if (fieldCode) {
      clauses.push("b.FieldCode = ?");
      params.push(fieldCode);
    }

    if (customerUserID) {
      clauses.push("b.CustomerUserID = ?");
      params.push(customerUserID);
    }

    if (bookingStatus) {
      clauses.push("b.BookingStatus = ?");
      params.push(bookingStatus);
    }

    const whereClause = clauses.length ? clauses.join(" AND ") : "1=1";

    const summaryRows = (await queryService.execQueryList(
      `SELECT
         COUNT(*) AS total_records,
         COALESCE(SUM(b.TotalPrice), 0) AS total_total_price,
         COALESCE(SUM(b.PlatformFee), 0) AS total_platform_fee,
         COALESCE(SUM(b.NetToShop), 0) AS total_net_to_shop,
         COALESCE(SUM(CASE WHEN b.CheckinCode IS NOT NULL AND b.CheckinCode <> '' THEN 1 ELSE 0 END), 0) AS total_checkins,
         COALESCE(SUM(CASE WHEN b.QuantityID IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_quantity_ids,
         DATE_FORMAT(MIN(b.CreateAt), '%Y-%m-%d %H:%i:%s') AS first_create_at,
         DATE_FORMAT(MAX(b.CreateAt), '%Y-%m-%d %H:%i:%s') AS last_create_at
       FROM Bookings b
       WHERE ${whereClause}`,
      params
    )) as Array<{
      total_records?: number | null;
      total_total_price?: number | null;
      total_platform_fee?: number | null;
      total_net_to_shop?: number | null;
      total_checkins?: number | null;
      total_quantity_ids?: number | null;
      first_create_at?: string | null;
      last_create_at?: string | null;
    }>;

    const summaryRow = summaryRows?.[0] ?? {};

    return {
      total_records: Number(summaryRow.total_records ?? 0),
      total_total_price: Number(summaryRow.total_total_price ?? 0),
      total_platform_fee: Number(summaryRow.total_platform_fee ?? 0),
      total_net_to_shop: Number(summaryRow.total_net_to_shop ?? 0),
      total_checkins: Number(summaryRow.total_checkins ?? 0),
      total_quantity_ids: Number(summaryRow.total_quantity_ids ?? 0),
      first_create_at: summaryRow.first_create_at ?? null,
      last_create_at: summaryRow.last_create_at ?? null,
    };
  },

  /**
   * Update shop request status (with transaction support)
   */
  async updateShopRequestStatus(
    requestId: number,
    status: "pending" | "reviewed" | "approved" | "rejected"
  ) {
    return await queryService.execTransaction<ShopRequestRow | null>(
      "admin_update_shop_request_status",
      async (connection) => {
        // Ensure inbox table exists
        await connection.query(
          `CREATE TABLE IF NOT EXISTS Shop_Request_Inbox (
            RequestID INT AUTO_INCREMENT PRIMARY KEY,
            FullName VARCHAR(255) NOT NULL,
            Email VARCHAR(190) NOT NULL,
            PhoneNumber VARCHAR(30) NOT NULL,
            Address VARCHAR(255) NOT NULL,
            Message TEXT NULL,
            Status ENUM('pending','reviewed','approved','rejected') NOT NULL DEFAULT 'pending',
            CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        );

        // Get existing request
        const [existingRows] = await connection.query<RowDataPacket[]>(
          `SELECT
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
           LIMIT 1`,
          [requestId]
        );

        const existing =
          (existingRows?.[0] as ShopRequestRow | undefined) ?? null;
        if (!existing) {
          return null;
        }

        const requestEmail = existing.email?.trim() ?? "";

        // If approving, update user level
        if (status === "approved") {
          if (!requestEmail) {
            throw new Error("SHOP_REQUEST_EMAIL_REQUIRED");
          }

          const [userRows] = await connection.query<RowDataPacket[]>(
            `SELECT UserID, LevelCode
             FROM Users
             WHERE LOWER(Email) = LOWER(?)
             LIMIT 1`,
            [requestEmail.toLowerCase()]
          );

          const user = userRows?.[0];
          if (!user) {
            throw new Error("SHOP_REQUEST_USER_NOT_FOUND");
          }

          const [levelRows] = await connection.query<RowDataPacket[]>(
            `SELECT LevelCode
             FROM Users_Level
             WHERE LevelType = 'shop'
             LIMIT 1`
          );

          const SHOP_LEVEL_FALLBACK = 2;
          const targetLevelCode =
            Number(levelRows?.[0]?.LevelCode ?? SHOP_LEVEL_FALLBACK) ||
            SHOP_LEVEL_FALLBACK;

          if (Number(user.LevelCode) !== targetLevelCode) {
            await connection.query<ResultSetHeader>(
              `UPDATE Users
               SET LevelCode = ?, UpdateAt = NOW()
               WHERE UserID = ?
               LIMIT 1`,
              [targetLevelCode, user.UserID]
            );
          }
        }

        // Update request status
        const [inboxUpdate] = await connection.query<ResultSetHeader>(
          `UPDATE Shop_Request_Inbox
           SET Status = ?
           WHERE RequestID = ?`,
          [status, requestId]
        );

        if (inboxUpdate.affectedRows > 0) {
          const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT
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
             LIMIT 1`,
            [requestId]
          );
          return (rows?.[0] as ShopRequestRow) ?? null;
        }

        return null;
      }
    );
  },
};

export default adminModel;
