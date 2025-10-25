import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import payoutService from "../services/payout.service";

const payoutController = {
  /**
   * Tạo yêu cầu rút tiền (Shop)
   * POST /api/shops/me/payout-requests
   */
  async createPayoutRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { amount, bank_id, note, password } = req.body;

      if (!amount || amount <= 0) {
        return next(new ApiError(StatusCodes.BAD_REQUEST, "Số tiền phải lớn hơn 0"));
      }

      if (!password) {
        return next(new ApiError(StatusCodes.BAD_REQUEST, "Vui lòng nhập mật khẩu để xác nhận"));
      }

      // Get approved shop code using service
      const shopCode = await payoutService.getApprovedShopByUserId(userId);

      if (!shopCode) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Bạn không có shop hoặc shop chưa được duyệt"));
      }

      // Nếu không gửi bank_id, sẽ dùng default (bank_id = 0)
      const bankId = bank_id || 0;
      
      console.log(`[Payout Controller] Request data:`, {
        userId,
        shopCode,
        amount,
        bank_id_from_request: bank_id,
        bankId_final: bankId,
        has_password: !!password
      });

      const result = await payoutService.createPayoutRequest(
        shopCode,
        bankId,
        amount,
        note,
        userId,
        password
      );

      return apiResponse.success(res, result, "Tạo yêu cầu rút tiền thành công", StatusCodes.CREATED);
    } catch (error: any) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          error?.message || "Lỗi tạo yêu cầu rút tiền"
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

      const result = await payoutService.listPayoutsForOwner(
        userId,
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

      const result = await payoutService.getPayoutForOwner(
        userId,
        Number(payoutID)
      );

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
