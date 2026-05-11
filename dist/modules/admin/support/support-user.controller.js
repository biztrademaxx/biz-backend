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
exports.createTicket = createTicket;
exports.listMyTickets = listMyTickets;
exports.addReply = addReply;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./support.service"));
async function createTicket(req, res) {
    try {
        const userId = req.auth.sub;
        const body = req.body;
        const ticket = await service.createTicketForUser(userId, {
            title: typeof body.title === "string" ? body.title : "",
            description: typeof body.description === "string" ? body.description : "",
            category: typeof body.category === "string" ? body.category : undefined,
            priority: typeof body.priority === "string" ? body.priority : undefined,
        });
        return (0, admin_response_1.sendOne)(res, ticket);
    }
    catch (e) {
        const msg = e?.message || "Failed to create ticket";
        const code = msg === "User not found" ? 404 : msg.includes("required") ? 400 : 500;
        return (0, admin_response_1.sendError)(res, code, msg, e?.message);
    }
}
async function listMyTickets(req, res) {
    try {
        const userId = req.auth.sub;
        const data = await service.listTicketsForUser(userId);
        return res.json({ success: true, data });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to load tickets", e?.message);
    }
}
async function addReply(req, res) {
    try {
        const userId = req.auth.sub;
        const { id } = req.params;
        const { content } = req.body;
        if (!id)
            return (0, admin_response_1.sendError)(res, 400, "Ticket id is required");
        await service.addUserReply(userId, id, content ?? "");
        return res.json({ success: true });
    }
    catch (e) {
        const msg = e?.message || "Failed to send reply";
        const code = msg === "Ticket not found" ? 404 : msg.includes("required") ? 400 : 500;
        return (0, admin_response_1.sendError)(res, code, msg, e?.message);
    }
}
