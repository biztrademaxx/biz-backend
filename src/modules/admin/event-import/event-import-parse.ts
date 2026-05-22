/** Parse dates from spreadsheet cells (incl. Excel/Vercel odd formats). */
export function parseDateString(dateStr: unknown): Date {
  if (dateStr === null || dateStr === undefined || String(dateStr).trim() === "") {
    return new Date();
  }

  const str = String(dateStr).trim();

  if (str.includes("$type") && str.includes("DateTime")) {
    try {
      let jsonStr = str;
      if (!jsonStr.startsWith("{")) jsonStr = `{${jsonStr}`;
      if (!jsonStr.endsWith("}")) jsonStr = `${jsonStr}}`;
      jsonStr = jsonStr.replace(/\\"/g, '"');
      const parsed = JSON.parse(jsonStr) as { value?: string };
      if (parsed.value) {
        const date = new Date(parsed.value);
        if (!Number.isNaN(date.getTime())) return date;
      }
    } catch {
      /* fall through */
    }
  }

  if (str.includes("+0") || str.includes("-0")) {
    const isoMatch = str.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      const date = new Date(isoMatch[1]);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return new Date();
  }

  const parts = str.split("-");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      if (day > 12 && day <= 31) return new Date(year, month - 1, day);
      if (year > 31 && month <= 12 && day <= 31) return new Date(year, month - 1, day);
    }
  }

  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return new Date();
  const y = date.getFullYear();
  if (y < 1900 || y > 2100) return new Date();
  return date;
}
