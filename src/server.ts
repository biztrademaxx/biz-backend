import "./load-env";
import { validateEnv } from "./config/env";
import { createApp } from "./app";
import { isRedisEnabled } from "./config/redis";
import { startDeactivationScheduler } from "./jobs/deactivation-scheduler";

validateEnv();

const app = createApp();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server listening on port ${PORT}`);
  // eslint-disable-next-line no-console
  console.log(
    isRedisEnabled()
      ? "[redis] Upstash connected — public organizers/facets responses are cached"
      : "[redis] Disabled (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to enable caching)",
  );
  startDeactivationScheduler();
});

