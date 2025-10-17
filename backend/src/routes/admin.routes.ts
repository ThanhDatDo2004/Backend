import express from "express";
import adminController from "../controllers/admin.controller";
import paymentController from "../controllers/payment.controller";
import payoutController from "../controllers/payout.controller";
import walletController from "../controllers/wallet.controller";
import reviewController from "../controllers/review.controller";
import bookingController from "../controllers/booking.controller";

const router = express.Router();

// User and shop management
router.get("/shops", adminController.listShops);
router.get("/users", adminController.listUsers);
router.get("/users/levels", adminController.listUserLevels);
router.get("/shop-requests", adminController.listShopRequests);
router.get("/shop-requests/:id", adminController.getShopRequestById);
router.patch("/users/:id/status", adminController.updateUserStatus);
router.patch("/shop-requests/:id/status", adminController.updateShopRequestStatus);

// Wallet management
router.get("/shops/:shopCode/wallet", walletController.adminGetShopWallet);
router.get("/shops/:shopCode/wallet/transactions", walletController.adminGetShopTransactions);

// Payout management
router.get("/payout-requests", payoutController.adminListPayouts);
router.get("/payout-requests/:payoutID", payoutController.adminGetPayout);
router.patch("/payout-requests/:payoutID/approve", payoutController.adminApprovePayout);
router.patch("/payout-requests/:payoutID/reject", payoutController.adminRejectPayout);

// Booking status management
router.patch("/bookings/:bookingCode/status", bookingController.updateBookingStatus);

// Review moderation
router.delete("/reviews/:reviewCode", reviewController.adminDeleteReview);

export default router;
