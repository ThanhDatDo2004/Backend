import type { ResultSetHeader, RowDataPacket } from "mysql2";
import queryService from "../core/database";
import { ADMIN_QUERIES } from "../queries/admin.queries";

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
      ADMIN_QUERIES.LIST_USERS,
      []
    );

    return rows as UserRow[];
  },

  /**
   * List all user levels
   */
  async listUserLevels() {
    const rows = await queryService.execQueryList(
      ADMIN_QUERIES.LIST_USER_LEVELS,
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
      ADMIN_QUERIES.GET_USER_BY_ID,
      [userId]
    )) as UserRow[];

    return rows?.[0] || null;
  },

  /**
   * Update user status
   */
  async updateUserStatus(userId: number, isActive: boolean): Promise<void> {
    await queryService.execQuery(
      ADMIN_QUERIES.UPDATE_USER_STATUS,
      [isActive ? 1 : 0, userId]
    );

    await queryService.execQuery(
      ADMIN_QUERIES.UPDATE_SHOP_STATUS,
      [isActive ? "Y" : "N", userId]
    );
  },

  /**
   * List all shops with bank details
   */
  async listShops(): Promise<ShopRow[]> {
    const shops = (await queryService.execQueryList(
      ADMIN_QUERIES.LIST_SHOPS,
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
      ADMIN_QUERIES.GET_SHOP_BANKS,
      [shopCodes]
    )) as ShopBankRow[];

    return banks;
  },

  /**
   * Ensure shop request inbox table exists
   */
  async ensureInboxTable(): Promise<void> {
    await queryService.execQuery(ADMIN_QUERIES.ENSURE_INBOX_TABLE, []);
  },

  /**
   * List all shop requests
   */
  async listShopRequests(): Promise<ShopRequestRow[]> {
    await adminModel.ensureInboxTable();

    const rows = await queryService.execQueryList(
      `${ADMIN_QUERIES.LIST_SHOP_REQUESTS}`,
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
      `${ADMIN_QUERIES.GET_SHOP_REQUEST_BY_ID}`,
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
    const query = ADMIN_QUERIES.LIST_FINANCE_BOOKINGS.replace("{{WHERE}}", whereClause);

    const items = (await queryService.execQueryList(
      query,
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
    const query = ADMIN_QUERIES.GET_FINANCE_SUMMARY.replace("{{WHERE}}", whereClause);

    const summaryRows = (await queryService.execQueryList(
      query,
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
    const query = ADMIN_QUERIES.COUNT_FINANCE_BOOKINGS.replace("{{WHERE}}", whereClause);

    const countRows = (await queryService.execQueryList(
      query,
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
    const query = ADMIN_QUERIES.GET_FINANCE_BOOKINGS_SUMMARY.replace("{{WHERE}}", whereClause);

    const summaryRows = (await queryService.execQueryList(
      query,
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
        await connection.query(ADMIN_QUERIES.ENSURE_INBOX_TABLE_TX);

        // Get existing request
        const [existingRows] = await connection.query<RowDataPacket[]>(
          ADMIN_QUERIES.GET_INBOX_REQUEST,
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
            ADMIN_QUERIES.GET_USER_BY_EMAIL,
            [requestEmail.toLowerCase()]
          );

          const user = userRows?.[0];
          if (!user) {
            throw new Error("SHOP_REQUEST_USER_NOT_FOUND");
          }

          const [levelRows] = await connection.query<RowDataPacket[]>(
            ADMIN_QUERIES.GET_SHOP_LEVEL
          );

          const SHOP_LEVEL_FALLBACK = 2;
          const targetLevelCode =
            Number(levelRows?.[0]?.LevelCode ?? SHOP_LEVEL_FALLBACK) ||
            SHOP_LEVEL_FALLBACK;

          if (Number(user.LevelCode) !== targetLevelCode) {
            await connection.query<ResultSetHeader>(
              ADMIN_QUERIES.UPDATE_USER_LEVEL,
              [targetLevelCode, user.UserID]
            );
          }
        }

        // Update request status
        const [inboxUpdate] = await connection.query<ResultSetHeader>(
          ADMIN_QUERIES.UPDATE_INBOX_REQUEST_STATUS,
          [status, requestId]
        );

        if (inboxUpdate.affectedRows > 0) {
          const [rows] = await connection.query<RowDataPacket[]>(
            ADMIN_QUERIES.GET_UPDATED_INBOX_REQUEST,
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
