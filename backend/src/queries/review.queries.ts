// SQL templates cho review operations
export const REVIEW_QUERIES = {
  // Danh sách review của một sân
  LIST_BY_FIELD: `
    SELECT r.ReviewCode, r.Rating, r.Comment, r.CreateAt, u.FullName
    FROM Reviews r
    JOIN Users u ON r.CustomerUserID = u.UserID
    WHERE r.FieldCode = ?
    ORDER BY r.CreateAt DESC
    LIMIT ? OFFSET ?
  `,

  // Thống kê rating của sân
  GET_RATING_STATS: `
    SELECT AVG(Rating) as avg_rating, COUNT(*) as total_reviews
    FROM Reviews 
    WHERE FieldCode = ?
  `,

  // Đếm tổng số review
  COUNT_BY_FIELD: `
    SELECT COUNT(*) as total 
    FROM Reviews 
    WHERE FieldCode = ?
  `,

  // Kiểm tra user đã review sân này chưa
  CHECK_EXISTING_REVIEW: `
    SELECT ReviewCode 
    FROM Reviews 
    WHERE FieldCode = ? AND CustomerUserID = ?
  `,

  // Lấy chi tiết review
  GET_BY_ID: `
    SELECT * 
    FROM Reviews 
    WHERE ReviewCode = ?
  `,

  // Lấy review của user
  GET_BY_ID_AND_USER: `
    SELECT * 
    FROM Reviews 
    WHERE ReviewCode = ? AND CustomerUserID = ?
  `,

  // Tạo review mới
  CREATE: `
    INSERT INTO Reviews (FieldCode, CustomerUserID, Rating, Comment, CreateAt)
    VALUES (?, ?, ?, ?, NOW())
  `,

  // Cập nhật review
  UPDATE: `
    UPDATE Reviews 
    SET Rating = ?, Comment = ? 
    WHERE ReviewCode = ?
  `,

  // Xóa review
  DELETE: `
    DELETE FROM Reviews 
    WHERE ReviewCode = ?
  `,

  // Kiểm tra user đã hoàn thành booking sân này
  CHECK_COMPLETED_BOOKING: `
    SELECT BookingCode 
    FROM Bookings 
    WHERE FieldCode = ? 
    AND CustomerUserID = ? 
    AND BookingStatus = 'completed'
    LIMIT 1
  `,
};
