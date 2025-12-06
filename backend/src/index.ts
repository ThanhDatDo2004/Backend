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
import {
  autoCompleteFinishedBookings,
  cleanupExpiredHeldSlots,
} from "./services/booking.service";

const app = express();

const defaultAllowedOrigins = [
  "https://thuere.site",
  "https://www.thuere.site",
  "http://thuere.site",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS || defaultAllowedOrigins.join(",")
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowPrivateOrigins =
  (process.env.CORS_ALLOW_PRIVATE || "true").toLowerCase() === "true";

const hasWildcard = allowedOrigins.includes("*");

function isPrivateHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]"
  ) {
    return true;
  }
  if (normalized.startsWith("192.168.")) return true;
  if (normalized.startsWith("10.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
  return false;
}

function checkOrigin(origin?: string | null) {
  if (!origin) return true;
  if (hasWildcard || allowedOrigins.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (allowPrivateOrigins && isPrivateHost(parsed.hostname)) {
      return true;
    }
  } catch (_error) {}
  return false;
}

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (checkOrigin(origin)) {
      return callback(null, true);
    }
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

// Basic health/status endpoints for root domain checks
app.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Thuere API is running",
    docs: "/api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use(errorHandlingMiddleware);

const PORT = process.env.PORT || 5050;
const slotCleanupInterval =
  Number(process.env.HELD_SLOT_CLEANUP_INTERVAL_MS) || 5 * 60 * 1000;
const autoCompleteInterval =
  Number(process.env.AUTO_COMPLETE_BOOKINGS_INTERVAL_MS) || 10 * 60 * 1000;

setInterval(() => {
  cleanupExpiredHeldSlots().catch((error) =>
    console.error("[booking] cleanup failed:", error)
  );
}, slotCleanupInterval);

setInterval(() => {
  autoCompleteFinishedBookings().catch((error) =>
    console.error("[booking] auto-complete failed:", error)
  );
}, autoCompleteInterval);

autoCompleteFinishedBookings().catch((error) =>
  console.error("[booking] initial auto-complete failed:", error)
);

app.listen(PORT, () => {
  console.log("Server is running on:", `${process.env.HOST}:${PORT}`);
});
