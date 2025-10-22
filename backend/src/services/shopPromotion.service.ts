import { ResultSetHeader, RowDataPacket } from "mysql2";
import { StatusCodes } from "http-status-codes";
import ApiError from "../utils/apiErrors";
import queryService from "./query";

export type ShopPromotionStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "expired"
  | "disabled";

export interface ShopPromotion {
  promotion_id: number;
  shop_code: number;
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
  status: ShopPromotionStatus;
  current_status: ShopPromotionStatus;
  usage_count: number;
  create_at: string;
  update_at: string;
}

export interface ShopPromotionPayload {
  promotion_code: string;
  title: string;
  description?: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_amount?: number | null;
  usage_limit?: number | null;
  usage_per_customer?: number | null;
  start_at: Date;
  end_at: Date;
  status?: ShopPromotionStatus;
}

const MUTABLE_STATUSES: ShopPromotionStatus[] = ["active", "disabled", "draft"];

const STATUS_VALUES: ShopPromotionStatus[] = [
  "draft",
  "scheduled",
  "active",
  "expired",
  "disabled",
];

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function toMySqlDatetime(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
    value.getDate()
  )} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(
    value.getSeconds()
  )}`;
}

function toIsoString(value: Date | string | null): string {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function computeCurrentStatus(
  status: ShopPromotionStatus,
  startAt: Date,
  endAt: Date
): ShopPromotionStatus {
  if (status === "disabled" || status === "draft") {
    return status;
  }

  const now = new Date();

  if (now < startAt) {
    return "scheduled";
  }
  if (now > endAt) {
    return "expired";
  }
  return "active";
}

function mapRow(row: RowDataPacket): ShopPromotion {
  const startAt = new Date(row.StartAt);
  const endAt = new Date(row.EndAt);
  const storedStatus = (row.Status ??
    "draft") as ShopPromotionStatus | undefined;
  const resolvedStatus = STATUS_VALUES.includes(storedStatus || "draft")
    ? (storedStatus as ShopPromotionStatus)
    : "draft";

  return {
    promotion_id: Number(row.PromotionID),
    shop_code: Number(row.ShopCode),
    promotion_code: String(row.PromotionCode),
    title: String(row.Title ?? ""),
    description: row.Description ?? null,
    discount_type:
      String(row.DiscountType ?? "percent") === "fixed" ? "fixed" : "percent",
    discount_value: Number(row.DiscountValue ?? 0),
    max_discount_amount:
      row.MaxDiscountAmount !== null && row.MaxDiscountAmount !== undefined
        ? Number(row.MaxDiscountAmount)
        : null,
    min_order_amount:
      row.MinOrderAmount !== null && row.MinOrderAmount !== undefined
        ? Number(row.MinOrderAmount)
        : null,
    usage_limit:
      row.UsageLimit !== null && row.UsageLimit !== undefined
        ? Number(row.UsageLimit)
        : null,
    usage_per_customer:
      row.UsagePerCustomer !== null && row.UsagePerCustomer !== undefined
        ? Number(row.UsagePerCustomer)
        : null,
    start_at: toIsoString(startAt),
    end_at: toIsoString(endAt),
    status: resolvedStatus,
    current_status: computeCurrentStatus(resolvedStatus, startAt, endAt),
    usage_count:
      row.UsageCount !== null && row.UsageCount !== undefined
        ? Number(row.UsageCount)
        : 0,
    create_at: toIsoString(row.CreateAt ?? startAt),
    update_at: toIsoString(row.UpdateAt ?? startAt),
  };
}

async function ensurePromotion(
  shopCode: number,
  promotionId: number
): Promise<RowDataPacket> {
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

  const record = rows?.[0];
  if (!record) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "Không tìm thấy chiến dịch khuyến mãi"
    );
  }
  return record;
}

function resolveStatus(
  payloadStatus: ShopPromotionStatus | undefined,
  startAt: Date,
  endAt: Date
): ShopPromotionStatus {
  if (payloadStatus === "disabled" || payloadStatus === "draft") {
    return payloadStatus;
  }
  return computeCurrentStatus("active", startAt, endAt);
}

function sanitizePayload(payload: ShopPromotionPayload) {
  const startAt = payload.start_at;
  const endAt = payload.end_at;

  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Ngày bắt đầu không hợp lệ");
  }
  if (!(endAt instanceof Date) || Number.isNaN(endAt.getTime())) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Ngày kết thúc không hợp lệ");
  }
  if (startAt >= endAt) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Ngày kết thúc phải lớn hơn ngày bắt đầu"
    );
  }

  const status = resolveStatus(payload.status, startAt, endAt);

  return {
    ...payload,
    status,
    start_at: startAt,
    end_at: endAt,
  };
}

const shopPromotionService = {
  async list(shopCode: number): Promise<ShopPromotion[]> {
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

    return (rows || []).map(mapRow);
  },

  async getById(
    shopCode: number,
    promotionId: number
  ): Promise<ShopPromotion> {
    const row = await ensurePromotion(shopCode, promotionId);
    return mapRow(row);
  },

  async create(
    shopCode: number,
    payload: ShopPromotionPayload
  ): Promise<ShopPromotion> {
    const sanitized = sanitizePayload(payload);

    const insertId = await queryService.execTransaction(
      "shopPromotion.create",
      async (conn) => {
        const [dupRows] = await conn.query<RowDataPacket[]>(
          `SELECT PromotionID
           FROM Shop_Promotions
           WHERE ShopCode = ? AND PromotionCode = ?
           LIMIT 1`,
          [shopCode, sanitized.promotion_code]
        );
        if (dupRows?.[0]) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            "Mã khuyến mãi đã tồn tại, vui lòng chọn mã khác"
          );
        }

        const [result] = await conn.query<ResultSetHeader>(
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
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            shopCode,
            sanitized.promotion_code,
            sanitized.title,
            sanitized.description ?? null,
            sanitized.discount_type,
            sanitized.discount_value,
            sanitized.max_discount_amount ?? null,
            sanitized.min_order_amount ?? 0,
            sanitized.usage_limit ?? null,
            sanitized.usage_per_customer ?? 1,
            toMySqlDatetime(sanitized.start_at),
            toMySqlDatetime(sanitized.end_at),
            sanitized.status,
          ]
        );

        return result.insertId;
      }
    );

    return this.getById(shopCode, Number(insertId));
  },

  async update(
    shopCode: number,
    promotionId: number,
    payload: ShopPromotionPayload
  ): Promise<ShopPromotion> {
    const sanitized = sanitizePayload(payload);

    await queryService.execTransaction(
      "shopPromotion.update",
      async (conn) => {
        const [existingRows] = await conn.query<RowDataPacket[]>(
          `SELECT PromotionID, PromotionCode
           FROM Shop_Promotions
           WHERE ShopCode = ? AND PromotionID = ?
           LIMIT 1`,
          [shopCode, promotionId]
        );
        const existing = existingRows?.[0];
        if (!existing) {
          throw new ApiError(
            StatusCodes.NOT_FOUND,
            "Không tìm thấy chiến dịch khuyến mãi"
          );
        }

        if (existing.PromotionCode !== sanitized.promotion_code) {
          const [dupRows] = await conn.query<RowDataPacket[]>(
            `SELECT PromotionID
             FROM Shop_Promotions
             WHERE ShopCode = ? AND PromotionCode = ? AND PromotionID <> ?
             LIMIT 1`,
            [shopCode, sanitized.promotion_code, promotionId]
          );
          if (dupRows?.[0]) {
            throw new ApiError(
              StatusCodes.CONFLICT,
              "Mã khuyến mãi đã tồn tại, vui lòng chọn mã khác"
            );
          }
        }

        await conn.query<ResultSetHeader>(
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
            sanitized.promotion_code,
            sanitized.title,
            sanitized.description ?? null,
            sanitized.discount_type,
            sanitized.discount_value,
            sanitized.max_discount_amount ?? null,
            sanitized.min_order_amount ?? 0,
            sanitized.usage_limit ?? null,
            sanitized.usage_per_customer ?? 1,
            toMySqlDatetime(sanitized.start_at),
            toMySqlDatetime(sanitized.end_at),
            sanitized.status,
            shopCode,
            promotionId,
          ]
        );
      }
    );

    return this.getById(shopCode, promotionId);
  },

  async updateStatus(
    shopCode: number,
    promotionId: number,
    status: ShopPromotionStatus
  ): Promise<ShopPromotion> {
    if (!MUTABLE_STATUSES.includes(status)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Trạng thái không hợp lệ hoặc không thể cập nhật trực tiếp"
      );
    }

    const record = await ensurePromotion(shopCode, promotionId);
    const startAt = new Date(record.StartAt);
    const endAt = new Date(record.EndAt);
    const currentStatus = computeCurrentStatus(
      record.Status as ShopPromotionStatus,
      startAt,
      endAt
    );

    if (status === "active") {
      const now = new Date();
      if (now < startAt) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Chiến dịch chưa đến thời gian áp dụng"
        );
      }
      if (now > endAt) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Chiến dịch đã hết hạn"
        );
      }
    }

    if (status === "draft" && currentStatus !== "draft") {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Không thể chuyển chiến dịch đã chạy về trạng thái Nháp"
      );
    }

    await queryService.query<ResultSetHeader>(
      `UPDATE Shop_Promotions
       SET Status = ?, UpdateAt = NOW()
       WHERE ShopCode = ? AND PromotionID = ?`,
      [status, shopCode, promotionId]
    );

    return this.getById(shopCode, promotionId);
  },

  async listActiveForShop(
    shopCode: number,
    customerUserId?: number | null
  ): Promise<Array<ShopPromotion & { customer_usage?: number }>> {
    const params: Array<number> = [];
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
      params.push(Number(customerUserId));
    }

    params.push(shopCode);

    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT p.*,
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
       ORDER BY p.EndAt ASC`,
      params
    );

    return (rows || []).map((row) => {
      const mapped = mapRow(row);
      return {
        ...mapped,
        customer_usage:
          row.CustomerUsage !== undefined && row.CustomerUsage !== null
            ? Number(row.CustomerUsage)
            : undefined,
      };
    });
  },

  async getByCode(
    promotionCode: string
  ): Promise<ShopPromotion & { shop_code: number }> {
    const normalized = promotionCode.trim().toUpperCase();
    if (!normalized) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Mã khuyến mãi không hợp lệ."
      );
    }

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

    const record = rows?.[0];
    if (!record) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Mã khuyến mãi không tồn tại");
    }

    const mapped = mapRow(record);
    return {
      ...mapped,
      shop_code: Number(record.ShopCode),
    };
  },

  async remove(shopCode: number, promotionId: number) {
    const record = await ensurePromotion(shopCode, promotionId);
    const [usageRows] = await queryService.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM Bookings WHERE PromotionID = ?`,
      [promotionId]
    );
    const totalUsage = Number(usageRows?.[0]?.cnt ?? 0);
    if (totalUsage > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Không thể xóa khuyến mãi đã liên kết với các đơn đặt sân."
      );
    }

    const [result] = await queryService.query<ResultSetHeader>(
      `DELETE FROM Shop_Promotions WHERE ShopCode = ? AND PromotionID = ? LIMIT 1`,
      [shopCode, promotionId]
    );

    if ((result.affectedRows ?? 0) === 0) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Không tìm thấy chiến dịch khuyến mãi"
      );
    }

    return true;
  },
};

export default shopPromotionService;
