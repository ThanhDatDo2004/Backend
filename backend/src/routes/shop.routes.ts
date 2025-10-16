import express from "express";
import shopController from "../controllers/shop.controller";
import shopFieldController from "../controllers/shopField.controller";
import pricingController from "../controllers/pricing.controller";
import { fieldImagesUpload } from "../middlewares/upload.middleware";
import { requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/requests", shopController.submitRequest);
router.get("/me", requireAuth, shopController.current);
router.put("/me", requireAuth, shopController.updateMe);
router.get("/me/fields", requireAuth, shopFieldController.listForMe);
router.post(
  "/me/fields",
  requireAuth,
  fieldImagesUpload,
  shopFieldController.createForMe
);
router.get("/:shopCode/fields", shopFieldController.list);
router.post("/:shopCode/fields", fieldImagesUpload, shopFieldController.create);
router.put(
  "/me/fields/:fieldCode",
  requireAuth,
  shopFieldController.updateForMe
);
router.put(
  "/:shopCode/fields/:fieldCode",
  requireAuth,
  shopFieldController.update
);

router.delete(
  "/me/fields/:fieldCode",
  requireAuth,
  shopFieldController.removeForMe
);

// Pricing routes for shop owners
router.get(
  "/me/fields/:fieldCode/pricing",
  requireAuth,
  pricingController.listOperatingHours
);
router.post(
  "/me/fields/:fieldCode/pricing",
  requireAuth,
  pricingController.createOperatingHours
);
router.put(
  "/me/pricing/:pricingId",
  requireAuth,
  pricingController.updateOperatingHours
);
router.delete(
  "/me/pricing/:pricingId",
  requireAuth,
  pricingController.deleteOperatingHours
);

export default router;
