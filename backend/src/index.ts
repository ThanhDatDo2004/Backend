import compression from "compression";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import helmet from "helmet";
import express, { NextFunction, Request, Response } from "express";
import ApiError from "./utils/apiErrors";
import { errorHandlingMiddleware } from "./middlewares/errorMiddlewares";
import morgan from "morgan";
const app = express();
const allowedOrigins = ["http://localhost:5173"];
// sau này deploy thì thêm "https://ten-mien-cua-ban.com"

const corsOptions: cors.CorsOptions = {
  origin: allowedOrigins,
  credentials: false, // FE không dùng cookie; có thể set true nếu cần
  methods: ["GET", "POST", "PATCH", "OPTIONS"], // Đúng theo spec
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
import shopRouter from "./routes/shop.routes";
import adminRouter from "./routes/admin.routes";
import paymentRouter from "./routes/payment.routes";
import notificationRouter from "./routes/notification.routes";
import bookingRouter from "./routes/booking.routes";
import { requireAuth } from "./middlewares/auth.middleware";
import shopController from "./controllers/shop.controller";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../uploads");

app.use("/api/auth", authRouter);
app.get("/api/shops/me", requireAuth, shopController.current);
app.put("/api/shops/me", requireAuth, shopController.updateMe);
app.use("/api/fields", fieldRouter);
app.use("/api/shops", shopRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/admin", adminRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/notifications", notificationRouter);
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
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

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
