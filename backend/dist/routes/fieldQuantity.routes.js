"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fieldQuantity_controller_1 = __importDefault(require("../controllers/fieldQuantity.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get("/:fieldCode/available-quantities", fieldQuantity_controller_1.default.getAvailableQuantities);
router.get("/:fieldCode/quantities", fieldQuantity_controller_1.default.getQuantities);
router.get("/:fieldCode/quantities/:quantityId", fieldQuantity_controller_1.default.getQuantityById);
router.put("/:fieldCode/quantities/:quantityNumber/status", auth_middleware_1.requireAuth, fieldQuantity_controller_1.default.updateQuantityStatus);
exports.default = router;
