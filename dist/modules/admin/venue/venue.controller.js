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
exports.listVenueEvents = listVenueEvents;
exports.listVenueBookings = listVenueBookings;
exports.updateVenueBooking = updateVenueBooking;
exports.listVenueFeedback = listVenueFeedback;
exports.updateVenueFeedback = updateVenueFeedback;
const admin_response_1 = require("../../../lib/admin-response");
const eventsSvc = __importStar(require("./venue-events.service"));
const bookingsSvc = __importStar(require("./venue-bookings.service"));
const feedbackSvc = __importStar(require("./venue-feedback.service"));
async function listVenueEvents(req, res) {
    try {
        const data = await eventsSvc.listVenueEventsForAdmin();
        return res.json(data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list venue events", e?.message);
    }
}
async function listVenueBookings(req, res) {
    try {
        const result = await bookingsSvc.listVenueBookingsForAdmin();
        return res.json(result);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list venue bookings", e?.message);
    }
}
async function updateVenueBooking(req, res) {
    try {
        const result = await bookingsSvc.updateVenueBookingStatus(req.params.id, req.body ?? {});
        if (!result)
            return (0, admin_response_1.sendError)(res, 404, "Booking not found");
        return res.json({ success: true, ...result });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update booking", e?.message);
    }
}
async function listVenueFeedback(req, res) {
    try {
        const result = await feedbackSvc.listVenueFeedbackForAdmin();
        return res.json(result);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list venue feedback", e?.message);
    }
}
async function updateVenueFeedback(req, res) {
    try {
        const result = await feedbackSvc.updateVenueFeedbackById(req.params.id, req.body ?? {});
        if (!result)
            return (0, admin_response_1.sendError)(res, 404, "Feedback not found");
        return res.json({ success: true, ...result });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update feedback", e?.message);
    }
}
