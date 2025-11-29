"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const query_1 = __importDefault(require("./query"));
const shopApplication_model_1 = __importDefault(require("../models/shopApplication.model"));
const shopApplicationService = {
    async createRequest(payload) {
        const result = await query_1.default.execTransaction("create_shop_request_inbox", async (connection) => {
            return await shopApplication_model_1.default.createRequest(connection, payload);
        });
        return result;
    },
};
exports.default = shopApplicationService;
