import express from "express";
import fieldController from "../controllers/field.controller";

const router = express.Router();

router.get("/", fieldController.list);
router.get("/:id/availability", fieldController.availability);
router.get("/:id", fieldController.detail);

export default router;
