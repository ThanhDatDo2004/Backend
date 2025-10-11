import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION;
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION;

const authService = {
   generateAccessToken(payload: any): string {
      if (!JWT_SECRET_KEY) {
         throw new Error("JWT secret key is not defined in environment variables.");
      }
      return jwt.sign(payload, JWT_SECRET_KEY, {
         expiresIn: JWT_EXPIRATION as any,
      });
   },

   generateRefreshToken(payload: any): string {
      if (!JWT_SECRET_KEY) {
         throw new Error("JWT secret key is not defined in environment variables.");
      }
      return jwt.sign(payload, JWT_SECRET_KEY, {
         expiresIn: JWT_REFRESH_EXPIRATION as any,
      });
   },

   verifyToken(token: string): any {
      if (!JWT_SECRET_KEY) {
         throw new Error("JWT secret key is not defined in environment variables.");
      }
      try {
         return jwt.verify(token, JWT_SECRET_KEY) as any;
      } catch (error) {
         throw new Error("Invalid token");
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
