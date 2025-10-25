// src/models/auth.model.ts
import { RowDataPacket, ResultSetHeader } from "mysql2";
import queryService from "../core/database";
import { AUTH_QUERIES } from "../queries/auth.queries";

export interface User extends RowDataPacket {
  UserID: number;
  Email: string;
  LevelCode: number;
  FullName?: string;
  PasswordHash?: string;
  IsActive?: number;
  _destroy?: number;
}

export interface UserLevel extends RowDataPacket {
  level_code: number;
}

const authModel = {
  /**
   * Lấy thông tin user cho đăng nhập
   */
  async getUserAuth(login: string): Promise<User | null> {
    const [rows] = await queryService.query<User[]>(
      AUTH_QUERIES.GET_USER_AUTH,
      [login, login]
    );
    return (rows?.[0] as User) || null;
  },

  /**
   * Kiểm tra user tồn tại theo email
   */
  async findByEmail(email: string): Promise<User | null> {
    const [rows] = await queryService.query<User[]>(
      AUTH_QUERIES.GET_USER_BY_EMAIL,
      [email]
    );
    return (rows?.[0] as User) || null;
  },

  /**
   * Lấy customer level code
   */
  async getCustomerLevelCode(): Promise<UserLevel | null> {
    const [rows] = await queryService.query<UserLevel[]>(
      AUTH_QUERIES.GET_CUSTOMER_LEVEL_CODE,
      []
    );
    return (rows?.[0] as UserLevel) || null;
  },

  /**
   * Tạo user mới
   */
  async createUser(
    levelCode: number,
    fullName: string,
    passwordHash: string,
    email: string
  ): Promise<number> {
    const [result] = await queryService.query<ResultSetHeader>(
      AUTH_QUERIES.CREATE_USER,
      [levelCode, fullName, passwordHash, email]
    );
    return result.insertId;
  },

  /**
   * Cập nhật mật khẩu theo email
   */
  async updatePasswordByEmail(
    email: string,
    passwordHash: string
  ): Promise<void> {
    await queryService.query<ResultSetHeader>(
      AUTH_QUERIES.UPDATE_PASSWORD_BY_EMAIL,
      [passwordHash, email.toLowerCase().trim()]
    );
  },

  /**
   * Kiểm tra user tồn tại
   */
  async checkExists(email: string): Promise<boolean> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      AUTH_QUERIES.CHECK_USER_EXISTS,
      [email]
    );
    return !!rows?.[0];
  },

  /**
   * Lấy user theo ID
   */
  async getUserById(userId: number): Promise<User | null> {
    const [rows] = await queryService.query<User[]>(
      AUTH_QUERIES.GET_USER_BY_ID,
      [userId]
    );
    return (rows?.[0] as User) || null;
  },
};

export default authModel;
