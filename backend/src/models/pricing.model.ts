import type { ResultSetHeader, RowDataPacket } from "mysql2";
import queryService from "../core/database";
import { PRICING_QUERIES } from "../queries/pricing.queries";
import { PRICING_QUERIES } from "../queries/pricing.queries";

// ============ TYPES ============
export type OperatingHoursRow = {
  pricing_id: number;
  field_code: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type FieldDetailsRow = {
  DefaultPricePerHour: number;
};

// ============ PRICING MODEL ============
const pricingModel = {
  /**
   * Get default price from field
   */
  async getDefaultPrice(fieldCode: number): Promise<number> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      PRICING_QUERIES.GET_DEFAULT_PRICE,
      [fieldCode]
    );
    const record = rows?.[0] as RowDataPacket | undefined;
    return Number(record?.DefaultPricePerHour ?? 50000);
  },

  /**
   * Create operating hours
   */
  async createOperatingHours(
    fieldCode: number,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    pricePerHour: number
  ): Promise<number> {
    const result = await queryService.execQuery(
      PRICING_QUERIES.CREATE_OPERATING_HOURS,
      [fieldCode, dayOfWeek, startTime, endTime, pricePerHour]
    );

    if (typeof result === "boolean") {
      throw new Error("Cannot create operating hours");
    }

    return (result as any).insertId;
  },

  /**
   * Get operating hours by ID
   */
  async getOperatingHoursById(
    pricingId: number,
    userId: number
  ): Promise<OperatingHoursRow | null> {
    const rows = await queryService.execQueryList(
      PRICING_QUERIES.GET_OPERATING_HOURS_BY_ID,
      [pricingId, userId]
    );
    return (rows[0] as OperatingHoursRow) || null;
  },

  /**
   * Update operating hours
   */
  async updateOperatingHours(
    pricingId: number,
    updateFields: { dayOfWeek?: number; startTime?: string; endTime?: string }
  ): Promise<boolean> {
    const fields: string[] = [];
    const params: any[] = [];

    if (updateFields.dayOfWeek !== undefined) {
      fields.push("DayOfWeek = ?");
      params.push(updateFields.dayOfWeek);
    }
    if (updateFields.startTime !== undefined) {
      fields.push("StartTime = ?");
      params.push(updateFields.startTime);
    }
    if (updateFields.endTime !== undefined) {
      fields.push("EndTime = ?");
      params.push(updateFields.endTime);
    }

    if (fields.length === 0) {
      return true;
    }

    params.push(pricingId);

    const query = PRICING_QUERIES.UPDATE_OPERATING_HOURS_BASE.replace(
      "{{FIELDS}}",
      fields.join(", ")
    );

    const result = await queryService.execQuery(query, params);
    if (typeof result === "boolean") {
      return result;
    }

    return (result as any).affectedRows > 0;
  },

  /**
   * Delete operating hours
   */
  async deleteOperatingHours(pricingId: number): Promise<boolean> {
    const result = await queryService.execQuery(
      PRICING_QUERIES.DELETE_OPERATING_HOURS,
      [pricingId]
    );

    if (typeof result === "boolean") {
      return result;
    }

    return (result as any).affectedRows > 0;
  },

  /**
   * Check for time overlap on same day and field
   */
  async checkTimeOverlap(
    fieldCode: number,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludePricingId?: number
  ): Promise<number> {
    const params: any[] = [fieldCode, dayOfWeek, startTime, endTime];

    const query = PRICING_QUERIES.CHECK_TIME_OVERLAP.replace(
      "{{EXCLUDE}}",
      excludePricingId ? " AND PricingID != ?" : ""
    );

    if (excludePricingId) {
      params.push(excludePricingId);
    }

    const rows = await queryService.execQueryList(query, params);
    return (rows[0] as any)?.count || 0;
  },

  /**
   * Get pricing record by ID (for retrieval)
   */
  async getPricingById(pricingId: number) {
    const rows = await queryService.execQueryList(
      PRICING_QUERIES.GET_PRICING_BY_ID,
      [pricingId]
    );
    return (rows[0] as OperatingHoursRow) || null;
  },
};

export default pricingModel;
