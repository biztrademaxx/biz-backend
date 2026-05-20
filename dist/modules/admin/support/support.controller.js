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
exports.listTickets = listTickets;
exports.updateTicket = updateTicket;
exports.replyToTicket = replyToTicket;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./support.service"));
function staffDisplayName(req) {
    const a = req.auth;
    if (a.displayName?.trim())
        return a.displayName.trim();
    const parts = [a.firstName, a.lastName].filter(Boolean);
    if (parts.length)
        return parts.join(" ");
    return a.email || "Admin";
}
async function listTickets(req, res) {
    try {
        const result = await service.listTickets(req.query);
        return (0, admin_response_1.sendList)(res, result.data, result.pagination);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list support tickets", e?.message);
    }
}
async function updateTicket(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!id || !status) {
            return (0, admin_response_1.sendError)(res, 400, "Ticket id and status are required");
        }
        await service.updateTicketStatus(id, status);
        return res.json({ success: true });
    }
    catch (e) {
        const msg = e?.message === "Invalid status" ? e.message : "Failed to update ticket";
        const code = e?.message === "Invalid status" ? 400 : 500;
        return (0, admin_response_1.sendError)(res, code, msg, e?.message);
    }
}
async function replyToTicket(req, res) {
    try {
        const { id } = req.params;
        const { content } = req.body;
        if (!id || !content?.trim()) {
            return (0, admin_response_1.sendError)(res, 400, "Ticket id and content are required");
        }
        await service.addStaffReply(id, content, staffDisplayName(req));
        return res.json({ success: true });
    }
    catch (e) {
        const code = e?.message === "Ticket not found" ? 404 : 500;
        return (0, admin_response_1.sendError)(res, code, e?.message || "Failed to reply", e?.message);
    }
}
