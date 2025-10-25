import { StatusCodes } from "http-status-codes";
import ApiError from "../utils/apiErrors";
import reviewModel from "../models/review.model";

const reviewService = {
  /**
   * Danh sách review với pagination
   */
  async listFieldReviews(
    fieldCode: number,
    filters?: { limit?: number; offset?: number }
  ) {
    const limit = Math.max(1, Math.min(filters?.limit || 10, 100));
    const offset = Math.max(0, filters?.offset || 0);

    const reviews = await reviewModel.listByField(fieldCode, limit, offset);
    const stats = await reviewModel.getRatingStats(fieldCode);
    const total = await reviewModel.countByField(fieldCode);

    return {
      data: reviews,
      stats: {
        avg_rating: stats.avg_rating ? parseFloat(String(stats.avg_rating)) : 0,
        total_reviews: stats.total_reviews || 0,
      },
      pagination: {
        limit,
        offset,
        total,
      },
    };
  },

  /**
   * Tạo review - với kiểm tra nghiệp vụ
   */
  async createReview(
    fieldCode: number,
    userId: number,
    rating: number,
    comment?: string
  ) {
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Rating phải từ 1 đến 5");
    }

    // Kiểm tra user đã hoàn thành booking sân này
    const hasCompletedBooking = await reviewModel.checkCompletedBooking(
      fieldCode,
      userId
    );
    if (!hasCompletedBooking) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Bạn chỉ có thể review sân sau khi hoàn thành booking"
      );
    }

    // Kiểm tra không review 2 lần
    const alreadyReviewed = await reviewModel.checkExisting(fieldCode, userId);
    if (alreadyReviewed) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Bạn đã review sân này rồi");
    }

    // Tạo review
    const reviewCode = await reviewModel.create(
      fieldCode,
      userId,
      rating,
      comment
    );

    return {
      reviewCode,
      fieldCode,
      rating,
      comment,
    };
  },

  /**
   * Cập nhật review - với kiểm tra quyền
   */
  async updateReview(
    reviewCode: number,
    userId: number,
    updates: { rating?: number; comment?: string }
  ) {
    // Validate rating if provided
    if (updates.rating && (updates.rating < 1 || updates.rating > 5)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Rating phải từ 1 đến 5");
    }

    // Kiểm tra quyền
    const review = await reviewModel.getByIdAndUser(reviewCode, userId);
    if (!review) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Bạn không có quyền chỉnh sửa review này"
      );
    }

    // Xác định dữ liệu cập nhật
    const rating = updates.rating ?? review.Rating;
    const comment =
      updates.comment !== undefined ? updates.comment : review.Comment;

    if (!updates.rating && updates.comment === undefined) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Không có gì để cập nhật");
    }

    // Cập nhật
    await reviewModel.update(reviewCode, rating, comment);

    return { reviewCode };
  },

  /**
   * Xóa review - với kiểm tra quyền
   */
  async deleteReview(reviewCode: number, userId: number) {
    // Kiểm tra quyền
    const review = await reviewModel.getByIdAndUser(reviewCode, userId);
    if (!review) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Bạn không có quyền xóa review này"
      );
    }

    // Xóa
    await reviewModel.delete(reviewCode);

    return { reviewCode };
  },

  /**
   * Admin xóa review
   */
  async adminDeleteReview(reviewCode: number) {
    const review = await reviewModel.getById(reviewCode);
    if (!review) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy review");
    }

    await reviewModel.delete(reviewCode);

    return { reviewCode };
  },
};

export default reviewService;
