import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import adminService from "../services/admin.service";
import ApiError from "../utils/apiErrors";
import { z } from "zod";

const updateUserStatusSchema = z.object({
  isActive: z.union([z.boolean(), z.number().int().min(0).max(1)]),
});

const updateShopRequestStatusSchema = z.object({
  status: z.enum(["pending", "reviewed", "approved", "rejected"]),
});

const financeBookingFilterSchema = z.object({
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày bắt đầu không hợp lệ")
    .optional(),
  endDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày kết thúc không hợp lệ")
    .optional(),
  fieldCode: z
    .string()
    .trim()
    .regex(/^\d+$/, "FieldCode phải là số")
    .optional(),
  customerUserID: z
    .string()
    .trim()
    .regex(/^\d+$/, "CustomerUserID phải là số")
    .optional(),
  bookingStatus: z.string().trim().optional(),
  limit: z
    .string()
    .trim()
    .regex(/^\d+$/, "Limit phải là số dương")
    .optional(),
  offset: z
    .string()
    .trim()
    .regex(/^\d+$/, "Offset phải là số không âm")
    .optional(),
});

const adminController = {
  async listShops(req: Request, res: Response, next: NextFunction) {
    try {
      const shops = await adminService.listShops();
      return apiResponse.success(
        res,
        shops,
        "Fetched shops successfully",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await adminService.listUsers();
      return apiResponse.success(
        res,
        users,
        "Fetched users successfully",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async listUserLevels(req: Request, res: Response, next: NextFunction) {
    try {
      const levels = await adminService.listUserLevels();
      return apiResponse.success(
        res,
        levels,
        "Fetched user levels successfully",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId) || userId <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã người dùng không hợp lệ")
        );
      }

      const parsed = updateUserStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
          parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ"
          )
        );
      }

      const desiredStatus =
        typeof parsed.data.isActive === "number"
          ? parsed.data.isActive === 1
          : parsed.data.isActive;

      const updated = await adminService.updateUserStatus(
        userId,
        desiredStatus
      );

      if (!updated) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy người dùng")
        );
      }

      return apiResponse.success(
        res,
        updated,
        desiredStatus
          ? "Đã mở khóa tài khoản người dùng"
          : "Đã khóa tài khoản người dùng",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async listShopRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const requests = await adminService.listShopRequests();
      return apiResponse.success(
        res,
        requests,
        "Fetched shop requests successfully",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async getShopRequestById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã yêu cầu không hợp lệ")
        );
      }

      const request = await adminService.getShopRequestById(id);
      if (!request) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy yêu cầu")
        );
      }

      return apiResponse.success(
        res,
        request,
        "Fetched shop request successfully",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async updateShopRequestStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã yêu cầu không hợp lệ")
        );
      }

      const parsed = updateShopRequestStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ"
          )
        );
      }

      const updated = await adminService.updateShopRequestStatus(
        id,
        parsed.data.status
      );

      if (!updated) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy yêu cầu")
        );
      }

      return apiResponse.success(
        res,
        updated,
        `Đã cập nhật trạng thái yêu cầu sang "${parsed.data.status}"`,
        StatusCodes.OK
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return next(error);
      }
      if (error instanceof Error) {
        if (error.message === "SHOP_REQUEST_EMAIL_REQUIRED") {
          return next(
            new ApiError(
              StatusCodes.BAD_REQUEST,
              "Yêu cầu không có email hợp lệ. Vui lòng cập nhật email trước khi duyệt."
            )
          );
        }
        if (error.message === "SHOP_REQUEST_USER_NOT_FOUND") {
          return next(
            new ApiError(
              StatusCodes.BAD_REQUEST,
              "Không tìm thấy người dùng có email trùng khớp. Vui lòng tạo tài khoản shop trước khi duyệt."
            )
          );
        }
      }
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Không thể cập nhật trạng thái yêu cầu"
        )
      );
    }
  },

  async listFinanceBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = financeBookingFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            parsed.error.issues[0]?.message || "Dữ liệu lọc không hợp lệ"
          )
        );
      }

      const {
        startDate,
        endDate,
        fieldCode,
        customerUserID,
        bookingStatus,
        limit,
        offset,
      } = parsed.data;

      const numericLimit = Math.min(
        Math.max(Number(limit ?? 200) || 200, 1),
        500
      );
      const numericOffset = Math.max(Number(offset ?? 0) || 0, 0);

      const numericFieldCode =
        typeof fieldCode === "string" && fieldCode.length
          ? Number(fieldCode)
          : undefined;
      const numericCustomerUserID =
        typeof customerUserID === "string" && customerUserID.length
          ? Number(customerUserID)
          : undefined;

      const data = await adminService.listFinanceBookings({
        startDate,
        endDate,
        fieldCode: Number.isFinite(numericFieldCode) ? numericFieldCode : undefined,
        customerUserID: Number.isFinite(numericCustomerUserID)
          ? numericCustomerUserID
          : undefined,
        bookingStatus: bookingStatus?.trim() || undefined,
        limit: numericLimit,
        offset: numericOffset,
      });

      return apiResponse.success(
        res,
        data,
        "Danh sách booking tài chính",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },
};

export default adminController;
