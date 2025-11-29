"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFrontendBaseUrl = resolveFrontendBaseUrl;
const DEFAULT_FRONTEND_BASE = "https://thuere.site";
function resolveFrontendBaseUrl() {
    const raw = DEFAULT_FRONTEND_BASE;
    return raw.replace(/\/+$/, "");
}
const envUtils = {
    resolveFrontendBaseUrl,
};
exports.default = envUtils;
