-- Event.listingClicks is on the Prisma Event model and is selected on every
-- findUnique/create. Phase 2 only created listingClicks on event_search_stats.
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "listingClicks" INTEGER NOT NULL DEFAULT 0;
