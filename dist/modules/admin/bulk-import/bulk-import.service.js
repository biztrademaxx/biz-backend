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
exports.importOrganizersFromFile = importOrganizersFromFile;
exports.importVenuesFromFile = importVenuesFromFile;
const XLSX = __importStar(require("xlsx"));
const prisma_1 = __importDefault(require("../../../config/prisma"));
const organizers_service_1 = require("../organizers/organizers.service");
const venues_service_1 = require("../venues/venues.service");
function parseRows(buffer) {
    const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet)
        return [];
    return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
        raw: false,
        defval: "",
    });
}
function str(v) {
    return String(v ?? "").trim();
}
function splitList(v) {
    const raw = str(v);
    if (!raw)
        return [];
    return raw
        .split(/[,|]/g)
        .map((x) => x.trim())
        .filter(Boolean);
}
function asBool(v, defaultValue = true) {
    const raw = str(v).toLowerCase();
    if (!raw)
        return defaultValue;
    if (["true", "1", "yes", "y"].includes(raw))
        return true;
    if (["false", "0", "no", "n"].includes(raw))
        return false;
    return defaultValue;
}
async function importOrganizersFromFile(params) {
    const rows = parseRows(params.buffer);
    const errors = [];
    let successCount = 0;
    for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const rowNo = index + 2;
        try {
            const email = str(row.email);
            if (!email)
                throw new Error("email is required");
            const country = str(row.country);
            const state = str(row.state);
            const city = str(row.city);
            const headquarters = str(row.headquarters) || [city, state, country].filter(Boolean).join(", ");
            const payload = {
                firstName: str(row.firstName) || "Organizer",
                lastName: str(row.lastName),
                email,
                phone: str(row.phone) || undefined,
                company: str(row.company || row.organizationName) || undefined,
                organizationName: str(row.organizationName || row.company) || undefined,
                description: str(row.description) || undefined,
                headquarters: headquarters || undefined,
                founded: str(row.founded) || undefined,
                teamSize: str(row.teamSize) || undefined,
                specialties: splitList(row.specialties),
                businessEmail: str(row.businessEmail) || undefined,
                businessPhone: str(row.businessPhone) || undefined,
                businessAddress: str(row.businessAddress) || undefined,
                taxId: str(row.taxId) || undefined,
                isActive: asBool(row.isActive, true),
            };
            const created = await (0, organizers_service_1.createOrganizer)(payload);
            successCount += 1;
            if (params.adminId && created?.id) {
                await prisma_1.default.adminLog.create({
                    data: {
                        adminId: params.adminId,
                        adminType: params.adminType ?? "SUPER_ADMIN",
                        action: "ADMIN_ORGANIZER_BULK_IMPORTED",
                        resource: "ORGANIZER",
                        resourceId: created.id,
                        details: { email },
                    },
                });
            }
        }
        catch (e) {
            errors.push({ row: rowNo, message: e?.message || "Failed to import organizer" });
        }
    }
    return {
        processed: rows.length,
        successCount,
        errorCount: errors.length,
        errors,
    };
}
async function importVenuesFromFile(params) {
    const rows = parseRows(params.buffer);
    const errors = [];
    let successCount = 0;
    for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const rowNo = index + 2;
        try {
            const email = str(row.email);
            const venueName = str(row.venueName);
            if (!email)
                throw new Error("email is required");
            if (!venueName)
                throw new Error("venueName is required");
            const payload = {
                email,
                firstName: str(row.firstName || row.contactPerson || venueName) || "Venue",
                lastName: str(row.lastName),
                phone: str(row.phone || row.mobile) || undefined,
                venueName,
                venueCity: str(row.venueCity || row.city) || undefined,
                venueState: str(row.venueState || row.state) || undefined,
                venueCountry: str(row.venueCountry || row.country) || undefined,
                venueAddress: str(row.venueAddress || row.address) || undefined,
                maxCapacity: str(row.maxCapacity) ? Number(row.maxCapacity) : undefined,
                isActive: asBool(row.isActive, true),
            };
            const created = await (0, venues_service_1.createVenue)(payload);
            successCount += 1;
            if (params.adminId && created?.id) {
                await prisma_1.default.adminLog.create({
                    data: {
                        adminId: params.adminId,
                        adminType: params.adminType ?? "SUPER_ADMIN",
                        action: "ADMIN_VENUE_BULK_IMPORTED",
                        resource: "VENUE",
                        resourceId: created.id,
                        details: { email, venueName },
                    },
                });
            }
        }
        catch (e) {
            errors.push({ row: rowNo, message: e?.message || "Failed to import venue" });
        }
    }
    return {
        processed: rows.length,
        successCount,
        errorCount: errors.length,
        errors,
    };
}
