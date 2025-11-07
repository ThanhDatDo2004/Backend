/**
 * @typedef {Object} JwtUserPayload
 * @property {number} [UserID]
 * @property {number} [LevelCode]
 * @property {string|null} [FullName]
 * @property {string|null} [Email]
 * @property {string|null} [PhoneNumber]
 * @property {number} [isActive]
 * @property {string} [role]
 * @property {boolean} [isGuest]
 * @property {Record<string, unknown>} [extras]
 */

/**
 * @typedef {JwtUserPayload & { user_id?: number; level_code?: number }} AuthenticatedUser
 */

export {};
