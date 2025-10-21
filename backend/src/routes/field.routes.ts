import express from "express";
import fieldController from "../controllers/field.controller";
import bookingController from "../controllers/booking.controller";
import reviewController from "../controllers/review.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { fieldImagesUpload } from "../middlewares/upload.middleware";

const router = express.Router();

// Field endpoints
router.get("/", fieldController.list);
router.get("/:fieldCode/availability", fieldController.availability);
router.get("/:fieldCode/utilities", fieldController.utilities);
router.post("/:fieldCode/bookings/confirm", fieldController.confirmBooking);
router.get("/:fieldCode", fieldController.detail);

// Field images endpoints
router.post(
  "/:fieldCode/images",
  requireAuth,
  fieldImagesUpload,
  fieldController.uploadImages
);

// Field stats and rent
router.get("/:fieldCode/stats", fieldController.getFieldStats);
router.get("/shop/:shopCode/with-rent", fieldController.listFieldsWithRent);

// Sync rent (fix mismatches from old data)
router.put("/:fieldCode/sync-rent", fieldController.syncFieldRent);
router.put("/sync/all", fieldController.syncAllFieldsRent);

// Booking confirm/cancel with rent tracking
router.put("/:bookingCode/confirm", bookingController.confirmBooking);
router.put("/:bookingCode/cancel", bookingController.cancelBookingMethod);

// Booking endpoints
router.get("/bookings", requireAuth, bookingController.listBookings);
router.get("/bookings/:bookingCode", requireAuth, bookingController.getBooking);
router.patch(
  "/bookings/:bookingCode/cancel",
  requireAuth,
  bookingController.cancelBooking
);
router.post(
  "/bookings/:bookingCode/verify-checkin",
  bookingController.verifyCheckinCode
);
router.get(
  "/:bookingCode/checkin-code",
  requireAuth,
  bookingController.getCheckinCode
);

// Review endpoints
router.get("/:fieldCode/reviews", reviewController.listFieldReviews);
router.post("/:fieldCode/reviews", requireAuth, reviewController.createReview);
router.put("/reviews/:reviewCode", requireAuth, reviewController.updateReview);
router.delete(
  "/reviews/:reviewCode",
  requireAuth,
  reviewController.deleteReview
);

export default router;
