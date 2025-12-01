import { createPool, Pool } from "mysql2/promise";

const pool: Pool = createPool({
  user: process.env.DB_USER!,
  host: process.env.DB_HOST!,
  database: process.env.DB_NAME!,
  password: process.env.DB_PASS!,
  port: Number(process.env.DB_PORT) || 3306,
  timezone: process.env.DB_TIMEZONE || "+07:00",
  decimalNumbers: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  connectTimeout: 30000,
  charset: "UTF8MB4_UNICODE_CI",
});

export default pool;
