import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { createAppError } from "../utils/apiErrors";

export const rejectGuest =
  (message = "Khách vãng lai không có quyền truy cập") =>
  (req: Request, _res: Response, next: NextFunction) => {
    const role = String((req as any).user?.role || "").toLowerCase();
    const isGuest = role === "guest" || Boolean((req as any).user?.isGuest);
    if (isGuest) {
      throw createAppError(StatusCodes.FORBIDDEN, message);
    }
    next();
  };

export default {
  rejectGuest,
};
