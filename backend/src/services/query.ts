import { RowDataPacket, ResultSetHeader } from "mysql2";
import { PoolConnection } from "mysql2/promise";
import pool from "../configs/db.config";
import { IError } from "../interfaces/common";

const queryService = {
  execQueryList: async (query: string, params: any[]): Promise<any[]> => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(query, params);
      return rows;
    } catch (error: unknown) {
      console.error("❌ execQueryList error:", {
        query,
        params,
        error: (error as Error).message,
      });
      throw error;
    }
  },

  execQueryCnt: async (query: string, params: any[]): Promise<number> => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(query, params);
      return parseInt(rows[0]?.cnt) ?? 0;
    } catch (error: unknown) {
      console.error("❌ execQueryCnt error:", {
        query,
        params,
        error: (error as Error).message,
      });
      throw error;
    }
  },

  execQueryOne: async (
    query: string,
    params: any[]
  ): Promise<object | null> => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(query, params);
      return rows[0] ?? null;
    } catch (error: unknown) {
      console.error("❌ execQueryOne error:", {
        query,
        params,
        error: (error as Error).message,
      });
      throw error;
    }
  },

  execQuery: async (query: string, params: any[]): Promise<ResultSetHeader> => {
    try {
      const [result] = await pool.query<ResultSetHeader>(query, params);
      return result;
    } catch (error: unknown) {
      console.error("❌ execQuery error:", {
        query,
        params,
        error: (error as Error).message,
      });
      throw error;
    }
  },

  // Generic query method for both SELECT and INSERT/UPDATE/DELETE
  query: async <T extends RowDataPacket[] | ResultSetHeader>(
    query: string,
    params: any[]
  ): Promise<
    [T extends RowDataPacket[] ? RowDataPacket[] : ResultSetHeader, any]
  > => {
    try {
      return await pool.query<T>(query, params);
    } catch (error: unknown) {
      console.error("❌ query error:", {
        query,
        params,
        error: (error as Error).message,
      });
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
      console.error("❌ execTransaction error:", {
        logBase,
        error: (error as Error).message,
      });
      throw error;
    } finally {
      connection.release();
    }
  },
};

export default queryService;
