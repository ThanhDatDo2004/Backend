import express from "express";
import paymentController from "../controllers/payment.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

// Customer endpoints
router.post("/bookings/:bookingCode/initiate", requireAuth, paymentController.initiatePayment);
router.get("/bookings/:bookingCode/status", paymentController.getPaymentStatus);
router.get("/bookings/:bookingCode/verify", paymentController.verifyPayment);
router.get("/result/:bookingCode", paymentController.getPaymentResult);

// Webhook callback from SePay
router.post("/webhook/sepay", paymentController.sepayCallback);

export default router;
