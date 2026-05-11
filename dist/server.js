"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./load-env");
const env_1 = require("./config/env");
const app_1 = require("./app");
const deactivation_scheduler_1 = require("./jobs/deactivation-scheduler");
(0, env_1.validateEnv)();
const app = (0, app_1.createApp)();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend server listening on port ${PORT}`);
    (0, deactivation_scheduler_1.startDeactivationScheduler)();
});
