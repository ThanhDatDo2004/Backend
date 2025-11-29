import compression from "compression";
import cors from "cors";
import path from "path";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import fs from "fs";

import ApiError from "./utils/apiErrors";
import pool from "./configs/db.config";

import authRouter from "./routes/auth.routes";
import fieldRouter from "./routes/field.routes";
import fieldQuantityRouter from "./routes/fieldQuantity.routes";
import shopRouter from "./routes/shop.routes";
import adminRouter from "./routes/admin.routes";
import paymentRouter from "./routes/payment.routes";
import bookingRouter from "./routes/booking.routes";
import cartRouter from "./routes/cart.routes";

import { errorHandlingMiddleware } from "./middlewares/errorMiddlewares";
import { cleanupExpiredHeldSlots } from "./services/booking.service";

const app = express();

const defaultAllowedOrigins = ["https://thuere.site"];

const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS || defaultAllowedOrigins.join(",")
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan("dev"));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(compression());

// Không dùng import.meta → dùng process.cwd()
const ROOT_DIR = process.cwd();
const uploadsDir = path.join(ROOT_DIR, "uploads");

// ================= Routes ==================
app.use("/api/auth", authRouter);
app.use("/api/fields", fieldRouter);
app.use("/api/fields", fieldQuantityRouter);
app.use("/api/shops", shopRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/cart", cartRouter);
app.use("/api/admin", adminRouter);
app.use("/api/payments", paymentRouter);

// Static uploads
app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

// Error handler
app.use(errorHandlingMiddleware);

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log("Server is running on:", `${process.env.HOST}:${PORT}`);
});
