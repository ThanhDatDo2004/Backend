import express from "express";
import shopController from "../controllers/shop.controller";
import shopFieldController from "../controllers/shopField.controller";
import { fieldImagesUpload } from "../middlewares/upload.middleware";
import { requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/requests", shopController.submitRequest);
router.get("/me", requireAuth, shopController.current);
router.get("/:shopCode/fields", shopFieldController.list);
router.post("/:shopCode/fields", fieldImagesUpload, shopFieldController.create);
router.put("/me/fields/:fieldId", requireAuth, shopFieldController.updateForMe);
router.put(
  "/:shopCode/fields/:fieldId",
  requireAuth,
  shopFieldController.update
);

export default router;
