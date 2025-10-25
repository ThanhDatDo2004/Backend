import { StatusCodes } from "http-status-codes";
import ApiError from "../utils/apiErrors";
import queryService from "../core/database";
import shopPromotionModel from "../models/shopPromotion.model";

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

function mapRow(row: any): ShopPromotion {
  const startAt = new Date(row.StartAt);
  const endAt = new Date(row.EndAt);
  const storedStatus = (row.Status ?? "draft") as
    | ShopPromotionStatus
    | undefined;
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
    const rows = await shopPromotionModel.listByShop(shopCode);
    return (rows || []).map(mapRow);
  },

  async getById(shopCode: number, promotionId: number): Promise<ShopPromotion> {
    const row = await shopPromotionModel.getById(shopCode, promotionId);
    if (!row) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Không tìm thấy chiến dịch khuyến mãi"
      );
    }
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
        const codeExists = await shopPromotionModel.codeExists(
          conn,
          shopCode,
          sanitized.promotion_code
        );
        if (codeExists) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            "Mã khuyến mãi đã tồn tại, vui lòng chọn mã khác"
          );
        }

        const promotionId = await shopPromotionModel.create(conn, shopCode, {
          promotion_code: sanitized.promotion_code,
          title: sanitized.title,
          description: sanitized.description ?? null,
          discount_type: sanitized.discount_type,
          discount_value: sanitized.discount_value,
          max_discount_amount: sanitized.max_discount_amount ?? null,
          min_order_amount: sanitized.min_order_amount ?? 0,
          usage_limit: sanitized.usage_limit ?? null,
          usage_per_customer: sanitized.usage_per_customer ?? 1,
          start_at: toMySqlDatetime(sanitized.start_at),
          end_at: toMySqlDatetime(sanitized.end_at),
          status: sanitized.status,
        });

        return promotionId;
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

    await queryService.execTransaction("shopPromotion.update", async (conn) => {
      const existing = await shopPromotionModel.getById(shopCode, promotionId);
      if (!existing) {
        throw new ApiError(
          StatusCodes.NOT_FOUND,
          "Không tìm thấy chiến dịch khuyến mãi"
        );
      }

      if (existing.PromotionCode !== sanitized.promotion_code) {
        const codeExists = await shopPromotionModel.codeExists(
          conn,
          shopCode,
          sanitized.promotion_code,
          promotionId
        );
        if (codeExists) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            "Mã khuyến mãi đã tồn tại, vui lòng chọn mã khác"
          );
        }
      }

      await shopPromotionModel.update(conn, shopCode, promotionId, {
        promotion_code: sanitized.promotion_code,
        title: sanitized.title,
        description: sanitized.description ?? null,
        discount_type: sanitized.discount_type,
        discount_value: sanitized.discount_value,
        max_discount_amount: sanitized.max_discount_amount ?? null,
        min_order_amount: sanitized.min_order_amount ?? 0,
        usage_limit: sanitized.usage_limit ?? null,
        usage_per_customer: sanitized.usage_per_customer ?? 1,
        start_at: toMySqlDatetime(sanitized.start_at),
        end_at: toMySqlDatetime(sanitized.end_at),
        status: sanitized.status,
      });
    });

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

    const record = await shopPromotionModel.getById(shopCode, promotionId);
    if (!record) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Không tìm thấy chiến dịch khuyến mãi"
      );
    }

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
        throw new ApiError(StatusCodes.BAD_REQUEST, "Chiến dịch đã hết hạn");
      }
    }

    if (status === "draft" && currentStatus !== "draft") {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Không thể chuyển chiến dịch đã chạy về trạng thái Nháp"
      );
    }

    await shopPromotionModel.updateStatus(shopCode, promotionId, status);

    return this.getById(shopCode, promotionId);
  },

  async listActiveForShop(
    shopCode: number,
    customerUserId?: number | null
  ): Promise<Array<ShopPromotion & { customer_usage?: number }>> {
    const rows = await shopPromotionModel.getActiveForShop(
      shopCode,
      customerUserId
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

    const record = await shopPromotionModel.getByCode(normalized);
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
    const record = await shopPromotionModel.getById(shopCode, promotionId);
    if (!record) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Không tìm thấy chiến dịch khuyến mãi"
      );
    }

    const totalUsage = await shopPromotionModel.checkUsage(promotionId);
    if (totalUsage > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Không thể xóa khuyến mãi đã liên kết với các đơn đặt sân."
      );
    }

    const deleted = await shopPromotionModel.delete(shopCode, promotionId);

    if (!deleted) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Không tìm thấy chiến dịch khuyến mãi"
      );
    }

    return true;
  },
};

export default shopPromotionService;
