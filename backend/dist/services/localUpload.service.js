"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeFieldImageLocally = storeFieldImageLocally;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const UPLOADS_ROOT = process.env.FIELD_IMAGE_LOCAL_DIR ||
    path_1.default.resolve(process.cwd(), "uploads", "fields");
function ensureExtension(filename) {
    const ext = path_1.default.extname(filename);
    if (ext)
        return ext;
    return ".jpg";
}
function getPublicBaseUrl() {
    const base = process.env.FIELD_IMAGE_BASE_URL ||
        process.env.APP_BASE_URL ||
        process.env.APP_ORIGIN ||
        "";
    return base.replace(/\/+$/, "");
}
async function storeFieldImageLocally(fieldCode, file) {
    const fieldDir = path_1.default.join(UPLOADS_ROOT, String(fieldCode));
    await fs_1.promises.mkdir(fieldDir, { recursive: true });
    const ext = ensureExtension(file.originalname);
    const name = `${Date.now()}-${(0, crypto_1.randomUUID)()}${ext}`;
    const absolutePath = path_1.default.join(fieldDir, name);
    await fs_1.promises.writeFile(absolutePath, file.buffer);
    const relativePath = path_1.default
        .relative(process.cwd(), absolutePath)
        .replace(/\\/g, "/");
    const baseUrl = getPublicBaseUrl();
    const publicUrl = baseUrl
        ? `${baseUrl}/${relativePath}`
        : `/${relativePath}`;
    return {
        absolutePath,
        relativePath,
        publicUrl,
    };
}
const localUploadService = {
    storeFieldImageLocally,
};
exports.default = localUploadService;
