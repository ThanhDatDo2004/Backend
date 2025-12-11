"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.verifyEmail = verifyEmail;
const http_status_codes_1 = require("http-status-codes");
const auth_model_1 = __importDefault(require("../models/auth.model"));
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const auth_1 = __importDefault(require("../services/auth"));
const respone_1 = __importDefault(require("../core/respone"));
const zod_1 = require("zod");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mail_service_1 = require("../services/mail.service");
const env_1 = require("../utils/env");
const otpStore = new Map();
const OTP_TTL_MS = 15 * 60 * 1000;
function genOTP(len = 6) {
    return Math.floor(Math.random() * 10 ** len)
        .toString()
        .padStart(len, "0");
}
const authController = {
    async login(req, res, next) {
        try {
            const { login, password } = req.body;
            let user = null;
            try {
                user = await auth_model_1.default.getUserAuth(login);
            }
            catch (dbError) {
                next();
            }
            if (!user) {
                return next(new apiErrors_1.default(401, "Email không tồn tại"));
            }
            const { PasswordHash, IsActive, _destroy, LevelType, ...dataUser } = user;
            if (!(IsActive ?? 0)) {
                return next(new apiErrors_1.default(http_status_codes_1.StatusCodes.LOCKED, "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên."));
            }
            const isMatch = await auth_1.default.verifyPassword(password, PasswordHash);
            if (!isMatch) {
                return next(new apiErrors_1.default(401, "Email hoặc mật khẩu không đúng"));
            }
            const userToken = {
                ...dataUser,
                IsActive,
                LevelType,
                role: LevelType,
                isGuest: false,
            };
            const token = await auth_1.default.generateAccessToken(userToken);
            const refreshToken = await auth_1.default.generateRefreshToken(userToken);
            return respone_1.default.success(res, { ...userToken, token, refreshToken }, "Login Success", 200);
        }
        catch (error) {
            next(new apiErrors_1.default(401, error?.message));
        }
    },
    async guestToken(_req, res, next) {
        try {
            const guestId = Number(process.env.GUEST_CUSTOMER_USER_ID ?? 1);
            if (!Number(guestId) || guestId <= 0) {
                return next(new apiErrors_1.default(500, "Guest user ID không hợp lệ"));
            }
            const payload = {
                UserID: guestId,
                role: "guest",
                isGuest: true,
            };
            const token = await auth_1.default.generateAccessToken(payload);
            return respone_1.default.success(res, {
                token,
                user: payload,
            }, "Tạo guest token thành công", http_status_codes_1.StatusCodes.OK);
        }
        catch (error) {
            next(new apiErrors_1.default(500, error?.message || "Không thể tạo guest token"));
        }
    },
    async sendCode(req, res) {
        const rawEmail = req.body?.email;
        const email = rawEmail.trim();
        const existed = await auth_model_1.default.findByEmailOrUserId(email, "");
        if (existed) {
            return res.status(401).json({
                message: "Email đã tồn tại. Vui lòng sử dụng email khác.",
            });
        }
        const code = genOTP(6);
        otpStore.set(email, { code, expiresAt: Date.now() + OTP_TTL_MS });
        try {
            await (0, mail_service_1.sendVerificationEmail)(email, code);
            return res.status(200).json({
                success: true,
                message: "Đã gửi mã xác minh",
            });
        }
        catch (e) {
            otpStore.delete(email);
            return res.status(500).json({
                success: false,
                message: "Không gửi được mã",
            });
        }
    },
    async verifyCode(req, res) {
        const email = req.body.email.trim();
        const code = req.body.code;
        const record = otpStore.get(email);
        if (Date.now() > record.expiresAt) {
            otpStore.delete(email);
            return res.json({ success: false, message: "Mã đã hết hạn" });
        }
        if (record.code !== code) {
            return res.json({ success: false, message: "Mã xác minh không đúng" });
        }
        otpStore.delete(email);
        return res.json({ success: true, message: "Xác minh thành công" });
    },
    async forgotPassword(req, res) {
        const schema = zod_1.z.object({ email: zod_1.z.string().email() });
        const parsed = schema.safeParse(req.body);
        const genericSuccessResponse = () => res.json({
            success: true,
            message: "Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi.",
        });
        if (!parsed.success) {
            return genericSuccessResponse();
        }
        const email = parsed.data.email.trim();
        const user = await auth_model_1.default.findByEmailOrUserId(email, "");
        if (!user) {
            return genericSuccessResponse();
        }
        const ttlMin = Number(process.env.RESET_TOKEN_TTL_MIN || 30);
        const secret = process.env.RESET_JWT_SECRET || "change-me";
        const token = jsonwebtoken_1.default.sign({ sub: email, type: "reset" }, secret, {
            expiresIn: `${ttlMin}m`,
        });
        const frontend = (0, env_1.resolveFrontendBaseUrl)();
        const resetLink = `${frontend}/reset-password?token=${encodeURIComponent(token)}`;
        try {
            await (0, mail_service_1.sendResetPasswordEmail)(email, resetLink);
        }
        catch (error) {
            console.error(`[FORGOT_PASSWORD] Failed to send email to ${email}:`, error);
        }
        return genericSuccessResponse();
    },
    // =================== RESET PASSWORD (đặt mật khẩu mới) ===================
    async resetPassword(req, res) {
        const schema = zod_1.z.object({
            token: zod_1.z.string().min(10),
            new_password: zod_1.z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(http_status_codes_1.StatusCodes.BAD_REQUEST).json({
                success: false,
                message: "Dữ liệu không hợp lệ",
                errors: parsed.error.flatten(),
            });
        }
        const { token, new_password } = parsed.data;
        try {
            const payload = jsonwebtoken_1.default.verify(token, process.env.RESET_JWT_SECRET || "change-me");
            if (!payload || payload.type !== "reset" || !payload.sub) {
                return res
                    .status(http_status_codes_1.StatusCodes.UNAUTHORIZED)
                    .json({ success: false, message: "Token không hợp lệ" });
            }
            const email = String(payload.sub).toLowerCase().trim();
            const user = await auth_model_1.default.findByEmailOrUserId(email, "");
            if (!user) {
                return res
                    .status(http_status_codes_1.StatusCodes.NOT_FOUND)
                    .json({ success: false, message: "Tài khoản không tồn tại" });
            }
            const password_hash = await bcrypt_1.default.hash(new_password, 10);
            await auth_model_1.default.updatePasswordByEmail(email, password_hash);
            return res.json({
                success: true,
                message: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập.",
            });
        }
        catch (e) {
            return res.status(http_status_codes_1.StatusCodes.UNAUTHORIZED).json({
                success: false,
                message: "Token không hợp lệ hoặc đã hết hạn",
            });
        }
    },
};
// =================== REGISTER ===================
const registerSchema = zod_1.z.object({
    user_name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
async function register(req, res) {
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(http_status_codes_1.StatusCodes.UNPROCESSABLE_ENTITY).json({
                success: false,
                message: "Dữ liệu không hợp lệ",
                errors: parsed.error.flatten(),
            });
        }
        const { user_name, email, password } = parsed.data;
        const existed = await auth_model_1.default.findByEmailOrUserId(email, "");
        if (existed) {
            return res.status(http_status_codes_1.StatusCodes.CONFLICT).json({
                success: false,
                message: "Email hoặc tên đăng nhập đã được sử dụng",
            });
        }
        const cusLevel = await auth_model_1.default.getCusLevelCode();
        if (!cusLevel) {
            return res.status(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Không tìm thấy level 'cus'",
            });
        }
        const password_hash = await bcrypt_1.default.hash(password, 10);
        await auth_model_1.default.insertUser(cusLevel.level_code, user_name, password_hash, email);
        return res.status(http_status_codes_1.StatusCodes.CREATED).json({
            success: true,
            message: "Đăng ký thành công. Bạn có thể đăng nhập ngay.",
        });
    }
    catch (err) {
        console.error(err);
        return res.status(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Có lỗi xảy ra. Vui lòng thử lại.",
        });
    }
}
async function verifyEmail(_req, res) {
    return res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Xác minh không cần thiết. Tài khoản đã được kích hoạt ngay khi đăng ký.",
    });
}
exports.default = authController;
