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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.getById = getById;
exports.create = create;
exports.update = update;
exports.remove = remove;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./speakers.service"));
const prisma_1 = __importDefault(require("../../../config/prisma"));
async function list(req, res) {
    try {
        const result = await service.listSpeakers(req.query);
        return (0, admin_response_1.sendList)(res, result.data, result.pagination);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list speakers", e?.message);
    }
}
async function getById(req, res) {
    try {
        const item = await service.getSpeakerById(req.params.id);
        if (!item)
            return (0, admin_response_1.sendError)(res, 404, "Speaker not found");
        return (0, admin_response_1.sendOne)(res, item);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get speaker", e?.message);
    }
}
async function create(req, res) {
    try {
        const item = await service.createSpeaker(req.body ?? {});
        if (req.auth?.domain === "ADMIN") {
            await prisma_1.default.adminLog.create({
                data: {
                    adminId: req.auth.sub,
                    adminType: req.auth.role === "SUB_ADMIN" ? "SUB_ADMIN" : "SUPER_ADMIN",
                    action: "ADMIN_SPEAKER_CREATED",
                    resource: "SPEAKER",
                    resourceId: item?.id ?? null,
                    details: {
                        email: item?.email ?? null,
                        name: `${item?.firstName ?? ""} ${item?.lastName ?? ""}`.trim(),
                    },
                },
            });
        }
        return res.status(201).json({ success: true, data: item });
    }
    catch (e) {
        if (e?.message?.includes("already exists"))
            return (0, admin_response_1.sendError)(res, 400, e.message);
        return (0, admin_response_1.sendError)(res, 500, "Failed to create speaker", e?.message);
    }
}
async function update(req, res) {
    try {
        const item = await service.updateSpeaker(req.params.id, req.body ?? {});
        if (!item)
            return (0, admin_response_1.sendError)(res, 404, "Speaker not found");
        return (0, admin_response_1.sendOne)(res, item);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update speaker", e?.message);
    }
}
async function remove(req, res) {
    try {
        const result = await service.deleteSpeaker(req.params.id);
        if (!result)
            return (0, admin_response_1.sendError)(res, 404, "Speaker not found");
        return (0, admin_response_1.sendOne)(res, result);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to delete speaker", e?.message);
    }
}
