// src/queries/auth.queries.ts
const authQueries = {
  // Lấy thông tin đăng nhập (Users: PascalCase)
  getUserAuth: `
    SELECT UserID, LevelCode, FullName, Email, PasswordHash, IsActive, _destroy
    FROM Users
    WHERE Email = ?
    LIMIT 1
  `,

  // Kiểm tra trùng Email
  getUserByEmailOrUserId: `
    SELECT UserID, Email
    FROM Users
    WHERE Email = ?
    LIMIT 1
  `,

  // Lấy LevelCode cho khách (Users_Level)
  getCusLevelCode: `
    SELECT LevelCode AS level_code
    FROM Users_Level
    WHERE LevelType = 'cus'
    LIMIT 1
  `,

  // Thêm user mới (bỏ CreateAt/UpdateAt vì đã DEFAULT; PhoneNumber/Password có thể NULL)
  insertUser: `
    INSERT INTO Users (
      LevelCode,
      FullName,
      PasswordHash,
      Email,
      FirstLogin,
      
      IsActive,
      _destroy
    ) VALUES (
      ?,      -- LevelCode
      ?,      -- FullName
      ?,      -- PasswordHash
      ?,      -- Email
      1,      -- IsActive
      1,      -- FirstLogin
      0       -- _destroy
    )
  `,
  // Password,
  // PhoneNumber,
  // NULL,   -- PhoneNumber (nullable)
  //     NULL,   -- Password (plaintext - không dùng, để NULL)

  // OTP / mã xác thực email (Users_Verification: PascalCase chuẩn)
  insertVerifyCode: `
    INSERT INTO Users_Verification (UserCode, Email, Code, ExpiresAt, Consumed)
    VALUES (?, ?, ?, ?, 'N')
  `,
  getValidVerifyCode: `
    SELECT Id, UserCode
    FROM Users_Verification
    WHERE Email = ?
      AND Code = ?
      AND Consumed = 'N'
      AND ExpiresAt > NOW()
    ORDER BY Id DESC
    LIMIT 1
  `,
  consumeVerifyCodeById: `
    UPDATE Users_Verification
    SET Consumed = 'Y'
    WHERE Id = ?
    LIMIT 1
  `,

  // Kích hoạt user
  activateUserById: `
    UPDATE Users
    SET IsActive = 1, UpdateAt = NOW()
    WHERE UserID = ?
    LIMIT 1
  `,

  // Đổi mật khẩu theo email (lưu ý UpdateAt, không phải UpdatedAt)
  updatePasswordByEmail: `
    UPDATE Users
    SET PasswordHash = ?, UpdateAt = NOW()
    WHERE Email = ?
    LIMIT 1
  `,
};

export default authQueries;
