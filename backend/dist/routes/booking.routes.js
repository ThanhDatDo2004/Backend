"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const booking_controller_1 = __importDefault(require("../controllers/booking.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const auth_middleware_2 = require("../middlewares/auth.middleware");
const router = express_1.default.Router();
router.post("/cancellation-requests/respond", booking_controller_1.default.respondCancellationRequest);
// Customer endpoints
router.get("/", auth_middleware_1.requireAuth, booking_controller_1.default.listBookings);
router.post("/", auth_middleware_2.optionalAuth, booking_controller_1.default.createBooking);
router.get("/:bookingCode", auth_middleware_1.requireAuth, booking_controller_1.default.getBooking);
router.patch("/:bookingCode/cancel", auth_middleware_1.requireAuth, booking_controller_1.default.cancelBooking);
router.get("/:bookingCode/checkin-code", auth_middleware_1.requireAuth, booking_controller_1.default.getCheckinCode);
router.post("/:bookingCode/verify-checkin", auth_middleware_1.requireAuth, booking_controller_1.default.verifyCheckinCode);
// Admin endpoints
router.patch("/:bookingCode/status", auth_middleware_1.requireAuth, (0, role_middleware_1.requireAdmin)(), booking_controller_1.default.updateBookingStatus);
exports.default = router;
