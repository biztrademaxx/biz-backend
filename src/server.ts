import "./load-env";
import { validateEnv } from "./config/env";
import { createApp } from "./app";
import { startDeactivationScheduler } from "./jobs/deactivation-scheduler";

validateEnv();

const app = createApp();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server listening on port ${PORT}`);
  startDeactivationScheduler();
});

