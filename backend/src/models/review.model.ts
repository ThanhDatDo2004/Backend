import { RowDataPacket, ResultSetHeader } from "mysql2";
import queryService from "../core/database";
import { REVIEW_QUERIES } from "../queries/review.queries";

export interface Review extends RowDataPacket {
  ReviewCode: number;
  FieldCode: number;
  CustomerUserID: number;
  Rating: number;
  Comment?: string;
  CreateAt: Date;
}

export interface ReviewWithUser extends RowDataPacket {
  ReviewCode: number;
  Rating: number;
  Comment?: string;
  CreateAt: Date;
  FullName: string;
}

export interface RatingStats {
  avg_rating: number | null;
  total_reviews: number;
}

const reviewModel = {
  /**
   * Danh sách review của sân
   */
  async listByField(
    fieldCode: number,
    limit: number,
    offset: number
  ): Promise<ReviewWithUser[]> {
    const [rows] = await queryService.query<ReviewWithUser[]>(
      REVIEW_QUERIES.LIST_BY_FIELD,
      [fieldCode, limit, offset]
    );
    return (rows as ReviewWithUser[]) || [];
  },

  /**
   * Thống kê rating
   */
  async getRatingStats(fieldCode: number): Promise<RatingStats> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      REVIEW_QUERIES.GET_RATING_STATS,
      [fieldCode]
    );
    return (rows?.[0] as RatingStats) || { avg_rating: 0, total_reviews: 0 };
  },

  /**
   * Đếm review theo sân
   */
  async countByField(fieldCode: number): Promise<number> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      REVIEW_QUERIES.COUNT_BY_FIELD,
      [fieldCode]
    );
    return rows?.[0]?.total || 0;
  },

  /**
   * Kiểm tra review đã tồn tại
   */
  async checkExisting(fieldCode: number, userId: number): Promise<boolean> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      REVIEW_QUERIES.CHECK_EXISTING_REVIEW,
      [fieldCode, userId]
    );
    return !!rows?.[0];
  },

  /**
   * Lấy review theo ID
   */
  async getById(reviewCode: number): Promise<Review | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      REVIEW_QUERIES.GET_BY_ID,
      [reviewCode]
    );
    return (rows?.[0] as Review) || null;
  },

  /**
   * Lấy review theo ID và user
   */
  async getByIdAndUser(
    reviewCode: number,
    userId: number
  ): Promise<Review | null> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      REVIEW_QUERIES.GET_BY_ID_AND_USER,
      [reviewCode, userId]
    );
    return (rows?.[0] as Review) || null;
  },

  /**
   * Tạo review
   */
  async create(
    fieldCode: number,
    userId: number,
    rating: number,
    comment?: string
  ): Promise<number> {
    const [result] = await queryService.query<ResultSetHeader>(
      REVIEW_QUERIES.CREATE,
      [fieldCode, userId, rating, comment || null]
    );
    return result.insertId;
  },

  /**
   * Cập nhật review
   */
  async update(
    reviewCode: number,
    rating: number,
    comment?: string
  ): Promise<void> {
    await queryService.query<ResultSetHeader>(REVIEW_QUERIES.UPDATE, [
      rating,
      comment || null,
      reviewCode,
    ]);
  },

  /**
   * Xóa review
   */
  async delete(reviewCode: number): Promise<void> {
    await queryService.query<ResultSetHeader>(REVIEW_QUERIES.DELETE, [
      reviewCode,
    ]);
  },

  /**
   * Kiểm tra booking hoàn thành
   */
  async checkCompletedBooking(
    fieldCode: number,
    userId: number
  ): Promise<boolean> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      REVIEW_QUERIES.CHECK_COMPLETED_BOOKING,
      [fieldCode, userId]
    );
    return !!rows?.[0];
  },
};

export default reviewModel;
