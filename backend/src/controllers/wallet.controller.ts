import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import payoutService from "../services/payout.service";
import shopService from "../services/shop.service";

const walletController = {
  /**
   * Lấy thông tin ví hiện tại (Shop)
   * GET /api/shops/me/wallet
   */
  async getWallet(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;

      const shop = await shopService.getByUserId(Number(userId));
      if (!shop?.shop_code) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Bạn không có shop"));
      }

      const shopCode = Number(shop.shop_code);

      const stats = await payoutService.getShopWalletStats(shopCode);

      return apiResponse.success(res, stats, "Thông tin ví", StatusCodes.OK);
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi lấy thông tin ví"
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

      const shop = await shopService.getByUserId(Number(userId));
      if (!shop?.shop_code) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Bạn không có shop"));
      }

      const shopCode = Number(shop.shop_code);
      const numericLimit = Number(limit) || 10;
      const numericOffset = Number(offset) || 0;

      const transactions = await payoutService.listWalletTransactions(
        shopCode,
        typeof type === "string" ? type : undefined,
        numericLimit,
        numericOffset
      );
      const total = await payoutService.countWalletTransactions(
        shopCode,
        typeof type === "string" ? type : undefined
      );

      return apiResponse.success(
        res,
        {
          data: transactions,
          pagination: {
            limit: numericLimit,
            offset: numericOffset,
            total,
          },
        },
        "Lịch sử giao dịch",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi lấy lịch sử giao dịch"
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
      const { shopCode } = req.params;

      const stats = await payoutService.getShopWalletStats(Number(shopCode));

      return apiResponse.success(
        res,
        stats,
        "Thông tin ví shop",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi lấy ví shop"
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
      const { shopCode } = req.params;
      const { type, limit = 10, offset = 0 } = req.query;

      const numericLimit = Number(limit) || 10;
      const numericOffset = Number(offset) || 0;
      const numericShopCode = Number(shopCode);

      const transactions = await payoutService.listWalletTransactions(
        numericShopCode,
        typeof type === "string" ? type : undefined,
        numericLimit,
        numericOffset
      );
      const total = await payoutService.countWalletTransactions(
        numericShopCode,
        typeof type === "string" ? type : undefined
      );

      return apiResponse.success(
        res,
        {
          data: transactions,
          pagination: {
            limit: numericLimit,
            offset: numericOffset,
            total,
          },
        },
        "Lịch sử giao dịch",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi lấy lịch sử"
        )
      );
    }
  },
};

export default walletController;
