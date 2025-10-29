import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import authService from "../services/auth";
import ApiError from "../utils/apiErrors";
import type { AuthenticatedUser } from "../interfaces/auth";

function extractToken(req: Request) {
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

function attachUser(req: Request, payload: unknown) {
  if (payload && typeof payload === "object") {
    const enriched = {
      ...(payload as Record<string, unknown>),
    } as AuthenticatedUser;
    if (!enriched.role) {
      enriched.role = "user";
    }
    if (enriched.role === "guest") {
      enriched.isGuest = true;
    } else {
      enriched.isGuest = false;
    }
    req.user = enriched;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      return next(
        new ApiError(StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục")
      );
    }

    const payload = authService.verifyToken(token);
    if (!payload || typeof payload !== "object") {
      return next(
        new ApiError(StatusCodes.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ")
      );
    }

    attachUser(req, payload);
    next();
  } catch (error) {
    return next(
      new ApiError(
        StatusCodes.UNAUTHORIZED,
        (error as Error)?.message || "Không thể xác thực người dùng"
      )
    );
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    const payload = authService.verifyToken(token);
    attachUser(req, payload);
  } catch (_error) {
    // Bỏ qua lỗi nếu token không hợp lệ
  }
  next();
}

const authMiddleware = {
  requireAuth,
  optionalAuth,
};

export default authMiddleware;
