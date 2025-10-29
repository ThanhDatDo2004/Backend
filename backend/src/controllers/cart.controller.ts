import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import cartService from "../services/cart.service";

const cartController = {
  async listUserCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number((req as any).user?.UserID);
      const isGuest =
        Boolean((req as any).user?.isGuest) ||
        String((req as any).user?.role || "").toLowerCase() === "guest";
      if (!Number.isFinite(userId) || userId <= 0) {
        return next(
          new ApiError(StatusCodes.UNAUTHORIZED, "Yêu cầu đăng nhập để xem giỏ hàng")
        );
      }

      if (isGuest) {
        return next(
          new ApiError(
            StatusCodes.FORBIDDEN,
            "Khách vãng lai không có quyền truy cập giỏ hàng"
          )
        );
      }

      const cartItems = await cartService.getUserCart(userId);

      return apiResponse.success(
        res,
        { items: cartItems, total: cartItems.length },
        "Danh sách giỏ hàng hiện tại",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Không thể lấy giỏ hàng"
        )
      );
    }
  },
};

export default cartController;
