/**
 * PAYMENT CONSTANTS
 */
export const PAYMENT_CONSTANTS = {
  PLATFORM_FEE_PERCENT: 5,
  SHOP_EARNING_PERCENT: 95,
  PAYMENT_METHODS: {
    BANK_TRANSFER: "bank_transfer",
    CARD: "card",
    EWALLET: "ewallet",
    CASH: "cash",
  },
  STATUS: {
    PENDING: "pending",
    PAID: "paid",
    FAILED: "failed",
    REFUNDED: "refunded",
  },
};

/**
 * BOOKING CONSTANTS
 */
export const BOOKING_CONSTANTS = {
  STATUS: {
    PENDING: "pending",
    CONFIRMED: "confirmed",
    CANCELLED: "cancelled",
    COMPLETED: "completed",
  },
  SLOT_STATUS: {
    AVAILABLE: "available",
    HELD: "held",
    BOOKED: "booked",
    MAINTENANCE: "maintenance",
  },
  DEFAULT_HOLD_DURATION_MS: 15 * 60 * 1000, // 15 minutes
};

/**
 * FIELD CONSTANTS
 */
export const FIELD_CONSTANTS = {
  SPORT_TYPE_LABELS: {
    badminton: "cầu lông",
    football: "bóng đá",
    baseball: "bóng chày",
    swimming: "bơi lội",
    tennis: "tennis",
  },
  STATUS: {
    ACTIVE: "active",
    MAINTENANCE: "maintenance",
    INACTIVE: "inactive",
  },
  STATUS_LABELS: {
    active: "trống",
    maintenance: "bảo trì",
    inactive: "đã đặt",
  },
};

/**
 * SHOP CONSTANTS
 */
export const SHOP_CONSTANTS = {
  APPROVAL_STATUS: {
    APPROVED: "Y",
    PENDING: "N",
  },
  APPROVAL_LABELS: {
    Y: "Approved",
    N: "Pending",
  },
};

/**
 * USER ROLES
 */
export const USER_ROLES = {
  ADMIN: "admin",
  SHOP_OWNER: "shop_owner",
  CUSTOMER: "customer",
};

/**
 * PAGINATION DEFAULTS
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  DEFAULT_OFFSET: 0,
  MAX_LIMIT: 100,
};

/**
 * ERROR MESSAGES
 */
export const ERROR_MESSAGES = {
  UNAUTHORIZED: "Unauthorized access",
  FORBIDDEN: "Access forbidden",
  NOT_FOUND: "Resource not found",
  INVALID_REQUEST: "Invalid request",
  DUPLICATE_ENTRY: "Entry already exists",
  DATABASE_ERROR: "Database error",
  VALIDATION_ERROR: "Validation error",
  INSUFFICIENT_BALANCE: "Insufficient balance",
  INVALID_PAYMENT: "Invalid payment",
};

/**
 * SUCCESS MESSAGES
 */
export const SUCCESS_MESSAGES = {
  CREATED: "Resource created successfully",
  UPDATED: "Resource updated successfully",
  DELETED: "Resource deleted successfully",
  PAYMENT_SUCCESS: "Payment processed successfully",
  BOOKING_CONFIRMED: "Booking confirmed successfully",
};

/**
 * REGEX PATTERNS
 */
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\d{9,11}$/,
  DATE: /^\d{4}-\d{2}-\d{2}$/,
  TIME: /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/,
  BANK_ACCOUNT: /^\d{9,18}$/,
};

export default {
  PAYMENT_CONSTANTS,
  BOOKING_CONSTANTS,
  FIELD_CONSTANTS,
  SHOP_CONSTANTS,
  USER_ROLES,
  PAGINATION,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  REGEX_PATTERNS,
};
