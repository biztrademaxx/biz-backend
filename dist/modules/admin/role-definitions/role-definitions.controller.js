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
const admin_response_1 = require("../../../lib/admin-response");
const prisma_admin_errors_1 = require("../../../lib/prisma-admin-errors");
const service = __importStar(require("./role-definitions.service"));
async function list(req, res) {
    try {
        const result = await service.listRoleDefinitions(req.query);
        return (0, admin_response_1.sendList)(res, result.data, result.pagination);
    }
    catch (e) {
        (0, prisma_admin_errors_1.respondWithAdminError)(res, e, "Failed to list role definitions");
    }
}
async function getById(req, res) {
    try {
        const item = await service.getRoleDefinitionById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, error: "Role not found" });
        }
        return (0, admin_response_1.sendOne)(res, item);
    }
    catch (e) {
        (0, prisma_admin_errors_1.respondWithAdminError)(res, e, "Failed to get role");
    }
}
async function create(req, res) {
    try {
        const item = await service.createRoleDefinition(req.body ?? {});
        return res.status(201).json({ success: true, data: item });
    }
    catch (e) {
        (0, prisma_admin_errors_1.respondWithAdminError)(res, e, "Failed to create role");
    }
}
async function update(req, res) {
    try {
        const item = await service.updateRoleDefinition(req.params.id, req.body ?? {});
        if (!item) {
            return res.status(404).json({ success: false, error: "Role not found" });
        }
        return (0, admin_response_1.sendOne)(res, item);
    }
    catch (e) {
        (0, prisma_admin_errors_1.respondWithAdminError)(res, e, "Failed to update role");
    }
}
async function remove(req, res) {
    try {
        const result = await service.deleteRoleDefinition(req.params.id);
        if (!result) {
            return res.status(404).json({ success: false, error: "Role not found" });
        }
        return (0, admin_response_1.sendOne)(res, result);
    }
    catch (e) {
        (0, prisma_admin_errors_1.respondWithAdminError)(res, e, "Failed to delete role");
    }
}
