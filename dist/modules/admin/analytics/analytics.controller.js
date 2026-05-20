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
exports.eventsGrowth = eventsGrowth;
exports.userGrowth = userGrowth;
exports.revenue = revenue;
exports.subAdminActivity = subAdminActivity;
exports.subAdminActivityById = subAdminActivityById;
exports.myActivity = myActivity;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./analytics.service"));
async function eventsGrowth(req, res) {
    try {
        const data = await service.getEventsGrowth();
        return (0, admin_response_1.sendOne)(res, data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get events growth", e?.message);
    }
}
async function userGrowth(req, res) {
    try {
        const data = await service.getUserGrowth();
        return (0, admin_response_1.sendOne)(res, data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get user growth", e?.message);
    }
}
async function revenue(req, res) {
    try {
        const data = await service.getRevenue();
        return (0, admin_response_1.sendOne)(res, data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get revenue", e?.message);
    }
}
async function subAdminActivity(req, res) {
    try {
        const data = await service.getSubAdminActivityAnalytics({});
        return (0, admin_response_1.sendOne)(res, data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get sub-admin activity analytics", e?.message);
    }
}
async function subAdminActivityById(req, res) {
    try {
        const adminId = String(req.params.adminId ?? "").trim();
        if (!adminId)
            return (0, admin_response_1.sendError)(res, 400, "Missing adminId");
        const data = await service.getSubAdminActivityAnalytics({ adminId });
        return (0, admin_response_1.sendOne)(res, data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get sub-admin detail analytics", e?.message);
    }
}
async function myActivity(req, res) {
    try {
        const adminId = req.auth?.sub;
        if (!adminId)
            return (0, admin_response_1.sendError)(res, 401, "Unauthorized");
        const data = await service.getSubAdminActivityAnalytics({ adminId });
        return (0, admin_response_1.sendOne)(res, data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get my activity analytics", e?.message);
    }
}
