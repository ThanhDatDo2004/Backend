"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.optionalAuth = optionalAuth;
const http_status_codes_1 = require("http-status-codes");
const auth_1 = __importDefault(require("../services/auth"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
function extractToken(req) {
    const header = req.headers.authorization || req.headers.Authorization;
    if (!header || typeof header !== "string") {
        return null;
    }
    const [scheme, token] = header.split(" ");
    if (!token || scheme.toLowerCase() !== "bearer") {
        return null;
    }
    return token.trim();
}
function attachUser(req, payload) {
    if (payload && typeof payload === "object") {
        const enriched = {
            ...payload,
        };
        if (!enriched.role) {
            enriched.role = "user";
        }
        if (enriched.role === "guest") {
            enriched.isGuest = true;
        }
        else {
            enriched.isGuest = false;
        }
        req.user = enriched;
    }
}
function requireAuth(req, _res, next) {
    try {
        const token = extractToken(req);
        if (!token) {
            return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục"));
        }
        const payload = auth_1.default.verifyToken(token);
        if (!payload || typeof payload !== "object") {
            return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ"));
        }
        attachUser(req, payload);
        next();
    }
    catch (error) {
        return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, error?.message || "Không thể xác thực người dùng"));
    }
}
function optionalAuth(req, _res, next) {
    const token = extractToken(req);
    if (!token) {
        return next();
    }
    try {
        const payload = auth_1.default.verifyToken(token);
        attachUser(req, payload);
    }
    catch (_error) { }
    next();
}
const authMiddleware = {
    requireAuth,
    optionalAuth,
};
exports.default = authMiddleware;
