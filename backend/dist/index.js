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
const defaultAllowedOrigins = [
    "https://thuere.site",
    "https://www.thuere.site",
    "http://thuere.site",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || defaultAllowedOrigins.join(","))
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
const allowPrivateOrigins = (process.env.CORS_ALLOW_PRIVATE || "true").toLowerCase() === "true";
const hasWildcard = allowedOrigins.includes("*");
function isPrivateHost(hostname) {
    const normalized = hostname.toLowerCase();
    if (normalized === "localhost" ||
        normalized === "127.0.0.1" ||
        normalized === "::1" ||
        normalized === "[::1]") {
        return true;
    }
    if (normalized.startsWith("192.168."))
        return true;
    if (normalized.startsWith("10."))
        return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized))
        return true;
    return false;
}
function checkOrigin(origin) {
    if (!origin)
        return true;
    if (hasWildcard || allowedOrigins.includes(origin))
        return true;
    try {
        const parsed = new URL(origin);
        if (allowPrivateOrigins && isPrivateHost(parsed.hostname)) {
            return true;
        }
    }
    catch (_error) { }
    return false;
}
const corsOptions = {
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
app.use(errorMiddlewares_1.errorHandlingMiddleware);
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
    console.log("Server is running on:", `${process.env.HOST}:${PORT}`);
});
