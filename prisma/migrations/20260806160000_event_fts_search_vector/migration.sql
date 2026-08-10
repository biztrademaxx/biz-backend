-- Phase 3: Postgres full-text search vector for events
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

CREATE OR REPLACE FUNCTION events_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."shortDescription", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."subTitle", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.category, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(left(NEW.description, 8000), '')), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_search_vector_trigger ON "events";
CREATE TRIGGER events_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description, "shortDescription", "subTitle", tags, category
  ON "events"
  FOR EACH ROW
  EXECUTE PROCEDURE events_search_vector_update();

-- Backfill existing rows
UPDATE "events" SET
  "search_vector" =
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce("shortDescription", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("subTitle", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(category, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(left(description, 8000), '')), 'D');

CREATE INDEX IF NOT EXISTS "events_search_vector_idx" ON "events" USING GIN ("search_vector");
