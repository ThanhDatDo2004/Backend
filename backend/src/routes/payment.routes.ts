import express from "express";
import paymentController from "../controllers/payment.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

// Customer endpoints
router.post("/bookings/:bookingCode/initiate", requireAuth, paymentController.initiatePayment);
router.get("/bookings/:bookingCode/status", paymentController.getPaymentStatus);
router.get("/result/:bookingCode", paymentController.getPaymentResult);

// Webhook callback from SePay
router.post("/webhook/sepay", paymentController.sepayCallback);

// Manual confirm (for testing)
router.post("/:paymentID/confirm", requireAuth, paymentController.confirmPayment);

export default router;
