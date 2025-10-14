import express from "express";
import fieldController from "../controllers/field.controller";
import { fieldImageUpload } from "../middlewares/upload.middleware";

const router = express.Router();

router.get("/", fieldController.list);
router.get("/:id/availability", fieldController.availability);
router.post("/:id/images", fieldImageUpload, fieldController.uploadImage);
router.get("/:id", fieldController.detail);
router.post("/:id/bookings/confirm", fieldController.confirmBooking);

export default router;
