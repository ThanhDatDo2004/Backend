"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apiResponse = {
    success: (res, data, message = "Success", statusCode = 200) => {
        return res.status(statusCode).json({
            success: true,
            statusCode,
            message,
            data,
            error: null,
        });
    },
    error: (res, error, statusCode = 500) => {
        return res.status(statusCode).json({
            success: false,
            statusCode,
            data: null,
            error,
        });
    },
};
exports.default = apiResponse;
// 200	OK
// 201	Created (POST)
// 204	No Content (DELETE)
// 400	Bad Request
// 401	Unauthorized	(MISSING TOKEN)
// 403	Forbidden
// 404	Not Found
// 409	Conflict
// 500	Internal
