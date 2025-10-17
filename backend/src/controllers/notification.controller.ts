import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import queryService from "../services/query";
import { RowDataPacket, ResultSetHeader } from "mysql2";

const notificationController = {
  /**
   * Liệt kê thông báo của user
   * GET /api/notifications
   */
  async listNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { isRead, limit = 10, offset = 0 } = req.query;

      let query = `SELECT * FROM Notifications 
                   WHERE UserID = ?`;
      const params: any[] = [userId];

      if (isRead !== undefined) {
        const readChar = isRead === "true" ? "Y" : "N";
        query += ` AND IsRead = ?`;
        params.push(readChar);
      }

      query += ` ORDER BY CreateAt DESC LIMIT ? OFFSET ?`;
      params.push(Number(limit), Number(offset));

      const [notifications] = await queryService.query<RowDataPacket[]>(
        query,
        params
      );

      // Get total
      let countQuery = `SELECT COUNT(*) as total FROM Notifications WHERE UserID = ?`;
      const countParams: any[] = [userId];
      if (isRead !== undefined) {
        const readChar = isRead === "true" ? "Y" : "N";
        countQuery += ` AND IsRead = ?`;
        countParams.push(readChar);
      }
      const [countRows] = await queryService.query<RowDataPacket[]>(
        countQuery,
        countParams
      );

      // Get unread count
      const [unreadRows] = await queryService.query<RowDataPacket[]>(
        `SELECT COUNT(*) as unread_count FROM Notifications WHERE UserID = ? AND IsRead = 'N'`,
        [userId]
      );

      return apiResponse.success(
        res,
        {
          data: notifications,
          unread_count: unreadRows?.[0]?.unread_count || 0,
          pagination: {
            limit: Number(limit),
            offset: Number(offset),
            total: countRows?.[0]?.total || 0,
          },
        },
        "Danh sách thông báo",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi lấy thông báo"
        )
      );
    }
  },

  /**
   * Đánh dấu thông báo đã đọc
   * PATCH /api/notifications/:notificationID/read
   */
  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { notificationID } = req.params;

      const [notifications] = await queryService.query<RowDataPacket[]>(
        `SELECT * FROM Notifications WHERE NotificationID = ? AND UserID = ?`,
        [notificationID, userId]
      );

      if (!notifications?.[0]) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy thông báo")
        );
      }

      await queryService.query<ResultSetHeader>(
        `UPDATE Notifications SET IsRead = 'Y' WHERE NotificationID = ?`,
        [notificationID]
      );

      return apiResponse.success(
        res,
        { notificationID, isRead: true },
        "Đánh dấu đã đọc",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi cập nhật thông báo"
        )
      );
    }
  },

  /**
   * Đánh dấu tất cả đã đọc
   * PATCH /api/notifications/read-all
   */
  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;

      const [result] = await queryService.query<ResultSetHeader>(
        `UPDATE Notifications SET IsRead = 'Y' WHERE UserID = ? AND IsRead = 'N'`,
        [userId]
      );

      return apiResponse.success(
        res,
        { updated: result.affectedRows },
        "Đánh dấu tất cả đã đọc",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi cập nhật thông báo"
        )
      );
    }
  },

  /**
   * Xóa thông báo
   * DELETE /api/notifications/:notificationID
   */
  async deleteNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { notificationID } = req.params;

      const [notifications] = await queryService.query<RowDataPacket[]>(
        `SELECT * FROM Notifications WHERE NotificationID = ? AND UserID = ?`,
        [notificationID, userId]
      );

      if (!notifications?.[0]) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy thông báo")
        );
      }

      await queryService.query<ResultSetHeader>(
        `DELETE FROM Notifications WHERE NotificationID = ?`,
        [notificationID]
      );

      return apiResponse.success(
        res,
        { notificationID },
        "Xóa thông báo thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi xóa thông báo"
        )
      );
    }
  },
};

/**
 * Service function to create notifications (được dùng bởi các service khác)
 */
export async function createNotification(
  userID: number,
  type: string,
  title: string,
  content?: string
) {
  try {
    await queryService.query<ResultSetHeader>(
      `INSERT INTO Notifications (UserID, Type, Title, Content, IsRead, CreateAt)
       VALUES (?, ?, ?, ?, 'N', NOW())`,
      [userID, type, title, content || null]
    );
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

export default notificationController;
