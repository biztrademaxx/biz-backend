-- Phase 2: organizer plan tier denorm + event search stats for ranked listing
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "organizerPlanTier" TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS "organizerPlanUpdatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "events_organizerPlanTier_idx" ON "events"("organizerPlanTier");
CREATE INDEX IF NOT EXISTS "events_status_isPublic_organizerPlanTier_idx"
  ON "events"("status", "isPublic", "organizerPlanTier");

CREATE TABLE IF NOT EXISTS "event_search_stats" (
  "eventId" UUID NOT NULL,
  "followersCount" INTEGER NOT NULL DEFAULT 0,
  "confirmedRegsCount" INTEGER NOT NULL DEFAULT 0,
  "listingClicks" INTEGER NOT NULL DEFAULT 0,
  "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "saves7d" INTEGER NOT NULL DEFAULT 0,
  "regs7d" INTEGER NOT NULL DEFAULT 0,
  "clicks7d" INTEGER NOT NULL DEFAULT 0,
  "subscriptionScore" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
  "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "freshnessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rankScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rankingVersion" TEXT NOT NULL DEFAULT 'v1',
  "statsUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_search_stats_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX IF NOT EXISTS "event_search_stats_rankScore_idx" ON "event_search_stats"("rankScore" DESC);

ALTER TABLE "event_search_stats" DROP CONSTRAINT IF EXISTS "event_search_stats_eventId_fkey";
ALTER TABLE "event_search_stats"
  ADD CONSTRAINT "event_search_stats_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
