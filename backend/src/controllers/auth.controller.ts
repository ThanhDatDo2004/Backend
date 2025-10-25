
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import ApiError from "../utils/apiErrors";
import authService from "../services/auth";
import apiResponse from "../core/respone";

// =================== LOGIN ===================
const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { login, password } = req.body;
      if (!login || !password) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Email và mật khẩu là bắt buộc");
      }

      const { user, passwordHash } = await authService.login(login);
      const isMatch = await authService.verifyPassword(password, passwordHash);
      if (!isMatch) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "Email hoặc mật khẩu không đúng");
      }

      const normalizedUser = authService.normalizeUser(user);
      const token = authService.generateAccessToken(normalizedUser);
      const refreshToken = authService.generateRefreshToken(normalizedUser);

      apiResponse.success(
        res,
        { ...normalizedUser, token, refreshToken },
        "Đăng nhập thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  // =================== SEND REGISTRATION CODE ===================
  async sendCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      if (!email) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Thiếu email");
      }
      await authService.sendRegistrationCode(email);
      apiResponse.success(res, null, "Đã gửi mã xác minh");
    } catch (error) {
      next(error);
    }
  },

  // =================== VERIFY OTP CODE ===================
  async verifyCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Thiếu email hoặc mã xác minh");
      }

      const isValid = authService.verifyOtp(email, code);
      if (!isValid) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Mã xác minh không đúng hoặc đã hết hạn");
      }

      apiResponse.success(res, null, "Xác minh thành công");
    } catch (error) {
      next(error);
    }
  },

  // =================== FORGOT PASSWORD ===================
  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    const genericMessage = "Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi.";
    try {
      const { email } = req.body;
      // Basic validation, but don't throw error for invalid email to prevent enumeration
      if (email && z.string().email().safeParse(email).success) {
        await authService.handleForgotPassword(email);
      }
      // Always return a generic success response
      apiResponse.success(res, null, genericMessage);
    } catch (error) {
      // Log the error but still send a generic response to the client
      console.error("[FORGOT_PASSWORD_CONTROLLER] Error:", error);
      apiResponse.success(res, null, genericMessage);
    }
  },

  // =================== RESET PASSWORD ===================
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const schema = z.object({
        token: z.string().min(10),
        new_password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
      });
      const { token, new_password } = schema.parse(req.body);

      await authService.resetPassword(token, new_password);

      apiResponse.success(res, null, "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập.");
    } catch (error) {
      next(error);
    }
  },

  // =================== DEPRECATED ENDPOINT ===================
  async checkEmailExists(_req: Request, res: Response, next: NextFunction) {
    next(new ApiError(StatusCodes.GONE, "This endpoint is deprecated."));
  },
};

// =================== REGISTER ===================
const registerSchema = z.object({
  user_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { user_name, email, password } = registerSchema.parse(req.body);
    await authService.register(user_name, email, password);
    apiResponse.success(
      res,
      null,
      "Đăng ký thành công. Bạn có thể đăng nhập ngay.",
      StatusCodes.CREATED
    );
  } catch (error) {
    next(error);
  }
}

export async function verifyEmail(_req: Request, res: Response) {
  apiResponse.success(res, null, "Xác minh không cần thiết. Tài khoản đã được kích hoạt ngay khi đăng ký.");
}

export default authController;
