"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/auth.model.ts
const auth_queries_1 = __importDefault(require("../queries/auth.queries"));
const query_1 = __importDefault(require("../services/query"));
const authModel = {
    async getUserAuth(login) {
        return await query_1.default.execQueryOne(auth_queries_1.default.getUserAuth, [login]);
    },
    // Giữ chữ ký như cũ để không ảnh hưởng nơi khác
    async findByEmailOrUserId(email, _userId) {
        return await query_1.default.execQueryOne(auth_queries_1.default.getUserByEmailOrUserId, [
            email,
        ]);
    },
    async getCusLevelCode() {
        return (await query_1.default.execQueryOne(auth_queries_1.default.getCusLevelCode, []));
    },
    // GIỮ chữ ký (level_code, user_name, password_hash, email)
    async insertUser(level_code, user_name, password_hash, email) {
        return await query_1.default.execQueryOne(auth_queries_1.default.insertUser, [
            level_code,
            user_name,
            password_hash,
            email,
        ]);
    },
    // NEW: cập nhật mật khẩu theo email (dùng cho reset password)
    async updatePasswordByEmail(email, password_hash) {
        // Trả về kết quả của execQueryOne; nếu bạn muốn boolean, có thể xử lý tùy theo driver
        return await query_1.default.execQueryOne(auth_queries_1.default.updatePasswordByEmail, [
            password_hash,
            email.toLowerCase().trim(),
        ]);
    },
};
exports.default = authModel;
