import type { ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import queryService from "../services/query";

export type FieldFilters = {
  search?: string;
  sportType?: string;
  location?: string;
  priceMin?: number;
  priceMax?: number;
  fieldCode?: number;
  status?: "active" | "maintenance" | "inactive";
  shopApproval?: "Y" | "N";
  shopCode?: number;
};

export type FieldSorting = {
  sortBy?: "price" | "rating" | "name";
  sortDir?: "asc" | "desc";
};

export type FieldPagination = {
  limit: number;
  offset: number;
};

export type FieldRow = {
  field_code: number;
  shop_code: number;
  field_name: string;
  sport_type: string;
  address: string | null;
  price_per_hour: number;
  status: string;
  average_rating: number | null;
  shop_name: string;
  shop_address: string | null;
  shop_user_id: number;
  shop_is_approved: string | null;
};

export type FieldSlotRow = {
  slot_id: number;
  field_code: number;
  play_date: string;
  start_time: string;
  end_time: string;
  status: string;
  hold_expires_at: string | null;
};

export type FieldPricingRow = {
  pricing_id: number;
  field_code: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  price_per_hour: number;
};

const BASE_SELECT = `
  SELECT
    f.FieldCode AS field_code,
    f.ShopCode AS shop_code,
    f.FieldName AS field_name,
    f.SportType AS sport_type,
    f.Address AS address,
    f.DefaultPricePerHour AS price_per_hour,
    f.Status AS status,
    COALESCE(AVG(r.Rating), 0) AS average_rating,
    s.ShopName AS shop_name,
    s.Address AS shop_address,
    s.UserID AS shop_user_id,
    s.IsApproved AS shop_is_approved
  FROM Fields f
  JOIN Shops s ON s.ShopCode = f.ShopCode
  LEFT JOIN Reviews r ON r.FieldCode = f.FieldCode
`;

function buildWhere(filters: FieldFilters) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.fieldCode) {
    conditions.push("f.FieldCode = ?");
    params.push(filters.fieldCode);
  }

  if (filters.search) {
    const like = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      `(LOWER(f.FieldName) LIKE ? OR LOWER(f.Address) LIKE ? OR LOWER(s.ShopName) LIKE ?)`
    );
    params.push(like, like, like);
  }

  if (filters.sportType) {
    conditions.push("f.SportType = ?");
    params.push(filters.sportType);
  }

  if (filters.location) {
    const like = `%${filters.location.toLowerCase()}%`;
    conditions.push(
      `(LOWER(f.Address) LIKE ? OR LOWER(s.Address) LIKE ?)`
    );
    params.push(like, like);
  }

  if (typeof filters.priceMin === "number") {
    conditions.push("f.DefaultPricePerHour >= ?");
    params.push(filters.priceMin);
  }

  if (typeof filters.priceMax === "number") {
    conditions.push("f.DefaultPricePerHour <= ?");
    params.push(filters.priceMax);
  }

  if (filters.status) {
    conditions.push("f.Status = ?");
    params.push(filters.status);
  }

  if (filters.shopApproval) {
    conditions.push("s.IsApproved = ?");
    params.push(filters.shopApproval);
  }

  if (filters.shopCode) {
    conditions.push("f.ShopCode = ?");
    params.push(filters.shopCode);
  }

  const clause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { clause, params };
}

function buildOrder(sorting: FieldSorting) {
  const dir = sorting.sortDir === "desc" ? "DESC" : "ASC";
  switch (sorting.sortBy) {
    case "price":
      return `ORDER BY f.DefaultPricePerHour ${dir}`;
    case "rating":
      return `ORDER BY average_rating ${dir}`;
    case "name":
      return `ORDER BY f.FieldName ${dir}`;
    default:
      return "ORDER BY f.FieldName ASC";
  }
}

