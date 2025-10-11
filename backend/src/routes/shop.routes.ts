import express from "express";
import shopController from "../controllers/shop.controller";

const router = express.Router();

router.post("/requests", shopController.submitRequest);

export default router;
