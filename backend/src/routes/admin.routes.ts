import express from "express";
import adminController from "../controllers/admin.controller";

const router = express.Router();

router.get("/shops", adminController.listShops);
router.get("/users", adminController.listUsers);
router.get("/users/levels", adminController.listUserLevels);
router.get("/shop-requests", adminController.listShopRequests);
router.get("/shop-requests/:id", adminController.getShopRequestById);
router.patch("/users/:id/status", adminController.updateUserStatus);
router.patch("/shop-requests/:id/status", adminController.updateShopRequestStatus);

export default router;
