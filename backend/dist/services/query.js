"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_config_1 = __importDefault(require("../configs/db.config"));
const queryService = {
    execQueryList: async (query, params) => {
        try {
            const [rows] = await db_config_1.default.query(query, params);
            return rows;
        }
        catch (error) {
            console.error("❌ execQueryList error:", { query, params, error });
            throw error;
        }
    },
    execQueryCnt: async (query, params) => {
        try {
            const [rows] = await db_config_1.default.query(query, params);
            return Number(rows[0]?.cnt) || 0;
        }
        catch (error) {
            console.error("❌ execQueryCnt error:", { query, params, error });
            throw error;
        }
    },
    execQueryOne: async (query, params) => {
        try {
            const [rows] = await db_config_1.default.query(query, params);
            return rows[0] ?? null;
        }
        catch (error) {
            console.error("❌ execQueryOne error:", { query, params, error });
            throw error;
        }
    },
    execQuery: async (query, params) => {
        try {
            const [result] = await db_config_1.default.query(query, params);
            return result;
        }
        catch (error) {
            console.error("❌ execQuery error:", { query, params, error });
            throw error;
        }
    },
    /**
     * Generic query method
     * - SELECT → RowDataPacket[]
     * - INSERT/UPDATE/DELETE → ResultSetHeader
     */
    query: async (query, params) => {
        try {
            const [rows, fields] = await db_config_1.default.query(query, params);
            return [rows, fields];
        }
        catch (error) {
            console.error("❌ query error:", { query, params, error });
            throw error;
        }
    },
    execTransaction: async (logBase, callback) => {
        const connection = await db_config_1.default.getConnection();
        try {
            await connection.beginTransaction();
            const result = await callback(connection);
            await connection.commit();
            return result;
        }
        catch (error) {
            await connection.rollback();
            console.error("❌ execTransaction error:", { logBase, error });
            throw error;
        }
        finally {
            connection.release();
        }
    },
};
exports.default = queryService;
