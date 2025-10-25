// SQL templates cho notification operations
export const NOTIFICATION_QUERIES = {
  // Danh sách thông báo của user
  LIST_BY_USER: `
    SELECT NotificationID, UserID, Title, Message, IsRead, CreateAt
    FROM Notifications
    WHERE UserID = ?
    ORDER BY CreateAt DESC
    LIMIT ? OFFSET ?
  `,

  // Đếm thông báo
  COUNT_BY_USER: `
    SELECT COUNT(*) as total
    FROM Notifications
    WHERE UserID = ?
  `,

  // Đếm thông báo chưa đọc
  COUNT_UNREAD_BY_USER: `
    SELECT COUNT(*) as unread_count
    FROM Notifications
    WHERE UserID = ? AND IsRead = 'N'
  `,

  // Danh sách thông báo chưa đọc
  LIST_UNREAD_BY_USER: `
    SELECT NotificationID, UserID, Title, Message, IsRead, CreateAt
    FROM Notifications
    WHERE UserID = ? AND IsRead = 'N'
    ORDER BY CreateAt DESC
    LIMIT ? OFFSET ?
  `,

  // Lấy thông báo theo ID
  GET_BY_ID: `
    SELECT * FROM Notifications WHERE NotificationID = ?
  `,

  // Đánh dấu đã đọc
  MARK_AS_READ: `
    UPDATE Notifications
    SET IsRead = 'Y'
    WHERE NotificationID = ?
  `,

  // Đánh dấu tất cả đã đọc
  MARK_ALL_AS_READ: `
    UPDATE Notifications
    SET IsRead = 'Y'
    WHERE UserID = ? AND IsRead = 'N'
  `,

  // Xóa thông báo
  DELETE: `
    DELETE FROM Notifications
    WHERE NotificationID = ?
  `,

  // Tạo thông báo
  CREATE: `
    INSERT INTO Notifications (UserID, Title, Message, IsRead, CreateAt)
    VALUES (?, ?, ?, 'N', NOW())
  `,
};
