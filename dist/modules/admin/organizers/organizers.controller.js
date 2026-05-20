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
exports.listOrganizerConnections = listOrganizerConnections;
exports.getOrganizerConnectionsDetail = getOrganizerConnectionsDetail;
exports.listVenueBookings = listVenueBookings;
exports.listOrganizerPromotions = listOrganizerPromotions;
exports.getOrganizerPromotionById = getOrganizerPromotionById;
exports.patchOrganizerPromotion = patchOrganizerPromotion;
exports.importBulk = importBulk;
exports.sendAccountEmail = sendAccountEmail;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./organizers.service"));
const promoAdmin = __importStar(require("../promotions/promotions-admin.service"));
const prisma_1 = __importDefault(require("../../../config/prisma"));
const bulk_import_service_1 = require("../bulk-import/bulk-import.service");
async function list(req, res) {
    try {
        const result = await service.listOrganizers(req.query);
        return (0, admin_response_1.sendList)(res, result.data, result.pagination);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list organizers", e?.message);
    }
}
async function getById(req, res) {
    try {
        const item = await service.getOrganizerById(req.params.id);
        if (!item)
            return (0, admin_response_1.sendError)(res, 404, "Organizer not found");
        return (0, admin_response_1.sendOne)(res, item);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get organizer", e?.message);
    }
}
async function create(req, res) {
    try {
        const item = await service.createOrganizer(req.body ?? {});
        if (req.auth?.domain === "ADMIN") {
            await prisma_1.default.adminLog.create({
                data: {
                    adminId: req.auth.sub,
                    adminType: req.auth.role === "SUB_ADMIN" ? "SUB_ADMIN" : "SUPER_ADMIN",
                    action: "ADMIN_ORGANIZER_CREATED",
                    resource: "ORGANIZER",
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
        return (0, admin_response_1.sendError)(res, 500, "Failed to create organizer", e?.message);
    }
}
async function update(req, res) {
    try {
        const item = await service.updateOrganizer(req.params.id, req.body ?? {});
        if (!item)
            return (0, admin_response_1.sendError)(res, 404, "Organizer not found");
        return (0, admin_response_1.sendOne)(res, item);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update organizer", e?.message);
    }
}
async function remove(req, res) {
    try {
        const result = await service.deleteOrganizer(req.params.id);
        if (!result)
            return (0, admin_response_1.sendError)(res, 404, "Organizer not found");
        return (0, admin_response_1.sendOne)(res, result);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to delete organizer", e?.message);
    }
}
async function listOrganizerConnections(req, res) {
    try {
        const items = await service.listOrganizerConnectionsForAdmin();
        // Frontend expects a plain array
        return res.json(items);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list organizer connections", e?.message);
    }
}
async function getOrganizerConnectionsDetail(req, res) {
    try {
        const detail = await service.getOrganizerConnectionsDetailForAdmin(req.params.id);
        if (!detail)
            return (0, admin_response_1.sendError)(res, 404, "Organizer not found");
        return res.json(detail);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get organizer connections detail", e?.message);
    }
}
async function listVenueBookings(req, res) {
    try {
        const items = await service.listVenueBookingsForAdmin();
        return res.json({ data: items });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list venue bookings", e?.message);
    }
}
async function listOrganizerPromotions(_req, res) {
    try {
        const result = await promoAdmin.listOrganizerPromotionsAdmin();
        return res.json(result);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to fetch promotions", e?.message);
    }
}
async function getOrganizerPromotionById(req, res) {
    try {
        const promotion = await promoAdmin.getOrganizerPromotionAdmin(req.params.id);
        if (!promotion)
            return (0, admin_response_1.sendError)(res, 404, "Promotion not found");
        return res.json({ promotion });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to fetch promotion", e?.message);
    }
}
async function patchOrganizerPromotion(req, res) {
    try {
        const updated = await promoAdmin.patchOrganizerPromotionAdmin(req.params.id, req.body ?? {});
        if (!updated)
            return (0, admin_response_1.sendError)(res, 404, "Promotion not found");
        return res.json({
            success: true,
            promotion: updated,
            message: `Promotion ${updated.status.toLowerCase()} successfully`,
        });
    }
    catch (e) {
        if (e?.message === "INVALID_STATUS")
            return (0, admin_response_1.sendError)(res, 400, "Invalid status value");
        if (e?.message === "REJECTION_REASON_REQUIRED") {
            return (0, admin_response_1.sendError)(res, 400, "Rejection reason is required");
        }
        return (0, admin_response_1.sendError)(res, 500, "Failed to update promotion", e?.message);
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
        const result = await (0, bulk_import_service_1.importOrganizersFromFile)({
            buffer: file.buffer,
            adminId: auth.sub,
            adminType: auth.role === "SUB_ADMIN" ? "SUB_ADMIN" : "SUPER_ADMIN",
        });
        return res.status(200).json({
            success: true,
            ...result,
            message: `Imported ${result.successCount} organizer(s) with ${result.errorCount} error(s).`,
        });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to import organizers", e?.message);
    }
}
async function sendAccountEmail(req, res) {
    try {
        await service.sendOrganizerAccountEmail({
            organizerId: req.body?.organizerId,
            organizerEmail: req.body?.organizerEmail,
        });
        return res.status(200).json({ success: true, message: "Organizer email sent successfully" });
    }
    catch (e) {
        if (e?.message?.includes("required"))
            return (0, admin_response_1.sendError)(res, 400, e.message);
        if (e?.message?.includes("not found"))
            return (0, admin_response_1.sendError)(res, 404, e.message);
        return (0, admin_response_1.sendError)(res, 500, "Failed to send organizer email", e?.message);
    }
}
