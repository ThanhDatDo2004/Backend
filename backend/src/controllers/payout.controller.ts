import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import payoutService from "../services/payout.service";
import queryService from "../services/query";
import { RowDataPacket } from "mysql2";

const payoutController = {
  /**
   * Tạo yêu cầu rút tiền (Shop)
   * POST /api/shops/me/payout-requests
   */
  async createPayoutRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { amount, bank_id, note } = req.body;

      if (!amount || amount <= 0) {
        return next(new ApiError(StatusCodes.BAD_REQUEST, "Số tiền phải lớn hơn 0"));
      }

      if (!bank_id) {
        return next(new ApiError(StatusCodes.BAD_REQUEST, "Vui lòng chọn tài khoản ngân hàng"));
      }

      // Lấy shop code của user
      const [shopRows] = await queryService.query<RowDataPacket[]>(
        `SELECT ShopCode FROM Shops WHERE UserID = ? AND IsApproved = 'Y'`,
        [userId]
      );

      if (!shopRows?.[0]) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Bạn không có shop hoặc shop chưa được duyệt"));
      }

      const shopCode = shopRows[0].ShopCode;

      const result = await payoutService.createPayoutRequest(
        shopCode,
        bank_id,
        amount,
        note
      );

      return apiResponse.success(res, result, "Tạo yêu cầu rút tiền thành công", StatusCodes.CREATED);
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi tạo yêu cầu rút tiền"
        )
      );
    }
  },

  /**
   * Liệt kê yêu cầu rút tiền của shop
   * GET /api/shops/me/payout-requests
   */
  async listPayoutRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { status, limit = 10, offset = 0 } = req.query;

      // Lấy shop code
      const [shopRows] = await queryService.query<RowDataPacket[]>(
        `SELECT ShopCode FROM Shops WHERE UserID = ?`,
        [userId]
      );

      if (!shopRows?.[0]) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Bạn không có shop"));
      }

      const shopCode = shopRows[0].ShopCode;

      const result = await payoutService.listPayoutsByShop(
        shopCode,
        status as string,
        Number(limit),
        Number(offset)
      );

      return apiResponse.success(
        res,
        result,
        "Lấy danh sách yêu cầu rút tiền thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi lấy danh sách rút tiền"
        )
      );
    }
  },

  /**
   * Chi tiết yêu cầu rút tiền
   * GET /api/shops/me/payout-requests/:payoutID
   */
  async getPayoutRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { payoutID } = req.params;

      // Kiểm tra quyền
      const [shopRows] = await queryService.query<RowDataPacket[]>(
        `SELECT ShopCode FROM Shops WHERE UserID = ?`,
        [userId]
      );

      if (!shopRows?.[0]) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Bạn không có shop"));
      }

      const result = await payoutService.getPayoutByID(Number(payoutID));

      if (!result || result.ShopCode !== shopRows[0].ShopCode) {
        return next(new ApiError(StatusCodes.FORBIDDEN, "Bạn không có quyền truy cập"));
      }

      return apiResponse.success(res, result, "Chi tiết yêu cầu rút tiền", StatusCodes.OK);
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi lấy chi tiết rút tiền"
        )
      );
    }
  },

  /**
   * ADMIN: Liệt kê tất cả yêu cầu rút tiền
   * GET /api/admin/payout-requests
   */
  async adminListPayouts(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, shop_code, limit = 10, offset = 0 } = req.query;

      const result = await payoutService.listAllPayouts(
        status as string,
        shop_code ? Number(shop_code) : undefined,
        Number(limit),
        Number(offset)
      );

      return apiResponse.success(res, result, "Danh sách yêu cầu rút tiền", StatusCodes.OK);
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi lấy danh sách"
        )
      );
    }
  },

  /**
   * ADMIN: Chi tiết yêu cầu rút tiền
   * GET /api/admin/payout-requests/:payoutID
   */
  async adminGetPayout(req: Request, res: Response, next: NextFunction) {
    try {
      const { payoutID } = req.params;

      const result = await payoutService.getPayoutByID(Number(payoutID));

      if (!result) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy payout"));
      }

      return apiResponse.success(res, result, "Chi tiết payout", StatusCodes.OK);
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi lấy chi tiết"
        )
      );
    }
  },

  /**
   * ADMIN: Duyệt rút tiền
   * PATCH /api/admin/payout-requests/:payoutID/approve
   */
  async adminApprovePayout(req: Request, res: Response, next: NextFunction) {
    try {
      const { payoutID } = req.params;
      const { note } = req.body;

      const result = await payoutService.approvePayoutRequest(Number(payoutID), note);

      return apiResponse.success(res, result, "Duyệt rút tiền thành công", StatusCodes.OK);
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi duyệt rút tiền"
        )
      );
    }
  },

  /**
   * ADMIN: Từ chối rút tiền
   * PATCH /api/admin/payout-requests/:payoutID/reject
   */
  async adminRejectPayout(req: Request, res: Response, next: NextFunction) {
    try {
      const { payoutID } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return next(new ApiError(StatusCodes.BAD_REQUEST, "Vui lòng cung cấp lý do từ chối"));
      }

      const result = await payoutService.rejectPayoutRequest(Number(payoutID), reason);

      return apiResponse.success(res, result, "Từ chối rút tiền thành công", StatusCodes.OK);
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi từ chối rút tiền"
        )
      );
    }
  },
};

export default payoutController;
