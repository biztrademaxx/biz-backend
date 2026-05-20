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
exports.create = create;
exports.update = update;
exports.remove = remove;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./states.service"));
async function list(req, res) {
    try {
        const includeCounts = req.query.includeCounts === "true";
        const countryCode = typeof req.query.countryCode === "string" ? req.query.countryCode : undefined;
        const data = await service.listStates(includeCounts, countryCode);
        return res.json(data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list states", e?.message);
    }
}
async function create(req, res) {
    try {
        const body = req.body ?? {};
        if (!body.name || !body.countryId) {
            return (0, admin_response_1.sendError)(res, 400, "name and countryId are required");
        }
        const item = await service.createState({
            name: body.name,
            countryId: body.countryId,
            isActive: body.isActive,
            isPermitted: body.isPermitted,
        });
        return res.status(201).json(item);
    }
    catch (e) {
        if (e?.code === "P2002")
            return (0, admin_response_1.sendError)(res, 409, "State already exists for this country");
        return (0, admin_response_1.sendError)(res, 500, "Failed to create state", e?.message);
    }
}
async function update(req, res) {
    try {
        const body = req.body ?? {};
        const item = await service.updateState(req.params.id, {
            name: body.name,
            countryId: body.countryId,
            isActive: body.isActive,
            isPermitted: body.isPermitted,
        });
        return res.json(item);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update state", e?.message);
    }
}
async function remove(req, res) {
    try {
        await service.deleteState(req.params.id);
        return res.json({ success: true, deleted: true });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to delete state", e?.message);
    }
}
