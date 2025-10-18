import express from "express";
import bookingController from "../controllers/booking.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

// Customer endpoints
router.get("/", requireAuth, bookingController.listBookings);
router.post("/create", requireAuth, bookingController.createBooking);
router.get("/:bookingCode", bookingController.getBooking);
router.patch("/:bookingCode/cancel", requireAuth, bookingController.cancelBooking);
router.get("/:bookingCode/checkin-code", bookingController.getCheckinCode);
router.post("/:bookingCode/verify-checkin", bookingController.verifyCheckinCode);

// Admin endpoints
router.patch("/:bookingCode/status", requireAuth, bookingController.updateBookingStatus);

export default router;
