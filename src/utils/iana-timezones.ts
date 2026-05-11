/** Normalize venue timezone from API input: empty clears; invalid omits update (undefined). */
export function normalizeVenueTimezoneInput(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined
  const s = String(raw ?? "").trim()
  if (!s) return null
  try {
    const intl = Intl as typeof Intl & {
      supportedValuesOf?(key: "timeZone"): string[]
    }
    const list =
      typeof intl.supportedValuesOf === "function"
        ? intl.supportedValuesOf.call(Intl, "timeZone")
        : []
    const allowed = new Set(list)
    if (allowed.has(s)) return s
  } catch {
    if (s === "UTC") return "UTC"
  }
  return undefined
}
