"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandlingMiddleware = void 0;
const http_status_codes_1 = require("http-status-codes");
const respone_1 = __importDefault(require("../core/respone"));
const errorHandlingMiddleware = (err, req, res, next) => {
    if (!err.statusCode)
        err.statusCode = http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR;
    const responseError = {
        status: "error",
        message: err.message || http_status_codes_1.StatusCodes[err.statusCode],
        stack: err.stack,
    };
    if (process.env.BUILD_MODE !== "dev")
        delete responseError.stack;
    return respone_1.default.error(res, responseError, err.statusCode);
};
exports.errorHandlingMiddleware = errorHandlingMiddleware;
