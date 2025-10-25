import { RowDataPacket, ResultSetHeader } from "mysql2";
import queryService from "../core/database";
import { NOTIFICATION_QUERIES } from "../queries/notification.queries";

export interface Notification extends RowDataPacket {
  NotificationID: number;
  UserID: number;
  Title: string;
  Message: string;
  IsRead: string; // 'Y' or 'N'
  CreateAt: Date;
}

export interface NotificationCount extends RowDataPacket {
  total: number;
}

export interface UnreadCount extends RowDataPacket {
  unread_count: number;
}

const notificationModel = {
  /**
   * Danh sách thông báo của user
   */
  async listByUser(
    userId: number,
    limit: number,
    offset: number
  ): Promise<Notification[]> {
    const [rows] = await queryService.query<Notification[]>(
      NOTIFICATION_QUERIES.LIST_BY_USER,
      [userId, limit, offset]
    );
    return (rows as Notification[]) || [];
  },

  /**
   * Danh sách thông báo chưa đọc
   */
  async listUnreadByUser(
    userId: number,
    limit: number,
    offset: number
  ): Promise<Notification[]> {
    const [rows] = await queryService.query<Notification[]>(
      NOTIFICATION_QUERIES.LIST_UNREAD_BY_USER,
      [userId, limit, offset]
    );
    return (rows as Notification[]) || [];
  },

  /**
   * Đếm thông báo của user
   */
  async countByUser(userId: number): Promise<number> {
    const [rows] = await queryService.query<NotificationCount[]>(
      NOTIFICATION_QUERIES.COUNT_BY_USER,
      [userId]
    );
    return rows?.[0]?.total || 0;
  },

  /**
   * Đếm thông báo chưa đọc
   */
  async countUnreadByUser(userId: number): Promise<number> {
    const [rows] = await queryService.query<UnreadCount[]>(
      NOTIFICATION_QUERIES.COUNT_UNREAD_BY_USER,
      [userId]
    );
    return rows?.[0]?.unread_count || 0;
  },

  /**
   * Lấy thông báo theo ID
   */
  async getById(notificationId: number): Promise<Notification | null> {
    const [rows] = await queryService.query<Notification[]>(
      NOTIFICATION_QUERIES.GET_BY_ID,
      [notificationId]
    );
    return (rows?.[0] as Notification) || null;
  },

  /**
   * Đánh dấu thông báo đã đọc
   */
  async markAsRead(notificationId: number): Promise<void> {
    await queryService.query<ResultSetHeader>(
      NOTIFICATION_QUERIES.MARK_AS_READ,
      [notificationId]
    );
  },

  /**
   * Đánh dấu tất cả thông báo của user đã đọc
   */
  async markAllAsRead(userId: number): Promise<void> {
    await queryService.query<ResultSetHeader>(
      NOTIFICATION_QUERIES.MARK_ALL_AS_READ,
      [userId]
    );
  },

  /**
   * Xóa thông báo
   */
  async delete(notificationId: number): Promise<void> {
    await queryService.query<ResultSetHeader>(NOTIFICATION_QUERIES.DELETE, [
      notificationId,
    ]);
  },

  /**
   * Tạo thông báo
   */
  async create(
    userId: number,
    title: string,
    message: string
  ): Promise<number> {
    const [result] = await queryService.query<ResultSetHeader>(
      NOTIFICATION_QUERIES.CREATE,
      [userId, title, message]
    );
    return result.insertId;
  },
};

export default notificationModel;
