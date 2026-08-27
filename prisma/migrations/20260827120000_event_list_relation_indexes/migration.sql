-- Event list relation indexes (non-destructive).
-- Supports /api/events listInclude: _count, savedEvents preview, cheapest ticket.

CREATE INDEX IF NOT EXISTS "ticket_types_eventId_isActive_price_idx"
  ON "ticket_types"("eventId", "isActive", "price");

CREATE INDEX IF NOT EXISTS "saved_events_eventId_savedAt_idx"
  ON "saved_events"("eventId", "savedAt");

CREATE INDEX IF NOT EXISTS "event_registrations_eventId_status_idx"
  ON "event_registrations"("eventId", "status");

CREATE INDEX IF NOT EXISTS "reviews_eventId_idx"
  ON "reviews"("eventId");
