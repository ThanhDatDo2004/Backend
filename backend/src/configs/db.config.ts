import { createPool, Pool } from "mysql2/promise";

const pool: Pool = createPool({
  user: process.env.DB_USER!,
  host: process.env.DB_HOST!,
  database: process.env.DB_NAME!,
  password: process.env.DB_PASS!,
  port: Number(process.env.DB_PORT) || 3306,
  decimalNumbers: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  connectTimeout: 30000,
  charset: "UTF8MB4_UNICODE_CI",
});

// Test connection on startup
pool
  .getConnection()
  .then((conn) => {
    console.log("✅ Database connected successfully");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    console.error("Config:", {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
    });
  });

export default pool;
