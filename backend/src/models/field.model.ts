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
  shopActive?: 0 | 1;
};

export type FieldSorting = {
  sortBy?: "price" | "rating" | "name" | "rent";
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
  rent: number;
  average_rating: number | null;
  shop_name: string;
  shop_address: string | null;
  shop_user_id: number;
  shop_is_approved: string | null;
  shop_phone_number: string | null;
  shop_opening_time: string | null;
  shop_closing_time: string | null;
  shop_is_open_24h: string | null;
};

export type FieldSlotRow = {
  slot_id: number;
  field_code: number;
  quantity_id: number | null;
  quantity_number: number | null;
  play_date: string;
  start_time: string;
  end_time: string;
  status: string;
  hold_expires_at: string | null;
  hold_exp_ts: number | null;
  update_at_ts: number | null;
};

export type BookingSlotRow = {
  booking_slot_id: number;
  field_code: number;
  quantity_id: number | null;
  quantity_number: number | null;
  play_date: string;
  start_time: string;
  end_time: string;
  booking_slot_status: string;
  booking_status: string;
  payment_status: string;
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
    f.Rent AS rent,
    s.ShopName AS shop_name,
    s.Address AS shop_address,
    s.UserID AS shop_user_id,
    s.IsApproved AS shop_is_approved,
    s.PhoneNumber AS shop_phone_number,
    DATE_FORMAT(s.OpeningTime, '%H:%i') AS shop_opening_time,
    DATE_FORMAT(s.ClosingTime, '%H:%i') AS shop_closing_time,
    s.IsOpen24Hours AS shop_is_open_24h
  FROM Fields f
  JOIN Shops s ON s.ShopCode = f.ShopCode
  JOIN Users u ON u.UserID = s.UserID
  
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
    conditions.push(`(LOWER(f.Address) LIKE ? OR LOWER(s.Address) LIKE ?)`);
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

  if (typeof filters.shopActive === "number") {
    conditions.push("u.IsActive = ?");
    params.push(filters.shopActive);
  }

  const clause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { clause, params };
}

