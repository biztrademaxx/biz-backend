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
const venues_service_1 = require("../venues/venues.service");
function normKey(v) {
    return str(v).toLowerCase().replace(/\s+/g, " ").trim();
}
function buildOrganizerNameKey(input) {
    const org = normKey(input.organizationName);
    if (org)
        return `org:${org}`;
    const full = [normKey(input.firstName), normKey(input.lastName)].filter(Boolean).join(" ").trim();
    if (full)
        return `person:${full}`;
    return "";
}
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
/** First non-empty match by exact key, then case-insensitive key match (Excel headers vary). */
function pickCell(row, ...keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
            const v = str(row[key]);
            if (v)
                return v;
        }
    }
    const norm = (s) => s.replace(/^\uFEFF/, "").toLowerCase().replace(/\s+/g, " ").trim();
    const rowNorm = new Map();
    for (const k of Object.keys(row)) {
        rowNorm.set(norm(k), row[k]);
    }
    for (const key of keys) {
        const v = str(rowNorm.get(norm(key)));
        if (v)
            return v;
    }
    return "";
}
async function importOrganizersFromFile(params) {
    const rows = parseRows(params.buffer);
    const errors = [];
    let successCount = 0;
    const prepared = [];
    const seenEmails = new Set();
    const seenNameKeys = new Set();
    const rowByEmail = new Map();
    const rowByNameKey = new Map();
    for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const rowNo = index + 2;
        try {
            const email = pickCell(row, "email", "Email").toLowerCase();
            if (!email)
                throw new Error("email is required");
            if (seenEmails.has(email)) {
                errors.push({ row: rowNo, message: `Duplicate email in file: ${email}` });
                continue;
            }
            seenEmails.add(email);
            rowByEmail.set(email, rowNo);
            const organizationName = pickCell(row, "Organization Name", "organizationName", "company", "Company");
            const country = pickCell(row, "country", "Country");
            const state = pickCell(row, "state", "State");
            const city = pickCell(row, "city", "City");
            const headquarters = pickCell(row, "company headquarters address", "Company Headquarters Address", "headquarters", "Headquarters");
            const website = pickCell(row, "website", "Website");
            const phone = pickCell(row, "phone number", "Phone Number", "phone", "Phone");
            const firstName = pickCell(row, "firstName", "First Name") || "Organizer";
            const lastName = pickCell(row, "lastName", "Last Name") || "";
            const nameKey = buildOrganizerNameKey({ organizationName, firstName, lastName });
            if (!nameKey)
                throw new Error("organizer name is required (Organization Name or First/Last Name)");
            if (seenNameKeys.has(nameKey)) {
                errors.push({ row: rowNo, message: `Duplicate organizer name in file: ${organizationName || `${firstName} ${lastName}`.trim()}` });
                continue;
            }
            seenNameKeys.add(nameKey);
            rowByNameKey.set(nameKey, rowNo);
            const locationLine = [city, state, country].filter(Boolean).join(", ");
            prepared.push({
                email,
                role: "ORGANIZER",
                firstName,
                lastName,
                phone: phone || null,
                website: website || null,
                company: organizationName || null,
                organizationName: organizationName || null,
                __nameKey: nameKey,
                description: str(row.description) || null,
                headquarters: headquarters || null,
                organizerCity: city || null,
                organizerState: state || null,
                organizerCountry: country || null,
                location: locationLine || null,
                founded: str(row.founded) || null,
                teamSize: str(row.teamSize) || null,
                specialties: splitList(row.specialties),
                businessEmail: str(row.businessEmail) || null,
                businessPhone: str(row.businessPhone) || null,
                businessAddress: str(row.businessAddress) || null,
                taxId: str(row.taxId) || null,
                isActive: asBool(row.isActive, true),
                isVerified: asBool(row.isVerified, false),
            });
        }
        catch (e) {
            errors.push({ row: rowNo, message: e?.message || "Failed to import organizer" });
        }
    }
    if (prepared.length > 0) {
        const candidateEmails = prepared.map((item) => String(item.email));
        const candidateOrgNames = prepared
            .map((item) => str(item.organizationName))
            .filter(Boolean);
        const candidateFirstNames = prepared.map((item) => str(item.firstName)).filter(Boolean);
        const candidateLastNames = prepared.map((item) => str(item.lastName)).filter(Boolean);
        const existingUsers = await prisma_1.default.user.findMany({
            where: {
                role: "ORGANIZER",
                OR: [
                    { email: { in: candidateEmails } },
                    { organizationName: { in: candidateOrgNames } },
                    { AND: [{ firstName: { in: candidateFirstNames } }, { lastName: { in: candidateLastNames } }] },
                ],
            },
            select: { email: true, organizationName: true, firstName: true, lastName: true },
        });
        const existingSet = new Set(existingUsers.map((u) => String(u.email).toLowerCase()));
        const existingNameSet = new Set(existingUsers
            .map((u) => buildOrganizerNameKey({
            organizationName: u.organizationName,
            firstName: u.firstName,
            lastName: u.lastName,
        }))
            .filter(Boolean));
        const toCreate = [];
        for (const item of prepared) {
            const email = String(item.email).toLowerCase();
            const nameKey = String(item.__nameKey ?? "");
            if (existingSet.has(email)) {
                errors.push({
                    row: rowByEmail.get(email) ?? 0,
                    message: `Organizer with this email already exists: ${email}`,
                });
            }
            else if (nameKey && existingNameSet.has(nameKey)) {
                errors.push({
                    row: rowByNameKey.get(nameKey) ?? 0,
                    message: `Organizer with this name already exists`,
                });
            }
            else {
                delete item.__nameKey;
                toCreate.push(item);
            }
        }
        const CHUNK_SIZE = 200;
        for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
            const chunk = toCreate.slice(i, i + CHUNK_SIZE);
            const created = await prisma_1.default.user.createMany({
                data: chunk,
                skipDuplicates: true,
            });
            successCount += created.count;
        }
    }
    if (params.adminId) {
        await prisma_1.default.adminLog.create({
            data: {
                adminId: params.adminId,
                adminType: params.adminType ?? "SUPER_ADMIN",
                action: "ADMIN_ORGANIZER_BULK_IMPORTED",
                resource: "ORGANIZER",
                details: {
                    processed: rows.length,
                    successCount,
                    errorCount: errors.length,
                },
            },
        });
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
    const seenVenueNames = new Set();
    for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const rowNo = index + 2;
        try {
            const email = pickCell(row, "email", "Email");
            const venueName = pickCell(row, "venueName", "Venue Name", "name");
            if (!email)
                throw new Error("email is required");
            if (!venueName)
                throw new Error("venueName is required");
            const venueNorm = (0, venues_service_1.normalizeVenueName)(venueName);
            if (seenVenueNames.has(venueNorm)) {
                throw new Error(`Duplicate venue name in file: "${venueName}"`);
            }
            seenVenueNames.add(venueNorm);
            const payload = {
                email,
                firstName: str(row.firstName || row.contactPerson || venueName) || "Venue",
                lastName: str(row.lastName),
                phone: str(row.phone || row.mobile) || undefined,
                avatar: str(row.venueImage || row.logo || row.avatar) || undefined,
                venueImages: [
                    str(row.venueImage || row.logo || row.avatar),
                    ...splitList(row.venueImages),
                ].filter(Boolean),
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
