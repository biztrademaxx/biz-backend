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
exports.listStates = listStates;
exports.create = create;
exports.update = update;
exports.remove = remove;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./countries.service"));
async function list(req, res) {
    try {
        const includeCounts = req.query.includeCounts === "true";
        const data = await service.listCountries(includeCounts);
        return res.json(data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list countries", e?.message);
    }
}
async function getById(req, res) {
    try {
        const item = await service.getCountryById(req.params.id);
        if (!item)
            return (0, admin_response_1.sendError)(res, 404, "Country not found");
        return res.json(item);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get country", e?.message);
    }
}
async function listStates(req, res) {
    try {
        const countryCode = typeof req.query.countryCode === "string" ? req.query.countryCode : undefined;
        const data = await service.listStateStats(countryCode);
        return res.json(data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list states", e?.message);
    }
}
async function create(req, res) {
    try {
        const body = req.body ?? {};
        const item = await service.createCountry({
            name: body.name,
            code: body.code,
            flag: body.flag,
            flagPublicId: body.flagPublicId,
            currency: body.currency,
            timezone: body.timezone,
            isActive: body.isActive,
            isPermitted: body.isPermitted,
        });
        return res.status(201).json(item);
    }
    catch (e) {
        if (e?.message?.includes("already exists"))
            return (0, admin_response_1.sendError)(res, 409, e.message);
        return (0, admin_response_1.sendError)(res, 500, "Failed to create country", e?.message);
    }
}
async function update(req, res) {
    try {
        const body = req.body ?? {};
        const item = await service.updateCountry(req.params.id, {
            name: body.name,
            code: body.code,
            flag: body.flag,
            flagPublicId: body.flagPublicId,
            currency: body.currency,
            timezone: body.timezone,
            isActive: body.isActive,
            isPermitted: body.isPermitted,
        });
        return res.json(item);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update country", e?.message);
    }
}
async function remove(req, res) {
    try {
        await service.deleteCountry(req.params.id);
        return res.json({ success: true, deleted: true });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to delete country", e?.message);
    }
}
