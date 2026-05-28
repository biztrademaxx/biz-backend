/** Must match `utils/slugify.ts` in biz-frontend for venue dashboard URLs. */
export function slugifyVenueSegment(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function isUuidParam(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(segment ?? "").trim(),
  );
}
