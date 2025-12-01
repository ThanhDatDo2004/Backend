"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const payment_controller_1 = __importDefault(require("../controllers/payment.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = express_1.default.Router();
router.post("/bookings/:bookingCode/initiate", auth_middleware_1.requireAuth, payment_controller_1.default.initiatePayment);
router.get("/bookings/:bookingCode/status", auth_middleware_1.requireAuth, payment_controller_1.default.getPaymentStatus);
router.get("/bookings/:bookingCode/verify", auth_middleware_1.requireAuth, payment_controller_1.default.verifyPayment);
router.get("/result/:bookingCode", auth_middleware_1.requireAuth, payment_controller_1.default.getPaymentResult);
router.all("/webhook/sepay", payment_controller_1.default.sepayCallback);
exports.default = router;
