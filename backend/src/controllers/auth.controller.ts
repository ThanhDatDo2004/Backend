// src/controllers/auth.controller.ts
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import authModel from "../models/auth.model";
import ApiError from "../utils/apiErrors";
import authService from "../services/auth";
import apiResponse from "../core/respone";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  sendVerificationEmail,
  sendResetPasswordEmail,
} from "../services/mail.service";

// ====== OTP store (demo) ======
const otpStore = new Map<string, { code: string; expiresAt: number }>();
const OTP_TTL_MS = 15 * 60 * 1000; // 15 phút

function genOTP(len = 6) {
  return Math.floor(Math.random() * 10 ** len)
    .toString()
    .padStart(len, "0");
}

// =================== LOGIN ===================
const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { login, password } = req.body;
      // Có thể là email hoặc phone
      let user: any = null;
      try {
        user = await authModel.getUserAuth(login);
      } catch (dbError) {
        return next(
          new ApiError(
            StatusCodes.SERVICE_UNAVAILABLE,
            (dbError as Error).message || "Database connection error"
          )
        );
      }

      if (!user) {
        return next(
          new ApiError(StatusCodes.UNAUTHORIZED, "Email không tồn tại")
        );
      }

      const { PasswordHash, IsActive, _destroy, ...dataUser } = user as {
        PasswordHash: string;
        IsActive?: number | null;
        _destroy?: number | null;
      };

      if (Number(_destroy ?? 0) === 1) {
        return next(
          new ApiError(
            StatusCodes.LOCKED,
            "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên."
          )
        );
      }

      if (!Number(IsActive ?? 0)) {
        return next(
          new ApiError(
            StatusCodes.LOCKED,
            "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên."
          )
        );
      }
      const isMatch = await authService.verifyPassword(password, PasswordHash);
      if (!isMatch) {
        return next(
          new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Email hoặc mật khẩu không đúng"
          )
        );
      }

      // Đơn giản hóa việc chuẩn hóa dữ liệu user
      const userId = Number(
        (user as any)?.UserID ?? (user as any)?.user_code ?? 0
      );
      const levelCode = Number(
        (user as any)?.LevelCode ?? (user as any)?.level_code
      );

      const normalizedUser = {
        ...dataUser,
        UserID: userId,
        user_code: userId,
        LevelCode: levelCode,
        level_code: levelCode,
        IsActive,
        isActive: Number(IsActive ?? 0) ? 1 : 0,
      };

      const token = await authService.generateAccessToken(normalizedUser);
      const refreshToken = await authService.generateRefreshToken(
        normalizedUser
      );

      return apiResponse.success(
        res,
        { ...normalizedUser, token, refreshToken },
        "Login Success",
        StatusCodes.OK
      );
    } catch (error: any) {
      next(
        new ApiError(StatusCodes.UNAUTHORIZED, error?.message || "Login Error")
      );
    }
  },

  // =================== SEND CODE (đăng ký mới – chặn nếu email đã tồn tại) ===================
  async sendCode(req: Request, res: Response) {
    const rawEmail = String(req.body?.email || "");
    const email = rawEmail.trim().toLowerCase();
    if (!email) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Thiếu email",
      });
    }

    // Không cho gửi mã nếu email đã tồn tại trong database (đăng ký mới)
    const existed = await authModel.findByEmailOrUserId(email, "");
    if (existed) {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: "Email đã tồn tại. Vui lòng sử dụng email khác.",
        code: "EMAIL_EXISTS",
      });
    }

    // Cho phép gửi lại mã: nếu đã có mã cũ, xóa nó đi (reset flow)
    if (otpStore.has(email)) {
      otpStore.delete(email);
    }

    const code = genOTP(6);
    otpStore.set(email, { code, expiresAt: Date.now() + OTP_TTL_MS });

    try {
      await sendVerificationEmail(email, code);
      return res.status(StatusCodes.OK).json({
        success: true,
        message: "Đã gửi mã xác minh",
      });
    } catch (e: any) {
      // Xóa OTP nếu gửi email thất bại
      otpStore.delete(email);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: e?.message || "Không gửi được mã",
      });
    }
  },

  // =================== VERIFY CODE ===================
  async verifyCode(req: Request, res: Response) {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const code = String(req.body?.code || "").trim();

    if (!email || !code) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: "Thiếu dữ liệu" });
    }
    const record = otpStore.get(email);
    if (!record) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Chưa yêu cầu mã hoặc mã đã hết hạn",
      });
    }
    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: "Mã đã hết hạn" });
    }
    if (record.code !== code) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: "Mã xác minh không đúng" });
    }

    otpStore.delete(email);
    return res.json({ success: true, message: "Xác minh thành công" });
  },

  // =================== CHECK EMAIL (Forgot: kiểm tra trước khi gửi link) - ĐÃ GỘP VÀO forgotPassword ===================
  // Endpoint này không còn cần thiết và nên được loại bỏ để tránh email enumeration.
  // Giữ lại hàm trống để tránh lỗi nếu route chưa được xóa, nhưng sẽ trả về lỗi.
  async checkEmailExists(_req: Request, res: Response, next: NextFunction) {
    return next(
      new ApiError(
        StatusCodes.GONE,
        "This endpoint is deprecated for security reasons."
      )
    );
  },

  // =================== FORGOT PASSWORD (gửi link) ===================
  async forgotPassword(req: Request, res: Response) {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);

    // Luôn trả về thông báo thành công chung để tránh dò email
    const genericSuccessResponse = () =>
      res.json({
        success: true,
        message: "Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi.",
      });

    if (!parsed.success) {
      return genericSuccessResponse();
    }

    const email = parsed.data.email.trim().toLowerCase();
    const user = await authModel.findByEmailOrUserId(email, "");
    if (!user) {
      // Không làm gì cả, chỉ trả về thông báo thành công ở cuối
      return genericSuccessResponse();
    }

    const ttlMin = Number(process.env.RESET_TOKEN_TTL_MIN || 30);
    const secret = process.env.RESET_JWT_SECRET || "change-me";
    const token = jwt.sign({ sub: email, type: "reset" }, secret, {
      expiresIn: `${ttlMin}m`,
    });

    const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${frontend}/reset-password?token=${encodeURIComponent(
      token
    )}`;

    try {
      await sendResetPasswordEmail(email, resetLink);
    } catch (error) {
      // Ghi lại lỗi nhưng không báo cho người dùng để bảo mật
      console.error(
        `[FORGOT_PASSWORD] Failed to send email to ${email}:`,
        error
      );
    }

    return genericSuccessResponse();
  },

  // =================== RESET PASSWORD (đặt mật khẩu mới) ===================
  async resetPassword(req: Request, res: Response) {
    const schema = z.object({
      token: z.string().min(10),
      new_password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Dữ liệu không hợp lệ",
        errors: parsed.error.flatten(),
      });
    }

    const { token, new_password } = parsed.data;

    try {
      const payload = jwt.verify(
        token,
        process.env.RESET_JWT_SECRET || "change-me"
      ) as { sub: string; type: string; iat: number; exp: number };

      if (!payload || payload.type !== "reset" || !payload.sub) {
        return res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ success: false, message: "Token không hợp lệ" });
      }

      const email = String(payload.sub).toLowerCase().trim();
      const user = await authModel.findByEmailOrUserId(email, "");
      if (!user) {
        return res
          .status(StatusCodes.NOT_FOUND)
          .json({ success: false, message: "Tài khoản không tồn tại" });
      }

      const password_hash = await bcrypt.hash(new_password, 10);
      await authModel.updatePasswordByEmail(email, password_hash);

      return res.json({
        success: true,
        message: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập.",
      });
    } catch (e: any) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Token không hợp lệ hoặc đã hết hạn",
      });
    }
  },
};

// =================== REGISTER ===================
const registerSchema = z.object({
  user_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function register(req: Request, res: Response) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
        success: false,
        message: "Dữ liệu không hợp lệ",
        errors: parsed.error.flatten(),
      });
    }
    const { user_name, email, password } = parsed.data;

    const existed = await authModel.findByEmailOrUserId(email, "");
    if (existed) {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: "Email hoặc tên đăng nhập đã được sử dụng",
      });
    }

    const cusLevel = await authModel.getCusLevelCode();
    if (!cusLevel) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Không tìm thấy level 'cus'",
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await authModel.insertUser(
      cusLevel.level_code,
      user_name,
      password_hash,
      email
    );

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Đăng ký thành công. Bạn có thể đăng nhập ngay.",
    });
  } catch (err) {
    console.error(err);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Có lỗi xảy ra. Vui lòng thử lại.",
    });
  }
}

export async function verifyEmail(_req: Request, res: Response) {
  return res.status(StatusCodes.OK).json({
    success: true,
    message:
      "Xác minh không cần thiết. Tài khoản đã được kích hoạt ngay khi đăng ký.",
  });
}

export default authController;
