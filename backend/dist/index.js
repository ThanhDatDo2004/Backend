"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const compression_1 = __importDefault(require("compression"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const field_routes_1 = __importDefault(require("./routes/field.routes"));
const fieldQuantity_routes_1 = __importDefault(require("./routes/fieldQuantity.routes"));
const shop_routes_1 = __importDefault(require("./routes/shop.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const booking_routes_1 = __importDefault(require("./routes/booking.routes"));
const cart_routes_1 = __importDefault(require("./routes/cart.routes"));
const errorMiddlewares_1 = require("./middlewares/errorMiddlewares");
const app = (0, express_1.default)();
const defaultAllowedOrigins = ["https://thuere.site"];
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || defaultAllowedOrigins.join(","))
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
const corsOptions = {
    origin(origin, callback) {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin))
            return callback(null, true);
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.json());
app.use((0, morgan_1.default)("dev"));
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
}));
app.use((0, compression_1.default)());
// Không dùng import.meta → dùng process.cwd()
const ROOT_DIR = process.cwd();
const uploadsDir = path_1.default.join(ROOT_DIR, "uploads");
// ================= Routes ==================
app.use("/api/auth", auth_routes_1.default);
app.use("/api/fields", field_routes_1.default);
app.use("/api/fields", fieldQuantity_routes_1.default);
app.use("/api/shops", shop_routes_1.default);
app.use("/api/bookings", booking_routes_1.default);
app.use("/api/cart", cart_routes_1.default);
app.use("/api/admin", admin_routes_1.default);
app.use("/api/payments", payment_routes_1.default);
// Static uploads
app.use("/uploads", express_1.default.static(uploadsDir, {
    setHeaders: (res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
}));
// Error handler
app.use(errorMiddlewares_1.errorHandlingMiddleware);
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
    console.log("Server is running on:", `${process.env.HOST}:${PORT}`);
});
