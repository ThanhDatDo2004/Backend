import express from "express";
import paymentController from "../controllers/payment.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.post(
  "/bookings/:bookingCode/initiate",
  requireAuth,
  paymentController.initiatePayment
);
router.get(
  "/bookings/:bookingCode/status",
  requireAuth,
  paymentController.getPaymentStatus
);
router.get(
  "/bookings/:bookingCode/verify",
  requireAuth,
  paymentController.verifyPayment
);
router.get(
  "/result/:bookingCode",
  requireAuth,
  paymentController.getPaymentResult
);

router.post("/webhook/sepay", paymentController.sepayCallback);

export default router;
