"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION;
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION;
const authService = {
    generateAccessToken(payload) {
        if (!JWT_SECRET_KEY) {
            throw new Error("JWT secret key is not defined in environment variables.");
        }
        return jsonwebtoken_1.default.sign(payload, JWT_SECRET_KEY, {
            expiresIn: JWT_EXPIRATION,
        });
    },
    generateRefreshToken(payload) {
        if (!JWT_SECRET_KEY) {
            throw new Error("JWT secret key is not defined in environment variables.");
        }
        return jsonwebtoken_1.default.sign(payload, JWT_SECRET_KEY, {
            expiresIn: JWT_REFRESH_EXPIRATION,
        });
    },
    verifyToken(token) {
        if (!JWT_SECRET_KEY) {
            throw new Error("JWT secret key is not defined in environment variables.");
        }
        try {
            return jsonwebtoken_1.default.verify(token, JWT_SECRET_KEY);
        }
        catch (error) {
            throw new Error("Invalid token");
        }
    },
    async hashPassword(password) {
        const saltRounds = 10;
        try {
            const hash = await bcrypt_1.default.hash(password, saltRounds);
            return hash;
        }
        catch (error) {
            throw error;
        }
    },
    async verifyPassword(password, hash) {
        try {
            const result = await bcrypt_1.default.compare(password, hash);
            return result;
        }
        catch (error) {
            throw error;
        }
    },
};
exports.default = authService;
