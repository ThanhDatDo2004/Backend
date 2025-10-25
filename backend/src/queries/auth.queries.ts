// SQL templates cho auth operations
export const AUTH_QUERIES = {
  // Lấy thông tin đăng nhập
  GET_USER_AUTH: `
    SELECT UserID, LevelCode, FullName, Email, PasswordHash, IsActive, _destroy
    FROM Users
    WHERE Email = ? OR Email = ?
    LIMIT 1
  `,

  // Kiểm tra trùng Email
  GET_USER_BY_EMAIL: `
    SELECT UserID, Email, LevelCode
    FROM Users
    WHERE Email = ?
    LIMIT 1
  `,

  // Lấy LevelCode cho khách
  GET_CUSTOMER_LEVEL_CODE: `
    SELECT LevelCode AS level_code
    FROM Users_Level
    WHERE LevelType = 'cus'
    LIMIT 1
  `,

  // Thêm user mới
  CREATE_USER: `
    INSERT INTO Users (
      LevelCode,
      FullName,
      PasswordHash,
      Email,
      FirstLogin,
      IsActive,
      _destroy
    ) VALUES (?, ?, ?, ?, 1, 1, 0)
  `,

  // Cập nhật mật khẩu theo email
  UPDATE_PASSWORD_BY_EMAIL: `
    UPDATE Users
    SET PasswordHash = ?, UpdateAt = NOW()
    WHERE Email = ?
    LIMIT 1
  `,

  // Kiểm tra user tồn tại
  CHECK_USER_EXISTS: `
    SELECT UserID
    FROM Users
    WHERE Email = ?
    LIMIT 1
  `,

  // Lấy user theo ID
  GET_USER_BY_ID: `
    SELECT UserID, Email, LevelCode, FullName, IsActive, _destroy
    FROM Users
    WHERE UserID = ?
    LIMIT 1
  `,
};

// Giữ lại cách import cũ để không break existing code
const authQueries = AUTH_QUERIES;
export default authQueries;
