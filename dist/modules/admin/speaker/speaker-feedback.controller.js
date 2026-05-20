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
exports.updateById = updateById;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./speaker-feedback.service"));
async function list(req, res) {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
        const result = await service.listSpeakerFeedbackForAdmin(page, limit);
        return res.json(result);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list speaker feedback", e?.message);
    }
}
async function updateById(req, res) {
    try {
        const body = (req.body ?? {});
        const item = await service.updateSpeakerFeedbackById(req.params.id, body);
        if (!item)
            return (0, admin_response_1.sendError)(res, 404, "Feedback not found");
        return res.json({ success: true, data: item });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update feedback", e?.message);
    }
}
