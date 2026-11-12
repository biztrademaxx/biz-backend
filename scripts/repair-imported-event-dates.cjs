// Dry-run by default. Repairs schedules that exactly match the legacy parsing
// of a selected import job. --include-valid also audits ranges with misread months.
require('dotenv').config({ quiet: true });
require('ts-node/register/transpile-only');
const fs = require('fs');
const prisma = require('../src/config/prisma').default;
const { invalidateEventCaches } = require('../src/config/redis');
const { inferImportDateOrder, parseImportedDateTime, parseImportTimezone } = require('../src/modules/admin/event-import/event-import-parse');
const { normalizeImportRow } = require('../src/modules/admin/event-import/event-import-row');
const args = process.argv.slice(2);
const value = (flag) => args[args.indexOf(flag) + 1];
const apply = args.includes('--apply');
const includeValid = args.includes('--include-valid');
const jobId = args.includes('--job') ? value('--job') : null;
const backup = args.includes('--backup') ? value('--backup') : null;
const iso = (date) => new Date(date).toISOString();

async function main() {
  if (!jobId) throw new Error('Specify --job <import-job-id>');
  if (apply && !backup) throw new Error('--apply requires --backup <new-json-file>');
  const job = await prisma.eventImportJob.findUnique({ where: { id: jobId }, select: { rowsPayload: true } });
  if (!job || !Array.isArray(job.rowsPayload)) throw new Error('Import rows not found');
  const rows = job.rowsPayload.map(normalizeImportRow);
  const order = inferImportDateOrder(rows);
  const events = await prisma.event.findMany({
    where: includeValid ? { title: { in: rows.map((row) => String(row.eventTitle || '').trim()) } } : { endDate: { lt: prisma.event.fields.startDate } },
    select: { id: true, slug: true, title: true, startDate: true, endDate: true, registrationStart: true, registrationEnd: true },
  });
  const changes = [], skipped = [];
  let unchanged = 0;
  for (const event of events) {
    const matches = [];
    for (const row of rows.filter((r) => String(r.eventTitle || '').trim().toLowerCase() === event.title.trim().toLowerCase())) {
      const tz = parseImportTimezone(row.timezone);
      try {
        const legacyStart = parseImportedDateTime(row.startDate, row.startTime, '10:00', tz);
        const legacyEnd = parseImportedDateTime(row.endDate || row.startDate, row.endTime, '18:00', tz);
        if (iso(legacyStart) !== iso(event.startDate) || iso(legacyEnd) !== iso(event.endDate)) continue;
        const startDate = parseImportedDateTime(row.startDate, row.startTime, '10:00', tz, 'startDate', order);
        const endDate = parseImportedDateTime(row.endDate || row.startDate, row.endTime, '18:00', tz, 'endDate', order);
        if (endDate < startDate) continue;
        const next = { startDate: iso(startDate), endDate: iso(endDate) };
        for (const [key, fallback, oldDate, newDate, time] of [
          ['registrationStart', row.startTime, event.startDate, startDate, '10:00'],
          ['registrationEnd', row.endTime, event.endDate, endDate, '18:00'],
        ]) {
          if (row[key]) next[key] = iso(parseImportedDateTime(row[key], fallback, time, tz, key, order));
          else if (iso(event[key]) === iso(oldDate)) next[key] = iso(newDate);
          else next[key] = iso(event[key]);
        }
        matches.push({ id: event.id, slug: event.slug, title: event.title,
          source: { jobId, startDate: row.startDate, endDate: row.endDate, order },
          old: { startDate: iso(event.startDate), endDate: iso(event.endDate), registrationStart: iso(event.registrationStart), registrationEnd: iso(event.registrationEnd) },
          next,
        });
      } catch { /* Report an unmatched record without guessing its dates. */ }
    }
    const unique = [...new Map(matches.map((match) => [JSON.stringify(match.next), match])).values()];
    if (unique.length === 1) {
      if (JSON.stringify(unique[0].old) === JSON.stringify(unique[0].next)) unchanged++;
      else changes.push(unique[0]);
    }
    else skipped.push({ id: event.id, title: event.title, reason: unique.length ? 'Conflicting source rows' : 'No exact legacy-date match in the selected import' });
  }
  const plan = { generatedAt: new Date().toISOString(), jobId, dateOrder: order, auditedCount: events.length, includeValid, unchanged, changes, skipped };
  if (apply) {
    fs.writeFileSync(backup, JSON.stringify(plan, null, 2), { flag: 'wx' });
    await prisma.$transaction(async (tx) => {
      for (const change of changes) {
        const dates = Object.fromEntries(Object.entries(change.next).map(([key, date]) => [key, new Date(date)]));
        const guard = Object.fromEntries(Object.entries(change.old).map(([key, date]) => [key, new Date(date)]));
        const result = await tx.event.updateMany({ where: { id: change.id, ...guard }, data: dates });
        if (result.count !== 1) throw new Error('Record changed since audit: ' + change.id);
      }
    }, { timeout: 30000 });
    for (const change of changes) await invalidateEventCaches({ id: change.id, slug: change.slug });
  }
  console.log(JSON.stringify({ ...plan, applied: apply }, null, 2));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
