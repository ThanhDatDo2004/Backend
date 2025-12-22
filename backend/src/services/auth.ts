import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION;
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION;

const authService = {
  generateAccessToken(payload: any): string {
    if (!JWT_SECRET_KEY) {
      throw new Error(
        "JWT secret key is not defined in environment variables."
      );
    }
    return jwt.sign(payload, JWT_SECRET_KEY, {
      expiresIn: JWT_EXPIRATION as any,
    });
  },

  generateRefreshToken(payload: any): string {
    if (!JWT_SECRET_KEY) {
      throw new Error(
        "JWT secret key is not defined in environment variables."
      );
    }
    return jwt.sign(payload, JWT_SECRET_KEY, {
      expiresIn: JWT_REFRESH_EXPIRATION as any,
    });
  },

 verifyToken(token?: string): any {
  if (!JWT_SECRET_KEY) {
    throw new Error("JWT secret key is not defined.");
  }

  // ✅ Check token trước
  if (!token || token === "undefined" || token === "null") {
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET_KEY);
  } catch (error: any) {
    // phân biệt lỗi để debug
    if (error.name === "TokenExpiredError") {
      throw new Error("Token expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid token");
    }
    throw error;
  }
},


  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    try {
      const hash = await bcrypt.hash(password, saltRounds);
      return hash;
    } catch (error) {
      throw error;
    }
  },
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const result = await bcrypt.compare(password, hash);
      return result;
    } catch (error) {
      throw error;
    }
  },
};
export default authService;
