"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const query_1 = __importDefault(require("../services/query"));
const fieldQuantityModel = {
    /**
     * Create single quantity
     */
    async create(fieldCode, quantityNumber) {
        const query = `
      INSERT INTO Field_Quantity (FieldCode, QuantityNumber, Status)
      VALUES (?, ?, 'available')
    `;
        const result = await query_1.default.execQuery(query, [
            fieldCode,
            quantityNumber,
        ]);
        if (typeof result === "boolean")
            return result;
        return Number(result?.insertId ?? 0);
    },
    /**
     * Bulk create quantities for a field
     * Used when creating a new field with multiple courts
     */
    async bulkCreate(fieldCode, count) {
        if (count <= 0)
            return 0;
        const query = `
      INSERT INTO Field_Quantity (FieldCode, QuantityNumber, Status)
      VALUES ${Array(count)
            .fill(0)
            .map((_, i) => `(?, ?, 'available')`)
            .join(",")}
    `;
        const params = Array(count)
            .fill(0)
            .flatMap((_, i) => [fieldCode, i + 1]);
        const result = await query_1.default.execQuery(query, params);
        if (typeof result === "boolean")
            return result ? count : 0;
        return Number(result?.affectedRows ?? 0);
    },
    /**
     * Get all quantities for a field
     */
    async getByFieldCode(fieldCode) {
        const query = `
      SELECT
        QuantityID AS quantity_id,
        FieldCode AS field_code,
        QuantityNumber AS quantity_number,
        Status AS status,
        DATE_FORMAT(CreatedAt, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(UpdatedAt, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM Field_Quantity
      WHERE FieldCode = ?
      ORDER BY QuantityNumber ASC
    `;
        return (await query_1.default.execQueryList(query, [
            fieldCode,
        ]));
    },
    /**
     * Get single quantity by ID
     */
    async getById(quantityId) {
        const query = `
      SELECT
        QuantityID AS quantity_id,
        FieldCode AS field_code,
        QuantityNumber AS quantity_number,
        Status AS status,
        DATE_FORMAT(CreatedAt, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(UpdatedAt, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM Field_Quantity
      WHERE QuantityID = ?
      LIMIT 1
    `;
        const rows = (await query_1.default.execQueryList(query, [
            quantityId,
        ]));
        return rows[0] || null;
    },
    /**
     * Get available quantities for a field (available + not maintenance/inactive)
     */
    async getAvailableQuantities(fieldCode) {
        const query = `
      SELECT
        QuantityID AS quantity_id,
        QuantityNumber AS quantity_number,
        Status AS status
      FROM Field_Quantity
      WHERE FieldCode = ? AND Status = 'available'
      ORDER BY QuantityNumber ASC
    `;
        return (await query_1.default.execQueryList(query, [
            fieldCode,
        ]));
    },
    /**
     * Get available quantities for a specific time slot
     * Available = Not booked (with paid status) + Status = 'available'
     *
     * Logic:
     * 1. Get all quantities for this field with status = 'available'
     * 2. Exclude quantities that have a PAID booking in this time slot
     *    - Check Bookings with PaymentStatus = 'paid'
     *    - Check Field_Slots with matching PlayDate and time overlap
     */
    async getAvailableForSlot(fieldCode, playDate, startTime, endTime) {
        const query = `
      SELECT
        fq.QuantityID AS quantity_id,
        fq.QuantityNumber AS quantity_number,
        fq.Status AS status
      FROM Field_Quantity fq
      WHERE fq.FieldCode = ?
        AND fq.Status = 'available'
        AND fq.QuantityID NOT IN (
          SELECT DISTINCT fs.QuantityID
          FROM Field_Slots fs
          WHERE fs.FieldCode = ?
            AND fs.QuantityID IS NOT NULL
            AND fs.PlayDate = ?
            AND fs.StartTime < ?
            AND fs.EndTime > ?
            AND (
              fs.Status = 'booked'
              OR (fs.Status = 'held' AND (fs.HoldExpiresAt IS NULL OR fs.HoldExpiresAt > NOW()))
            )
        )
      ORDER BY fq.QuantityNumber ASC
    `;
        return (await query_1.default.execQueryList(query, [
            fieldCode,
            fieldCode,
            playDate,
            endTime,
            startTime,
        ]));
    },
    /**
     * Get booked quantities for a specific time slot
     *
     * Logic:
     * 1. Get quantities that have a PAID booking in this time slot
     *    - Find Field_Slots entries for this field + playDate + time
     *    - Get the BookingCode
     *    - Get QuantityID from that Booking with PaymentStatus = 'paid'
     */
    async getBookedForSlot(fieldCode, playDate, startTime, endTime) {
        const query = `
      SELECT DISTINCT
        fs.QuantityID AS quantity_id,
        fq.QuantityNumber AS quantity_number,
        fs.Status AS status
      FROM Field_Slots fs
      INNER JOIN Field_Quantity fq ON fs.QuantityID = fq.QuantityID
      WHERE fs.FieldCode = ?
        AND fs.QuantityID IS NOT NULL
        AND fs.PlayDate = ?
        AND fs.StartTime < ?
        AND fs.EndTime > ?
        AND (
          fs.Status = 'booked'
          OR (fs.Status = 'held' AND (fs.HoldExpiresAt IS NULL OR fs.HoldExpiresAt > NOW()))
        )
      ORDER BY fq.QuantityNumber ASC
    `;
        return (await query_1.default.execQueryList(query, [
            fieldCode,
            playDate,
            endTime,
            startTime,
        ]));
    },
    /**
     * Update quantity status (available, maintenance, inactive)
     */
    async updateStatus(quantityId, status) {
        const query = `
      UPDATE Field_Quantity
      SET Status = ?, UpdatedAt = NOW()
      WHERE QuantityID = ?
    `;
        const result = await query_1.default.execQuery(query, [status, quantityId]);
        if (typeof result === "boolean")
            return result;
        return result.affectedRows > 0;
    },
    /**
     * Check if specific quantity is available for time slot
     */
    async isAvailableForSlot(quantityId, playDate, startTime, endTime) {
        const query = `
      SELECT COUNT(*) AS cnt
      FROM Field_Quantity fq
      WHERE fq.QuantityID = ?
        AND fq.Status = 'available'
        AND NOT EXISTS (
          SELECT 1
          FROM Field_Slots fs
          WHERE fs.FieldCode = fq.FieldCode
            AND fs.QuantityID = fq.QuantityID
            AND fs.PlayDate = ?
            AND fs.StartTime < ?
            AND fs.EndTime > ?
            AND (
              fs.Status = 'booked'
              OR (fs.Status = 'held' AND (fs.HoldExpiresAt IS NULL OR fs.HoldExpiresAt > NOW()))
            )
        )
    `;
        const rows = (await query_1.default.execQueryList(query, [
            quantityId,
            playDate,
            endTime,
            startTime,
        ]));
        return Number(rows?.[0]?.cnt ?? 0) > 0;
    },
    /**
     * Get quantity count for a field
     */
    async getCountByFieldCode(fieldCode) {
        const query = `
      SELECT COUNT(*) AS cnt
      FROM Field_Quantity
      WHERE FieldCode = ?
    `;
        const rows = (await query_1.default.execQueryList(query, [
            fieldCode,
        ]));
        return Number(rows?.[0]?.cnt ?? 0);
    },
    /**
     * Delete quantity by ID
     */
    async deleteById(quantityId) {
        const query = `DELETE FROM Field_Quantity WHERE QuantityID = ?`;
        const result = await query_1.default.execQuery(query, [quantityId]);
        if (typeof result === "boolean")
            return result;
        return result.affectedRows > 0;
    },
    /**
     * Delete all quantities for a field (usually via cascade, but explicit method available)
     */
    async deleteByFieldCode(fieldCode) {
        const query = `DELETE FROM Field_Quantity WHERE FieldCode = ?`;
        const result = await query_1.default.execQuery(query, [fieldCode]);
        if (typeof result === "boolean")
            return result ? 1 : 0;
        return Number(result?.affectedRows ?? 0);
    },
    async getMaxQuantityNumber(fieldCode) {
        const query = `
      SELECT COALESCE(MAX(QuantityNumber), 0) AS max_no
      FROM Field_Quantity
      WHERE FieldCode = ?
    `;
        const rows = await query_1.default.execQueryList(query, [fieldCode]);
        return Number(rows?.[0]?.max_no ?? 0);
    },
    async countFutureBookedQuantities(fieldCode) {
        const query = `
      SELECT COUNT(DISTINCT fs.QuantityID) AS cnt
      FROM Field_Slots fs
      INNER JOIN Bookings b ON b.BookingCode = fs.BookingCode
      WHERE fs.FieldCode = ?
        AND fs.QuantityID IS NOT NULL
        AND (
          fs.PlayDate > CURDATE()
          OR (
            fs.PlayDate = CURDATE()
            AND fs.EndTime > DATE_FORMAT(CONVERT_TZ(NOW(), '+00:00', '+07:00'), '%H:%i')
          )
        )
        AND b.BookingStatus IN ('pending', 'confirmed')
    `;
        const rows = await query_1.default.execQueryList(query, [fieldCode]);
        return Number(rows?.[0]?.cnt ?? 0);
    },
    async getRemovableQuantityIds(fieldCode, limit) {
        if (limit <= 0)
            return [];
        const query = `
      SELECT fq.QuantityID AS quantity_id
      FROM Field_Quantity fq
      LEFT JOIN (
        SELECT DISTINCT fs.QuantityID
        FROM Field_Slots fs
        INNER JOIN Bookings b ON b.BookingCode = fs.BookingCode
        WHERE fs.FieldCode = ?
          AND fs.QuantityID IS NOT NULL
          AND (
            fs.PlayDate > CURDATE()
            OR (
              fs.PlayDate = CURDATE()
              AND fs.EndTime > DATE_FORMAT(CONVERT_TZ(NOW(), '+00:00', '+07:00'), '%H:%i')
            )
          )
          AND b.BookingStatus IN ('pending', 'confirmed')
      ) busy ON busy.QuantityID = fq.QuantityID
      WHERE fq.FieldCode = ? AND busy.QuantityID IS NULL
      ORDER BY fq.QuantityNumber DESC
      LIMIT ?
    `;
        const rows = await query_1.default.execQueryList(query, [
            fieldCode,
            fieldCode,
            limit,
        ]);
        return rows.map((row) => Number(row.quantity_id ?? 0));
    },
    async deleteByIds(quantityIds) {
        if (!quantityIds.length)
            return 0;
        const placeholders = quantityIds.map(() => "?").join(", ");
        const query = `
      DELETE FROM Field_Quantity
      WHERE QuantityID IN (${placeholders})
    `;
        const result = await query_1.default.execQuery(query, quantityIds);
        if (typeof result === "boolean")
            return result ? quantityIds.length : 0;
        return Number(result?.affectedRows ?? 0);
    },
};
exports.default = fieldQuantityModel;
