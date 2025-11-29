"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fieldImagesUpload = exports.fieldImageUpload = void 0;
const multer_1 = __importStar(require("multer"));
const http_status_codes_1 = require("http-status-codes");
const apiErrors_1 = __importDefault(require("../utils/apiErrors"));
const IMAGE_SIZE_LIMIT = Number(process.env.FIELD_IMAGE_MAX_SIZE_MB ?? 5) * 1024 * 1024;
const IMAGE_MAX_COUNT = Math.max(1, Number(process.env.FIELD_IMAGE_MAX_COUNT ?? 5));
const storage = multer_1.default.memoryStorage();
const baseFieldImageUpload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: IMAGE_SIZE_LIMIT,
        files: IMAGE_MAX_COUNT,
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype && file.mimetype.startsWith("image/")) {
            cb(null, true);
            return;
        }
        const error = new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Chỉ chấp nhận tập tin hình ảnh");
        cb(error);
    },
});
function normalizeUploadError(err) {
    if (!err)
        return null;
    if (err instanceof apiErrors_1.default) {
        return err;
    }
    if (err instanceof multer_1.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Dung lượng ảnh vượt quá ${Math.round(IMAGE_SIZE_LIMIT / (1024 * 1024))}MB`);
        }
        if (err.code === "LIMIT_FILE_COUNT") {
            return new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Chỉ được tải tối đa ${IMAGE_MAX_COUNT} ảnh mỗi lần`);
        }
        return new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, err.message || "Upload thất bại");
    }
    return new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, err?.message || "Không thể tải lên hình ảnh");
}
function createUploadHandler(fieldName, maxCount = 1) {
    return (req, res, next) => {
        const handler = maxCount > 1
            ? baseFieldImageUpload.array(fieldName, maxCount)
            : baseFieldImageUpload.single(fieldName);
        handler(req, res, (err) => {
            const normalized = normalizeUploadError(err);
            if (normalized) {
                return next(normalized);
            }
            return next();
        });
    };
}
exports.fieldImageUpload = createUploadHandler("image", 1);
exports.fieldImagesUpload = createUploadHandler("images", IMAGE_MAX_COUNT);
const uploadMiddleware = {
    fieldImageUpload: exports.fieldImageUpload,
    fieldImagesUpload: exports.fieldImagesUpload,
};
exports.default = uploadMiddleware;
