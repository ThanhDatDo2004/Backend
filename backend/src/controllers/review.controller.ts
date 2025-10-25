import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import reviewService from "../services/review.service";

const reviewController = {
  // Danh sách review
  async listFieldReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const { fieldCode } = req.params;
      const { limit, offset } = req.query;

      const result = await reviewService.listFieldReviews(Number(fieldCode), {
        limit: limit ? Number(limit) : 10,
        offset: offset ? Number(offset) : 0,
      });

      return apiResponse.success(
        res,
        result,
        "Danh sách review",
        StatusCodes.OK
      );
    } catch (error: any) {
      next(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, error?.message));
    }
  },

  // Tạo review
  async createReview(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { fieldCode } = req.params;
      const { rating, comment } = req.body;

      const result = await reviewService.createReview(
        Number(fieldCode),
        userId,
        rating,
        comment
      );

      return apiResponse.success(
        res,
        result,
        "Tạo review thành công",
        StatusCodes.CREATED
      );
    } catch (error: any) {
      if (error instanceof ApiError) return next(error);
      next(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, error?.message));
    }
  },

  // Cập nhật review
  async updateReview(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { reviewCode } = req.params;
      const { rating, comment } = req.body;

      const result = await reviewService.updateReview(
        Number(reviewCode),
        userId,
        {
          rating,
          comment,
        }
      );

      return apiResponse.success(
        res,
        result,
        "Cập nhật review thành công",
        StatusCodes.OK
      );
    } catch (error: any) {
      if (error instanceof ApiError) return next(error);
      next(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, error?.message));
    }
  },

  // Xóa review
  async deleteReview(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { reviewCode } = req.params;

      const result = await reviewService.deleteReview(
        Number(reviewCode),
        userId
      );

      return apiResponse.success(
        res,
        result,
        "Xóa review thành công",
        StatusCodes.OK
      );
    } catch (error: any) {
      if (error instanceof ApiError) return next(error);
      next(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, error?.message));
    }
  },

  // Admin xóa review
  async adminDeleteReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewCode } = req.params;

      const result = await reviewService.adminDeleteReview(Number(reviewCode));

      return apiResponse.success(
        res,
        result,
        "Admin đã xóa review",
        StatusCodes.OK
      );
    } catch (error: any) {
      if (error instanceof ApiError) return next(error);
      next(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, error?.message));
    }
  },
};

export default reviewController;
