import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import apiResponse from "../core/respone";
import ApiError from "../utils/apiErrors";
import notificationService from "../services/notification.service";

const notificationController = {
  /**
   * Liệt kê thông báo của user
   * GET /api/notifications
   */
  async listNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;
      const { isRead, limit = 10, offset = 0 } = req.query;

      const result = await notificationService.listNotifications(userId, {
        isRead:
          isRead === "true" ? true : isRead === "false" ? false : undefined,
        limit: Number(limit),
        offset: Number(offset),
      });

      return apiResponse.success(
        res,
        {
          ...result,
          unread_count: result.unreadCount,
        },
        "Danh sách thông báo",
        StatusCodes.OK
      );
    } catch (error: any) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          error?.message || "Lỗi lấy thông báo"
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
      const { notificationID } = req.params;

      const result = await notificationService.markAsRead(
        Number(notificationID)
      );

      return apiResponse.success(
        res,
        { ...result, isRead: true },
        "Đánh dấu đã đọc",
        StatusCodes.OK
      );
    } catch (error: any) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          error?.message || "Lỗi cập nhật thông báo"
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

      await notificationService.markAllAsRead(userId);

      return apiResponse.success(
        res,
        { userId },
        "Đánh dấu tất cả đã đọc",
        StatusCodes.OK
      );
    } catch (error: any) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          error?.message || "Lỗi cập nhật thông báo"
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
      const { notificationID } = req.params;
      const result = await notificationService.deleteNotification(
        Number(notificationID)
      );

      return apiResponse.success(
        res,
        result,
        "Xóa thông báo thành công",
        StatusCodes.OK
      );
    } catch (error: any) {
      if (error instanceof ApiError) return next(error);
      next(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, error?.message));
    }
  },
};

/**
 * Service function to create notifications (được dùng bởi các service khác)
 */
export async function createNotification(
  userId: number,
  title: string,
  message: string
) {
  try {
    await notificationService.createNotification(userId, title, message);
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

export default notificationController;
