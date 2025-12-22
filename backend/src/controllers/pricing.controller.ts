import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import pricingService from "../services/pricing.service";

const createOperatingHoursSchema = z.object({
  day_of_week: z.coerce
    .number()
    .int()
    .min(0, "Thứ trong tuần phải từ 0-6 (Chủ nhật = 0)")
    .max(6, "Thứ trong tuần phải từ 0-6 (Chủ nhật = 0)"),
  start_time: z.string()
    .trim()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Thời gian bắt đầu phải có định dạng HH:MM"),
  end_time: z.string()
    .trim()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Thời gian kết thúc phải có định dạng HH:MM")
});

const updateOperatingHoursSchema = z.object({
  day_of_week: z.coerce
    .number()
    .int()
    .min(0, "Thứ trong tuần phải từ 0-6 (Chủ nhật = 0)")
    .max(6, "Thứ trong tuần phải từ 0-6 (Chủ nhật = 0)")
    .optional(),
  start_time: z.string()
    .trim()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Thời gian bắt đầu phải có định dạng HH:MM")
    .optional(),
  end_time: z.string()
    .trim()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Thời gian kết thúc phải có định dạng HH:MM")
    .optional()
}).refine(data => {
  return Object.keys(data).length > 0;
}, {
  message: "Phải cung cấp ít nhất một trường để cập nhật"
});

function parseFieldCode(req: Request): number {
  const fieldCode = Number(req.params.fieldCode);
  if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ");
  }
  return fieldCode;
}

function parsePricingId(req: Request): number {
  const pricingId = Number(req.params.pricingId);
  if (!Number.isFinite(pricingId) || pricingId <= 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Mã giá không hợp lệ");
  }
  return pricingId;
}

function getUserId(req: Request): number {
  const userId = Number(
    req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code
  );
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục");
  }
  return userId;
}

const pricingController = {
  async listOperatingHours(req: Request, res: Response, next: NextFunction) {
    try {
      const fieldCode = parseFieldCode(req);
      const userId = getUserId(req);

      const operatingHours = await pricingService.listOperatingHoursByField(fieldCode, userId);

      return apiResponse.success(
        res,
        operatingHours,
        "Lấy danh sách giờ hoạt động thành công",
        StatusCodes.OK
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return next(error);
      }
      next(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Lỗi hệ thống"));
    }
  },

  async createOperatingHours(req: Request, res: Response, next: NextFunction) {
    try {
      const fieldCode = parseFieldCode(req);
      const userId = getUserId(req);

      const parsed = createOperatingHoursSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
        return next(new ApiError(StatusCodes.BAD_REQUEST, message));
      }

      const operatingHoursData = {
        fieldCode,
        dayOfWeek: parsed.data.day_of_week,
        startTime: parsed.data.start_time,
        endTime: parsed.data.end_time
      };

      const createdHours = await pricingService.createOperatingHours(operatingHoursData, userId);

      return apiResponse.success(
        res,
        createdHours,
        "Tạo giờ hoạt động mới thành công",
        StatusCodes.CREATED
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return next(error);
      }
      next(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Lỗi hệ thống"));
    }
  },

  async updateOperatingHours(req: Request, res: Response, next: NextFunction) {
    try {
      const pricingId = parsePricingId(req);
      const userId = getUserId(req);

      const parsed = updateOperatingHoursSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
        return next(new ApiError(StatusCodes.BAD_REQUEST, message));
      }

      const updateData = {
        dayOfWeek: parsed.data.day_of_week,
        startTime: parsed.data.start_time,
        endTime: parsed.data.end_time
      };

      const updatedHours = await pricingService.updateOperatingHours(pricingId, updateData, userId);

      return apiResponse.success(
        res,
        updatedHours,
        "Cập nhật giờ hoạt động thành công",
        StatusCodes.OK
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return next(error);
      }
      next(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Lỗi hệ thống"));
    }
  },

  async deleteOperatingHours(req: Request, res: Response, next: NextFunction) {
    try {
      const pricingId = parsePricingId(req);
      const userId = getUserId(req);

      const deleted = await pricingService.deleteOperatingHours(pricingId, userId);

      if (!deleted) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy giờ hoạt động để xóa"));
      }

      return apiResponse.success(
        res,
        { deleted: true },
        "Xóa giờ hoạt động thành công",
        StatusCodes.OK
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return next(error);
      }
      next(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Lỗi hệ thống"));
    }
  }
};

export default pricingController;
