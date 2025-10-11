import express from "express";
import authController, { register, verifyEmail } from "../controllers/auth.controller";

const router = express.Router();

router.post("/login", authController.login);
router.post("/register", register);

// OTP đăng ký
router.post("/send-code", authController.sendCode);
router.post("/verify-code", authController.verifyCode);

// Kiểm tra email tồn tại (Forgot)
router.post("/check-email", authController.checkEmailExists);

// Forgot / Reset password
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// (tuỳ chọn) verify cũ
router.post("/verify", verifyEmail);

export default router;
