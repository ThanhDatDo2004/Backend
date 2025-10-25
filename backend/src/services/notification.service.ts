import { StatusCodes } from "http-status-codes";
import ApiError from "../utils/apiErrors";
import notificationModel from "../models/notification.model";

const notificationService = {
  /**
   * Danh sách thông báo của user với pagination
   */
  async listNotifications(
    userId: number,
    filters?: {
      isRead?: boolean;
      limit?: number;
      offset?: number;
    }
  ) {
    const limit = Math.max(1, Math.min(filters?.limit || 10, 100));
    const offset = Math.max(0, filters?.offset || 0);

    let notifications;
    if (filters?.isRead !== undefined) {
      // Chỉ lấy đã đọc hoặc chưa đọc
      if (filters.isRead) {
        // Chỉ đã đọc - cần filter ở service layer vì model không có query cho "IsRead = Y"
        const allNotifications = await notificationModel.listByUser(
          userId,
          1000,
          0
        );
        notifications = allNotifications
          .filter((n) => n.IsRead === "Y")
          .slice(offset, offset + limit);
      } else {
        // Chưa đọc
        notifications = await notificationModel.listUnreadByUser(
          userId,
          limit,
          offset
        );
      }
    } else {
      // Tất cả thông báo
      notifications = await notificationModel.listByUser(userId, limit, offset);
    }

    // Lấy thống kê
    const total = await notificationModel.countByUser(userId);
    const unreadCount = await notificationModel.countUnreadByUser(userId);

    return {
      data: notifications,
      unreadCount,
      pagination: {
        limit,
        offset,
        total,
      },
    };
  },

  /**
   * Đánh dấu thông báo đã đọc
   */
  async markAsRead(notificationId: number) {
    const notification = await notificationModel.getById(notificationId);
    if (!notification) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy thông báo");
    }

    await notificationModel.markAsRead(notificationId);
    return { notificationId };
  },

  /**
   * Đánh dấu tất cả thông báo của user đã đọc
   */
  async markAllAsRead(userId: number) {
    await notificationModel.markAllAsRead(userId);
    return { userId };
  },

  /**
   * Xóa thông báo
   */
  async deleteNotification(notificationId: number) {
    const notification = await notificationModel.getById(notificationId);
    if (!notification) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy thông báo");
    }

    await notificationModel.delete(notificationId);
    return { notificationId };
  },

  /**
   * Tạo thông báo
   */
  async createNotification(userId: number, title: string, message: string) {
    const notificationId = await notificationModel.create(
      userId,
      title,
      message
    );
    return { notificationId };
  },
};

export default notificationService;
