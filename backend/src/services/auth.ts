
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import ApiError from "../utils/apiErrors";
import authModel from "../models/auth.model";
import otpService from "./otp.service"; // Import OTP service
import {
  sendVerificationEmail,
  sendResetPasswordEmail,
} from "./mail.service"; // Import Mail service

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION;
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION;

const authService = {
  /**
   * Verify password hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  },

  /**
   * Generate JWT access token
   */
  generateAccessToken(payload: any): string {
    if (!JWT_SECRET_KEY) {
      throw new Error("JWT secret key is not defined.");
    }
    return jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: JWT_EXPIRATION });
  },

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(payload: any): string {
    if (!JWT_SECRET_KEY) {
      throw new Error("JWT secret key is not defined.");
    }
    return jwt.sign(payload, JWT_SECRET_KEY, {
      expiresIn: JWT_REFRESH_EXPIRATION,
    });
  },

  /**
   * Verify JWT token
   */
  verifyToken(token: string): any {
    if (!JWT_SECRET_KEY) {
      throw new Error("JWT secret key is not defined.");
    }
    try {
      return jwt.verify(token, JWT_SECRET_KEY);
    } catch (error) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid or expired token.");
    }
  },

  /**
   * Login business logic
   */
  async login(loginInput: string): Promise<any> {
    const user = await authModel.getUserAuth(loginInput);
    if (!user) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Email không tồn tại.");
    }

    const { PasswordHash, IsActive, _destroy, ...dataUser } = user;

    if (Number(_destroy ?? 0) === 1) {
      throw new ApiError(
        StatusCodes.LOCKED,
        "Tài khoản đã bị vô hiệu hóa."
      );
    }
    if (!Number(IsActive ?? 0)) {
      throw new ApiError(StatusCodes.LOCKED, "Tài khoản đã bị khóa.");
    }

    return { user: dataUser, passwordHash: PasswordHash! };
  },

  /**
   * Normalize user data
   */
  normalizeUser(user: any): any {
    const userId = Number(user?.UserID ?? 0);
    const levelCode = Number(user?.LevelCode ?? 0);
    return {
      ...user,
      UserID: userId,
      user_code: userId,
      LevelCode: levelCode,
      level_code: levelCode,
      isActive: Number(user?.IsActive ?? 0) ? 1 : 0,
    };
  },

  /**
   * Register new user
   */
  async register(
    username: string,
    email: string,
    password: string
  ): Promise<void> {
    const existed = await authModel.findByEmail(email);
    if (existed) {
      throw new ApiError(StatusCodes.CONFLICT, "Email đã được sử dụng.");
    }

    const cusLevel = await authModel.getCustomerLevelCode();
    if (!cusLevel) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Không tìm thấy level 'cus'."
      );
    }

    const password_hash = await this.hashPassword(password);
    await authModel.createUser(
      cusLevel.level_code,
      username,
      password_hash,
      email
    );
  },

  /**
   * Send a verification code for registration.
   */
  async sendRegistrationCode(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const existed = await authModel.findByEmail(normalizedEmail);
    if (existed) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "Email đã tồn tại. Vui lòng sử dụng email khác.",
        "EMAIL_EXISTS"
      );
    }

    const code = otpService.generate();
    otpService.store(normalizedEmail, code);

    try {
      await sendVerificationEmail(normalizedEmail, code);
    } catch (error) {
      otpService.clear(normalizedEmail); // Rollback OTP if email fails
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Không gửi được mã xác minh."
      );
    }
  },

  /**
   * Verify an OTP code.
   */
  verifyOtp(email: string, code: string): boolean {
    return otpService.verify(email.trim().toLowerCase(), code.trim());
  },

  /**
   * Handle forgot password request.
   * Generates a reset token and sends a reset link.
   * Always returns successfully to prevent email enumeration.
   */
  async handleForgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const user = await authModel.findByEmail(normalizedEmail);
      if (!user) {
        // Do not throw an error to prevent email enumeration
        return;
      }

      const ttlMin = Number(process.env.RESET_TOKEN_TTL_MIN || 30);
      const secret = process.env.RESET_JWT_SECRET || "change-me";
      const token = jwt.sign({ sub: normalizedEmail, type: "reset" }, secret, {
        expiresIn: `${ttlMin}m`,
      });

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(
        token
      )}`;

      await sendResetPasswordEmail(normalizedEmail, resetLink);
    } catch (error) {
      // Log error but do not expose to the client
      console.error(
        `[FORGOT_PASSWORD] Failed to process request for ${normalizedEmail}:`,
        error
      );
    }
  },

  /**
   * Reset user's password using a valid token.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const secret = process.env.RESET_JWT_SECRET || "change-me";
    let payload: any;

    try {
      payload = jwt.verify(token, secret);
    } catch (e) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "Token không hợp lệ hoặc đã hết hạn."
      );
    }

    if (!payload || payload.type !== "reset" || !payload.sub) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Token không hợp lệ.");
    }

    const email = String(payload.sub).toLowerCase().trim();
    const user = await authModel.findByEmail(email);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Tài khoản không tồn tại.");
    }

    const passwordHash = await this.hashPassword(newPassword);
    await authModel.updatePasswordByEmail(email, passwordHash);
  },

  /**
   * Find user by email
   */
  async findByEmailOrUserId(email: string): Promise<any> {
    return authModel.findByEmail(email);
  },
};

export default authService;
