-- Composite indexes for Admin CMS blog queries (listing + slug lookup).
-- Safe to apply if indexes do not already exist.

CREATE INDEX IF NOT EXISTS "admin_content_type_published_idx" ON "admin_content"("type", "published");

CREATE INDEX IF NOT EXISTS "admin_content_type_slug_idx" ON "admin_content"("type", "slug");
