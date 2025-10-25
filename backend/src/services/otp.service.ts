
// src/services/otp.service.ts

/**
 * Simple in-memory OTP store for demonstration purposes.
 * In a production environment, this should be replaced with a persistent store like Redis.
 */
const otpStore = new Map<string, { code: string; expiresAt: number }>();
const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes

const otpService = {
  /**
   * Generates a random OTP code.
   * @param len The length of the OTP (default: 6).
   * @returns A string representing the OTP.
   */
  generate(len = 6): string {
    return Math.floor(Math.random() * 10 ** len)
      .toString()
      .padStart(len, "0");
  },

  /**
   * Stores an OTP for a given key (e.g., email).
   * @param key The key to associate the OTP with.
   * @param code The OTP code to store.
   */
  store(key: string, code: string): void {
    // If an old OTP exists for this key, it will be overwritten.
    otpStore.set(key, { code, expiresAt: Date.now() + OTP_TTL_MS });
  },

  /**
   * Verifies an OTP for a given key.
   * @param key The key to verify the OTP for.
   * @param code The OTP code to check.
   * @returns True if the OTP is valid, false otherwise.
   */
  verify(key: string, code: string): boolean {
    const record = otpStore.get(key);

    if (!record) {
      return false; // No OTP requested or it has been cleared.
    }

    // Check for expiration
    if (Date.now() > record.expiresAt) {
      otpStore.delete(key); // Clean up expired OTP
      return false;
    }

    // Check for code match
    if (record.code !== code) {
      return false;
    }

    // OTP is valid, clear it to prevent reuse
    otpStore.delete(key);
    return true;
  },

  /**
   * Clears an OTP for a given key.
   * @param key The key to clear the OTP for.
   */
  clear(key: string): void {
    otpStore.delete(key);
  },
};

export default otpService;
