import express from "express";
import bookingController from "../controllers/booking.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireAdmin } from "../middlewares/role.middleware";
import { optionalAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.post(
  "/cancellation-requests/respond",
  bookingController.respondCancellationRequest
);

// Customer endpoints
router.get("/", requireAuth, bookingController.listBookings);
router.post("/", optionalAuth, bookingController.createBooking);
router.get("/:bookingCode", requireAuth, bookingController.getBooking);
router.patch("/:bookingCode/cancel", requireAuth, bookingController.cancelBooking);
router.get("/:bookingCode/checkin-code", requireAuth, bookingController.getCheckinCode);
router.post("/:bookingCode/verify-checkin", requireAuth, bookingController.verifyCheckinCode);

// Admin endpoints
router.patch(
  "/:bookingCode/status",
  requireAuth,
  requireAdmin(),
  bookingController.updateBookingStatus
);



export default router;
