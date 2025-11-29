"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const field_controller_1 = __importDefault(require("../controllers/field.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = express_1.default.Router();
// Field endpoints
router.get("/", field_controller_1.default.list);
router.get("/:fieldCode/availability", field_controller_1.default.availability);
router.get("/:fieldCode/utilities", field_controller_1.default.utilities);
router.get("/:fieldCode", field_controller_1.default.detail);
// Field images endpoints
router.post("/:fieldCode/images", auth_middleware_1.requireAuth, (0, role_middleware_1.requireShopOwner)(), upload_middleware_1.fieldImagesUpload, field_controller_1.default.uploadImages);
// Field stats and rent
router.get("/:fieldCode/stats", field_controller_1.default.getFieldStats);
router.get("/shop/:shopCode/with-rent", field_controller_1.default.listFieldsWithRent);
// Sync rent (fix mismatches from old data)
router.put("/:fieldCode/sync-rent", auth_middleware_1.requireAuth, (0, role_middleware_1.requireAdmin)(), field_controller_1.default.syncFieldRent);
router.put("/sync/all", auth_middleware_1.requireAuth, (0, role_middleware_1.requireAdmin)(), field_controller_1.default.syncAllFieldsRent);
exports.default = router;