function buildOrder(sorting: FieldSorting) {
  const dir = sorting.sortDir === "desc" ? "DESC" : "ASC";
  switch (sorting.sortBy) {
    case "price":
      return `ORDER BY f.DefaultPricePerHour ${dir}`;
    case "name":
      return `ORDER BY f.FieldName ${dir}`;
    case "rent":
      return `ORDER BY f.Rent ${dir}, f.FieldName ASC`;
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
        s.IsApproved,
        s.PhoneNumber,
        s.OpeningTime,
        s.ClosingTime,
        s.IsOpen24Hours
      ${order}
      LIMIT ? OFFSET ?
    `;
    return (await queryService.execQueryList(query, [
      ...params,
      pagination.limit,
      pagination.offset,
    ])) as FieldRow[];
  },

  async getImagesByCodes(fieldCode: number, imageCodes: number[]) {
    if (!imageCodes.length) return [];
    const query = `
      SELECT
        ImageCode AS image_code,
        FieldCode AS field_code,
        ImageUrl AS image_url,
        SortOrder AS sort_order
      FROM Field_Images
      WHERE FieldCode = ? AND ImageCode IN (?)
      ORDER BY SortOrder, ImageCode
    `;
    return await queryService.execQueryList(query, [fieldCode, imageCodes]);
  },

  async deleteImages(fieldCode: number, imageCodes: number[]) {
    if (!imageCodes.length) return 0;
    const query = `
      DELETE FROM Field_Images
      WHERE FieldCode = ? AND ImageCode IN (?)
    `;
    const result = await queryService.execQuery(query, [fieldCode, imageCodes]);
    if (typeof result === "boolean") {
      return result ? imageCodes.length : 0;
    }
    return Number((result as ResultSetHeader)?.affectedRows ?? 0);
  },

  async count(filters: FieldFilters): Promise<number> {
    const { clause, params } = buildWhere(filters);
    const query = `
      SELECT COUNT(DISTINCT f.FieldCode) AS total
      FROM Fields f
      JOIN Shops s ON s.ShopCode = f.ShopCode
      JOIN Users u ON u.UserID = s.UserID
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
      JOIN Users u ON u.UserID = s.UserID
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
      JOIN Users u ON u.UserID = s.UserID
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
      JOIN Users u ON u.UserID = s.UserID
      ${clause}
    `;
    const rows = await queryService.execQueryList(query, params);
    return rows.map((row) => (row as any).address ?? "").filter(Boolean);
  },

  async listSportTypes(filters: FieldFilters): Promise<string[]> {
    const { clause, params } = buildWhere(filters);
    const query = `
      SELECT DISTINCT f.SportType AS sport_type
      FROM Fields f
      JOIN Shops s ON s.ShopCode = f.ShopCode
      JOIN Users u ON u.UserID = s.UserID
      ${clause}
      ORDER BY f.SportType
    `;
    const rows = await queryService.execQueryList(query, params);
    return rows.map((row) => (row as any).sport_type ?? "").filter(Boolean);
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

  async listSlots(fieldCode: number, playDate?: string, quantityId?: number) {
    const params: any[] = [fieldCode];
    let clause = "WHERE fs.FieldCode = ?";
    if (playDate) {
      clause += " AND fs.PlayDate = ?";
      params.push(playDate);
    }
    // NEW: Filter by QuantityID if provided
    if (quantityId !== undefined && quantityId !== null) {
      clause += " AND (fs.QuantityID = ? OR fs.QuantityID IS NULL)";
      params.push(quantityId);
    }
    const query = `
      SELECT
        fs.SlotID AS slot_id,
        fs.FieldCode AS field_code,
        fs.QuantityID AS quantity_id,
        fq.QuantityNumber AS quantity_number,
        DATE_FORMAT(fs.PlayDate, '%Y-%m-%d') AS play_date,
        DATE_FORMAT(fs.StartTime, '%H:%i') AS start_time,
        DATE_FORMAT(fs.EndTime, '%H:%i') AS end_time,
        fs.Status AS status,
        DATE_FORMAT(fs.HoldExpiresAt, '%Y-%m-%d %H:%i:%s') AS hold_expires_at,
        UNIX_TIMESTAMP(
          CONVERT_TZ(
            fs.HoldExpiresAt,
            IF(
              @@session.time_zone = 'SYSTEM',
              @@system_time_zone,
              @@session.time_zone
            ),
            '+00:00'
          )
        ) AS hold_exp_ts,
        UNIX_TIMESTAMP(fs.UpdateAt) AS update_at_ts
      FROM Field_Slots fs
      LEFT JOIN Field_Quantity fq ON fs.QuantityID = fq.QuantityID
      ${clause}
      ORDER BY fs.PlayDate, fs.StartTime
    `;
    return (await queryService.execQueryList(query, params)) as FieldSlotRow[];
  },

  async listBookingSlots(fieldCode: number, playDate: string) {
    const query = `
      SELECT
        bs.Slot_ID AS booking_slot_id,
        bs.FieldCode AS field_code,
        bs.QuantityID AS quantity_id,
        fq.QuantityNumber AS quantity_number,
        DATE_FORMAT(bs.PlayDate, '%Y-%m-%d') AS play_date,
        DATE_FORMAT(bs.StartTime, '%H:%i') AS start_time,
        DATE_FORMAT(bs.EndTime, '%H:%i') AS end_time,
        bs.Status AS booking_slot_status,
        b.BookingStatus AS booking_status,
        b.PaymentStatus AS payment_status
      FROM Booking_Slots bs
      INNER JOIN Bookings b ON bs.BookingCode = b.BookingCode
      LEFT JOIN Field_Quantity fq ON bs.QuantityID = fq.QuantityID
      WHERE bs.FieldCode = ?
        AND bs.PlayDate = ?
        AND b.BookingStatus IN ('pending', 'confirmed')
    `;
    return (await queryService.execQueryList(query, [
      fieldCode,
      playDate,
    ])) as BookingSlotRow[];
  },

  async hasFutureBookings(fieldCode: number) {
    const query = `
      SELECT COUNT(DISTINCT bs.BookingCode) AS cnt
      FROM Booking_Slots bs
      INNER JOIN Bookings b ON b.BookingCode = bs.BookingCode
      WHERE bs.FieldCode = ?
        AND (
          bs.PlayDate > CURDATE()
          OR (
            bs.PlayDate = CURDATE()
            AND bs.EndTime > DATE_FORMAT(CONVERT_TZ(NOW(), '+00:00', '+07:00'), '%H:%i')
          )
        )
        AND b.BookingStatus IN ('pending', 'confirmed')
    `;
    const rows = await queryService.execQueryList(query, [fieldCode]);
    return Number((rows?.[0] as { cnt?: number })?.cnt ?? 0) > 0;
  },

  async deleteAllImagesForField(fieldCode: number) {
    // Step 1 of deletion: Remove all image records from database
    // Note: Physical files (S3/local) are deleted before calling this method
    const query = `
      DELETE FROM Field_Images WHERE FieldCode = ?
    `;
    const result = await queryService.execQuery(query, [fieldCode]);
    if (typeof result === "boolean") return result ? 1 : 0;
    return Number((result as ResultSetHeader)?.affectedRows ?? 0);
  },

  async listAllImagesForField(fieldCode: number) {
    const query = `
      SELECT
        ImageCode AS image_code,
        FieldCode AS field_code,
        ImageUrl AS image_url,
        SortOrder AS sort_order
      FROM Field_Images
      WHERE FieldCode = ?
      ORDER BY SortOrder, ImageCode
    `;
    return await queryService.execQueryList(query, [fieldCode]);
  },

  async hardDeleteField(fieldCode: number) {
    // Step 4 (final) of deletion: Delete the field record itself
    // Only reaches here if all FK constraints are resolved:
    // - All Field_Images deleted
    // - All Field_Pricing deleted
    // - All Bookings deleted
    const query = `
      DELETE FROM Fields WHERE FieldCode = ?
    `;
    const result = await queryService.execQuery(query, [fieldCode]);
    if (typeof result === "boolean") return result;
    return !!(
      result &&
      typeof (result as ResultSetHeader).affectedRows === "number" &&
      (result as ResultSetHeader).affectedRows > 0
    );
  },

  async deleteAllPricingForField(fieldCode: number) {
    // Step 2 of deletion: Delete all pricing schedules for this field
    // Removes Field_Pricing records (FK to Fields)
    const query = `
      DELETE FROM Field_Pricing WHERE FieldCode = ?
    `;
    const result = await queryService.execQuery(query, [fieldCode]);
    if (typeof result === "boolean") return result ? 1 : 0;
    return Number((result as ResultSetHeader)?.affectedRows ?? 0);
  },

  async hasAnyBookings(fieldCode: number) {
    // Check if field has ANY bookings (regardless of date/status)
    // Currently not used in deletion (we only check future bookings)
    // But useful for other purposes (e.g., preventing field modification)
    const query = `
      SELECT COUNT(*) AS cnt
      FROM Bookings
      WHERE FieldCode = ?
    `;
    const rows = await queryService.execQueryList(query, [fieldCode]);
    return Number((rows?.[0] as { cnt?: number })?.cnt ?? 0) > 0;
  },

  async deleteAllBookingsForField(fieldCode: number) {
    // Step 3 of deletion: Delete ALL bookings (past, present, cancelled, completed, etc.)
    // This is ONLY called after confirming there are NO FUTURE bookings
    //
    // POLICY:
    // ✅ CAN DELETE sân if: No bookings OR all bookings are PAST (qua hạn)
    // ❌ CANNOT DELETE sân if: Any booking is FUTURE (chưa qua hạn) → 409 error
    //
    // When deleting, we remove ALL bookings because:
    // - Future bookings: Already checked and blocked
    // - Past bookings: Can be safely deleted with field
    // - Cancelled/Completed: Safe to delete
    const query = `
      DELETE FROM Bookings WHERE FieldCode = ?
    `;
    const result = await queryService.execQuery(query, [fieldCode]);
    if (typeof result === "boolean") return result ? 1 : 0;
    return Number((result as ResultSetHeader)?.affectedRows ?? 0);
  },

  async softDeleteField(fieldCode: number) {
    // Soft delete: Mark field as 'inactive' without removing records
    // Used when you want to keep booking history but hide the field
    const query = `
      UPDATE Fields SET Status = 'inactive' WHERE FieldCode = ?
    `;
    const result = await queryService.execQuery(query, [fieldCode]);
    if (typeof result === "boolean") return result;
    return !!(
      result &&
      typeof (result as ResultSetHeader).affectedRows === "number" &&
      (result as ResultSetHeader).affectedRows > 0
    );
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

  async createImage(fieldCode: number, imageUrl: string, sortOrder?: number) {
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

  async updateField(
    fieldId: number,
    dataToUpdate: Partial<{
      field_name: string;
      sport_type: string;
      address: string;
      price_per_hour: number;
      status: "active" | "maintenance" | "inactive";
    }>
  ) {
    const fields: string[] = [];
    const params: any[] = [];

    if (dataToUpdate.field_name) {
      fields.push("FieldName = ?");
      params.push(dataToUpdate.field_name);
    }
    if (dataToUpdate.sport_type) {
      fields.push("SportType = ?");
      params.push(dataToUpdate.sport_type);
    }
    if (dataToUpdate.address) {
      fields.push("Address = ?");
      params.push(dataToUpdate.address);
    }
    if (dataToUpdate.price_per_hour) {
      fields.push("DefaultPricePerHour = ?");
      params.push(dataToUpdate.price_per_hour);
    }
    if (dataToUpdate.status) {
      fields.push("Status = ?");
      params.push(dataToUpdate.status);
    }

    if (fields.length === 0) {
      return false;
    }

    const query = `
      UPDATE Fields
      SET ${fields.join(", ")}
      WHERE FieldCode = ?
    `;
    params.push(fieldId);

    const result = await queryService.execQuery(query, params);
    // If execQuery returns a boolean, just return it; otherwise, check affectedRows
    if (typeof result === "boolean") {
      return result;
    }
    return !!(
      result &&
      typeof (result as any).affectedRows === "number" &&
      (result as any).affectedRows > 0
    );
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
