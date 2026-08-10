/**
 * One-shot backfill for Phase 2 ranking features.
 * Usage (from biz-backend): npx tsx scripts/backfill-event-ranking.ts
 */
import { backfillEventRankingFeatures } from "../src/modules/events/event-ranking.service";

async function main() {
  console.log("Backfilling organizerPlanTier + EventSearchStats...");
  const result = await backfillEventRankingFeatures();
  console.log("Done:", result);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
