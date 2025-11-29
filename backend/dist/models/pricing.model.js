"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const query_1 = __importDefault(require("../services/query"));
// ============ PRICING MODEL ============
const pricingModel = {
    /**
     * Get default price from field
     */
    async getDefaultPrice(fieldCode) {
        const fieldDetails = await query_1.default.execQueryOne(`SELECT DefaultPricePerHour FROM Fields WHERE FieldCode = ?`, [fieldCode]);
        return fieldDetails?.DefaultPricePerHour || 50000;
    },
    /**
     * Create operating hours
     */
    async createOperatingHours(fieldCode, dayOfWeek, startTime, endTime, pricePerHour) {
        const query = `
      INSERT INTO Field_Pricing (
        FieldCode,
        DayOfWeek,
        StartTime,
        EndTime,
        PricePerHour
      ) VALUES (?, ?, ?, ?, ?)
    `;
        const result = await query_1.default.execQuery(query, [
            fieldCode,
            dayOfWeek,
            startTime,
            endTime,
            pricePerHour,
        ]);
        if (typeof result === "boolean") {
            throw new Error("Cannot create operating hours");
        }
        return result.insertId;
    },
    /**
     * Get operating hours by ID
     */
    async getOperatingHoursById(pricingId, userId) {
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
        const rows = await query_1.default.execQueryList(query, [pricingId, userId]);
        return rows[0] || null;
    },
    /**
     * Update operating hours
     */
    async updateOperatingHours(pricingId, updateFields) {
        const fields = [];
        const params = [];
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
        const result = await query_1.default.execQuery(query, params);
        if (typeof result === "boolean") {
            return result;
        }
        return result.affectedRows > 0;
    },
    /**
     * Delete operating hours
     */
    async deleteOperatingHours(pricingId) {
        const query = `DELETE FROM Field_Pricing WHERE PricingID = ?`;
        const result = await query_1.default.execQuery(query, [pricingId]);
        if (typeof result === "boolean") {
            return result;
        }
        return result.affectedRows > 0;
    },
    /**
     * Check for time overlap on same day and field
     */
    async checkTimeOverlap(fieldCode, dayOfWeek, startTime, endTime, excludePricingId) {
        let query = `
      SELECT COUNT(*) AS count
      FROM Field_Pricing
      WHERE FieldCode = ? 
        AND DayOfWeek = ?
        AND NOT (EndTime <= ? OR StartTime >= ?)
    `;
        const params = [fieldCode, dayOfWeek, startTime, endTime];
        if (excludePricingId) {
            query += " AND PricingID != ?";
            params.push(excludePricingId);
        }
        const rows = await query_1.default.execQueryList(query, params);
        return rows[0]?.count || 0;
    },
    /**
     * Get pricing record by ID (for retrieval)
     */
    async getPricingById(pricingId) {
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
        const rows = await query_1.default.execQueryList(query, [pricingId]);
        return rows[0] || null;
    },
};
exports.default = pricingModel;
