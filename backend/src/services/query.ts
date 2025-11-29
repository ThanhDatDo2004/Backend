import { RowDataPacket, ResultSetHeader, FieldPacket } from "mysql2";
import { PoolConnection } from "mysql2/promise";
import pool from "../configs/db.config";

const queryService = {
  execQueryList: async (query: string, params: any[]): Promise<RowDataPacket[]> => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(query, params);
      return rows;
    } catch (error: unknown) {
      console.error("❌ execQueryList error:", { query, params, error });
      throw error;
    }
  },

  execQueryCnt: async (query: string, params: any[]): Promise<number> => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(query, params);
      return Number((rows[0] as any)?.cnt) || 0;
    } catch (error: unknown) {
      console.error("❌ execQueryCnt error:", { query, params, error });
      throw error;
    }
  },

  execQueryOne: async (query: string, params: any[]): Promise<RowDataPacket | null> => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(query, params);
      return rows[0] ?? null;
    } catch (error: unknown) {
      console.error("❌ execQueryOne error:", { query, params, error });
      throw error;
    }
  },

  execQuery: async (query: string, params: any[]): Promise<ResultSetHeader> => {
    try {
      const [result] = await pool.query<ResultSetHeader>(query, params);
      return result;
    } catch (error: unknown) {
      console.error("❌ execQuery error:", { query, params, error });
      throw error;
    }
  },

  /**
   * Generic query method
   * - SELECT → RowDataPacket[]
   * - INSERT/UPDATE/DELETE → ResultSetHeader
   */
  query: async <
    T extends RowDataPacket[] | ResultSetHeader
  >(query: string, params: any[]): Promise<[T, FieldPacket[]]> => {
    try {
      const [rows, fields] = await pool.query<any>(query, params);
      return [rows as T, fields];
    } catch (error: unknown) {
      console.error("❌ query error:", { query, params, error });
      throw error;
    }
  },

  execTransaction: async <T>(
    logBase: string,
    callback: (conn: PoolConnection) => Promise<T>
  ): Promise<T> => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error: unknown) {
      await connection.rollback();
      console.error("❌ execTransaction error:", { logBase, error });
      throw error;
    } finally {
      connection.release();
    }
  },
};

export default queryService;
