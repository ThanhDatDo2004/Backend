import express from "express";
import cartController from "../controllers/cart.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/", requireAuth, cartController.listUserCart);

export default router;
