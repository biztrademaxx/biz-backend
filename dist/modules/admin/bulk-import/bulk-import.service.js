"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importOrganizersFromFile = importOrganizersFromFile;
exports.importVenuesFromFile = importVenuesFromFile;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const event_import_service_1 = require("../event-import/event-import.service");
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
/** On re-import: only overwrite fields when the spreadsheet cell had a value. */
function buildOrganizerUpdateData(existing, payload) {
    const city = payload.organizerCity ?? existing.organizerCity;
    const state = payload.organizerState ?? existing.organizerState;
    const country = payload.organizerCountry ?? existing.organizerCountry;
    const locationLine = [city, state, country].filter(Boolean).join(", ");
    return {
        firstName: payload.firstName || existing.firstName,
        lastName: payload.lastName || existing.lastName,
        phone: payload.phone ?? existing.phone,
        website: payload.website ?? existing.website,
        company: payload.company ?? existing.company,
        organizationName: payload.organizationName ?? existing.organizationName,
        headquarters: payload.headquarters ?? existing.headquarters,
        organizerCity: city,
        organizerState: state,
        organizerCountry: country,
        location: locationLine || null,
    };
}
function toOrganizerCreateData(payload) {
    return {
        email: payload.email,
        role: "ORGANIZER",
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone,
        website: payload.website,
        company: payload.company,
        organizationName: payload.organizationName,
        description: payload.description,
        headquarters: payload.headquarters,
        organizerCity: payload.organizerCity,
        organizerState: payload.organizerState,
        organizerCountry: payload.organizerCountry,
        location: payload.location,
        founded: payload.founded,
        teamSize: payload.teamSize,
        specialties: payload.specialties,
        businessEmail: payload.businessEmail,
        businessPhone: payload.businessPhone,
        businessAddress: payload.businessAddress,
        taxId: payload.taxId,
        isActive: payload.isActive,
        isVerified: payload.isVerified,
    };
}
async function importOrganizersFromFile(params) {
    const rows = (0, event_import_service_1.parseWorkbookToRows)(params.buffer, "organizers-import");
    const errors = [];
    let createdCount = 0;
    let updatedCount = 0;
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
            const organizationName = pickCell(row, "Organization Name", "organization name", "organizationName", "Organization", "company", "Company");
            const country = pickCell(row, "country", "Country", "organizer country", "organizerCountry", "Organizer Country");
            const state = pickCell(row, "state", "State", "organizer state", "organizerState", "Organizer State", "province", "Province");
            const city = pickCell(row, "city", "City", "organizer city", "organizerCity", "Organizer City");
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
            const item = {
                email,
                firstName,
                lastName,
                phone: phone || null,
                website: website || null,
                company: organizationName || null,
                organizationName: organizationName || null,
                __nameKey: nameKey,
                description: str(row.description) || null,
                headquarters: headquarters || null,
                organizerCity: city ? city : null,
                organizerState: state ? state : null,
                organizerCountry: country ? country : null,
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
            };
            prepared.push(item);
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
            select: {
                id: true,
                email: true,
                organizationName: true,
                firstName: true,
                lastName: true,
                organizerCity: true,
                organizerState: true,
                organizerCountry: true,
                headquarters: true,
                phone: true,
                website: true,
                company: true,
                location: true,
            },
        });
        const existingByEmail = new Map();
        for (const u of existingUsers) {
            const em = String(u.email ?? "").toLowerCase();
            if (em)
                existingByEmail.set(em, u);
        }
        const existingNameToEmail = new Map();
        for (const u of existingUsers) {
            const nk = buildOrganizerNameKey({
                organizationName: u.organizationName,
                firstName: u.firstName,
                lastName: u.lastName,
            });
            const em = String(u.email ?? "").toLowerCase();
            if (nk && em)
                existingNameToEmail.set(nk, em);
        }
        const toCreate = [];
        for (const item of prepared) {
            const email = item.email.toLowerCase();
            const nameKey = item.__nameKey;
            const rowNo = rowByEmail.get(email) ?? 0;
            const existingByMail = existingByEmail.get(email);
            if (existingByMail) {
                try {
                    const { __nameKey: _nk, ...payload } = item;
                    await prisma_1.default.user.update({
                        where: { id: existingByMail.id },
                        data: buildOrganizerUpdateData(existingByMail, payload),
                    });
                    updatedCount += 1;
                }
                catch (e) {
                    errors.push({
                        row: rowNo,
                        message: e?.message || "Failed to update existing organizer",
                    });
                }
                continue;
            }
            const conflictingEmail = nameKey ? existingNameToEmail.get(nameKey) : undefined;
            if (nameKey && conflictingEmail && conflictingEmail !== email) {
                errors.push({
                    row: rowByNameKey.get(nameKey) ?? rowNo,
                    message: `Organizer name already used by another account (${conflictingEmail})`,
                });
                continue;
            }
            const { __nameKey: _nk, ...payload } = item;
            toCreate.push(payload);
        }
        for (const payload of toCreate) {
            const email = payload.email.toLowerCase();
            const rowNo = rowByEmail.get(email) ?? 0;
            try {
                await prisma_1.default.user.create({ data: toOrganizerCreateData(payload) });
                createdCount += 1;
            }
            catch (e) {
                errors.push({
                    row: rowNo,
                    message: e?.message || "Failed to create organizer",
                });
            }
        }
    }
    const successCount = createdCount + updatedCount;
    if (params.adminId) {
        const adminType = params.adminType ?? "SUPER_ADMIN";
        const importDetails = {
            processed: rows.length,
            successCount,
            createdCount,
            updatedCount,
            errorCount: errors.length,
        };
        await prisma_1.default.adminLog.create({
            data: {
                adminId: params.adminId,
                adminType,
                action: "ADMIN_ORGANIZER_BULK_IMPORTED",
                resource: "ORGANIZER",
                details: importDetails,
            },
        });
        if (updatedCount > 0) {
            await prisma_1.default.adminLog.create({
                data: {
                    adminId: params.adminId,
                    adminType,
                    action: "ADMIN_ORGANIZER_BULK_UPDATED",
                    resource: "ORGANIZER",
                    details: {
                        processed: rows.length,
                        updatedCount,
                        createdCount,
                        errorCount: errors.length,
                    },
                },
            });
        }
    }
    return {
        processed: rows.length,
        successCount,
        createdCount,
        updatedCount,
        errorCount: errors.length,
        errors,
    };
}
async function importVenuesFromFile(params) {
    const rows = (0, event_import_service_1.parseWorkbookToRows)(params.buffer, "venues-import");
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
        createdCount: successCount,
        updatedCount: 0,
        errorCount: errors.length,
        errors,
    };
}
