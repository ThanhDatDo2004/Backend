import express from "express";
import notificationController from "../controllers/notification.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

// User notifications
router.get("/", requireAuth, notificationController.listNotifications);
router.patch("/:notificationID/read", requireAuth, notificationController.markAsRead);
router.patch("/read-all", requireAuth, notificationController.markAllAsRead);
router.delete("/:notificationID", requireAuth, notificationController.deleteNotification);

export default router;
