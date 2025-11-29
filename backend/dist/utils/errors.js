"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = exports.unauthorized = exports.badRequest = void 0;
const http_status_codes_1 = require("http-status-codes");
const apiErrors_1 = __importDefault(require("./apiErrors"));
const badRequest = (msg = "Bad Request") => new apiErrors_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, msg);
exports.badRequest = badRequest;
const unauthorized = (msg = "Unauthorized") => new apiErrors_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, msg);
exports.unauthorized = unauthorized;
var apiErrors_2 = require("./apiErrors");
Object.defineProperty(exports, "ApiError", { enumerable: true, get: function () { return __importDefault(apiErrors_2).default; } });
