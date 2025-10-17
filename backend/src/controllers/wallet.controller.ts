import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import payoutService from "../services/payout.service";
import queryService from "../services/query";
import { RowDataPacket } from "mysql2";

const walletController = {
  /**
   * Lấy thông tin ví hiện tại (Shop)
   * GET /api/shops/me/wallet
   */
  async getWallet(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;

      // Lấy shop code
      const [shopRows] = await queryService.query<RowDataPacket[]>(
        `SELECT ShopCode FROM Shops WHERE UserID = ?`,
        [userId]
      );

      if (!shopRows?.[0]) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Bạn không có shop"));
      }

      const shopCode = shopRows[0].ShopCode;

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

      // Lấy shop code
      const [shopRows] = await queryService.query<RowDataPacket[]>(
        `SELECT ShopCode FROM Shops WHERE UserID = ?`,
        [userId]
      );

      if (!shopRows?.[0]) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Bạn không có shop"));
      }

      const shopCode = shopRows[0].ShopCode;

      let query = `SELECT wt.*, b.BookingCode, pr.PayoutID
                   FROM Wallet_Transactions wt
                   LEFT JOIN Bookings b ON wt.BookingCode = b.BookingCode
                   LEFT JOIN Payout_Requests pr ON wt.PayoutID = pr.PayoutID
                   WHERE wt.ShopCode = ?`;
      const params: any[] = [shopCode];

      if (type) {
        query += ` AND wt.Type = ?`;
        params.push(type);
      }

      query += ` ORDER BY wt.CreateAt DESC LIMIT ? OFFSET ?`;
      params.push(Number(limit), Number(offset));

      const [transactions] = await queryService.query<RowDataPacket[]>(
        query,
        params
      );

      // Get total
      let countQuery = `SELECT COUNT(*) as total FROM Wallet_Transactions WHERE ShopCode = ?`;
      const countParams: any[] = [shopCode];
      if (type) {
        countQuery += ` AND Type = ?`;
        countParams.push(type);
      }
      const [countRows] = await queryService.query<RowDataPacket[]>(
        countQuery,
        countParams
      );

      return apiResponse.success(
        res,
        {
          data: transactions,
          pagination: {
            limit: Number(limit),
            offset: Number(offset),
            total: countRows?.[0]?.total || 0,
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

      let query = `SELECT wt.*, b.BookingCode, pr.PayoutID
                   FROM Wallet_Transactions wt
                   LEFT JOIN Bookings b ON wt.BookingCode = b.BookingCode
                   LEFT JOIN Payout_Requests pr ON wt.PayoutID = pr.PayoutID
                   WHERE wt.ShopCode = ?`;
      const params: any[] = [Number(shopCode)];

      if (type) {
        query += ` AND wt.Type = ?`;
        params.push(type);
      }

      query += ` ORDER BY wt.CreateAt DESC LIMIT ? OFFSET ?`;
      params.push(Number(limit), Number(offset));

      const [transactions] = await queryService.query<RowDataPacket[]>(
        query,
        params
      );

      // Get total
      let countQuery = `SELECT COUNT(*) as total FROM Wallet_Transactions WHERE ShopCode = ?`;
      const countParams: any[] = [Number(shopCode)];
      if (type) {
        countQuery += ` AND Type = ?`;
        countParams.push(type);
      }
      const [countRows] = await queryService.query<RowDataPacket[]>(
        countQuery,
        countParams
      );

      return apiResponse.success(
        res,
        {
          data: transactions,
          pagination: {
            limit: Number(limit),
            offset: Number(offset),
            total: countRows?.[0]?.total || 0,
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
