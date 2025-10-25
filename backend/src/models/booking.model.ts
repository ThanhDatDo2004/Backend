
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import queryService from "../core/database";
import { BOOKING_QUERIES } from "../queries/booking.queries";

// ============ TYPES ============
export type SlotRow = RowDataPacket & {
  SlotID: number;
  Status: string;
  HoldExpiresAt: string | null;
  QuantityID: number | null;
};

export type ExpiredSlot = {
  slotId: number;
  bookingCode: number | null;
};

export type NormalizedSlot = {
  key: string;
  slot_id?: number | null;
  play_date: string;
  start_time: string;
  end_time: string;
  db_date: string;
  db_start_time: string;
  db_end_time: string;
};

// ============ BOOKING MODEL ============
const bookingModel = {
  async lockSlot(
    connection: PoolConnection,
    fieldCode: number,
    slot: NormalizedSlot,
    quantityId?: number | null
  ): Promise<SlotRow | null> {
    const params: any[] = [fieldCode, slot.db_date, slot.db_start_time, slot.db_end_time];
    let query = BOOKING_QUERIES.LOCK_FIELD_SLOT.replace("{{QUANTITY_CONDITION}}", "");
    if (quantityId != null) {
      query = BOOKING_QUERIES.LOCK_FIELD_SLOT.replace(
        "{{QUANTITY_CONDITION}}",
        " AND (QuantityID = ? OR QuantityID IS NULL)"
      );
      params.push(quantityId);
    }
    const [rows] = await connection.query<RowDataPacket[]>(query, params);
    return (rows?.[0] as SlotRow) ?? null;
  },

  async updateExistingSlot(connection: PoolConnection, slotId: number, quantityId?: number | null): Promise<void> {
    await connection.query<ResultSetHeader>(BOOKING_QUERIES.UPDATE_EXISTING_FIELD_SLOT, [quantityId ?? null, slotId]);
  },

  async insertNewSlot(
    connection: PoolConnection,
    fieldCode: number,
    slot: NormalizedSlot,
    quantityId?: number | null,
    createdBy?: number | null
  ): Promise<number> {
    const [result] = await connection.query<ResultSetHeader>(BOOKING_QUERIES.UPSERT_FIELD_SLOT, [
      fieldCode,
      quantityId || null,
      slot.db_date,
      slot.db_start_time,
      slot.db_end_time,
      createdBy,
    ]);
    return result.insertId;
  },

  async getExpiredHeldSlots(fieldCode?: number): Promise<ExpiredSlot[]> {
    let query = BOOKING_QUERIES.GET_EXPIRED_HELD_SLOTS;
    const params: any[] = [];
    if (fieldCode) {
      query += ` AND FieldCode = ?`;
      params.push(fieldCode);
    }
    const [rows] = await queryService.query<RowDataPacket[]>(query, params);
    return rows as ExpiredSlot[];
  },

  async releaseExpiredHeldSlots(fieldCode?: number): Promise<number> {
    let query = BOOKING_QUERIES.RELEASE_EXPIRED_HELD_SLOTS;
    const params: any[] = [];
    if (fieldCode) {
      query += ` AND FieldCode = ?`;
      params.push(fieldCode);
    }
    const [result] = await queryService.query<ResultSetHeader>(query, params);
    return result.affectedRows ?? 0;
  },

  async createBookingDetailed(connection: PoolConnection, payload: any): Promise<number> {
    const [result] = await connection.query<ResultSetHeader>(BOOKING_QUERIES.CREATE_BOOKING_DETAILED, [
      payload.fieldCode,
      payload.quantityId,
      payload.customerUserId,
      payload.customerName,
      payload.customerEmail,
      payload.customerPhone,
      payload.totalPrice,
      payload.platformFee,
      payload.netToShop,
      payload.discountAmount,
      payload.promotionId,
      payload.promotionCode,
      payload.checkinCode,
    ]);
    return result.insertId;
  },

  async insertBookingSlotDetailed(connection: PoolConnection, payload: any): Promise<void> {
    await connection.query<ResultSetHeader>(BOOKING_QUERIES.INSERT_BOOKING_SLOT_DETAILED, [
      payload.bookingCode,
      payload.fieldCode,
      payload.quantityId,
      payload.playDate,
      payload.startTime,
      payload.endTime,
      payload.pricePerSlot,
    ]);
  },

  async getByBookingCode(bookingCode: string) {
    const [rows] = await queryService.query<RowDataPacket[]>(BOOKING_QUERIES.GET_BOOKING_BY_CODE, [bookingCode]);
    return rows?.[0] || null;
  },

  async getBookingSlots(bookingCode: string | number) {
    const [rows] = await queryService.query<RowDataPacket[]>(BOOKING_QUERIES.GET_BOOKING_SLOTS, [bookingCode]);
    return rows || [];
  },

  async getBookingSlotsDetailed(bookingCode: string | number) {
    const [rows] = await queryService.query<RowDataPacket[]>(BOOKING_QUERIES.GET_BOOKING_SLOTS_DETAILED, [bookingCode]);
    return rows || [];
  },

  async updateBookingStatus(bookingCode: string | number, status: string): Promise<void> {
    await queryService.query<ResultSetHeader>(BOOKING_QUERIES.UPDATE_BOOKING_STATUS, [status, bookingCode]);
  },

  async markBookingCompleted(bookingCode: string | number): Promise<void> {
    await queryService.query<ResultSetHeader>(BOOKING_QUERIES.SET_BOOKING_COMPLETED, [bookingCode]);
  },

  async getCheckinInfo(bookingCode: string | number) {
    const [rows] = await queryService.query<RowDataPacket[]>(BOOKING_QUERIES.GET_CHECKIN_INFO, [bookingCode]);
    return rows?.[0] || null;
  },

  async setCheckinTime(bookingCode: string | number): Promise<void> {
    await queryService.query<ResultSetHeader>(BOOKING_QUERIES.UPDATE_CHECKIN_TIME, [bookingCode]);
  },

  async releaseHeldSlots(bookingCode: string | number): Promise<void> {
    await queryService.execQuery(BOOKING_QUERIES.RELEASE_HELD_SLOTS_STRICT, [bookingCode]);
  },

  async releaseHeldSlotsByIds(slotIds: number[]): Promise<void> {
    if (!slotIds.length) return;
    await queryService.query<ResultSetHeader>(BOOKING_QUERIES.RELEASE_HELD_SLOTS_BY_IDS, [slotIds]);
  },

  async getFieldInfo(fieldCode: number) {
    const [rows] = await queryService.query<RowDataPacket[]>(BOOKING_QUERIES.GET_FIELD_INFO, [fieldCode]);
    return rows?.[0] || null;
  },

  async checkPromotionUsageByUser(promotionId: number, userId: number): Promise<{ customerUsage: number; totalUsage: number }> {
    const [customerRows] = await queryService.query<RowDataPacket[]>(BOOKING_QUERIES.CHECK_PROMOTION_USAGE_BY_USER, [userId, promotionId]);
    const [totalRows] = await queryService.query<RowDataPacket[]>(BOOKING_QUERIES.CHECK_PROMOTION_TOTAL_USAGE, [promotionId]);
    return {
      customerUsage: customerRows?.[0]?.usage_count || 0,
      totalUsage: totalRows?.[0]?.total_usage || 0,
    };
  },

  async cancelExpiredBookings(bookingCodes: number[]): Promise<void> {
    if (!bookingCodes.length) return;
    await queryService.query<ResultSetHeader>(BOOKING_QUERIES.RELEASE_HELD_SLOTS_BY_BOOKING_CODES, [bookingCodes]);
    await queryService.query<ResultSetHeader>(BOOKING_QUERIES.CANCEL_BOOKINGS, [bookingCodes]);
    await queryService.query<ResultSetHeader>(BOOKING_QUERIES.FAIL_PENDING_PAYMENTS, [bookingCodes]);
  },

  async listBookingsByCustomer(userId: number, limit: number, offset: number): Promise<any[]> {
    const [rows] = await queryService.query<RowDataPacket[]>(BOOKING_QUERIES.LIST_BOOKINGS_BY_CUSTOMER, [userId, limit, offset]);
    return rows || [];
  },

  async countBookingsByCustomer(userId: number): Promise<number> {
    const [rows] = await queryService.query<RowDataPacket[]>(BOOKING_QUERIES.COUNT_BOOKINGS_BY_CUSTOMER, [userId]);
    return rows?.[0]?.total || 0;
  },

  async getBookingDetail(bookingCode: string | number): Promise<any | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(BOOKING_QUERIES.GET_BOOKING_DETAIL, [bookingCode]);
    return rows?.[0] || null;
  },

  async cancelBooking(bookingCode: string | number): Promise<void> {
    await queryService.query<ResultSetHeader>(BOOKING_QUERIES.CANCEL_BOOKING, [bookingCode]);
  },

  async decrementFieldRent(fieldCode: number): Promise<void> {
    await queryService.query<ResultSetHeader>(BOOKING_QUERIES.DECREMENT_FIELD_RENT, [fieldCode]);
  },

  async incrementFieldRent(fieldCode: number): Promise<void> {
    await queryService.query<ResultSetHeader>(BOOKING_QUERIES.INCREMENT_FIELD_RENT, [fieldCode]);
  },

  async checkQuantityExists(quantityID: number, fieldCode: number): Promise<boolean> {
    const [rows] = await queryService.query<RowDataPacket[]>(BOOKING_QUERIES.CHECK_QUANTITY_EXISTS, [quantityID, fieldCode]);
    return !!rows?.[0];
  },

  async getQuantityStatus(quantityID: number): Promise<string | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(BOOKING_QUERIES.GET_QUANTITY_STATUS, [quantityID]);
    return (rows?.[0] as any)?.Status || null;
  },

  async checkQuantityBookedForSlot(quantityID: number, playDate: string, startTime: string, endTime: string): Promise<boolean> {
    const [rows] = await queryService.query<RowDataPacket[]>(BOOKING_QUERIES.CHECK_QUANTITY_BOOKED_FOR_SLOT, [quantityID, playDate, startTime, endTime]);
    return Number((rows?.[0] as any)?.cnt ?? 0) > 0;
  },

  async ensureSlotExists(fieldCode: number, quantityID: number | null, playDate: string, startTime: string, endTime: string): Promise<void> {
    const [slots] = await queryService.query<RowDataPacket[]>(BOOKING_QUERIES.CHECK_SLOT_EXISTS, [fieldCode, playDate, startTime, endTime]);
    if (!slots?.[0]) {
      try {
        await queryService.query(BOOKING_QUERIES.CREATE_FIELD_SLOT, [fieldCode, quantityID, playDate, startTime, endTime]);
      } catch (err: any) {
        if (err.code === "ER_DUP_ENTRY") {
          await queryService.query(BOOKING_QUERIES.UPDATE_FIELD_SLOT_TO_AVAILABLE, [quantityID ?? null, fieldCode, playDate, startTime, endTime]);
        } else {
          throw err;
        }
      }
    }
  },

  async createSimpleBookingTx(connection: PoolConnection, payload: any): Promise<number> {
    const { fieldCode, quantityID, userId, customerName, customerEmail, customerPhone, totalPrice, platformFee, netToShop, playDate, startTime, endTime, pricePerSlot } = payload;
    const [bookingResult] = await connection.query<ResultSetHeader>(BOOKING_QUERIES.CREATE_SIMPLE_BOOKING, [fieldCode, quantityID, userId, customerName, customerEmail, customerPhone, totalPrice, platformFee, netToShop]);
    const bookingCode = (bookingResult as any).insertId;
    await connection.query<ResultSetHeader>(BOOKING_QUERIES.CREATE_BOOKING_SLOT_SIMPLE, [bookingCode, fieldCode, quantityID, playDate, startTime, endTime, pricePerSlot]);
    let updateSlotQuery = BOOKING_QUERIES.UPDATE_FIELD_SLOT_TO_BOOKED_SIMPLE;
    const updateSlotParams: any[] = [bookingCode, quantityID ?? null, fieldCode, playDate, startTime, endTime];
    if (quantityID !== null) {
      updateSlotQuery += ` AND (QuantityID = ? OR QuantityID IS NULL)`;
      updateSlotParams.push(quantityID);
    }
    await connection.query<ResultSetHeader>(updateSlotQuery, updateSlotParams);
    return bookingCode;
  },

  async withTransaction<T>(label: string, handler: (connection: PoolConnection) => Promise<T>): Promise<T> {
    return queryService.execTransaction(label, handler);
  },

  async cancelPendingBookingsForShop(shopCode: number): Promise<void> {
    await queryService.query<ResultSetHeader>(BOOKING_QUERIES.CANCEL_PENDING_BOOKINGS_FOR_SHOP, [shopCode]);
  },

  async listShopBookings(params: any): Promise<RowDataPacket[]> {
    const { shopCode, status, search, sortField, sortOrder, limit, offset } = params;
    let query = BOOKING_QUERIES.LIST_SHOP_BOOKINGS;
    const queryParams: any[] = [shopCode];

    if (status) {
      query += ` AND b.BookingStatus = ?`;
      queryParams.push(status);
    }

    if (search) {
      const searchTerm = `%${search.trim()}%`;
      query += ` AND (CAST(b.BookingCode AS CHAR) LIKE ? OR f.FieldName LIKE ? OR b.CustomerPhone LIKE ? OR u.FullName LIKE ?)`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY b.${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    const [rows] = await queryService.query<RowDataPacket[]>(query, queryParams);
    return rows || [];
  },

  async countShopBookings(params: any): Promise<number> {
    const { shopCode, status, search } = params;
    let query = BOOKING_QUERIES.COUNT_SHOP_BOOKINGS;
    const queryParams: any[] = [shopCode];

    if (status) {
      query += ` AND b.BookingStatus = ?`;
      queryParams.push(status);
    }

    if (search) {
      const searchTerm = `%${search.trim()}%`;
      query += ` AND (CAST(b.BookingCode AS CHAR) LIKE ? OR f.FieldName LIKE ? OR b.CustomerPhone LIKE ? OR u.FullName LIKE ?)`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const [rows] = await queryService.query<RowDataPacket[]>(query, queryParams);
    return rows?.[0]?.total || 0;
  },
};

export default bookingModel;
