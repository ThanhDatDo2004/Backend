import type { ResultSetHeader, RowDataPacket } from "mysql2";
import queryService from "../services/query";

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
    const fieldDetails = await queryService.execQueryOne(
      `SELECT DefaultPricePerHour FROM Fields WHERE FieldCode = ?`,
      [fieldCode]
    );

    return (fieldDetails as any)?.DefaultPricePerHour || 50000;
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
    const query = `
      INSERT INTO Field_Pricing (
        FieldCode,
        DayOfWeek,
        StartTime,
        EndTime,
        PricePerHour
      ) VALUES (?, ?, ?, ?, ?)
    `;

    const result = await queryService.execQuery(query, [
      fieldCode,
      dayOfWeek,
      startTime,
      endTime,
      pricePerHour,
    ]);

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
    const query = `
      SELECT
        p.PricingID AS pricing_id,
        p.FieldCode AS field_code,
        p.DayOfWeek AS day_of_week,
        DATE_FORMAT(p.StartTime, '%H:%i') AS start_time,
        DATE_FORMAT(p.EndTime, '%H:%i') AS end_time
      FROM Field_Pricing p
      JOIN Fields f ON f.FieldCode = p.FieldCode
      JOIN Shops s ON s.ShopCode = f.ShopCode
      WHERE p.PricingID = ? AND s.UserID = ?
      LIMIT 1
    `;

    const rows = await queryService.execQueryList(query, [pricingId, userId]);
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

    const query = `
      UPDATE Field_Pricing
      SET ${fields.join(", ")}
      WHERE PricingID = ?
    `;

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
    const query = `DELETE FROM Field_Pricing WHERE PricingID = ?`;
    const result = await queryService.execQuery(query, [pricingId]);

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
    let query = `
      SELECT COUNT(*) AS count
      FROM Field_Pricing
      WHERE FieldCode = ? 
        AND DayOfWeek = ?
        AND NOT (EndTime <= ? OR StartTime >= ?)
    `;

    const params: any[] = [fieldCode, dayOfWeek, startTime, endTime];

    if (excludePricingId) {
      query += " AND PricingID != ?";
      params.push(excludePricingId);
    }

    const rows = await queryService.execQueryList(query, params);
    return (rows[0] as any)?.count || 0;
  },

  /**
   * Get pricing record by ID (for retrieval)
   */
  async getPricingById(pricingId: number) {
    const query = `
      SELECT
        p.PricingID AS pricing_id,
        p.FieldCode AS field_code,
        p.DayOfWeek AS day_of_week,
        DATE_FORMAT(p.StartTime, '%H:%i') AS start_time,
        DATE_FORMAT(p.EndTime, '%H:%i') AS end_time
      FROM Field_Pricing p
      WHERE p.PricingID = ?
      LIMIT 1
    `;

    const rows = await queryService.execQueryList(query, [pricingId]);
    return (rows[0] as OperatingHoursRow) || null;
  },
};

export default pricingModel;
