-- CreateIndex
CREATE INDEX "events_status_isPublic_createdAt_idx" ON "events"("status", "isPublic", "createdAt");
