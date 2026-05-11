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
exports.create = create;
exports.update = update;
exports.remove = remove;
exports.importBulk = importBulk;
exports.sendAccountEmail = sendAccountEmail;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./venues.service"));
const bulk_import_service_1 = require("../bulk-import/bulk-import.service");
async function list(req, res) {
    try {
        const result = await service.listVenues(req.query);
        return (0, admin_response_1.sendList)(res, result.data, result.pagination);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list venues", e?.message);
    }
}
async function getById(req, res) {
    try {
        const item = await service.getVenueById(req.params.id);
        if (!item)
            return (0, admin_response_1.sendError)(res, 404, "Venue not found");
        return (0, admin_response_1.sendOne)(res, item);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get venue", e?.message);
    }
}
async function create(req, res) {
    try {
        const item = await service.createVenue(req.body ?? {});
        return res.status(201).json({ success: true, data: item });
    }
    catch (e) {
        if (e?.message?.includes("already exists"))
            return (0, admin_response_1.sendError)(res, 400, e.message);
        return (0, admin_response_1.sendError)(res, 500, "Failed to create venue", e?.message);
    }
}
async function update(req, res) {
    try {
        const item = await service.updateVenue(req.params.id, req.body ?? {});
        if (!item)
            return (0, admin_response_1.sendError)(res, 404, "Venue not found");
        return (0, admin_response_1.sendOne)(res, item);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update venue", e?.message);
    }
}
async function remove(req, res) {
    try {
        const result = await service.deleteVenue(req.params.id);
        if (!result)
            return (0, admin_response_1.sendError)(res, 404, "Venue not found");
        return (0, admin_response_1.sendOne)(res, result);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to delete venue", e?.message);
    }
}
async function importBulk(req, res) {
    try {
        const auth = req.auth;
        if (!auth || auth.domain !== "ADMIN") {
            return (0, admin_response_1.sendError)(res, 403, "Admin access required");
        }
        const file = req.file;
        if (!file?.buffer) {
            return (0, admin_response_1.sendError)(res, 400, "No file uploaded (use field name: file)");
        }
        const result = await (0, bulk_import_service_1.importVenuesFromFile)({
            buffer: file.buffer,
            adminId: auth.sub,
            adminType: auth.role === "SUB_ADMIN" ? "SUB_ADMIN" : "SUPER_ADMIN",
        });
        return res.status(200).json({
            success: true,
            ...result,
            message: `Imported ${result.successCount} venue(s) with ${result.errorCount} error(s).`,
        });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to import venues", e?.message);
    }
}
async function sendAccountEmail(req, res) {
    try {
        await service.sendVenueAccountEmail({
            venueId: req.body?.venueId,
            venueEmail: req.body?.venueEmail,
        });
        return res.status(200).json({ success: true, message: "Venue manager email sent successfully" });
    }
    catch (e) {
        if (e?.message?.includes("required"))
            return (0, admin_response_1.sendError)(res, 400, e.message);
        if (e?.message?.includes("not found"))
            return (0, admin_response_1.sendError)(res, 404, e.message);
        return (0, admin_response_1.sendError)(res, 500, "Failed to send venue email", e?.message);
    }
}
