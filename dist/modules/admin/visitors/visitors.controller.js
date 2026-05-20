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
exports.listVisitorEvents = listVisitorEvents;
exports.listVisitorConnections = listVisitorConnections;
exports.listVisitorAppointments = listVisitorAppointments;
exports.getById = getById;
exports.update = update;
exports.remove = remove;
exports.getVisitorForSuggestion = getVisitorForSuggestion;
exports.getAvailableExhibitors = getAvailableExhibitors;
exports.sendSuggestions = sendSuggestions;
exports.getVisitorSuggestions = getVisitorSuggestions;
exports.getAllCategories = getAllCategories;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./visitors.service"));
const suggestionsSvc = __importStar(require("./visitor-suggestions.service"));
const visitorEventsSvc = __importStar(require("./visitor-events.service"));
const visitorConnectionsSvc = __importStar(require("./visitor-connections.service"));
const visitorAppointmentsSvc = __importStar(require("./visitor-appointments.service"));
async function list(req, res) {
    try {
        const result = await service.listVisitors(req.query);
        return res.status(200).json({ success: true, data: result.data });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return (0, admin_response_1.sendError)(res, 500, "Failed to list visitors", msg);
    }
}
async function listVisitorEvents(req, res) {
    try {
        const data = await visitorEventsSvc.listVisitorEventsForAdmin();
        return res.status(200).json(data);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return (0, admin_response_1.sendError)(res, 500, "Failed to list visitor events", msg);
    }
}
async function listVisitorConnections(req, res) {
    try {
        const data = await visitorConnectionsSvc.listVisitorConnectionsForAdmin(req.query);
        return res.status(200).json(data);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return (0, admin_response_1.sendError)(res, 500, "Failed to list visitor connections", msg);
    }
}
async function listVisitorAppointments(req, res) {
    try {
        const data = await visitorAppointmentsSvc.listVisitorAppointmentsForAdmin();
        return res.status(200).json(data);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return (0, admin_response_1.sendError)(res, 500, "Failed to list visitor appointments", msg);
    }
}
async function getById(req, res) {
    try {
        const item = await service.getVisitorById(req.params.id);
        if (!item)
            return (0, admin_response_1.sendError)(res, 404, "Visitor not found");
        return (0, admin_response_1.sendOne)(res, item);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return (0, admin_response_1.sendError)(res, 500, "Failed to get visitor", msg);
    }
}
// Add these two functions
async function update(req, res) {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        const updated = await service.updateVisitor(id, { isActive });
        if (!updated)
            return (0, admin_response_1.sendError)(res, 404, "Visitor not found");
        return res.json({ success: true, data: updated });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return (0, admin_response_1.sendError)(res, 500, "Failed to update visitor", msg);
    }
}
async function remove(req, res) {
    try {
        const { id } = req.params;
        const deleted = await service.deleteVisitor(id);
        if (!deleted)
            return (0, admin_response_1.sendError)(res, 404, "Visitor not found");
        return res.json({ success: true });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return (0, admin_response_1.sendError)(res, 500, "Failed to delete visitor", msg);
    }
}
async function getVisitorForSuggestion(req, res) {
    try {
        const visitorId = req.params.id;
        console.log("Getting visitor for suggestion:", visitorId);
        const result = await suggestionsSvc.getVisitorForSuggestion(visitorId);
        return res.json({ success: true, data: result });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error("Error in getVisitorForSuggestion:", e);
        return (0, admin_response_1.sendError)(res, 500, "Failed to get visitor data", msg);
    }
}
async function getAvailableExhibitors(req, res) {
    try {
        const visitorId = req.params.id;
        const { limit, search, category } = req.query;
        console.log("Getting available exhibitors for visitor:", visitorId, { limit, search, category });
        const result = await suggestionsSvc.getAvailableExhibitorsForSuggestion(visitorId, {
            limit: limit ? parseInt(limit, 10) : 20,
            search: search,
            category: category,
        });
        return res.json({ success: true, data: result });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error("Error in getAvailableExhibitors:", e);
        return (0, admin_response_1.sendError)(res, 500, "Failed to get available exhibitors", msg);
    }
}
async function sendSuggestions(req, res) {
    try {
        const visitorId = req.params.id;
        const { exhibitorIds, note } = req.body;
        if (!exhibitorIds || !Array.isArray(exhibitorIds) || exhibitorIds.length === 0) {
            return (0, admin_response_1.sendError)(res, 400, "At least one exhibitor ID is required");
        }
        const result = await suggestionsSvc.sendSuggestionsToVisitor(visitorId, exhibitorIds, note);
        return res.json({
            success: true,
            message: `Successfully sent ${result.count} suggestions to visitor`,
            data: result,
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error("Error in sendSuggestions:", e);
        return (0, admin_response_1.sendError)(res, 500, "Failed to send suggestions", msg);
    }
}
async function getVisitorSuggestions(req, res) {
    try {
        const visitorId = req.params.id;
        const result = await suggestionsSvc.getVisitorSuggestions(visitorId);
        return res.json({ success: true, data: result });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error("Error in getVisitorSuggestions:", e);
        return (0, admin_response_1.sendError)(res, 500, "Failed to get visitor suggestions", msg);
    }
}
async function getAllCategories(req, res) {
    try {
        const result = await suggestionsSvc.getAllCategories();
        return res.json({ success: true, data: result });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error("Error in getAllCategories:", e);
        return (0, admin_response_1.sendError)(res, 500, "Failed to get categories", msg);
    }
}
