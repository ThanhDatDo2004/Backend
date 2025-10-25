import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import walletService from "../services/wallet.service";

const walletController = {
  /**
   * Lấy thông tin ví hiện tại (Shop)
   * GET /api/shops/me/wallet
   */
  async getWallet(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;

      // Get shop code using service
      const stats = await walletService.getWalletStatsByUser(userId);

      return apiResponse.success(res, stats, "Thông tin ví", StatusCodes.OK);
    } catch (error: any) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          error?.message || "Lỗi lấy thông tin ví"
        )
      );
    }
  },

  /**
   * Lịch sử giao dịch (Shop)
   * GET /api/shops/me/wallet/transactions
   */
  async getWalletTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { type, limit = 10, offset = 0 } = req.query;

      // Get shop code using service
      const result = await walletService.getTransactionsByUser(userId, {
        type: type as string,
        limit: Number(limit),
        offset: Number(offset),
      });

      return apiResponse.success(
        res,
        result,
        "Lịch sử giao dịch",
        StatusCodes.OK
      );
    } catch (error: any) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          error?.message || "Lỗi lấy lịch sử giao dịch"
        )
      );
    }
  },

  /**
   * ADMIN: Xem ví của shop
   * GET /api/admin/shops/:shopCode/wallet
   */
  async adminGetShopWallet(req: Request, res: Response, next: NextFunction) {
    try {
      const shopCode = Number(req.params.shopCode);
      if (!Number.isFinite(shopCode) || shopCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã shop không hợp lệ")
        );
      }

      const stats = await walletService.getWalletStatsByShop(shopCode);

      return apiResponse.success(
        res,
        stats,
        "Thông tin ví shop",
        StatusCodes.OK
      );
    } catch (error: any) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          error?.message || "Lỗi lấy ví shop"
        )
      );
    }
  },

  /**
   * ADMIN: Lịch sử giao dịch của shop
   * GET /api/admin/shops/:shopCode/wallet/transactions
   */
  async adminGetShopTransactions(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const shopCode = Number(req.params.shopCode);
      if (!Number.isFinite(shopCode) || shopCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã shop không hợp lệ")
        );
      }
      await shopService.ensureShopOwnership(shopCode, (req as any).user?.UserID ?? 0);
      const { type, limit = 10, offset = 0 } = req.query;

      const result = await walletService.getTransactionsByShop(shopCode, {
        type: type as string,
        limit: Number(limit),
        offset: Number(offset),
      });

      return apiResponse.success(
        res,
        result,
        "Lịch sử giao dịch",
        StatusCodes.OK
      );
    } catch (error: any) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          error?.message || "Lỗi lấy lịch sử"
        )
      );
    }
  },
};

export default walletController;
