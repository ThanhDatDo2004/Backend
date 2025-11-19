import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import queryService from "../services/query";

// ============ TYPES ============
export type ShopPromotionRow = {
  PromotionID: number;
  ShopCode: number;
  PromotionCode: string;
  Title: string;
  Description: string | null;
  DiscountType: "percent" | "fixed";
  DiscountValue: number;
  MaxDiscountAmount: number | null;
  MinOrderAmount: number | null;
  UsageLimit: number | null;
  UsagePerCustomer: number | null;
  StartAt: string;
  EndAt: string;
  Status: string;
  CreateAt: string;
  UpdateAt: string;
  UsageCount?: number;
  CustomerUsage?: number;
};

// ============ SHOP PROMOTION MODEL ============
const shopPromotionModel = {
  /**
   * List all promotions by shop
   */
  async listByShop(shopCode: number): Promise<ShopPromotionRow[]> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT p.*,
              COALESCE(b.TotalUsage, 0) AS UsageCount
       FROM Shop_Promotions p
       LEFT JOIN (
         SELECT PromotionID, COUNT(*) AS TotalUsage
         FROM Bookings
         WHERE BookingStatus IN ('pending','confirmed','completed')
           AND PromotionID IS NOT NULL
         GROUP BY PromotionID
       ) b ON b.PromotionID = p.PromotionID
       WHERE p.ShopCode = ?
       ORDER BY p.CreateAt DESC`,
      [shopCode]
    );

    return (rows || []) as ShopPromotionRow[];
  },

  /**
   * Get promotion by ID and shop
   */
  async getById(
    shopCode: number,
    promotionId: number
  ): Promise<ShopPromotionRow | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT p.*,
              COALESCE(b.TotalUsage, 0) AS UsageCount
       FROM Shop_Promotions p
       LEFT JOIN (
         SELECT PromotionID, COUNT(*) AS TotalUsage
         FROM Bookings
         WHERE PromotionID = ? AND BookingStatus IN ('pending','confirmed','completed')
         GROUP BY PromotionID
       ) b ON b.PromotionID = p.PromotionID
       WHERE p.ShopCode = ? AND p.PromotionID = ?
       LIMIT 1`,
      [promotionId, shopCode, promotionId]
    );

    return rows?.[0] || null;
  },

  /**
   * Create promotion (within transaction)
   */
  async create(
    connection: PoolConnection,
    shopCode: number,
    payload: {
      promotion_code: string;
      title: string;
      description: string | null;
      discount_type: "percent" | "fixed";
      discount_value: number;
      max_discount_amount: number | null;
      min_order_amount: number | null;
      usage_limit: number | null;
      usage_per_customer: number | null;
      start_at: string; // MySQL datetime format
      end_at: string; // MySQL datetime format
      status: string;
    }
  ): Promise<number> {
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO Shop_Promotions (
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
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
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
      ]
    );

    return Number(result.insertId);
  },

  /**
   * Check if promotion code exists (within transaction)
   */
  async codeExists(
    connection: PoolConnection,
    shopCode: number,
    promotionCode: string,
    excludeId?: number
  ): Promise<boolean> {
    let query = `SELECT PromotionID FROM Shop_Promotions WHERE ShopCode = ? AND PromotionCode = ?`;
    const params: any[] = [shopCode, promotionCode];

    if (excludeId) {
      query += ` AND PromotionID <> ?`;
      params.push(excludeId);
    }

    query += ` LIMIT 1`;

    const [rows] = await connection.query<RowDataPacket[]>(query, params);
    return !!rows?.[0];
  },

  /**
   * Update promotion (within transaction)
   */
  async update(
    connection: PoolConnection,
    shopCode: number,
    promotionId: number,
    payload: {
      promotion_code: string;
      title: string;
      description: string | null;
      discount_type: "percent" | "fixed";
      discount_value: number;
      max_discount_amount: number | null;
      min_order_amount: number | null;
      usage_limit: number | null;
      usage_per_customer: number | null;
      start_at: string;
      end_at: string;
      status: string;
    }
  ): Promise<void> {
    await connection.query<ResultSetHeader>(
      `UPDATE Shop_Promotions
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
       WHERE ShopCode = ? AND PromotionID = ?`,
      [
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
      ]
    );
  },

  /**
   * Update promotion status
   */
  async updateStatus(
    shopCode: number,
    promotionId: number,
    status: string
  ): Promise<void> {
    await queryService.execQuery(
      `UPDATE Shop_Promotions
       SET Status = ?, UpdateAt = NOW()
       WHERE ShopCode = ? AND PromotionID = ?`,
      [status, shopCode, promotionId]
    );
  },

  /**
   * Get active promotions for shop (with optional customer usage)
   */
  async getActiveForShop(
    shopCode: number,
    customerUserId?: number | null
  ): Promise<ShopPromotionRow[]> {
    const params: any[] = [];
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

    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT p.*,
              COALESCE(b.TotalUsage, 0) AS UsageCount,
              ${
                customerJoin ? "COALESCE(c.CustomerUsage, 0)" : "0"
              } AS CustomerUsage
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
       ORDER BY p.EndAt ASC`,
      params
    );

    return (rows || []) as ShopPromotionRow[];
  },

  /**
   * Get promotion by code
   */
  async getByCode(promotionCode: string): Promise<ShopPromotionRow | null> {
    const normalized = promotionCode.trim().toUpperCase();

    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT p.*,
              COALESCE(b.TotalUsage, 0) AS UsageCount
       FROM Shop_Promotions p
       LEFT JOIN (
         SELECT PromotionID, COUNT(*) AS TotalUsage
         FROM Bookings
         WHERE BookingStatus IN ('pending','confirmed','completed')
           AND PromotionID IS NOT NULL
         GROUP BY PromotionID
       ) b ON b.PromotionID = p.PromotionID
       WHERE p.PromotionCode = ?
       LIMIT 1`,
      [normalized]
    );

    return rows?.[0] || null;
  },

  /**
   * Check promotion usage
   */
  async checkUsage(promotionId: number): Promise<number> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt
       FROM Bookings
       WHERE PromotionID = ?
         AND BookingStatus IN ('pending','confirmed')`,
      [promotionId]
    );

    return Number(rows?.[0]?.cnt ?? 0);
  },

  /**
   * Delete promotion
   */
  async delete(shopCode: number, promotionId: number): Promise<boolean> {
    const [result] = await queryService.query<ResultSetHeader>(
      `DELETE FROM Shop_Promotions WHERE ShopCode = ? AND PromotionID = ? LIMIT 1`,
      [shopCode, promotionId]
    );

    return (result.affectedRows ?? 0) > 0;
  },
};

export default shopPromotionModel;
