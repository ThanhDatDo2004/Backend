import type { AuthenticatedUser } from "../../interfaces/auth";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
