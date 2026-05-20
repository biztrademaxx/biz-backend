"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDeactivationScheduler = startDeactivationScheduler;
const account_deactivation_service_1 = require("../modules/admin/account-deactivation/account-deactivation.service");
/**
 * Runs on startup and every hour to set isActive=false when deactivateEffectiveAt has passed.
 */
function startDeactivationScheduler() {
    const tick = () => {
        (0, account_deactivation_service_1.processDueAccountDeactivations)()
            .then((n) => {
            if (n > 0) {
                // eslint-disable-next-line no-console
                console.log(`[account-deactivation] Applied ${n} scheduled closure(s)`);
            }
        })
            .catch((err) => {
            // eslint-disable-next-line no-console
            console.error("[account-deactivation] Scheduler error:", err);
        });
    };
    tick();
    setInterval(tick, 60 * 60 * 1000);
}
