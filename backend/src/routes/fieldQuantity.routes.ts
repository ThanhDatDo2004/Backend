import { Router } from "express";
import fieldQuantityController from "../controllers/fieldQuantity.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

/**
 * GET /api/fields/:fieldCode/available-quantities
 * Get available quantities for a specific time slot
 * Query: playDate, startTime, endTime
 */
router.get(
  "/:fieldCode/available-quantities",
  fieldQuantityController.getAvailableQuantities
);

/**
 * GET /api/fields/:fieldCode/quantities
 * Get all quantities for a field
 */
router.get("/:fieldCode/quantities", fieldQuantityController.getQuantities);

/**
 * GET /api/fields/:fieldCode/quantities/:quantityId
 * Get single quantity details
 */
router.get(
  "/:fieldCode/quantities/:quantityId",
  fieldQuantityController.getQuantityById
);

/**
 * PUT /api/fields/:fieldCode/quantities/:quantityNumber/status
 * Update quantity status (maintenance, inactive, available)
 * Protected: Owner only
 */
router.put(
  "/:fieldCode/quantities/:quantityNumber/status",
  requireAuth,
  fieldQuantityController.updateQuantityStatus
);

export default router;
