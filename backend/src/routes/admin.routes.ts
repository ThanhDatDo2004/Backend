import express from "express";
import adminController from "../controllers/admin.controller";
import payoutController from "../controllers/payout.controller";
import walletController from "../controllers/wallet.controller";
import bookingController from "../controllers/booking.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireAdmin } from "../middlewares/role.middleware";

const router = express.Router();

router.use(requireAuth, requireAdmin());

// User and shop management
router.get("/shops", adminController.listShops);
router.get("/users", adminController.listUsers);
router.get("/users/levels", adminController.listUserLevels);
router.get("/shop-requests", adminController.listShopRequests);
router.get("/shop-requests/:id", adminController.getShopRequestById);
router.get("/finance/bookings", adminController.listFinanceBookings);
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

export default router;
