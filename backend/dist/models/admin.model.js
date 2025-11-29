"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const query_1 = __importDefault(require("../services/query"));
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
    async listUsers() {
        const rows = await query_1.default.execQueryList(`
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
      `, []);
        return rows;
    },
    /**
     * List all user levels
     */
    async listUserLevels() {
        const rows = await query_1.default.execQueryList(`
        SELECT
          LevelCode AS level_code,
          LevelType AS level_type,
          isActive AS is_active
        FROM Users_Level
        WHERE _destroy IS NULL OR _destroy = 0
        ORDER BY LevelCode ASC
      `, []);
        return rows.map((row) => ({
            level_code: Number(row.level_code),
            level_type: (row.level_type ?? "cus"),
            isActive: Number(row.is_active ?? 0) ? 1 : 0,
        }));
    },
    /**
     * Get user by ID
     */
    async getUserById(userId) {
        const rows = (await query_1.default.execQueryList(`
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
      `, [userId]));
        return rows?.[0] || null;
    },
    /**
     * Update user status
     */
    async updateUserStatus(userId, isActive) {
        await query_1.default.execQuery(`
        UPDATE Users
        SET IsActive = ?, UpdateAt = NOW()
        WHERE UserID = ?
        LIMIT 1
      `, [isActive ? 1 : 0, userId]);
        await query_1.default.execQuery(`UPDATE Shops
        SET IsApproved =?, UpdateAt = NOW()
        WHERE UserID = ?
        `, [isActive ? "Y" : "N", userId]);
    },
    /**
     * List all shops with bank details
     */
    async listShops() {
        const shops = (await query_1.default.execQueryList(`
        SELECT
          s.ShopCode AS shop_code,
          s.UserID AS user_code,
          s.ShopName AS shop_name,
          s.Address AS address,
          s.PhoneNumber AS phone_number,
          s.IsApproved AS isapproved
        FROM Shops s
        ORDER BY s.ShopCode DESC
      `, []));
        return shops;
    },
    /**
     * Get shop banks
     */
    async getShopBanks(shopCodes) {
        if (!shopCodes.length)
            return [];
        const banks = (await query_1.default.execQueryList(`
        SELECT
          ShopCode AS shop_code,
          BankName AS bank_name,
          AccountNumber AS bank_account_number,
          IsDefault AS is_default
        FROM Shop_Bank_Accounts
        WHERE ShopCode IN (?)
        ORDER BY ShopCode, IsDefault DESC, ShopBankID ASC
      `, [shopCodes]));
        return banks;
    },
    /**
     * Ensure shop request inbox table exists
     */
    async ensureInboxTable() {
        await query_1.default.execQuery(ENSURE_INBOX_TABLE_SQL, []);
    },
    /**
     * List all shop requests
     */
    async listShopRequests() {
        await adminModel.ensureInboxTable();
        const rows = await query_1.default.execQueryList(`${COMBINED_SHOP_REQUESTS_QUERY} ORDER BY created_at DESC, request_id DESC`, []);
        return rows;
    },
    /**
     * Get shop request by ID
     */
    async getShopRequestById(requestId) {
        await adminModel.ensureInboxTable();
        const rows = (await query_1.default.execQueryList(`${COMBINED_SHOP_REQUESTS_QUERY} WHERE request_id = ? ORDER BY created_at DESC LIMIT 1`, [requestId]));
        return rows?.[0] || null;
    },
    /**
     * List finance bookings with filters
     */
    async listFinanceBookings(startDate, endDate, fieldCode, customerUserID, bookingStatus, limit = 10, offset = 0) {
        const clauses = [];
        const params = [];
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
        const items = (await query_1.default.execQueryList(`SELECT
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
       LIMIT ? OFFSET ?`, [...params, limit, offset]));
        return items;
    },
    /**
     * Get finance summary
     */
    async getFinanceSummary(startDate, endDate, fieldCode, customerUserID, bookingStatus) {
        const clauses = [];
        const params = [];
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
        const summaryRows = (await query_1.default.execQueryList(`SELECT
         COUNT(*) AS total_bookings,
         COALESCE(SUM(CASE WHEN b.BookingStatus = 'confirmed' THEN 1 ELSE 0 END), 0) AS confirmed_bookings,
         COALESCE(SUM(CASE WHEN b.PaymentStatus = 'paid' THEN 1 ELSE 0 END), 0) AS paid_bookings,
         COALESCE(SUM(b.TotalPrice), 0) AS total_revenue,
         COALESCE(SUM(b.PlatformFee), 0) AS platform_fee,
         COALESCE(SUM(b.NetToShop), 0) AS net_to_shop
       FROM Bookings b
       WHERE ${whereClause}`, params));
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
    async countFinanceBookings(startDate, endDate, fieldCode, customerUserID, bookingStatus) {
        const clauses = [];
        const params = [];
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
        const countRows = (await query_1.default.execQueryList(`SELECT COUNT(*) AS total FROM Bookings b WHERE ${whereClause}`, params));
        return Number(countRows?.[0]?.total ?? 0);
    },
    /**
     * Get finance bookings summary
     */
    async getFinanceBookingsSummary(startDate, endDate, fieldCode, customerUserID, bookingStatus) {
        const clauses = [];
        const params = [];
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
        const summaryRows = (await query_1.default.execQueryList(`SELECT
         COUNT(*) AS total_records,
         COALESCE(SUM(b.TotalPrice), 0) AS total_total_price,
         COALESCE(SUM(b.PlatformFee), 0) AS total_platform_fee,
         COALESCE(SUM(b.NetToShop), 0) AS total_net_to_shop,
         COALESCE(SUM(CASE WHEN b.CheckinCode IS NOT NULL AND b.CheckinCode <> '' THEN 1 ELSE 0 END), 0) AS total_checkins,
         COALESCE(SUM(CASE WHEN b.QuantityID IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_quantity_ids,
         DATE_FORMAT(MIN(b.CreateAt), '%Y-%m-%d %H:%i:%s') AS first_create_at,
         DATE_FORMAT(MAX(b.CreateAt), '%Y-%m-%d %H:%i:%s') AS last_create_at
       FROM Bookings b
       WHERE ${whereClause}`, params));
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
    async updateShopRequestStatus(requestId, status) {
        return await query_1.default.execTransaction("admin_update_shop_request_status", async (connection) => {
            // Ensure inbox table exists
            await connection.query(`CREATE TABLE IF NOT EXISTS Shop_Request_Inbox (
            RequestID INT AUTO_INCREMENT PRIMARY KEY,
            FullName VARCHAR(255) NOT NULL,
            Email VARCHAR(190) NOT NULL,
            PhoneNumber VARCHAR(30) NOT NULL,
            Address VARCHAR(255) NOT NULL,
            Message TEXT NULL,
            Status ENUM('pending','reviewed','approved','rejected') NOT NULL DEFAULT 'pending',
            CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
            // Get existing request
            const [existingRows] = await connection.query(`SELECT
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
           LIMIT 1`, [requestId]);
            const existing = existingRows?.[0] ?? null;
            if (!existing) {
                return null;
            }
            const requestEmail = existing.email?.trim() ?? "";
            // If approving, update user level
            if (status === "approved") {
                if (!requestEmail) {
                    throw new Error("SHOP_REQUEST_EMAIL_REQUIRED");
                }
                const [userRows] = await connection.query(`SELECT UserID, LevelCode
             FROM Users
             WHERE LOWER(Email) = LOWER(?)
             LIMIT 1`, [requestEmail.toLowerCase()]);
                const user = userRows?.[0];
                if (!user) {
                    throw new Error("SHOP_REQUEST_USER_NOT_FOUND");
                }
                const [levelRows] = await connection.query(`SELECT LevelCode
             FROM Users_Level
             WHERE LevelType = 'shop'
             LIMIT 1`);
                const SHOP_LEVEL_FALLBACK = 2;
                const targetLevelCode = Number(levelRows?.[0]?.LevelCode ?? SHOP_LEVEL_FALLBACK) ||
                    SHOP_LEVEL_FALLBACK;
                if (Number(user.LevelCode) !== targetLevelCode) {
                    await connection.query(`UPDATE Users
               SET LevelCode = ?, UpdateAt = NOW()
               WHERE UserID = ?
               LIMIT 1`, [targetLevelCode, user.UserID]);
                }
            }
            // Update request status
            const [inboxUpdate] = await connection.query(`UPDATE Shop_Request_Inbox
           SET Status = ?
           WHERE RequestID = ?`, [status, requestId]);
            if (inboxUpdate.affectedRows > 0) {
                const [rows] = await connection.query(`SELECT
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
             LIMIT 1`, [requestId]);
                return rows?.[0] ?? null;
            }
            return null;
        });
    },
};
exports.default = adminModel;
