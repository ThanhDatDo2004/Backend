import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import queryService from "../services/query";

export type FieldQuantityRow = {
  quantity_id: number;
  field_code: number;
  quantity_number: number;
  status: "available" | "maintenance" | "inactive";
  created_at: string;
  updated_at: string;
};

export type AvailableQuantityRow = {
  quantity_id: number;
  quantity_number: number;
  status: "available" | "maintenance" | "inactive";
};

const fieldQuantityModel = {
  /**
   * Create single quantity
   */
  async create(fieldCode: number, quantityNumber: number) {
    const query = `
      INSERT INTO Field_Quantity (FieldCode, QuantityNumber, Status)
      VALUES (?, ?, 'available')
    `;
    const result = await queryService.execQuery(query, [
      fieldCode,
      quantityNumber,
    ]);
    if (typeof result === "boolean") return result;
    return Number((result as ResultSetHeader)?.insertId ?? 0);
  },

  /**
   * Bulk create quantities for a field
   * Used when creating a new field with multiple courts
   */
  async bulkCreate(fieldCode: number, count: number) {
    if (count <= 0) return 0;

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

    const result = await queryService.execQuery(query, params);
    if (typeof result === "boolean") return result ? count : 0;
    return Number((result as ResultSetHeader)?.affectedRows ?? 0);
  },

  /**
   * Get all quantities for a field
   */
  async getByFieldCode(fieldCode: number) {
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
    return (await queryService.execQueryList(query, [
      fieldCode,
    ])) as FieldQuantityRow[];
  },

  /**
   * Get single quantity by ID
   */
  async getById(quantityId: number) {
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
    const rows = (await queryService.execQueryList(query, [
      quantityId,
    ])) as FieldQuantityRow[];
    return rows[0] || null;
  },

  /**
   * Get available quantities for a field (available + not maintenance/inactive)
   */
  async getAvailableQuantities(fieldCode: number) {
    const query = `
      SELECT
        QuantityID AS quantity_id,
        QuantityNumber AS quantity_number,
        Status AS status
      FROM Field_Quantity
      WHERE FieldCode = ? AND Status = 'available'
      ORDER BY QuantityNumber ASC
    `;
    return (await queryService.execQueryList(query, [
      fieldCode,
    ])) as AvailableQuantityRow[];
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
  async getAvailableForSlot(
    fieldCode: number,
    playDate: string,
    startTime: string,
    endTime: string
  ) {
    const query = `
      SELECT
        fq.QuantityID AS quantity_id,
        fq.QuantityNumber AS quantity_number,
        fq.Status AS status
      FROM Field_Quantity fq
      WHERE fq.FieldCode = ?
        AND fq.Status = 'available'
        AND fq.QuantityID NOT IN (
          SELECT DISTINCT b.QuantityID
          FROM Bookings b
          INNER JOIN Field_Slots fs ON b.BookingCode = fs.BookingCode
          WHERE b.FieldCode = ?
            AND b.QuantityID IS NOT NULL
            AND b.PaymentStatus = 'paid'
            AND fs.FieldCode = ?
            AND fs.PlayDate = ?
            AND fs.StartTime < ?
            AND fs.EndTime > ?
        )
      ORDER BY fq.QuantityNumber ASC
    `;
    return (await queryService.execQueryList(query, [
      fieldCode,
      fieldCode,
      fieldCode,
      playDate,
      endTime,
      startTime,
    ])) as AvailableQuantityRow[];
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
  async getBookedForSlot(
    fieldCode: number,
    playDate: string,
    startTime: string,
    endTime: string
  ) {
    const query = `
      SELECT DISTINCT
        b.QuantityID AS quantity_id,
        fq.QuantityNumber AS quantity_number,
        fq.Status AS status
      FROM Bookings b
      INNER JOIN Field_Quantity fq ON b.QuantityID = fq.QuantityID
      INNER JOIN Field_Slots fs ON b.BookingCode = fs.BookingCode
      WHERE b.FieldCode = ?
        AND b.QuantityID IS NOT NULL
        AND b.PaymentStatus = 'paid'
        AND fs.FieldCode = ?
        AND fs.PlayDate = ?
        AND fs.StartTime < ?
        AND fs.EndTime > ?
      ORDER BY fq.QuantityNumber ASC
    `;
    return (await queryService.execQueryList(query, [
      fieldCode,
      fieldCode,
      playDate,
      endTime,
      startTime,
    ])) as AvailableQuantityRow[];
  },

  /**
   * Update quantity status (available, maintenance, inactive)
   */
  async updateStatus(
    quantityId: number,
    status: "available" | "maintenance" | "inactive"
  ) {
    const query = `
      UPDATE Field_Quantity
      SET Status = ?, UpdatedAt = NOW()
      WHERE QuantityID = ?
    `;
    const result = await queryService.execQuery(query, [status, quantityId]);
    if (typeof result === "boolean") return result;
    return (result as any).affectedRows > 0;
  },

  /**
   * Check if specific quantity is available for time slot
   */
  async isAvailableForSlot(
    quantityId: number,
    playDate: string,
    startTime: string,
    endTime: string
  ) {
    const query = `
      SELECT COUNT(*) AS cnt
      FROM Field_Quantity fq
      WHERE fq.QuantityID = ?
        AND fq.Status = 'available'
        AND NOT EXISTS (
          SELECT 1
          FROM Bookings b
          WHERE b.QuantityID = ?
            AND b.PlayDate = ?
            AND b.StartTime < ?
            AND b.EndTime > ?
            AND b.BookingStatus IN ('pending', 'confirmed')
        )
    `;
    const rows = (await queryService.execQueryList(query, [
      quantityId,
      quantityId,
      playDate,
      endTime,
      startTime,
    ])) as Array<{ cnt: number }>;
    return Number(rows?.[0]?.cnt ?? 0) > 0;
  },

  /**
   * Get quantity count for a field
   */
  async getCountByFieldCode(fieldCode: number) {
    const query = `
      SELECT COUNT(*) AS cnt
      FROM Field_Quantity
      WHERE FieldCode = ?
    `;
    const rows = (await queryService.execQueryList(query, [
      fieldCode,
    ])) as Array<{ cnt: number }>;
    return Number(rows?.[0]?.cnt ?? 0);
  },

  /**
   * Delete quantity by ID
   */
  async deleteById(quantityId: number) {
    const query = `DELETE FROM Field_Quantity WHERE QuantityID = ?`;
    const result = await queryService.execQuery(query, [quantityId]);
    if (typeof result === "boolean") return result;
    return (result as any).affectedRows > 0;
  },

  /**
   * Delete all quantities for a field (usually via cascade, but explicit method available)
   */
  async deleteByFieldCode(fieldCode: number) {
    const query = `DELETE FROM Field_Quantity WHERE FieldCode = ?`;
    const result = await queryService.execQuery(query, [fieldCode]);
    if (typeof result === "boolean") return result ? 1 : 0;
    return Number((result as ResultSetHeader)?.affectedRows ?? 0);
  },
};

export default fieldQuantityModel;
