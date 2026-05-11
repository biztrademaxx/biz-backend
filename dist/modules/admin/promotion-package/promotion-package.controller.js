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
exports.listHandler = listHandler;
exports.createHandler = createHandler;
exports.patchHandler = patchHandler;
exports.deleteHandler = deleteHandler;
const service = __importStar(require("./promotion-package.service"));
async function listHandler(_req, res) {
    try {
        const packages = await service.listPromotionPackages();
        return res.json({ success: true, packages });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to fetch promotion packages", details: error?.message });
    }
}
async function createHandler(req, res) {
    try {
        const body = req.body ?? {};
        if (!body.name) {
            return res.status(400).json({ success: false, error: "name is required" });
        }
        const item = await service.createPromotionPackage(body);
        return res.status(201).json({ success: true, package: item });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to create promotion package", details: error?.message });
    }
}
async function patchHandler(req, res) {
    try {
        const id = req.params.id;
        const item = await service.updatePromotionPackage(id, req.body ?? {});
        if (!item)
            return res.status(404).json({ success: false, error: "Promotion package not found" });
        return res.json({ success: true, package: item });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to update promotion package", details: error?.message });
    }
}
async function deleteHandler(req, res) {
    try {
        const id = req.params.id;
        const deleted = await service.deletePromotionPackage(id);
        if (!deleted)
            return res.status(404).json({ success: false, error: "Promotion package not found" });
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to delete promotion package", details: error?.message });
    }
}
