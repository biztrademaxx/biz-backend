"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingDeactivationsHandler = getPendingDeactivationsHandler;
exports.getDeactivationsHandler = getDeactivationsHandler;
exports.postApproveDeactivationHandler = postApproveDeactivationHandler;
exports.postRejectDeactivationHandler = postRejectDeactivationHandler;
exports.postProcessDueDeactivationsHandler = postProcessDueDeactivationsHandler;
const account_deactivation_service_1 = require("./account-deactivation.service");
function adminMeta(req) {
    const a = req.auth;
    return { id: a.sub, type: a.role };
}
async function getPendingDeactivationsHandler(_req, res) {
    try {
        const data = await (0, account_deactivation_service_1.listPendingDeactivationRequests)();
        return res.json({ success: true, data });
    }
    catch (e) {
        return res.status(500).json({ success: false, message: e?.message || "Failed to list requests" });
    }
}
async function getDeactivationsHandler(req, res) {
    try {
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        const data = await (0, account_deactivation_service_1.listAllDeactivationRequestsForAdmin)(status);
        return res.json({ success: true, data });
    }
    catch (e) {
        return res.status(500).json({ success: false, message: e?.message || "Failed to list requests" });
    }
}
async function postApproveDeactivationHandler(req, res) {
    try {
        const { id } = req.params;
        const { id: adminId, type: adminType } = adminMeta(req);
        const { effectiveAt } = await (0, account_deactivation_service_1.approveDeactivationRequest)(id, adminId, adminType);
        return res.json({
            success: true,
            message: "Deactivation approved. Account will be closed after the 30-day period.",
            deactivateEffectiveAt: effectiveAt.toISOString(),
        });
    }
    catch (e) {
        const msg = e?.message || "Failed to approve";
        return res.status(400).json({ success: false, message: msg });
    }
}
async function postRejectDeactivationHandler(req, res) {
    try {
        const { id } = req.params;
        const { id: adminId, type: adminType } = adminMeta(req);
        const { reason } = (req.body ?? {});
        await (0, account_deactivation_service_1.rejectDeactivationRequest)(id, adminId, adminType, reason);
        return res.json({ success: true, message: "Request rejected" });
    }
    catch (e) {
        const msg = e?.message || "Failed to reject";
        return res.status(400).json({ success: false, message: msg });
    }
}
/** Manual trigger (admin) — same as background job */
async function postProcessDueDeactivationsHandler(_req, res) {
    try {
        const n = await (0, account_deactivation_service_1.processDueAccountDeactivations)();
        return res.json({ success: true, processed: n });
    }
    catch (e) {
        return res.status(500).json({ success: false, message: e?.message || "Failed" });
    }
}
