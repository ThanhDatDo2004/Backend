import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import adminService from "../services/admin.service";
import ApiError from "../utils/apiErrors";

const toInt = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
};

const toNonNegInt = (v: unknown, fallback = 0): number => {
  const n = toInt(v);
  return n !== undefined && n >= 0 ? n : fallback;
};

const toPosInt = (v: unknown, fallback = 1): number => {
  const n = toInt(v);
  return n !== undefined && n > 0 ? n : fallback;
};

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

const toBoolFlexible = (v: unknown): boolean | undefined => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["1","true","yes","y","on"].includes(s)) return true;
    if (["0","false","no","n","off"].includes(s)) return false;
  }
  return undefined;
};

const toDateStringLoose = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  return s;
};

const isOneOf = <T extends string>(val: any, list: readonly T[]): val is T =>
  typeof val === "string" && list.includes(val as T);


const adminController = {
  async listShops(req: Request, res: Response, next: NextFunction) {
    try {
      const shops = await adminService.listShops();
      return apiResponse.success(res, shops, "Fetched shops successfully", StatusCodes.OK);
    } catch (error) {
      next(error);
    }
  },

  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await adminService.listUsers();
      return apiResponse.success(res, users, "Fetched users successfully", StatusCodes.OK);
    } catch (error) {
      next(error);
    }
  },

  async listUserLevels(req: Request, res: Response, next: NextFunction) {
    try {
      const levels = await adminService.listUserLevels();
      return apiResponse.success(res, levels, "Fetched user levels successfully", StatusCodes.OK);
    } catch (error) {
      next(error);
    }
  },

  async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = toPosInt(req.params.id);
      if (!userId) {
        return next(new ApiError(StatusCodes.BAD_REQUEST, "Mã người dùng không hợp lệ"));
      }

      const desired = toBoolFlexible((req.body as any)?.isActive);
      if (desired === undefined) {
        return next(new ApiError(StatusCodes.BAD_REQUEST, "Trạng thái không hợp lệ"));
      }

      const updated = await adminService.updateUserStatus(userId, desired);
      if (!updated) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy người dùng"));
      }

      return apiResponse.success(
        res,
        updated,
        desired ? "Đã mở khóa tài khoản người dùng" : "Đã khóa tài khoản người dùng",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async listShopRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const requests = await adminService.listShopRequests();
      return apiResponse.success(res, requests, "Fetched shop requests successfully", StatusCodes.OK);
    } catch (error) {
      next(error);
    }
  },

  async getShopRequestById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = toPosInt(req.params.id);
      if (!id) {
        return next(new ApiError(StatusCodes.BAD_REQUEST, "Mã yêu cầu không hợp lệ"));
      }

      const request = await adminService.getShopRequestById(id);
      if (!request) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy yêu cầu"));
      }

      return apiResponse.success(res, request, "Fetched shop request successfully", StatusCodes.OK);
    } catch (error) {
      next(error);
    }
  },

  /** Chỉ giữ enum rất mỏng, không Zod */
  async updateShopRequestStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = toPosInt(req.params.id);
      if (!id) {
        return next(new ApiError(StatusCodes.BAD_REQUEST, "Mã yêu cầu không hợp lệ"));
      }

      const allowed = ["pending", "reviewed", "approved", "rejected"] as const;
      const status = (req.body as any)?.status;
      if (!isOneOf(status, allowed)) {
        return next(new ApiError(StatusCodes.BAD_REQUEST, "Trạng thái không hợp lệ"));
      }

      const updated = await adminService.updateShopRequestStatus(id, status);
      if (!updated) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy yêu cầu"));
      }

      return apiResponse.success(
        res,
        updated,
        `Đã cập nhật trạng thái yêu cầu sang "${status}"`,
        StatusCodes.OK
      );
    } catch (error) {
      if (error instanceof ApiError) return next(error);
      if (error instanceof Error) {
        if (error.message === "SHOP_REQUEST_EMAIL_REQUIRED") {
          return next(new ApiError(StatusCodes.BAD_REQUEST,
            "Yêu cầu không có email hợp lệ. Vui lòng cập nhật email trước khi duyệt."
          ));
        }
        if (error.message === "SHOP_REQUEST_USER_NOT_FOUND") {
          return next(new ApiError(StatusCodes.BAD_REQUEST,
            "Không tìm thấy người dùng có email trùng khớp. Vui lòng tạo tài khoản shop trước khi duyệt."
          ));
        }
      }
      next(new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        (error as Error)?.message || "Không thể cập nhật trạng thái yêu cầu"
      ));
    }
  },

  /** Bộ lọc tài chính “tự nhiên”: chấp nhận chuỗi ngày thoáng, số ép mềm, có mặc định */
  async listFinanceBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const q = req.query as any;

      const startDate   = toDateStringLoose(q.startDate);
      const endDate     = toDateStringLoose(q.endDate);
      const fieldCode   = toInt(q.fieldCode);
      const customerUID = toInt(q.customerUserID);
      const bookingStatus = typeof q.bookingStatus === "string" && q.bookingStatus.trim()
        ? q.bookingStatus.trim()
        : undefined;

      const numericLimit  = clamp(toPosInt(q.limit, 200), 1, 500);
      const numericOffset = toNonNegInt(q.offset, 0);

      const data = await adminService.listFinanceBookings({
        startDate,
        endDate,
        fieldCode: fieldCode,
        customerUserID: customerUID,
        bookingStatus,
        limit: numericLimit,
        offset: numericOffset,
      });

      return apiResponse.success(res, data, "Danh sách booking tài chính", StatusCodes.OK);
    } catch (error) {
      next(error);
    }
  },
};

export default adminController;
