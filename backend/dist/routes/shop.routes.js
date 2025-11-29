"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const shop_controller_1 = __importDefault(require("../controllers/shop.controller"));
const shopField_controller_1 = __importDefault(require("../controllers/shopField.controller"));
const pricing_controller_1 = __importDefault(require("../controllers/pricing.controller"));
const payout_controller_1 = __importDefault(require("../controllers/payout.controller"));
const wallet_controller_1 = __importDefault(require("../controllers/wallet.controller"));
const upload_middleware_1 = require("../middlewares/upload.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const booking_controller_1 = __importDefault(require("../controllers/booking.controller"));
const shopPromotion_controller_1 = __importDefault(require("../controllers/shopPromotion.controller"));
const router = express_1.default.Router();
// Shop info routes
router.post("/requests", shop_controller_1.default.submitRequest);
router.get("/me", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), shop_controller_1.default.current);
router.put("/me", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), shop_controller_1.default.updateMe);
// Field management
router.get("/me/fields", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), shopField_controller_1.default.listForMe);
router.get("/me/fields/:fieldCode", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), shopField_controller_1.default.getForMe);
router.post("/me/fields", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), upload_middleware_1.fieldImagesUpload, shopField_controller_1.default.createForMe);
router.get("/:shopCode/promotions/active", auth_middleware_1.optionalAuth, shopPromotion_controller_1.default.listActive);
router.get("/:shopCode/utilities", shop_controller_1.default.getUtilities);
router.post("/:shopCode/utilities", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), shop_controller_1.default.updateUtilities);
router.get("/:shopCode/fields", shopField_controller_1.default.list);
router.post("/:shopCode/fields", auth_middleware_1.requireAuth, (0, role_middleware_1.requireAdmin)(), upload_middleware_1.fieldImagesUpload, shopField_controller_1.default.create);
router.put("/me/fields/:fieldCode", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), upload_middleware_1.fieldImagesUpload, shopField_controller_1.default.updateForMe);
router.put("/:shopCode/fields/:fieldCode", auth_middleware_1.requireAuth, (0, role_middleware_1.requireAdmin)(), upload_middleware_1.fieldImagesUpload, shopField_controller_1.default.update);
router.delete("/me/fields/:fieldCode", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), shopField_controller_1.default.removeForMe);
// Promotions routes
router.get("/me/promotions", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), shopPromotion_controller_1.default.listForMe);
router.post("/me/promotions", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), shopPromotion_controller_1.default.createForMe);
router.put("/me/promotions/:promotionId", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), shopPromotion_controller_1.default.updateForMe);
router.patch("/me/promotions/:promotionId/status", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), shopPromotion_controller_1.default.updateStatusForMe);
router.delete("/me/promotions/:promotionId", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), shopPromotion_controller_1.default.removeForMe);
// Pricing routes
router.get("/me/fields/:fieldCode/pricing", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), pricing_controller_1.default.listOperatingHours);
router.post("/me/fields/:fieldCode/pricing", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), pricing_controller_1.default.createOperatingHours);
router.put("/me/pricing/:pricingId", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), pricing_controller_1.default.updateOperatingHours);
router.delete("/me/pricing/:pricingId", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), pricing_controller_1.default.deleteOperatingHours);
// Wallet routes
router.get("/me/wallet", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), wallet_controller_1.default.getWallet);
router.get("/me/wallet/transactions", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), wallet_controller_1.default.getWalletTransactions);
// Bank accounts routes
router.get("/me/bank-accounts", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), shop_controller_1.default.getBankAccounts);
// Payout routes
router.post("/me/payout-requests", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), payout_controller_1.default.createPayoutRequest);
router.get("/me/payout-requests", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), payout_controller_1.default.listPayoutRequests);
router.get("/me/payout-requests/:payoutID", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), payout_controller_1.default.getPayoutRequest);
// Booking routes for shop
router.get("/me/bookings", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), booking_controller_1.default.listShopBookings);
exports.default = router;
