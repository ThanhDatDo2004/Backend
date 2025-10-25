import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import queryService from "../core/database";
import { FIELD_QUERIES } from "../queries/field.queries";

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

// Helper function: Build WHERE clause based on filters (acceptable in model - query composition helper)
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

// Helper function: Build ORDER BY clause based on sorting
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
  // List fields with filters and pagination
  async list(
    filters: FieldFilters,
    pagination: FieldPagination,
    sorting: FieldSorting
  ): Promise<FieldRow[]> {
    const { clause, params } = buildWhere(filters);
    const order = buildOrder(sorting);
    const query = `
      ${FIELD_QUERIES.BASE_SELECT}
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
    const [rows] = await queryService.query<RowDataPacket[]>(query, [
      ...params,
      pagination.limit,
      pagination.offset,
    ]);
    return (rows as FieldRow[]) || [];
  },

  // Get field images by codes
  async getImagesByCodes(fieldCode: number, imageCodes: number[]) {
    if (!imageCodes.length) return [];
    const [rows] = await queryService.query<RowDataPacket[]>(
      FIELD_QUERIES.GET_FIELD_IMAGES,
      [fieldCode, imageCodes]
    );
    return rows || [];
  },

  // Delete field images
  async deleteImages(fieldCode: number, imageCodes: number[]) {
    if (!imageCodes.length) return 0;
    const [result] = await queryService.query<ResultSetHeader>(
      FIELD_QUERIES.DELETE_FIELD_IMAGES,
      [fieldCode, imageCodes]
    );
    return Number(result?.affectedRows ?? 0);
  },

  // Count fields with filters
  async count(filters: FieldFilters): Promise<number> {
    const { clause, params } = buildWhere(filters);
    const query = `${FIELD_QUERIES.COUNT_FIELDS} ${clause}`;
    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return Number((rows?.[0] as { total?: number })?.total ?? 0);
  },

  // Count fields by status
  async countByStatus(filters: FieldFilters) {
    const { clause, params } = buildWhere(filters);
    const query = `${FIELD_QUERIES.COUNT_BY_STATUS} ${clause} GROUP BY f.Status`;
    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return (rows as Array<{ status: string | null; total: number }>) || [];
  },

  // Count fields by shop approval
  async countByShopApproval(filters: FieldFilters) {
    const { clause, params } = buildWhere(filters);
    const query = `${FIELD_QUERIES.COUNT_BY_SHOP_APPROVAL} ${clause} GROUP BY s.IsApproved`;
    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return (rows as Array<{ approval: string | null; total: number }>) || [];
  },

  // List distinct addresses
  async listAddresses(filters: FieldFilters): Promise<string[]> {
    const { clause, params } = buildWhere(filters);
    const query = `${FIELD_QUERIES.LIST_ADDRESSES} ${clause}`;
    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return (
      (rows as Array<{ address?: string | null }>)
        ?.map((row) => row.address ?? "")
        .filter(Boolean) || []
    );
  },

  // List distinct sport types
  async listSportTypes(filters: FieldFilters): Promise<string[]> {
    const { clause, params } = buildWhere(filters);
    const query = `${FIELD_QUERIES.LIST_SPORT_TYPES} ${clause}`;
    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return (
      (rows as Array<{ sport_type?: string | null }>)
        ?.map((row) => row.sport_type ?? "")
        .filter(Boolean) || []
    );
  },

  // List images for multiple fields
  async listImages(fieldCodes: number[]) {
    if (!fieldCodes.length) return [];
    const [rows] = await queryService.query<RowDataPacket[]>(
      FIELD_QUERIES.LIST_FIELD_IMAGES,
      [fieldCodes]
    );
    return rows || [];
  },

  // List field slots
  async listSlots(fieldCode: number, playDate?: string, quantityId?: number) {
    const params: any[] = [fieldCode];
    let clause = "WHERE fs.FieldCode = ?";
    if (playDate) {
      clause += " AND fs.PlayDate = ?";
      params.push(playDate);
    }
    if (quantityId !== undefined && quantityId !== null) {
      clause += " AND (fs.QuantityID = ? OR fs.QuantityID IS NULL)";
      params.push(quantityId);
    }
    const query = `${FIELD_QUERIES.LIST_FIELD_SLOTS} ${clause} ORDER BY fs.PlayDate, fs.StartTime`;
    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return (rows as FieldSlotRow[]) || [];
  },

  // List booking slots
  async listBookingSlots(fieldCode: number, playDate: string) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      FIELD_QUERIES.LIST_BOOKING_SLOTS,
      [fieldCode, playDate]
    );
    return (rows as BookingSlotRow[]) || [];
  },

  // Check if field has future bookings
  async hasFutureBookings(fieldCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      FIELD_QUERIES.HAS_FUTURE_BOOKINGS,
      [fieldCode]
    );
    return Number((rows?.[0] as { cnt?: number })?.cnt ?? 0) > 0;
  },

  // Delete all images for field
  async deleteAllImagesForField(fieldCode: number) {
    const [result] = await queryService.query<ResultSetHeader>(
      FIELD_QUERIES.DELETE_ALL_IMAGES_FOR_FIELD,
      [fieldCode]
    );
    return Number(result?.affectedRows ?? 0);
  },

  // List all images for field
  async listAllImagesForField(fieldCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      FIELD_QUERIES.LIST_ALL_IMAGES_FOR_FIELD,
      [fieldCode]
    );
    return rows || [];
  },

  // Hard delete field
  async hardDeleteField(fieldCode: number) {
    const [result] = await queryService.query<ResultSetHeader>(
      FIELD_QUERIES.HARD_DELETE_FIELD,
      [fieldCode]
    );
    return !!(result && result.affectedRows > 0);
  },

  // Delete all pricing for field
  async deleteAllPricingForField(fieldCode: number) {
    const [result] = await queryService.query<ResultSetHeader>(
      FIELD_QUERIES.DELETE_ALL_PRICING_FOR_FIELD,
      [fieldCode]
    );
    return Number(result?.affectedRows ?? 0);
  },

  // Check if field has any bookings
  async hasAnyBookings(fieldCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      FIELD_QUERIES.HAS_ANY_BOOKINGS,
      [fieldCode]
    );
    return Number((rows?.[0] as { cnt?: number })?.cnt ?? 0) > 0;
  },

  // Delete all bookings for field
  async deleteAllBookingsForField(fieldCode: number) {
    const [result] = await queryService.query<ResultSetHeader>(
      FIELD_QUERIES.DELETE_ALL_BOOKINGS_FOR_FIELD,
      [fieldCode]
    );
    return Number(result?.affectedRows ?? 0);
  },

  // Soft delete field
  async softDeleteField(fieldCode: number) {
    const [result] = await queryService.query<ResultSetHeader>(
      FIELD_QUERIES.SOFT_DELETE_FIELD,
      [fieldCode]
    );
    return !!(result && result.affectedRows > 0);
  },

  // List pricing for field
  async listPricing(fieldCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      FIELD_QUERIES.LIST_FIELD_PRICING,
      [fieldCode]
    );
    return (rows as FieldPricingRow[]) || [];
  },

  // Find field by code
  async findById(fieldCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      FIELD_QUERIES.GET_FIELD_BY_CODE,
      [fieldCode]
    );
    return rows?.[0] || null;
  },

  // Find shop by code
  async findShopByCode(shopCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      FIELD_QUERIES.GET_SHOP_BY_CODE,
      [shopCode]
    );
    return rows?.[0] || null;
  },

  // Create field image
  async createImage(fieldCode: number, imageUrl: string, sortOrder?: number) {
    const [result] = await queryService.query<ResultSetHeader>(
      FIELD_QUERIES.CREATE_FIELD_IMAGE,
      [fieldCode, imageUrl, sortOrder ?? 0]
    );
    return result.insertId;
  },

  // Insert field (transaction context)
  async insertField(
    conn: PoolConnection,
    params: {
      shopCode: number;
      fieldName: string;
      sportType: string;
      pricePerHour: number;
    }
  ) {
    const [result] = await conn.query<ResultSetHeader>(
      FIELD_QUERIES.INSERT_FIELD,
      [
        params.shopCode,
        params.fieldName,
        params.sportType,
        params.pricePerHour,
        "active",
        0,
      ]
    );
    return result.insertId;
  },

  // Update field
  async updateField(
    fieldId: number,
    dataToUpdate: Partial<{
      address: string;
      status: "active" | "maintenance" | "inactive";
      pricePerHour: number;
      fieldName: string;
      sportType: string;
    }>
  ) {
    if (
      !dataToUpdate.fieldName ||
      !dataToUpdate.sportType ||
      dataToUpdate.address === undefined ||
      dataToUpdate.pricePerHour === undefined
    ) {
      return 0;
    }
    const [result] = await queryService.query<ResultSetHeader>(
      FIELD_QUERIES.UPDATE_FIELD_DETAILED,
      [
        dataToUpdate.fieldName,
        dataToUpdate.sportType,
        dataToUpdate.address,
        dataToUpdate.pricePerHour,
        fieldId,
      ]
    );
    return Number(result?.affectedRows ?? 0);
  },

  // Insert field image (transaction context)
  async insertFieldImage(
    conn: PoolConnection,
    params: {
      fieldCode: number;
      imageUrl: string;
      sortOrder: number;
    }
  ) {
    const [result] = await conn.query<ResultSetHeader>(
      FIELD_QUERIES.INSERT_FIELD_IMAGE,
      [params.fieldCode, params.imageUrl, params.sortOrder]
    );
    return result.insertId;
  },

  // Insert pricing (transaction context)
  async insertPricing(
    conn: PoolConnection,
    fieldCode: number,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    pricePerHour: number
  ) {
    const [result] = await conn.query<ResultSetHeader>(
      FIELD_QUERIES.INSERT_FIELD_PRICING,
      [fieldCode, dayOfWeek, startTime, endTime, pricePerHour]
    );
    return result.insertId;
  },

  async getFieldStats(fieldCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      FIELD_QUERIES.GET_FIELD_STATS,
      [fieldCode]
    );
    return rows?.[0] || null;
  },

  async listFieldsWithRent(
    shopCode: number,
    limit: number,
    offset: number
  ) {
    const [rows] = await queryService.query<RowDataPacket[]>(
      FIELD_QUERIES.LIST_FIELDS_WITH_RENT,
      [shopCode, limit, offset]
    );
    return rows || [];
  },

  async countFieldsByShop(shopCode: number): Promise<number> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      FIELD_QUERIES.COUNT_FIELDS_BY_SHOP,
      [shopCode]
    );
    return rows?.[0]?.total || 0;
  },

  async countConfirmedBookingsForField(fieldCode: number): Promise<number> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      FIELD_QUERIES.COUNT_CONFIRMED_BOOKINGS_FOR_FIELD,
      [fieldCode]
    );
    return rows?.[0]?.rent_count || 0;
  },

  async updateFieldRent(fieldCode: number, rent: number): Promise<void> {
    await queryService.query<ResultSetHeader>(
      FIELD_QUERIES.UPDATE_FIELD_RENT,
      [rent, fieldCode]
    );
  },

  async listAllFieldCodes(): Promise<number[]> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      FIELD_QUERIES.LIST_ALL_FIELD_CODES,
      []
    );
    return rows?.map((row) => Number(row.FieldCode)) ?? [];
  },

  async withTransaction<T>(
    label: string,
    handler: (connection: PoolConnection) => Promise<T>
  ): Promise<T> {
    return queryService.execTransaction(label, handler);
  },
};

export default fieldModel;
