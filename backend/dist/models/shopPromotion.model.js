"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const query_1 = __importDefault(require("../services/query"));
// ============ SHOP PROMOTION MODEL ============
const shopPromotionModel = {
    /**
     * List all promotions by shop
     */
    async listByShop(shopCode) {
        const [rows] = await query_1.default.query(`SELECT p.*,
              COALESCE(b.TotalUsage, 0) AS UsageCount
       FROM Shop_Promotions p
       LEFT JOIN (
         SELECT PromotionID, COUNT(*) AS TotalUsage
         FROM Bookings
         WHERE BookingStatus IN ('pending','confirmed','completed')
           AND PromotionID IS NOT NULL
         GROUP BY PromotionID
       ) b ON b.PromotionID = p.PromotionID
       WHERE p.ShopCode = ? AND p.IsDeleted = 0
       ORDER BY p.CreateAt DESC`, [shopCode]);
        return rows || [];
    },
    /**
     * Get promotion by ID and shop
     */
    async getById(shopCode, promotionId) {
        const [rows] = await query_1.default.query(`SELECT p.*,
              COALESCE(b.TotalUsage, 0) AS UsageCount
       FROM Shop_Promotions p
       LEFT JOIN (
         SELECT PromotionID, COUNT(*) AS TotalUsage
         FROM Bookings
         WHERE PromotionID = ? AND BookingStatus IN ('pending','confirmed','completed')
         GROUP BY PromotionID
       ) b ON b.PromotionID = p.PromotionID
       WHERE p.ShopCode = ? AND p.PromotionID = ? AND p.IsDeleted = 0
       LIMIT 1`, [promotionId, shopCode, promotionId]);
        return rows?.[0] || null;
    },
    /**
     * Create promotion (within transaction)
     */
    async create(connection, shopCode, payload) {
        const [result] = await connection.query(`INSERT INTO Shop_Promotions (
         ShopCode,
         PromotionCode,
         Title,
         Description,
         DiscountType,
         DiscountValue,
         MaxDiscountAmount,
         MinOrderAmount,
         UsageLimit,
         UsagePerCustomer,
         StartAt,
         EndAt,
         Status,
         CreateAt,
         UpdateAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`, [
            shopCode,
            payload.promotion_code,
            payload.title,
            payload.description,
            payload.discount_type,
            payload.discount_value,
            payload.max_discount_amount,
            payload.min_order_amount,
            payload.usage_limit,
            payload.usage_per_customer,
            payload.start_at,
            payload.end_at,
            payload.status,
        ]);
        return Number(result.insertId);
    },
    /**
     * Check code exists
     */
    async codeExists(connection, shopCode, promotionCode, excludeId) {
        let query = `SELECT PromotionID FROM Shop_Promotions WHERE ShopCode = ? AND PromotionCode = ?`;
        const params = [shopCode, promotionCode];
        if (excludeId) {
            query += ` AND PromotionID <> ?`;
            params.push(excludeId);
        }
        query += ` LIMIT 1`;
        const [rows] = await connection.query(query, params);
        return !!rows?.[0];
    },
    /**
     * Update promotion
     */
    async update(connection, shopCode, promotionId, payload) {
        await connection.query(`UPDATE Shop_Promotions
       SET PromotionCode = ?,
           Title = ?,
           Description = ?,
           DiscountType = ?,
           DiscountValue = ?,
           MaxDiscountAmount = ?,
           MinOrderAmount = ?,
           UsageLimit = ?,
           UsagePerCustomer = ?,
           StartAt = ?,
           EndAt = ?,
           Status = ?,
           UpdateAt = NOW()
       WHERE ShopCode = ? AND PromotionID = ? AND IsDeleted = 0`, [
            payload.promotion_code,
            payload.title,
            payload.description,
            payload.discount_type,
            payload.discount_value,
            payload.max_discount_amount,
            payload.min_order_amount,
            payload.usage_limit,
            payload.usage_per_customer,
            payload.start_at,
            payload.end_at,
            payload.status,
            shopCode,
            promotionId,
        ]);
    },
    /**
     * Update status
     */
    async updateStatus(shopCode, promotionId, status) {
        await query_1.default.execQuery(`UPDATE Shop_Promotions
       SET Status = ?, UpdateAt = NOW()
       WHERE ShopCode = ? AND PromotionID = ? AND IsDeleted = 0`, [status, shopCode, promotionId]);
    },
    /**
     * Get active promotions for shop
     */
    async getActiveForShop(shopCode, customerUserId) {
        const params = [];
        let customerJoin = "";
        if (Number.isFinite(customerUserId) && (customerUserId ?? 0) > 0) {
            customerJoin = `LEFT JOIN (
        SELECT PromotionID, COUNT(*) AS CustomerUsage
        FROM Bookings
        WHERE BookingStatus IN ('pending','confirmed','completed')
          AND PromotionID IS NOT NULL
          AND CustomerUserID = ?
        GROUP BY PromotionID
      ) c ON c.PromotionID = p.PromotionID`;
            params.push(customerUserId);
        }
        params.push(shopCode);
        const [rows] = await query_1.default.query(`SELECT p.*,
              COALESCE(b.TotalUsage, 0) AS UsageCount,
              ${customerJoin ? "COALESCE(c.CustomerUsage, 0)" : "0"} AS CustomerUsage
       FROM Shop_Promotions p
       LEFT JOIN (
         SELECT PromotionID, COUNT(*) AS TotalUsage
         FROM Bookings
         WHERE BookingStatus IN ('pending','confirmed','completed')
           AND PromotionID IS NOT NULL
         GROUP BY PromotionID
       ) b ON b.PromotionID = p.PromotionID
       ${customerJoin}
       WHERE p.ShopCode = ?
         AND p.Status NOT IN ('draft','disabled')
         AND p.StartAt <= NOW()
         AND p.EndAt >= NOW()
         AND p.IsDeleted = 0
       ORDER BY p.EndAt ASC`, params);
        return rows || [];
    },
    /**
     * Get by code
     */
    async getByCode(promotionCode) {
        const normalized = promotionCode.trim().toUpperCase();
        const [rows] = await query_1.default.query(`SELECT p.*,
              COALESCE(b.TotalUsage, 0) AS UsageCount
       FROM Shop_Promotions p
       LEFT JOIN (
         SELECT PromotionID, COUNT(*) AS TotalUsage
         FROM Bookings
         WHERE BookingStatus IN ('pending','confirmed','completed')
           AND PromotionID IS NOT NULL
         GROUP BY PromotionID
       ) b ON b.PromotionID = p.PromotionID
       WHERE p.PromotionCode = ? AND p.IsDeleted = 0
       LIMIT 1`, [normalized]);
        return rows?.[0] || null;
    },
    /**
     * Check linked pending bookings
     */
    async hasPendingUnpaidBookings(promotionId) {
        const [rows] = await query_1.default.query(`SELECT COUNT(*) AS Cnt
       FROM Bookings
       WHERE PromotionID = ?
         AND PaymentStatus <> 'paid'
         AND BookingStatus NOT IN ('cancelled')`, [promotionId]);
        return Number(rows?.[0]?.Cnt ?? 0) > 0;
    },
    /**
     * Soft delete promotion
     */
    async softDelete(shopCode, promotionId) {
        const [result] = await query_1.default.query(`UPDATE Shop_Promotions
       SET Status = 'disabled',
           IsDeleted = 1,
           DeletedAt = NOW(),
           UpdateAt = NOW()
       WHERE ShopCode = ? AND PromotionID = ? AND IsDeleted = 0`, [shopCode, promotionId]);
        return (result.affectedRows ?? 0) > 0;
    },
};
exports.default = shopPromotionModel;
