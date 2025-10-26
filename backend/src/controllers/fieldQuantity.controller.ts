import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ApiError } from "http-errors";
import fieldQuantityService from "../services/fieldQuantity.service";
import fieldModel from "../models/field.model";
import shopService from "../services/shop.service";
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

      // Validate field exists

      const field = await fieldModel.findById(Number(fieldCode));
      if (!field) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân loại")
        );
      }

      // Get availability
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

      const field = await fieldModel.findById(Number(fieldCode));
      if (!field) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân loại")
        );
      }

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

      const field = await fieldModel.findById(Number(fieldCode));
      if (!field) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân loại")
        );
      }

      const shop = await shopService.getByCode(field.shop_code);
      if (!shop || shop.user_id !== userId) {
        return next(
          new ApiError(
            StatusCodes.FORBIDDEN,
            "Bạn không có quyền cập nhật sân này"
          )
        );
      }

      // Find quantity by fieldCode and quantityNumber
      const quantities = await fieldQuantityService.getQuantitiesForField(
        Number(fieldCode)
      );
      const quantity = quantities.find(
        (q) => q.quantity_number === Number(quantityNumber)
      );

      if (!quantity) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân")
        );
      }

      // Update status

      const updated = await fieldQuantityService.updateQuantityStatus(
        quantity.quantity_id,
        status
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
