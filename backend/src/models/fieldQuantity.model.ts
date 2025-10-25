import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import queryService from "../core/database";
import { FIELD_QUANTITY_QUERIES } from "../queries/fieldQuantity.queries";

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
  status: string;
};

const fieldQuantityModel = {
  async create(fieldCode: number, quantityNumber: number) {
    const result = await queryService.execQuery(
      FIELD_QUANTITY_QUERIES.CREATE,
      [fieldCode, quantityNumber]
    );
    if (typeof result === "boolean") return result;
    return Number((result as ResultSetHeader)?.insertId ?? 0);
  },

  async bulkCreate(fieldCode: number, count: number) {
    if (count <= 0) return 0;
    const valuesClause = Array(count)
      .fill(0)
      .map(() => "(?, ?, 'available')")
      .join(",");
    const query = FIELD_QUANTITY_QUERIES.BULK_CREATE.replace(
      "{{VALUES}}",
      valuesClause
    );
    const params = Array(count)
      .fill(0)
      .flatMap((_, index) => [fieldCode, index + 1]);
    const result = await queryService.execQuery(query, params);
    if (typeof result === "boolean") return result ? count : 0;
    return Number((result as ResultSetHeader)?.affectedRows ?? 0);
  },

  async getByFieldCode(fieldCode: number) {
    return (await queryService.execQueryList(
      FIELD_QUANTITY_QUERIES.GET_BY_FIELD_CODE,
      [fieldCode]
    )) as FieldQuantityRow[];
  },

  async getById(quantityId: number) {
    const rows = (await queryService.execQueryList(
      FIELD_QUANTITY_QUERIES.GET_BY_ID,
      [quantityId]
    )) as FieldQuantityRow[];
    return rows[0] || null;
  },

  async getAvailableQuantities(fieldCode: number) {
    return (await queryService.execQueryList(
      FIELD_QUANTITY_QUERIES.GET_AVAILABLE_QUANTITIES,
      [fieldCode]
    )) as AvailableQuantityRow[];
  },

  async getAvailableForSlot(
    fieldCode: number,
    playDate: string,
    startTime: string,
    endTime: string
  ) {
    return (await queryService.execQueryList(
      FIELD_QUANTITY_QUERIES.GET_AVAILABLE_FOR_SLOT,
      [fieldCode, fieldCode, playDate, endTime, startTime]
    )) as AvailableQuantityRow[];
  },

  async getBookedForSlot(
    fieldCode: number,
    playDate: string,
    startTime: string,
    endTime: string
  ) {
    return (await queryService.execQueryList(
      FIELD_QUANTITY_QUERIES.GET_BOOKED_FOR_SLOT,
      [fieldCode, playDate, endTime, startTime]
    )) as AvailableQuantityRow[];
  },

  async updateStatus(
    quantityId: number,
    status: "available" | "maintenance" | "inactive"
  ) {
    const result = await queryService.execQuery(
      FIELD_QUANTITY_QUERIES.UPDATE_STATUS,
      [status, quantityId]
    );
    if (typeof result === "boolean") return result;
    return (result as ResultSetHeader).affectedRows > 0;
  },

  async isAvailableForSlot(
    quantityId: number,
    playDate: string,
    startTime: string,
    endTime: string
  ) {
    const rows = (await queryService.execQueryList(
      FIELD_QUANTITY_QUERIES.IS_AVAILABLE_FOR_SLOT,
      [quantityId, playDate, endTime, startTime]
    )) as Array<{ cnt: number }>;
    return Number(rows?.[0]?.cnt ?? 0) > 0;
  },

  async getCountByFieldCode(fieldCode: number) {
    const rows = (await queryService.execQueryList(
      FIELD_QUANTITY_QUERIES.GET_COUNT_BY_FIELD_CODE,
      [fieldCode]
    )) as Array<{ cnt: number }>;
    return Number(rows?.[0]?.cnt ?? 0);
  },

  async deleteById(quantityId: number) {
    const result = await queryService.execQuery(
      FIELD_QUANTITY_QUERIES.DELETE_BY_ID,
      [quantityId]
    );
    if (typeof result === "boolean") return result;
    return (result as ResultSetHeader).affectedRows > 0;
  },

  async deleteByFieldCode(fieldCode: number) {
    const result = await queryService.execQuery(
      FIELD_QUANTITY_QUERIES.DELETE_BY_FIELD_CODE,
      [fieldCode]
    );
    if (typeof result === "boolean") return result ? 1 : 0;
    return Number((result as ResultSetHeader).affectedRows ?? 0);
  },
};

export default fieldQuantityModel;
