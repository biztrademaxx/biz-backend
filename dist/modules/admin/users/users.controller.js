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
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.getById = getById;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./users.service"));
async function list(req, res) {
    try {
        const result = await service.listUsers(req.query);
        return (0, admin_response_1.sendList)(res, result.data, result.pagination);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list users", e?.message);
    }
}
async function getById(req, res) {
    try {
        const item = await service.getUserById(req.params.id);
        if (!item)
            return (0, admin_response_1.sendError)(res, 404, "User not found");
        return (0, admin_response_1.sendOne)(res, item);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get user", e?.message);
    }
}