const fieldModel = {
  async list(
    filters: FieldFilters,
    pagination: FieldPagination,
    sorting: FieldSorting
  ): Promise<FieldRow[]> {
    const { clause, params } = buildWhere(filters);
    const order = buildOrder(sorting);
    const query = `
      ${BASE_SELECT}
      ${clause}
      GROUP BY
        f.FieldCode,
        f.ShopCode,
        f.FieldName,
        f.SportType,
        f.Address,
        f.DefaultPricePerHour,
        f.Status,
        s.ShopName,
        s.Address,
        s.UserID,
        s.IsApproved
      ${order}
      LIMIT ? OFFSET ?
    `;
    return (await queryService.execQueryList(query, [
      ...params,
      pagination.limit,
      pagination.offset,
    ])) as FieldRow[];
  },

  async count(filters: FieldFilters): Promise<number> {
    const { clause, params } = buildWhere(filters);
    const query = `
      SELECT COUNT(DISTINCT f.FieldCode) AS total
      FROM Fields f
      JOIN Shops s ON s.ShopCode = f.ShopCode
      ${clause}
    `;
    const rows = await queryService.execQueryList(query, params);
    return Number((rows?.[0] as { total?: number })?.total ?? 0);
  },

  async countByStatus(filters: FieldFilters) {
    const { clause, params } = buildWhere(filters);
    const query = `
      SELECT f.Status AS status, COUNT(DISTINCT f.FieldCode) AS total
      FROM Fields f
      JOIN Shops s ON s.ShopCode = f.ShopCode
      ${clause}
      GROUP BY f.Status
    `;
    return (await queryService.execQueryList(query, params)) as Array<{
      status: string | null;
      total: number;
    }>;
  },

  async countByShopApproval(filters: FieldFilters) {
    const { clause, params } = buildWhere(filters);
    const query = `
      SELECT s.IsApproved AS approval, COUNT(DISTINCT f.FieldCode) AS total
      FROM Fields f
      JOIN Shops s ON s.ShopCode = f.ShopCode
      ${clause}
      GROUP BY s.IsApproved
    `;
    return (await queryService.execQueryList(query, params)) as Array<{
      approval: string | null;
      total: number;
    }>;
  },

  async listAddresses(filters: FieldFilters): Promise<string[]> {
    const { clause, params } = buildWhere(filters);
    const query = `
      SELECT DISTINCT f.Address AS address
      FROM Fields f
      JOIN Shops s ON s.ShopCode = f.ShopCode
      ${clause}
    `;
    const rows = await queryService.execQueryList(query, params);
    return rows
      .map((row: { address?: string | null }) => row.address ?? "")
      .filter(Boolean);
  },

  async listSportTypes(filters: FieldFilters): Promise<string[]> {
    const { clause, params } = buildWhere(filters);
    const query = `
      SELECT DISTINCT f.SportType AS sport_type
      FROM Fields f
      JOIN Shops s ON s.ShopCode = f.ShopCode
      ${clause}
      ORDER BY f.SportType
    `;
    const rows = await queryService.execQueryList(query, params);
    return rows
      .map((row: { sport_type?: string | null }) => row.sport_type ?? "")
      .filter(Boolean);
  },

  async listImages(fieldCodes: number[]) {
    if (!fieldCodes.length) return [];
    const query = `
      SELECT
        ImageCode AS image_code,
        FieldCode AS field_code,
        ImageUrl AS image_url,
        SortOrder AS sort_order
      FROM Field_Images
      WHERE FieldCode IN (?)
      ORDER BY FieldCode, SortOrder, ImageCode
    `;
    return await queryService.execQueryList(query, [fieldCodes]);
  },

  async listSlots(fieldCode: number, playDate?: string) {
    const params: any[] = [fieldCode];
    let clause = "WHERE FieldCode = ?";
    if (playDate) {
      clause += " AND PlayDate = ?";
      params.push(playDate);
    }
    const query = `
      SELECT
        SlotID AS slot_id,
        FieldCode AS field_code,
        DATE_FORMAT(PlayDate, '%Y-%m-%d') AS play_date,
        DATE_FORMAT(StartTime, '%H:%i') AS start_time,
        DATE_FORMAT(EndTime, '%H:%i') AS end_time,
        Status AS status,
        DATE_FORMAT(HoldExpiresAt, '%Y-%m-%d %H:%i:%s') AS hold_expires_at
      FROM Field_Slots
      ${clause}
      ORDER BY PlayDate, StartTime
    `;
    return (await queryService.execQueryList(query, params)) as FieldSlotRow[];
  },

  async listPricing(fieldCode: number) {
    const query = `
      SELECT
        PricingID AS pricing_id,
        FieldCode AS field_code,
        DayOfWeek AS day_of_week,
        DATE_FORMAT(StartTime, '%H:%i') AS start_time,
        DATE_FORMAT(EndTime, '%H:%i') AS end_time,
        PricePerHour AS price_per_hour
      FROM Field_Pricing
      WHERE FieldCode = ?
      ORDER BY DayOfWeek, StartTime
    `;
    return (await queryService.execQueryList(query, [
      fieldCode,
    ])) as FieldPricingRow[];
  },

  async findById(fieldCode: number) {
    const query = `
      SELECT
        f.FieldCode AS field_code,
        f.ShopCode AS shop_code
      FROM Fields f
      WHERE f.FieldCode = ?
      LIMIT 1
    `;
    const rows = await queryService.execQueryList(query, [fieldCode]);
    return (
      (rows[0] as { field_code: number; shop_code: number } | undefined) ?? null
    );
  },

  async findShopByCode(shopCode: number) {
    const query = `
      SELECT
        s.ShopCode AS shop_code,
        s.UserID AS user_id,
        s.IsApproved AS is_approved
      FROM Shops s
      WHERE s.ShopCode = ?
      LIMIT 1
    `;
    const rows = await queryService.execQueryList(query, [shopCode]);
    return (
      (rows[0] as
        | { shop_code: number; user_id: number; is_approved: string | null }
        | undefined) ?? null
    );
  },

  async createImage(
    fieldCode: number,
    imageUrl: string,
    sortOrder?: number
  ) {
    return await queryService.execTransaction(
      "fieldModel.createImage",
      async (conn) => {
        let finalSortOrder = sortOrder;

        if (typeof finalSortOrder !== "number") {
          const [orderRows] = await conn.query(
            `
              SELECT COALESCE(MAX(SortOrder), -1) + 1 AS next_order
              FROM Field_Images
              WHERE FieldCode = ?
            `,
            [fieldCode]
          );
          const nextOrder =
            (orderRows as Array<{ next_order: number }>)[0]?.next_order ?? 0;
          finalSortOrder = Number(nextOrder);
        }

        return await fieldModel.insertFieldImage(conn, {
          fieldCode,
          imageUrl,
          sortOrder: finalSortOrder ?? 0,
        });
      }
    );
  },

  async listReviews(fieldCodes: number[]) {
    if (!fieldCodes.length) return [];
    const query = `
      SELECT
        r.ReviewCode AS review_code,
        r.FieldCode AS field_code,
        r.Rating AS rating,
        r.Comment AS comment,
        r.CreateAt AS created_at,
        r.CustomerUserID AS customer_user_id,
        u.FullName AS customer_name
      FROM Reviews r
      LEFT JOIN Users u ON u.UserID = r.CustomerUserID
      WHERE r.FieldCode IN (?)
      ORDER BY r.FieldCode, r.CreateAt DESC, r.ReviewCode DESC
    `;
    return await queryService.execQueryList(query, [fieldCodes]);
  },

  async insertField(
    conn: PoolConnection,
    params: {
      shopCode: number;
      fieldName: string;
      sportType: string;
      address?: string | null;
      pricePerHour: number;
      status?: "active" | "maintenance" | "inactive";
    }
  ) {
    const [result] = await conn.query<ResultSetHeader>(
      `
        INSERT INTO Fields (
          ShopCode,
          FieldName,
          SportType,
          Address,
          DefaultPricePerHour,
          Status
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        params.shopCode,
        params.fieldName,
        params.sportType,
        params.address ?? null,
        params.pricePerHour,
        params.status ?? "active",
      ]
    );

    return Number(result.insertId ?? 0);
  },

  async insertFieldImage(
    conn: PoolConnection,
    params: {
      fieldCode: number;
      imageUrl: string;
      sortOrder: number;
    }
  ) {
    const [result] = await conn.query<ResultSetHeader>(
      `
        INSERT INTO Field_Images (FieldCode, ImageUrl, SortOrder)
        VALUES (?, ?, ?)
      `,
      [params.fieldCode, params.imageUrl, params.sortOrder]
    );

    return {
      image_code: Number(result.insertId ?? 0),
      field_code: params.fieldCode,
      image_url: params.imageUrl,
      sort_order: params.sortOrder,
    };
  },
};

export default fieldModel;
