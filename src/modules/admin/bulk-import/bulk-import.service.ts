import * as XLSX from "xlsx";
import prisma from "../../../config/prisma";
import { createOrganizer } from "../organizers/organizers.service";
import { createVenue } from "../venues/venues.service";

type ImportError = { row: number; message: string };
type ImportResult = { processed: number; successCount: number; errorCount: number; errors: ImportError[] };

function parseRows(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], {
    raw: false,
    defval: "",
  });
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function splitList(v: unknown): string[] {
  const raw = str(v);
  if (!raw) return [];
  return raw
    .split(/[,|]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function asBool(v: unknown, defaultValue = true): boolean {
  const raw = str(v).toLowerCase();
  if (!raw) return defaultValue;
  if (["true", "1", "yes", "y"].includes(raw)) return true;
  if (["false", "0", "no", "n"].includes(raw)) return false;
  return defaultValue;
}

export async function importOrganizersFromFile(params: {
  buffer: Buffer;
  adminId?: string;
  adminType?: "SUPER_ADMIN" | "SUB_ADMIN";
}): Promise<ImportResult> {
  const rows = parseRows(params.buffer);
  const errors: ImportError[] = [];
  let successCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNo = index + 2;
    try {
      const email = str(row.email);
      if (!email) throw new Error("email is required");

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

      const created = await createOrganizer(payload);
      successCount += 1;

      if (params.adminId && created?.id) {
        await prisma.adminLog.create({
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
    } catch (e: any) {
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

export async function importVenuesFromFile(params: {
  buffer: Buffer;
  adminId?: string;
  adminType?: "SUPER_ADMIN" | "SUB_ADMIN";
}): Promise<ImportResult> {
  const rows = parseRows(params.buffer);
  const errors: ImportError[] = [];
  let successCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNo = index + 2;
    try {
      const email = str(row.email);
      const venueName = str(row.venueName);
      if (!email) throw new Error("email is required");
      if (!venueName) throw new Error("venueName is required");

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

      const created = await createVenue(payload);
      successCount += 1;

      if (params.adminId && created?.id) {
        await prisma.adminLog.create({
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
    } catch (e: any) {
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
