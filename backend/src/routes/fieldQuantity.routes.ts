import { Router } from "express";
import fieldQuantityController from "../controllers/fieldQuantity.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get(
  "/:fieldCode/available-quantities",
  fieldQuantityController.getAvailableQuantities
);

router.get("/:fieldCode/quantities", fieldQuantityController.getQuantities);

router.get(
  "/:fieldCode/quantities/:quantityId",
  fieldQuantityController.getQuantityById
);

router.put(
  "/:fieldCode/quantities/:quantityNumber/status",
  requireAuth,
  fieldQuantityController.updateQuantityStatus
);

export default router;
