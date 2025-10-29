export type JwtUserPayload = {
  UserID?: number;
  LevelCode?: number;
  FullName?: string | null;
  Email?: string | null;
  PhoneNumber?: string | null;
  isActive?: number;
  role?: string;
  isGuest?: boolean;
  [key: string]: unknown;
};

export type AuthenticatedUser = JwtUserPayload & {
  user_id?: number;
  level_code?: number;
};
