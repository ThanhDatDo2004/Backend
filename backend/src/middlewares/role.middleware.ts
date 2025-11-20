import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import ApiError  from "../utils/apiErrors";

function resolveRole(req: Request) {
  const roleSources = [
    (req as any).user?.role,
    (req as any).user?.LevelType,
    (req as any).user?.level_type,
  ];
  return String(roleSources.find((value) => value)?.toString() ?? "").toLowerCase();
}

export const requireAdmin = (
  message = "Chỉ quản trị viên mới được phép truy cập"
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = resolveRole(req);
    if (role !== "admin") {
      throw new ApiError(StatusCodes.FORBIDDEN, message);
    }
    next();
  };
};

export const requireShopOwner = (
  message = "Chỉ chủ cửa hàng mới được phép truy cập"
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = resolveRole(req);
    if (role === "admin" || role === "shop") {
      return next();
    }
    throw new ApiError(StatusCodes.FORBIDDEN, message);
  };
};

export const rejectGuest =
  (message = "Khách vãng lai không có quyền truy cập") =>
  (req: Request, _res: Response, next: NextFunction) => {
    const role = resolveRole(req);
    const isGuest = role === "guest" || Boolean((req as any).user?.isGuest);
    if (isGuest) {
      throw new ApiError(StatusCodes.FORBIDDEN, message);
    }
    next();
  };

export default {
  rejectGuest,
  requireAdmin,
  requireShopOwner,
};
