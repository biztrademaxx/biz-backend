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
const express_1 = require("express");
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const ctrl = __importStar(require("./integrations.controller"));
const router = (0, express_1.Router)();
router.get("/payments", auth_middleware_1.requireAdmin, ctrl.getPayments);
router.patch("/payments/gateways/:gatewayId", auth_middleware_1.requireAdmin, ctrl.patchPaymentGateway);
router.post("/payments/gateways/:gatewayId/test", auth_middleware_1.requireAdmin, ctrl.testPaymentGateway);
router.get("/communication", auth_middleware_1.requireAdmin, ctrl.getCommunication);
router.patch("/communication/providers/:id", auth_middleware_1.requireAdmin, ctrl.patchCommunicationProvider);
router.post("/communication/providers/:id/test", auth_middleware_1.requireAdmin, ctrl.testCommunicationProvider);
router.get("/travel", auth_middleware_1.requireAdmin, ctrl.getTravel);
router.post("/travel/partners", auth_middleware_1.requireAdmin, ctrl.createTravelPartner);
router.patch("/travel/partners/:partnerId", auth_middleware_1.requireAdmin, ctrl.patchTravelPartner);
router.post("/travel/partners/:partnerId/sync", auth_middleware_1.requireAdmin, ctrl.syncTravelPartner);
/** Legacy paths used by older admin UI (alias) */
router.patch("/travel/:partnerId", auth_middleware_1.requireAdmin, ctrl.patchTravelPartner);
router.post("/travel/:partnerId/sync", auth_middleware_1.requireAdmin, ctrl.syncTravelPartner);
exports.default = router;
