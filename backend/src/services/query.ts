import { RowDataPacket } from "mysql2";
import pool from "../configs/db.config";
import { IError } from "../interfaces/common";
const queryService = {
   execQueryList: async (query: string, params: any[]): Promise<any[]> => {
      try {
         const [rows] = await pool.query<RowDataPacket[]>(query, params);
         return rows;
      } catch (error: unknown) {
         throw error;
      }
   },

   execQueryCnt: async (query: string, params: any[]): Promise<number> => {
      try {
         const [rows] = await pool.query<RowDataPacket[]>(query, params);
         return parseInt(rows[0]?.cnt) ?? 0;
      } catch (error: unknown) {
         throw error;
      }
   },

   execQueryOne: async (query: string, params: any[]): Promise<object | null> => {
      try {
         const [rows] = await pool.query<RowDataPacket[]>(query, params);
         return rows[0] ?? null;
      } catch (error: unknown) {
         throw error;
      }
   },

   execQuery: async (query: string, params: any[]): Promise<boolean> => {
      try {
         await pool.query<RowDataPacket[]>(query, params);
         return true;
      } catch (error: unknown) {
         throw error;
      }
   },
   execTransaction: async (logBase: string, callback: (conn: any) => Promise<any>): Promise<boolean> => {
      const connection = await pool.getConnection(); // get dedicated connection
      try {
         await connection.beginTransaction();

         // Run user-defined logic inside transaction
         await callback(connection);

         await connection.commit();
         return true;
      } catch (error: unknown) {
         await connection.rollback();
         return false;
      } finally {
         connection.release();
      }
   },
};

export default queryService;
