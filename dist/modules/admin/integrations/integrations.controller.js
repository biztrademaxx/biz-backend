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
exports.getPayments = getPayments;
exports.patchPaymentGateway = patchPaymentGateway;
exports.testPaymentGateway = testPaymentGateway;
exports.getCommunication = getCommunication;
exports.patchCommunicationProvider = patchCommunicationProvider;
exports.testCommunicationProvider = testCommunicationProvider;
exports.getTravel = getTravel;
exports.patchTravelPartner = patchTravelPartner;
exports.syncTravelPartner = syncTravelPartner;
exports.createTravelPartner = createTravelPartner;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./integrations.service"));
async function getPayments(req, res) {
    try {
        const data = await service.getPayments();
        return (0, admin_response_1.sendOne)(res, data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get payment integration", e?.message);
    }
}
async function patchPaymentGateway(req, res) {
    try {
        const updated = await service.patchPaymentGateway(req.params.gatewayId, req.body ?? {});
        if (!updated)
            return (0, admin_response_1.sendError)(res, 404, "Gateway not found");
        return (0, admin_response_1.sendOne)(res, updated);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update gateway", e?.message);
    }
}
async function testPaymentGateway(req, res) {
    try {
        const result = await service.testPaymentGateway(req.params.gatewayId);
        return res.json({
            success: result.ok,
            message: result.message,
        });
    }
    catch (e) {
        return res.status(500).json({ success: false, message: e?.message || "Test failed" });
    }
}
async function getCommunication(req, res) {
    try {
        const data = await service.getCommunication();
        return (0, admin_response_1.sendOne)(res, data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get communication integration", e?.message);
    }
}
async function patchCommunicationProvider(req, res) {
    try {
        const updated = await service.patchCommunicationProvider(req.params.id, req.body ?? {});
        if (!updated)
            return (0, admin_response_1.sendError)(res, 404, "Provider not found");
        return (0, admin_response_1.sendOne)(res, updated);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update provider", e?.message);
    }
}
async function testCommunicationProvider(req, res) {
    try {
        const result = await service.testCommunicationProvider(req.params.id, req.body ?? {});
        return res.json({
            success: result.ok,
            message: result.message,
        });
    }
    catch (e) {
        return res.status(500).json({ success: false, message: e?.message || "Test failed" });
    }
}
async function getTravel(req, res) {
    try {
        const data = await service.getTravel();
        return (0, admin_response_1.sendOne)(res, data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get travel integration", e?.message);
    }
}
async function patchTravelPartner(req, res) {
    try {
        const updated = await service.patchTravelPartner(req.params.partnerId, req.body ?? {});
        if (!updated)
            return (0, admin_response_1.sendError)(res, 404, "Partner not found");
        return (0, admin_response_1.sendOne)(res, updated);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update partner", e?.message);
    }
}
async function syncTravelPartner(req, res) {
    try {
        const updated = await service.syncTravelPartner(req.params.partnerId);
        if (!updated)
            return (0, admin_response_1.sendError)(res, 404, "Partner not found");
        return (0, admin_response_1.sendOne)(res, updated);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to sync partner", e?.message);
    }
}
async function createTravelPartner(req, res) {
    try {
        const created = await service.createTravelPartner(req.body ?? {});
        return res.status(201).json({ success: true, data: created });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to create partner", e?.message);
    }
}
