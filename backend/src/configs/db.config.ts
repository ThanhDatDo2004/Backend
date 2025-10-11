import { createPool, Pool } from "mysql2/promise";

const pool: Pool = createPool({
   user: process.env.DB_USER!,
   host: process.env.DB_HOST!,
   database: process.env.DB_NAME!,
   password: process.env.DB_PASS!,
   port: Number(process.env.DB_PORT) || 3306,
   decimalNumbers: true , // 👈 all DECIMAL/NUMERIC 
   waitForConnections: true,
   connectionLimit: 10,
   queueLimit: 0,
});

export default pool;
