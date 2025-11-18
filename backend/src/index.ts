import compression from "compression";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Load .env manually at startup
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").replace(/^['"]|['"]$/g, "");
      if (key) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
  console.log("✅ .env file loaded");
} else {
  console.warn("⚠️  .env file not found at:", envPath);
}

import helmet from "helmet";
import express, { NextFunction, Request, Response } from "express";
import ApiError from "./utils/apiErrors";
import { errorHandlingMiddleware } from "./middlewares/errorMiddlewares";
import morgan from "morgan";
import pool from "./configs/db.config";

const app = express();
const allowedOrigins = ["http://localhost:5173"];
// sau này deploy thì thêm "https://ten-mien-cua-ban.com"

const corsOptions: cors.CorsOptions = {
  origin: allowedOrigins,
  credentials: false, // FE không dùng cookie; có thể set true nếu cần
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // Đúng theo spec
  allowedHeaders: ["Content-Type", "Authorization"], // Đúng theo spec
};

app.use(cors(corsOptions));
// Cho phép preflight
//use pakage
app.use(express.json());
app.use(morgan("dev"));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());

//routes

const PORT = process.env.PORT || 5050;

import authRouter from "./routes/auth.routes";
import fieldRouter from "./routes/field.routes";
import fieldQuantityRouter from "./routes/fieldQuantity.routes";
import shopRouter from "./routes/shop.routes";
import adminRouter from "./routes/admin.routes";
import paymentRouter from "./routes/payment.routes";
import bookingRouter from "./routes/booking.routes";
import cartRouter from "./routes/cart.routes";
import { cleanupExpiredHeldSlots } from "./services/booking.service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../uploads");

app.use("/api/auth", authRouter);
app.use("/api/fields", fieldRouter);
app.use("/api/fields", fieldQuantityRouter);
app.use("/api/shops", shopRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/cart", cartRouter);
app.use("/api/admin", adminRouter);
app.use("/api/payments", paymentRouter);
app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    console.log("🔍 Health check started...");
    console.log("Config:", {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
    });

    const conn = await pool.getConnection();
    console.log("✅ Got connection from pool");

    await conn.ping();
    console.log("✅ Ping successful");

    conn.release();
    console.log("✅ Connection released");

    return res.status(200).json({
      success: true,
      message: "✅ Database connected",
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Health check error:", error);
    return res.status(503).json({
      success: false,
      message: "❌ Database connection failed",
      error: (error as Error).message,
      hint: "Check if VPS is accessible and database exists",
      config: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Setup cleanup job for expired held slots
// Run every minute
setInterval(async () => {
  await cleanupExpiredHeldSlots();
}, 60 * 1000); // 60 seconds

//error handler 404
app.use((req: Request, res: Response, next: NextFunction) => {
  const error = new ApiError(404, `Not Found - ${req.originalUrl}`);
  next(error); // đẩy vào errorHandlingMiddleware
});
app.use(errorHandlingMiddleware);
//error handler
app.listen(PORT, () => {
  console.log("Server is running on ", process.env.HOST + ":" + PORT);
});
