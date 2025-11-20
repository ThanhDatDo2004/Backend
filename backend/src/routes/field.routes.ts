import express from "express";
import fieldController from "../controllers/field.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { fieldImagesUpload } from "../middlewares/upload.middleware";
import { requireAdmin, requireShopOwner } from "../middlewares/role.middleware";

const router = express.Router();

// Field endpoints
router.get("/", fieldController.list);
router.get("/:fieldCode/availability", fieldController.availability);
router.get("/:fieldCode/utilities", fieldController.utilities);
router.get("/:fieldCode", fieldController.detail);

// Field images endpoints
router.post(
  "/:fieldCode/images",
  requireAuth,
  requireShopOwner(),
  fieldImagesUpload,
  fieldController.uploadImages
);

// Field stats and rent
router.get("/:fieldCode/stats", fieldController.getFieldStats);
router.get("/shop/:shopCode/with-rent", fieldController.listFieldsWithRent);

// Sync rent (fix mismatches from old data)
router.put(
  "/:fieldCode/sync-rent",
  requireAuth,
  requireAdmin(),
  fieldController.syncFieldRent
);
router.put(
  "/sync/all",
  requireAuth,
  requireAdmin(),
  fieldController.syncAllFieldsRent
);

export default router;
