// src/models/auth.model.ts
import authQueries from "../queries/auth.queries";
import queryService from "../services/query";

const authModel = {
  async getUserAuth(login: string) {
    return await queryService.execQueryOne(authQueries.getUserAuth, [login]);
  },

  // Giữ chữ ký như cũ để không ảnh hưởng nơi khác
  async findByEmailOrUserId(email: string, _userId: string) {
    return await queryService.execQueryOne(authQueries.getUserByEmailOrUserId, [
      email,
    ]);
  },

  async getCusLevelCode(): Promise<{ level_code: number } | null> {
    return (await queryService.execQueryOne(
      authQueries.getCusLevelCode,
      []
    )) as {
      level_code: number;
    } | null;
  },

  // GIỮ chữ ký (level_code, user_name, password_hash, email)
  async insertUser(
    level_code: number,
    user_name: string,
    password_hash: string,
    email: string
  ) {
    return await queryService.execQueryOne(authQueries.insertUser, [
      level_code,
      user_name,
      password_hash,
      email,
    ]);
  },

  // NEW: cập nhật mật khẩu theo email (dùng cho reset password)
  async updatePasswordByEmail(email: string, password_hash: string) {
    // Trả về kết quả của execQueryOne; nếu bạn muốn boolean, có thể xử lý tùy theo driver
    return await queryService.execQueryOne(authQueries.updatePasswordByEmail, [
      password_hash,
      email.toLowerCase().trim(),
    ]);
  },
};

export default authModel;
