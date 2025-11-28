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
import { resolveFrontendBaseUrl } from "../utils/env";

const otpStore = new Map<string, { code: string; expiresAt: number }>();
const OTP_TTL_MS = 15 * 60 * 1000;

function genOTP(len = 6) {
  return Math.floor(Math.random() * 10 ** len)
    .toString()
    .padStart(len, "0");
}

const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { login, password } = req.body;
      let user: any = null;
      try {
        user = await authModel.getUserAuth(login);
      } catch (dbError) {
        next();
      }
      if (!user) {
        return next(new ApiError(401, "Email không tồn tại"));
      }
      const { PasswordHash, IsActive, _destroy, LevelType, ...dataUser } = user;
      if (!(IsActive ?? 0)) {
        return next(
          new ApiError(
            StatusCodes.LOCKED,
            "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên."
          )
        );
      }
      const isMatch = await authService.verifyPassword(password, PasswordHash);
      if (!isMatch) {
        return next(new ApiError(401, "Email hoặc mật khẩu không đúng"));
      }
      const userToken = {
        ...dataUser,
        IsActive,
        LevelType,
        role: LevelType,
        isGuest: false,
      };

      const token = await authService.generateAccessToken(userToken);
      const refreshToken = await authService.generateRefreshToken(userToken);

      return apiResponse.success(
        res,
        { ...userToken, token, refreshToken },
        "Login Success",
        200
      );
    } catch (error: any) {
      next(new ApiError(401, error?.message));
    }
  },

  async guestToken(_req: Request, res: Response, next: NextFunction) {
    try {
      const guestId = Number(process.env.GUEST_CUSTOMER_USER_ID ?? 1);
      if (!Number(guestId) || guestId <= 0) {
        return next(new ApiError(500, "Guest user ID không hợp lệ"));
      }

      const payload = {
        UserID: guestId,
        role: "guest",
        isGuest: true,
      };

      const token = await authService.generateAccessToken(payload);

      return apiResponse.success(
        res,
        {
          token,
          user: payload,
        },
        "Tạo guest token thành công",
        StatusCodes.OK
      );
    } catch (error: any) {
      next(new ApiError(500, error?.message || "Không thể tạo guest token"));
    }
  },

  async sendCode(req: Request, res: Response) {
    const rawEmail = req.body?.email;
    const email = rawEmail.trim();

    const existed = await authModel.findByEmailOrUserId(email, "");
    if (existed) {
      return res.status(401).json({
        message: "Email đã tồn tại. Vui lòng sử dụng email khác.",
      });
    }

    const code = genOTP(6);
    otpStore.set(email, { code, expiresAt: Date.now() + OTP_TTL_MS });

    try {
      await sendVerificationEmail(email, code);
      return res.status(200).json({
        success: true,
        message: "Đã gửi mã xác minh",
      });
    } catch (e: any) {
      otpStore.delete(email);
      return res.status(500).json({
        success: false,
        message: "Không gửi được mã",
      });
    }
  },

  async verifyCode(req: Request, res: Response) {
    const email = req.body.email.trim();
    const code = req.body.code;
    const record = otpStore.get(email);

    if (Date.now() > record!.expiresAt) {
      otpStore.delete(email);
      return res.json({ success: false, message: "Mã đã hết hạn" });
    }
    if (record!.code !== code) {
      return res.json({ success: false, message: "Mã xác minh không đúng" });
    }

    otpStore.delete(email);
    return res.json({ success: true, message: "Xác minh thành công" });
  },

  async forgotPassword(req: Request, res: Response) {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);

    const genericSuccessResponse = () =>
      res.json({
        success: true,
        message: "Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi.",
      });

    if (!parsed.success) {
      return genericSuccessResponse();
    }

    const email = parsed.data.email.trim();
    const user = await authModel.findByEmailOrUserId(email, "");
    if (!user) {
      return genericSuccessResponse();
    }

    const ttlMin = Number(process.env.RESET_TOKEN_TTL_MIN || 30);
    const secret = process.env.RESET_JWT_SECRET || "change-me";
    const token = jwt.sign({ sub: email, type: "reset" }, secret, {
      expiresIn: `${ttlMin}m`,
    });

    const frontend = resolveFrontendBaseUrl();
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
