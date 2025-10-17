import express from "express";
import shopController from "../controllers/shop.controller";
import shopFieldController from "../controllers/shopField.controller";
import pricingController from "../controllers/pricing.controller";
import paymentController from "../controllers/payment.controller";
import payoutController from "../controllers/payout.controller";
import walletController from "../controllers/wallet.controller";
import { fieldImagesUpload } from "../middlewares/upload.middleware";
import { requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

// Shop info routes
router.post("/requests", shopController.submitRequest);
router.get("/me", requireAuth, shopController.current);
router.put("/me", requireAuth, shopController.updateMe);

// Field management
router.get("/me/fields", requireAuth, shopFieldController.listForMe);
router.post("/me/fields", requireAuth, fieldImagesUpload, shopFieldController.createForMe);
router.get("/:shopCode/fields", shopFieldController.list);
router.post("/:shopCode/fields", fieldImagesUpload, shopFieldController.create);
router.put("/me/fields/:fieldCode", requireAuth, shopFieldController.updateForMe);
router.put("/:shopCode/fields/:fieldCode", requireAuth, shopFieldController.update);
router.delete("/me/fields/:fieldCode", requireAuth, shopFieldController.removeForMe);

// Pricing routes
router.get("/me/fields/:fieldCode/pricing", requireAuth, pricingController.listOperatingHours);
router.post("/me/fields/:fieldCode/pricing", requireAuth, pricingController.createOperatingHours);
router.put("/me/pricing/:pricingId", requireAuth, pricingController.updateOperatingHours);
router.delete("/me/pricing/:pricingId", requireAuth, pricingController.deleteOperatingHours);

// Wallet routes
router.get("/me/wallet", requireAuth, walletController.getWallet);
router.get("/me/wallet/transactions", requireAuth, walletController.getWalletTransactions);

// Payout routes
router.post("/me/payout-requests", requireAuth, payoutController.createPayoutRequest);
router.get("/me/payout-requests", requireAuth, payoutController.listPayoutRequests);
router.get("/me/payout-requests/:payoutID", requireAuth, payoutController.getPayoutRequest);

export default router;
