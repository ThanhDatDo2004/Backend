"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const admin_controller_1 = __importDefault(require("../controllers/admin.controller"));
const payout_controller_1 = __importDefault(require("../controllers/payout.controller"));
const wallet_controller_1 = __importDefault(require("../controllers/wallet.controller"));
const booking_controller_1 = __importDefault(require("../controllers/booking.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = express_1.default.Router();
router.use(auth_middleware_1.requireAuth, (0, role_middleware_1.requireAdmin)());
// User and shop management
router.get("/shops", admin_controller_1.default.listShops);
router.get("/users", admin_controller_1.default.listUsers);
router.get("/users/levels", admin_controller_1.default.listUserLevels);
router.get("/shop-requests", admin_controller_1.default.listShopRequests);
router.get("/shop-requests/:id", admin_controller_1.default.getShopRequestById);
router.get("/finance/bookings", admin_controller_1.default.listFinanceBookings);
router.patch("/users/:id/status", admin_controller_1.default.updateUserStatus);
router.patch("/shop-requests/:id/status", admin_controller_1.default.updateShopRequestStatus);
// Wallet management
router.get("/shops/:shopCode/wallet", wallet_controller_1.default.adminGetShopWallet);
router.get("/shops/:shopCode/wallet/transactions", wallet_controller_1.default.adminGetShopTransactions);
// Payout management
router.get("/payout-requests", payout_controller_1.default.adminListPayouts);
router.get("/payout-requests/:payoutID", payout_controller_1.default.adminGetPayout);
router.patch("/payout-requests/:payoutID/approve", payout_controller_1.default.adminApprovePayout);
router.patch("/payout-requests/:payoutID/reject", payout_controller_1.default.adminRejectPayout);
// Booking status management
router.patch("/bookings/:bookingCode/status", booking_controller_1.default.updateBookingStatus);
exports.default = router;
