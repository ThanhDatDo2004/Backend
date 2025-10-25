import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import ApiError from "../utils/apiErrors";
import fieldQuantityService from "../services/fieldQuantity.service";
import apiResponse from "../core/respone";

const fieldQuantityController = {
  /**
   * GET /api/fields/:fieldCode/available-quantities
   * Get available quantities for a specific time slot
   */
  async getAvailableQuantities(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { fieldCode } = req.params;
      const { playDate, startTime, endTime } = req.query;

      if (!fieldCode || !playDate || !startTime || !endTime) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Thiếu thông tin: fieldCode, playDate, startTime, endTime"
          )
        );
      }

      const availability = await fieldQuantityService.getAvailableSlot(
        Number(fieldCode),
        String(playDate),
        String(startTime),
        String(endTime)
      );

      return apiResponse.success(
        res,
        availability,
        "Danh sách sân trống",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/fields/:fieldCode/quantities
   * Get all quantities for a field
   */
  async getQuantities(req: Request, res: Response, next: NextFunction) {
    try {
      const { fieldCode } = req.params;

      const quantities = await fieldQuantityService.getQuantitiesForField(
        Number(fieldCode)
      );

      return apiResponse.success(
        res,
        {
          fieldCode: Number(fieldCode),
          totalQuantities: quantities.length,
          quantities,
        },
        "Danh sách sân",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/fields/:fieldCode/quantities/:quantityNumber/status
   * Update quantity status (for admin - maintenance, inactive)
   */
  async updateQuantityStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number(
        req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code
      );
      if (!Number.isFinite(userId) || userId <= 0) {
        return next(
          new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Vui lòng đăng nhập để tiếp tục"
          )
        );
      }

      const { fieldCode, quantityNumber } = req.params;
      const { status } = req.body;

      if (!["available", "maintenance", "inactive"].includes(status)) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Trạng thái không hợp lệ: available, maintenance, inactive"
          )
        );
      }

      // Validate ownership

      const updated = await fieldQuantityService.updateQuantityStatusByNumber(
        Number(fieldCode),
        Number(quantityNumber),
        status,
        userId
      );

      return apiResponse.success(
        res,
        updated,
        "Cập nhật trạng thái sân thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/fields/:fieldCode/quantities/:quantityId
   * Get single quantity details
   */
  async getQuantityById(req: Request, res: Response, next: NextFunction) {
    try {
      const { quantityId } = req.params;

      const quantity = await fieldQuantityService.getQuantityById(
        Number(quantityId)
      );

      return apiResponse.success(res, quantity, "Chi tiết sân", StatusCodes.OK);
    } catch (error) {
      next(error);
    }
  },
};

export default fieldQuantityController;
