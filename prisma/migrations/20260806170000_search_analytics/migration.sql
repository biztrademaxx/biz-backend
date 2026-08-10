-- Phase 4: search analytics tables
CREATE TABLE IF NOT EXISTS "search_queries" (
  "id" UUID NOT NULL,
  "normalizedQuery" TEXT NOT NULL,
  "rawQuerySample" TEXT,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "hitCount" INTEGER NOT NULL DEFAULT 0,
  "zeroResultCount" INTEGER NOT NULL DEFAULT 0,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "search_queries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "search_queries_normalizedQuery_key"
  ON "search_queries"("normalizedQuery");
CREATE INDEX IF NOT EXISTS "search_queries_hitCount_idx" ON "search_queries"("hitCount");
CREATE INDEX IF NOT EXISTS "search_queries_zeroResultCount_idx" ON "search_queries"("zeroResultCount");
CREATE INDEX IF NOT EXISTS "search_queries_lastSeenAt_idx" ON "search_queries"("lastSeenAt");

CREATE TABLE IF NOT EXISTS "search_clicks" (
  "id" UUID NOT NULL,
  "queryNormalized" TEXT,
  "eventId" UUID NOT NULL,
  "position" INTEGER,
  "page" INTEGER,
  "userId" UUID,
  "sessionId" TEXT,
  "listingSource" TEXT NOT NULL DEFAULT 'events_list',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "search_clicks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "search_clicks_eventId_createdAt_idx"
  ON "search_clicks"("eventId", "createdAt");
CREATE INDEX IF NOT EXISTS "search_clicks_queryNormalized_idx"
  ON "search_clicks"("queryNormalized");
CREATE INDEX IF NOT EXISTS "search_clicks_createdAt_idx" ON "search_clicks"("createdAt");
CREATE INDEX IF NOT EXISTS "search_clicks_listingSource_createdAt_idx"
  ON "search_clicks"("listingSource", "createdAt");
