/** Canonical spreadsheet column names for event import rows. */

const IMPORT_HEADER_ALIASES: Record<string, string> = {
  startdate: "startDate",
  enddate: "endDate",
  starttime: "startTime",
  endtime: "endTime",
  eventtitle: "eventTitle",
  eventdescription: "eventDescription",
  eventdesc: "eventDescription",
  eventcategorynames: "eventCategoryNames",
  eventcategory: "eventCategoryNames",
  eventcate: "eventCategoryNames",
  category: "category",
  eventtype: "eventType",
  eventtypes: "eventTypes",
  organizereemail: "organizerEmail",
  organizeremail: "organizerEmail",
  organizere: "organizerEmail",
  organizername: "organizerName",
  organizern: "organizerName",
  venueemail: "venueEmail",
  venueema: "venueEmail",
  venuename: "venueName",
  venuenam: "venueName",
  registrationstart: "registrationStart",
  registrationend: "registrationEnd",
  timezone: "timezone",
  images: "images",
  videos: "videos",
  documents: "documents",
  tags: "tags",
  slug: "slug",
  eventslug: "eventSlug",
};

export function normalizeImportHeader(header: string): string {
  return header.replace(/^\uFEFF/, "").trim();
}

function aliasKey(header: string): string {
  return normalizeImportHeader(header).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function canonicalImportHeader(header: string): string {
  const clean = normalizeImportHeader(header);
  if (!clean) return clean;
  return IMPORT_HEADER_ALIASES[aliasKey(clean)] ?? clean;
}

/** Map row keys to canonical names (case/spacing insensitive). Keeps first non-empty value. */
export function normalizeImportRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const canonical = canonicalImportHeader(key);
    if (!canonical) continue;
    const existing = out[canonical];
    const existingEmpty =
      existing === undefined || existing === null || String(existing).trim() === "";
    const valueEmpty = value === undefined || value === null || String(value).trim() === "";
    if (existingEmpty && !valueEmpty) out[canonical] = value;
    else if (!(canonical in out)) out[canonical] = value;
  }
  return out;
}

export function pickImportField(row: Record<string, unknown>, field: string): unknown {
  const normalized = normalizeImportRow(row);
  return normalized[field];
}
