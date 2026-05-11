"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettingsHandler = getSettingsHandler;
exports.patchSettingsHandler = patchSettingsHandler;
exports.postVerifyEmailHandler = postVerifyEmailHandler;
exports.putVerifyEmailHandler = putVerifyEmailHandler;
exports.patchAccountHandler = patchAccountHandler;
const settings_service_1 = require("./settings.service");
function userId(req) {
    return req.auth?.sub ?? null;
}
async function getSettingsHandler(req, res) {
    try {
        const uid = userId(req);
        if (!uid)
            return res.status(401).json({ message: "Unauthorized" });
        const settings = await (0, settings_service_1.getSettingsForUser)(uid);
        if (!settings)
            return res.status(404).json({ message: "User not found" });
        return res.json(settings);
    }
    catch (e) {
        return res.status(500).json({ message: e?.message || "Failed to load settings" });
    }
}
async function patchSettingsHandler(req, res) {
    try {
        const uid = userId(req);
        if (!uid)
            return res.status(401).json({ message: "Unauthorized" });
        const updated = await (0, settings_service_1.updateSettingsForUser)(uid, req.body || {});
        if (!updated)
            return res.status(404).json({ message: "User not found" });
        return res.json({
            message: "Settings updated successfully",
            settings: updated,
        });
    }
    catch (e) {
        const msg = e?.message || "Failed to update settings";
        return res.status(400).json({ error: msg, message: msg });
    }
}
async function postVerifyEmailHandler(req, res) {
    try {
        const uid = userId(req);
        if (!uid)
            return res.status(401).json({ message: "Unauthorized" });
        const { email } = req.body;
        if (!email)
            return res.status(400).json({ error: "Email is required", message: "Email is required" });
        await (0, settings_service_1.sendEmailChangeOtp)(uid, email);
        return res.json({ message: "Verification code sent successfully" });
    }
    catch (e) {
        const msg = e?.message || "Failed to send verification code";
        return res.status(400).json({ error: msg, message: msg });
    }
}
async function putVerifyEmailHandler(req, res) {
    try {
        const uid = userId(req);
        if (!uid)
            return res.status(401).json({ message: "Unauthorized" });
        const { code, email } = req.body;
        if (!code || !email) {
            return res.status(400).json({ error: "Code and email are required", message: "Code and email are required" });
        }
        const settings = await (0, settings_service_1.verifyEmailChangeOtp)(uid, email, code);
        return res.json({
            message: "Email verified successfully",
            verified: true,
            settings,
        });
    }
    catch (e) {
        const msg = e?.message || "Verification failed";
        return res.status(400).json({ error: msg, message: msg });
    }
}
async function patchAccountHandler(req, res) {
    try {
        const uid = userId(req);
        if (!uid)
            return res.status(401).json({ message: "Unauthorized" });
        const { action } = req.body;
        if (action === "requestDeactivation") {
            const { requestId } = await (0, settings_service_1.requestAccountDeactivation)(uid);
            const settings = await (0, settings_service_1.getSettingsForUser)(uid);
            return res.json({
                message: "Your request was sent to an administrator. After approval, your account will close 30 days later.",
                requestId,
                settings,
            });
        }
        if (action === "cancelDeactivationRequest") {
            await (0, settings_service_1.cancelPendingDeactivationRequest)(uid);
            const settings = await (0, settings_service_1.getSettingsForUser)(uid);
            return res.json({
                message: "Pending deactivation request cancelled.",
                settings,
            });
        }
        return res.status(400).json({
            error: "Invalid action",
            message: "Use requestDeactivation or cancelDeactivationRequest",
        });
    }
    catch (e) {
        const msg = e?.message || "Failed to manage account";
        return res.status(400).json({ error: msg, message: msg });
    }
}
