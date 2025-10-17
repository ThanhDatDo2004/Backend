import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import queryService from "../services/query";
import { RowDataPacket, ResultSetHeader } from "mysql2";

const reviewController = {
  /**
   * Liệt kê review của một sân
   * GET /api/fields/:fieldCode/reviews
   */
  async listFieldReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const { fieldCode } = req.params;
      const { limit = 10, offset = 0 } = req.query;

      let query = `SELECT r.ReviewCode, r.Rating, r.Comment, r.CreateAt,
                          u.FullName
                   FROM Reviews r
                   JOIN Users u ON r.CustomerUserID = u.UserID
                   WHERE r.FieldCode = ?
                   ORDER BY r.CreateAt DESC
                   LIMIT ? OFFSET ?`;

      const [reviews] = await queryService.query<RowDataPacket[]>(
        query,
        [fieldCode, Number(limit), Number(offset)]
      );

      // Get average rating
      const [ratingRows] = await queryService.query<RowDataPacket[]>(
        `SELECT AVG(Rating) as avg_rating, COUNT(*) as total_reviews
         FROM Reviews WHERE FieldCode = ?`,
        [fieldCode]
      );

      const avgRating = ratingRows?.[0]?.avg_rating || 0;
      const totalReviews = ratingRows?.[0]?.total_reviews || 0;

      // Get total
      const [countRows] = await queryService.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM Reviews WHERE FieldCode = ?`,
        [fieldCode]
      );

      return apiResponse.success(
        res,
        {
          data: reviews,
          stats: {
            avg_rating: parseFloat(avgRating),
            total_reviews: totalReviews,
          },
          pagination: {
            limit: Number(limit),
            offset: Number(offset),
            total: countRows?.[0]?.total || 0,
          },
        },
        "Danh sách review",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi lấy danh sách review"
        )
      );
    }
  },

  /**
   * Tạo review (customer)
   * POST /api/fields/:fieldCode/reviews
   */
  async createReview(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { fieldCode } = req.params;
      const { rating, comment } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return next(new ApiError(StatusCodes.BAD_REQUEST, "Rating phải từ 1 đến 5"));
      }

      // Kiểm tra customer đã hoàn thành booking cho sân này
      const [bookingRows] = await queryService.query<RowDataPacket[]>(
        `SELECT BookingCode FROM Bookings 
         WHERE FieldCode = ? AND CustomerUserID = ? AND BookingStatus = 'completed'`,
        [fieldCode, userId]
      );

      if (!bookingRows?.[0]) {
        return next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Bạn chỉ có thể review sân sau khi hoàn thành booking"
          )
        );
      }

      // Kiểm tra không review 2 lần
      const [existingReview] = await queryService.query<RowDataPacket[]>(
        `SELECT ReviewCode FROM Reviews 
         WHERE FieldCode = ? AND CustomerUserID = ?`,
        [fieldCode, userId]
      );

      if (existingReview?.[0]) {
        return next(new ApiError(StatusCodes.BAD_REQUEST, "Bạn đã review sân này rồi"));
      }

      const [result] = await queryService.query<ResultSetHeader>(
        `INSERT INTO Reviews (FieldCode, CustomerUserID, Rating, Comment, CreateAt)
         VALUES (?, ?, ?, ?, NOW())`,
        [fieldCode, userId, rating, comment || null]
      );

      return apiResponse.success(
        res,
        { reviewCode: result.insertId, fieldCode, rating, comment },
        "Tạo review thành công",
        StatusCodes.CREATED
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi tạo review"
        )
      );
    }
  },

  /**
   * Cập nhật review (customer)
   * PUT /api/reviews/:reviewCode
   */
  async updateReview(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { reviewCode } = req.params;
      const { rating, comment } = req.body;

      if (rating && (rating < 1 || rating > 5)) {
        return next(new ApiError(StatusCodes.BAD_REQUEST, "Rating phải từ 1 đến 5"));
      }

      // Kiểm tra quyền
      const [reviews] = await queryService.query<RowDataPacket[]>(
        `SELECT * FROM Reviews WHERE ReviewCode = ? AND CustomerUserID = ?`,
        [reviewCode, userId]
      );

      if (!reviews?.[0]) {
        return next(new ApiError(StatusCodes.FORBIDDEN, "Bạn không có quyền chỉnh sửa review này"));
      }

      const updateFields = [];
      const updateParams: any[] = [];

      if (rating) {
        updateFields.push("Rating = ?");
        updateParams.push(rating);
      }

      if (comment !== undefined) {
        updateFields.push("Comment = ?");
        updateParams.push(comment || null);
      }

      if (updateFields.length === 0) {
        return next(new ApiError(StatusCodes.BAD_REQUEST, "Không có gì để cập nhật"));
      }

      updateParams.push(reviewCode);

      await queryService.query<ResultSetHeader>(
        `UPDATE Reviews SET ${updateFields.join(", ")} WHERE ReviewCode = ?`,
        updateParams
      );

      return apiResponse.success(res, { reviewCode }, "Cập nhật review thành công", StatusCodes.OK);
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi cập nhật review"
        )
      );
    }
  },

  /**
   * Xóa review (customer)
   * DELETE /api/reviews/:reviewCode
   */
  async deleteReview(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { reviewCode } = req.params;

      const [reviews] = await queryService.query<RowDataPacket[]>(
        `SELECT * FROM Reviews WHERE ReviewCode = ? AND CustomerUserID = ?`,
        [reviewCode, userId]
      );

      if (!reviews?.[0]) {
        return next(new ApiError(StatusCodes.FORBIDDEN, "Bạn không có quyền xóa review này"));
      }

      await queryService.query<ResultSetHeader>(
        `DELETE FROM Reviews WHERE ReviewCode = ?`,
        [reviewCode]
      );

      return apiResponse.success(res, { reviewCode }, "Xóa review thành công", StatusCodes.OK);
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi xóa review"
        )
      );
    }
  },

  /**
   * ADMIN: Xóa review vi phạm
   * DELETE /api/admin/reviews/:reviewCode
   */
  async adminDeleteReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewCode } = req.params;

      const [reviews] = await queryService.query<RowDataPacket[]>(
        `SELECT * FROM Reviews WHERE ReviewCode = ?`,
        [reviewCode]
      );

      if (!reviews?.[0]) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy review"));
      }

      await queryService.query<ResultSetHeader>(
        `DELETE FROM Reviews WHERE ReviewCode = ?`,
        [reviewCode]
      );

      return apiResponse.success(
        res,
        { reviewCode },
        "Admin đã xóa review",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi xóa review"
        )
      );
    }
  },
};

export default reviewController;
