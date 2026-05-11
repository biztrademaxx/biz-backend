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
exports.getStats = getStats;
exports.create = create;
exports.update = update;
exports.remove = remove;
exports.listExhibitorFeedback = listExhibitorFeedback;
exports.updateExhibitorFeedback = updateExhibitorFeedback;
exports.listExhibitorAppointments = listExhibitorAppointments;
exports.updateExhibitorAppointmentStatus = updateExhibitorAppointmentStatus;
exports.listExhibitorPromotions = listExhibitorPromotions;
exports.getExhibitorPromotionById = getExhibitorPromotionById;
exports.patchExhibitorPromotion = patchExhibitorPromotion;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./exhibitors.service"));
const appointments_service_1 = require("../../appointments/appointments.service");
const promoAdmin = __importStar(require("../promotions/promotions-admin.service"));
const prisma_1 = __importDefault(require("../../../config/prisma"));
async function list(req, res) {
    try {
        const result = await service.listExhibitors(req.query);
        return (0, admin_response_1.sendList)(res, result.data, result.pagination);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list exhibitors", e?.message);
    }
}
async function getById(req, res) {
    try {
        const item = await service.getExhibitorById(req.params.id);
        if (!item)
            return (0, admin_response_1.sendError)(res, 404, "Exhibitor not found");
        return (0, admin_response_1.sendOne)(res, item);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get exhibitor", e?.message);
    }
}
async function getStats(req, res) {
    try {
        const stats = await service.getExhibitorStats();
        return res.json({ success: true, data: stats });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get exhibitor stats", e?.message);
    }
}
async function create(req, res) {
    try {
        const item = await service.createExhibitor(req.body ?? {});
        if (req.auth?.domain === "ADMIN") {
            await prisma_1.default.adminLog.create({
                data: {
                    adminId: req.auth.sub,
                    adminType: req.auth.role === "SUB_ADMIN" ? "SUB_ADMIN" : "SUPER_ADMIN",
                    action: "ADMIN_EXHIBITOR_CREATED",
                    resource: "EXHIBITOR",
                    resourceId: item?.id ?? null,
                    details: {
                        email: item?.email ?? null,
                        company: item?.company ?? null,
                    },
                },
            });
        }
        return res.status(201).json({ success: true, data: item });
    }
    catch (e) {
        if (e?.message?.includes("already exists"))
            return (0, admin_response_1.sendError)(res, 400, e.message);
        return (0, admin_response_1.sendError)(res, 500, "Failed to create exhibitor", e?.message);
    }
}
async function update(req, res) {
    try {
        const item = await service.updateExhibitor(req.params.id, req.body ?? {});
        if (!item)
            return (0, admin_response_1.sendError)(res, 404, "Exhibitor not found");
        return (0, admin_response_1.sendOne)(res, item);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update exhibitor", e?.message);
    }
}
async function remove(req, res) {
    try {
        const result = await service.deleteExhibitor(req.params.id);
        if (!result)
            return (0, admin_response_1.sendError)(res, 404, "Exhibitor not found");
        return (0, admin_response_1.sendOne)(res, result);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to delete exhibitor", e?.message);
    }
}
async function listExhibitorFeedback(req, res) {
    try {
        const items = await service.listExhibitorFeedbackForAdmin();
        return res.json(items);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list exhibitor feedback", e?.message);
    }
}
async function updateExhibitorFeedback(req, res) {
    try {
        const { id } = req.params;
        const { action } = req.body ?? {};
        if (!id)
            return (0, admin_response_1.sendError)(res, 400, "Review id required");
        // Optional: persist approval state if Review gets isApproved/isPublic later
        return res.json({ success: true, id, action: action ?? "approved" });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update feedback", e?.message);
    }
}
async function listExhibitorAppointments(req, res) {
    try {
        const appointments = await service.listExhibitorAppointmentsForAdmin();
        return res.json({ appointments });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list exhibitor appointments", e?.message);
    }
}
async function updateExhibitorAppointmentStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, cancelReason } = req.body ?? {};
        if (!id)
            return (0, admin_response_1.sendError)(res, 400, "Appointment id required");
        const result = await (0, appointments_service_1.updateEventAppointment)({
            appointmentId: id,
            status,
            cancellationReason: cancelReason,
        });
        return res.json({ success: true, appointment: result.appointment });
    }
    catch (e) {
        if (e?.message?.includes("not found"))
            return (0, admin_response_1.sendError)(res, 404, e.message);
        return (0, admin_response_1.sendError)(res, 500, "Failed to update appointment", e?.message);
    }
}
async function listExhibitorPromotions(_req, res) {
    try {
        const promotions = await promoAdmin.listExhibitorPromotionsAdmin();
        return res.json(promotions);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to fetch exhibitor promotions", e?.message);
    }
}
async function getExhibitorPromotionById(req, res) {
    try {
        const promotion = await promoAdmin.getExhibitorPromotionAdmin(req.params.id);
        if (!promotion)
            return (0, admin_response_1.sendError)(res, 404, "Promotion not found");
        return res.json(promotion);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to fetch promotion", e?.message);
    }
}
async function patchExhibitorPromotion(req, res) {
    try {
        const updated = await promoAdmin.patchExhibitorPromotionAdmin(req.params.id, req.body ?? {});
        if (!updated)
            return (0, admin_response_1.sendError)(res, 404, "Promotion not found");
        return res.json(updated);
    }
    catch (e) {
        if (e?.message === "INVALID_STATUS")
            return (0, admin_response_1.sendError)(res, 400, "Invalid status");
        if (e?.message === "REJECTION_REASON_REQUIRED") {
            return (0, admin_response_1.sendError)(res, 400, "Rejection reason is required");
        }
        return (0, admin_response_1.sendError)(res, 500, "Failed to update promotion", e?.message);
    }
}
