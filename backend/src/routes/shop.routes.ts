import express from "express";
import shopController from "../controllers/shop.controller";
import shopFieldController from "../controllers/shopField.controller";
import pricingController from "../controllers/pricing.controller";
import paymentController from "../controllers/payment.controller";
import payoutController from "../controllers/payout.controller";
import walletController from "../controllers/wallet.controller";
import { fieldImagesUpload } from "../middlewares/upload.middleware";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware";
import { requireAdmin, requireShopOwner } from "../middlewares/role.middleware";
import bookingController from "../controllers/booking.controller";
import shopPromotionController from "../controllers/shopPromotion.controller";

const router = express.Router();

// Shop info routes
router.post("/requests", shopController.submitRequest);
router.get("/me", requireAuth, requireShopOwner(), shopController.current);
router.put("/me", requireAuth, requireShopOwner(), shopController.updateMe);

// Field management
router.get("/me/fields", requireAuth, requireShopOwner(), shopFieldController.listForMe);
router.get("/me/fields/:fieldCode", requireAuth, requireShopOwner(), shopFieldController.getForMe);
router.post(
  "/me/fields",
  requireAuth,
  requireShopOwner(),
  fieldImagesUpload,
  shopFieldController.createForMe
);
router.get(
  "/:shopCode/promotions/active",
  optionalAuth,
  shopPromotionController.listActive
);
router.get("/:shopCode/utilities", shopController.getUtilities);
router.post(
  "/:shopCode/utilities",
  requireAuth,
  requireShopOwner(),
  shopController.updateUtilities
);
router.get("/:shopCode/fields", shopFieldController.list);
router.post(
  "/:shopCode/fields",
  requireAuth,
  requireShopOwner(),
  fieldImagesUpload,
  shopFieldController.create
);
router.put(
  "/me/fields/:fieldCode",
  requireAuth,
  requireShopOwner(),
  fieldImagesUpload,
  shopFieldController.updateForMe
);
router.put(
  "/:shopCode/fields/:fieldCode",
  requireAuth,
  requireAdmin(),
  fieldImagesUpload,
  shopFieldController.update
);
router.delete(
  "/me/fields/:fieldCode",
  requireAuth,
  requireShopOwner(),
  shopFieldController.removeForMe
);

// Promotions routes
router.get("/me/promotions", requireAuth, requireShopOwner(), shopPromotionController.listForMe);
router.post("/me/promotions", requireAuth, requireShopOwner(), shopPromotionController.createForMe);
router.put(
  "/me/promotions/:promotionId",
  requireAuth,
  requireShopOwner(),
  shopPromotionController.updateForMe
);
router.patch(
  "/me/promotions/:promotionId/status",
  requireAuth,
  requireShopOwner(),
  shopPromotionController.updateStatusForMe
);
router.delete(
  "/me/promotions/:promotionId",
  requireAuth,
  requireShopOwner(),
  shopPromotionController.removeForMe
);

// Pricing routes
router.get(
  "/me/fields/:fieldCode/pricing",
  requireAuth,
  requireShopOwner(),
  pricingController.listOperatingHours
);
router.post(
  "/me/fields/:fieldCode/pricing",
  requireAuth,
  requireShopOwner(),
  pricingController.createOperatingHours
);
router.put(
  "/me/pricing/:pricingId",
  requireAuth,
  requireShopOwner(),
  pricingController.updateOperatingHours
);
router.delete(
  "/me/pricing/:pricingId",
  requireAuth,
  requireShopOwner(),
  pricingController.deleteOperatingHours
);

// Wallet routes
router.get("/me/wallet", requireAuth, requireShopOwner(), walletController.getWallet);
router.get(
  "/me/wallet/transactions",
  requireAuth,
  requireShopOwner(),
  walletController.getWalletTransactions
);

// Bank accounts routes
router.get(
  "/me/bank-accounts",
  requireAuth,
  requireShopOwner(),
  shopController.getBankAccounts
);

// Payout routes
router.post(
  "/me/payout-requests",
  requireAuth,
  requireShopOwner(),
  payoutController.createPayoutRequest
);
router.get(
  "/me/payout-requests",
  requireAuth,
  requireShopOwner(),
  payoutController.listPayoutRequests
);
router.get(
  "/me/payout-requests/:payoutID",
  requireAuth,
  requireShopOwner(),
  payoutController.getPayoutRequest
);

// Booking routes for shop
router.get(
  "/me/bookings",
  requireAuth,
  requireShopOwner(),
  bookingController.listShopBookings
);

export default router;
