"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FRONTEND_BASE = void 0;
exports.sendOtpEmail = sendOtpEmail;
exports.sendBadgeEmail = sendBadgeEmail;
exports.sendVerificationEmail = sendVerificationEmail;
exports.resolveFrontendBase = resolveFrontendBase;
exports.sendPasswordResetLinkEmail = sendPasswordResetLinkEmail;
exports.sendAdminPasswordResetOtpEmail = sendAdminPasswordResetOtpEmail;
exports.sendEventImportThankYouEmail = sendEventImportThankYouEmail;
exports.sendMarketingEmail = sendMarketingEmail;
exports.sendEventListingThankYouEmail = sendEventListingThankYouEmail;
exports.sendUserAccountAccessEmail = sendUserAccountAccessEmail;
exports.sendContactInquiryThankYouEmail = sendContactInquiryThankYouEmail;
exports.sendContactInquiryStaffNotify = sendContactInquiryStaffNotify;
exports.sendNewsletterDigestEmail = sendNewsletterDigestEmail;
exports.sendNewsletterWelcomeEmail = sendNewsletterWelcomeEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const resend_1 = require("resend");
const undici_1 = require("undici");
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
/** Read at call time so `dotenv` / `load-env` runs before any import of this module. */
function getResendApiKey() {
    return (process.env.RESEND_API_KEY ?? "").trim();
}
function getResendFromEmail() {
    return process.env.RESEND_FROM_EMAIL?.trim();
}
function getSendGridApiKey() {
    return (process.env.SENDGRID_API_KEY ?? "").trim();
}
/** Bare email used inside `"BizTradeFairs" <…>` — Resend vs SendGrid vs SMTP. */
function getEffectiveFromEmail() {
    if (getResendApiKey()) {
        const r = getResendFromEmail();
        if (r)
            return r;
    }
    const fromSg = process.env.SENDGRID_FROM_EMAIL?.trim();
    if (fromSg)
        return fromSg;
    const u = process.env.EMAIL_USER?.trim();
    return u || undefined;
}
function mailConfigured() {
    if (getResendApiKey())
        return !!getResendFromEmail();
    if (getSendGridApiKey())
        return !!getEffectiveFromEmail();
    return !!(process.env.EMAIL_USER?.trim() && process.env.EMAIL_PASS);
}
if (!mailConfigured() && process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.warn("[email.service] Set RESEND_API_KEY + RESEND_FROM_EMAIL (e.g. noreply@yourdomain.com), or SENDGRID_* , or EMAIL_USER + EMAIL_PASS (Gmail SMTP).");
}
const transporter = nodemailer_1.default.createTransport({
    service: "gmail",
    secure: true,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    },
    /** Fail fast; long SMTP hangs cause nginx 504 on routes that await sendMail (e.g. send-otp). */
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
});
/** Undici default connect timeout is 10s; small VPS / flaky routes can hit UND_ERR_CONNECT_TIMEOUT. */
const sendgridAgent = new undici_1.Agent({
    connect: { timeout: 30000 },
    headersTimeout: 45000,
    bodyTimeout: 45000,
});
function parseFromHeader(from) {
    const m = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
    if (m) {
        const name = m[1].trim();
        return { email: m[2].trim(), ...(name ? { name } : {}) };
    }
    return { email: from.trim() };
}
function requireMailConfig() {
    if (getResendApiKey()) {
        if (!getResendFromEmail()) {
            throw new Error("Set RESEND_FROM_EMAIL (address on a domain verified in Resend), e.g. noreply@biztradefairs.com.");
        }
        return;
    }
    if (getSendGridApiKey()) {
        if (!getEffectiveFromEmail()) {
            throw new Error("Set SENDGRID_FROM_EMAIL (verified sender in SendGrid) or EMAIL_USER when using SENDGRID_API_KEY.");
        }
        return;
    }
    if (!EMAIL_USER || !EMAIL_PASS) {
        throw new Error("Email credentials are not configured");
    }
}
async function sendViaResend(opts) {
    const apiKey = getResendApiKey();
    if (!opts.html && !opts.text) {
        throw new Error("Email must include html or text content");
    }
    const resend = new resend_1.Resend(apiKey);
    const base = {
        from: opts.from.trim(),
        to: opts.to,
        subject: opts.subject,
    };
    const attachments = opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
    })) ?? [];
    let result;
    try {
        if (opts.html) {
            result = await resend.emails.send({
                ...base,
                html: opts.html,
                ...(opts.text ? { text: opts.text } : {}),
                ...(attachments.length ? { attachments } : {}),
            });
        }
        else {
            result = await resend.emails.send({
                ...base,
                text: opts.text,
                ...(attachments.length ? { attachments } : {}),
            });
        }
    }
    catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        // eslint-disable-next-line no-console
        console.error("[email.service] Resend request failed:", err);
        throw new Error(`Resend network error: ${err.message}`);
    }
    if (result.error) {
        const er = result.error;
        // eslint-disable-next-line no-console
        console.error("[email.service] Resend API error:", er);
        throw new Error(`Resend error ${er.statusCode ?? "?"}: ${er.message}${er.name ? ` (${er.name})` : ""}`);
    }
}
async function sendViaSendGrid(opts) {
    const fromParsed = parseFromHeader(opts.from);
    const fromEmail = getEffectiveFromEmail() || fromParsed.email || EMAIL_USER;
    if (!fromEmail) {
        throw new Error("Missing sender email for SendGrid.");
    }
    const content = [];
    if (opts.text) {
        content.push({ type: "text/plain", value: opts.text });
    }
    if (opts.html) {
        content.push({ type: "text/html", value: opts.html });
    }
    if (content.length === 0) {
        throw new Error("Email must include html or text content");
    }
    const body = {
        personalizations: [{ to: [{ email: opts.to }] }],
        from: {
            email: fromEmail,
            ...(fromParsed.name ? { name: fromParsed.name } : {}),
        },
        subject: opts.subject,
        content,
    };
    if (opts.attachments?.length) {
        body.attachments = opts.attachments.map((a) => ({
            content: a.content.toString("base64"),
            filename: a.filename,
            type: a.contentType || "application/octet-stream",
            disposition: "attachment",
        }));
    }
    let res;
    try {
        res = await (0, undici_1.fetch)("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${getSendGridApiKey()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            dispatcher: sendgridAgent,
            signal: AbortSignal.timeout(45000),
        });
    }
    catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        // eslint-disable-next-line no-console
        console.error("[email.service] SendGrid fetch failed:", err);
        throw new Error(`SendGrid network error: ${err.message}`);
    }
    if (!res.ok) {
        const errText = await res.text();
        let summary = errText.slice(0, 800);
        try {
            const parsed = JSON.parse(errText);
            if (parsed.errors?.length) {
                summary = parsed.errors.map((e) => e.message).filter(Boolean).join("; ") || summary;
            }
        }
        catch {
            /* keep raw text */
        }
        // eslint-disable-next-line no-console
        console.error("[email.service] SendGrid HTTP", res.status, errText.slice(0, 2000));
        throw new Error(`SendGrid error ${res.status}: ${summary}`);
    }
}
async function dispatchMail(opts) {
    requireMailConfig();
    if (getResendApiKey()) {
        await sendViaResend(opts);
        return;
    }
    if (getSendGridApiKey()) {
        await sendViaSendGrid(opts);
        return;
    }
    await transporter.sendMail({
        from: opts.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        attachments: opts.attachments?.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType || "application/octet-stream",
        })),
    });
}
async function sendOtpEmail(email, otp) {
    await dispatchMail({
        from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
        to: email,
        subject: "Your OTP Verification Code",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #2563eb;">BizTradeFairs Email Verification</h2>
        <p>Hello,</p>
        <p>Your OTP code for email verification is:</p>
        <div style="background: #f3f4f6; padding: 16px; text-align: center; margin: 20px 0;">
          <h1 style="font-size: 32px; color: #2563eb; margin: 0;">${otp}</h1>
        </div>
        <p>This code will expire in <strong>10 minutes</strong>.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
        <br/>
        <p>Best regards,<br/>The BizTradeFairs Team</p>
      </div>
    `,
    });
}
async function sendBadgeEmail(email, badgeDataUrl, attendeeName, eventName) {
    const base64Data = badgeDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    await dispatchMail({
        from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
        to: email,
        subject: `Your Event Badge - ${eventName}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${attendeeName},</h2>
        <p>Your event badge for <strong>${eventName}</strong> is ready!</p>
        <p>Please find your badge attached to this email. You can print it or save it to your mobile device.</p>
        <p>We look forward to seeing you at the event!</p>
        <br>
        <p>Best regards,<br>The Event Team</p>
      </div>
    `,
        attachments: [
            {
                filename: `badge-${attendeeName.replace(/\s+/g, "-")}.png`,
                content: buffer,
                contentType: "image/png",
            },
        ],
    });
}
async function sendVerificationEmail(email, otp) {
    await dispatchMail({
        from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
        to: email,
        subject: "Your OTP Verification Code",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #2563eb;">BizTradeFairs Email Verification</h2>
        <p>Hello,</p>
        <p>Your OTP code for email verification is:</p>
        <div style="background: #f3f4f6; padding: 16px; text-align: center; margin: 20px 0;">
          <h1 style="font-size: 32px; color: #2563eb; margin: 0;">${otp}</h1>
        </div>
        <p>This code will expire in <strong>10 minutes</strong>.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
        <br/>
        <p>Best regards,<br/>The BizTradeFairs Team</p>
      </div>
    `,
    });
}
function parseFrontendBases() {
    const raw = process.env.FRONTEND_URL?.trim() ||
        process.env.APP_PUBLIC_URL?.trim() ||
        "http://localhost:3000";
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/\/$/, ""));
}
function resolveFrontendBase(preferredOrigin) {
    const bases = parseFrontendBases();
    if (preferredOrigin) {
        const normalized = preferredOrigin.replace(/\/$/, "");
        if (bases.includes(normalized))
            return normalized;
    }
    return bases[0] || "http://localhost:3000";
}
const FRONTEND_BASE = resolveFrontendBase();
exports.FRONTEND_BASE = FRONTEND_BASE;
async function sendPasswordResetLinkEmail(params) {
    const { toEmail, resetUrl, firstName, roleLabel } = params;
    await dispatchMail({
        from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
        to: toEmail,
        subject: "Reset your password",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #2563eb;">Password reset</h2>
        <p>Hello ${firstName || "there"},</p>
        <p>We received a request to reset the password for your <strong>${roleLabel}</strong> account.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset password</a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
        <p style="font-size: 12px; color: #9ca3af; word-break: break-all;">${resetUrl}</p>
        <p>Best regards,<br/>The BizTradeFairs Team</p>
      </div>
    `,
    });
}
/** OTP for super-admin / sub-admin password reset — sent to their login email. */
async function sendAdminPasswordResetOtpEmail(params) {
    const { toEmail, otp, name, adminKind } = params;
    await dispatchMail({
        from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
        to: toEmail,
        subject: `Your ${adminKind} password reset code`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #2563eb;">Admin password reset</h2>
        <p>Hello ${name || "there"},</p>
        <p>Use this one-time code to set a new password for your <strong>${adminKind}</strong> account:</p>
        <div style="background: #f3f4f6; padding: 16px; text-align: center; margin: 20px 0;">
          <h1 style="font-size: 32px; color: #2563eb; margin: 0; letter-spacing: 4px;">${otp}</h1>
        </div>
        <p>This code expires in <strong>15 minutes</strong>.</p>
        <p>If you did not request this, please ignore this email.</p>
        <br/>
        <p>Best regards,<br/>The BizTradeFairs Team</p>
      </div>
    `,
    });
}
/** Sent after bulk event import finishes — one email per organizer with event titles. */
async function sendEventImportThankYouEmail(params) {
    const { toEmail, firstName, eventTitles, setPasswordUrl } = params;
    const listHtml = eventTitles
        .map((t) => `<li style="margin: 8px 0; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">${String(t).replace(/</g, "&lt;")}</li>`)
        .join("");
    await dispatchMail({
        from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
        to: toEmail,
        subject: `Your events were imported (${eventTitles.length})`,
        html: `
      <div style="font-family: Inter, Arial, sans-serif; background: #f1f5f9; padding: 24px;">
        <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #0ea5e9 100%); color: #ffffff; padding: 22px 24px;">
            <h2 style="margin: 0; font-size: 22px; line-height: 1.3;">Events Imported Successfully</h2>
            <p style="margin: 8px 0 0 0; opacity: 0.92; font-size: 14px;">Your listings are now available on BizTradeFairs.</p>
          </div>

          <div style="padding: 22px 24px;">
            <p style="margin: 0 0 12px 0; color: #0f172a;">Hello <strong>${firstName || "there"}</strong>,</p>
            <p style="margin: 0 0 14px 0; color: #334155; line-height: 1.6;">
              The following event(s) have been added to the platform on your behalf:
            </p>
            <ul style="padding: 0; margin: 0 0 18px 0; list-style: none;">${listHtml}</ul>
        ${setPasswordUrl
            ? `<p style="margin: 24px 0;">
          <a href="${setPasswordUrl}" style="background: #2563eb; color: #fff; padding: 12px 22px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Set your password</a>
        </p>
        <p style="font-size: 13px; color: #475569; line-height: 1.6;">Your organizer account was created during import. Use the button above to choose a password and sign in with <strong>${toEmail}</strong>.</p>
        <p style="font-size: 12px; color: #94a3b8; word-break: break-all; margin-top: 10px;">${setPasswordUrl}</p>`
            : `<p style="margin: 8px 0 0 0; color: #475569;">You can sign in with this email address to manage your events.</p>`}
            <p style="margin: 22px 0 0 0; color: #334155;">Best regards,<br/><strong>The BizTradeFairs Team</strong></p>
          </div>
        </div>
      </div>
    `,
    });
}
async function sendMarketingEmail(params) {
    const html = params.htmlContent ||
        `<div style="font-family: Arial, sans-serif; line-height: 1.6; white-space: pre-wrap;">${params.content}</div>`;
    await dispatchMail({
        from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
        to: params.to,
        subject: params.subject,
        text: params.content,
        html,
    });
}
async function sendEventListingThankYouEmail(params) {
    const passwordSetupUrl = params.resetPasswordUrl ?? params.setPasswordUrl;
    if (!passwordSetupUrl) {
        throw new Error("Event listing email requires resetPasswordUrl or setPasswordUrl");
    }
    await dispatchMail({
        from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
        to: params.toEmail,
        subject: `Event listing update (${params.eventTitles.length})`,
        html: buildEventListingThankYouEmailHtml({
            firstName: params.firstName || "there",
            toEmail: params.toEmail,
            eventTitles: params.eventTitles,
            resetUrl: passwordSetupUrl,
        }),
    });
}
function escapeHtmlAttr(url) {
    return url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function escapeHtmlText(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/** Event listing processed — dark blue BIZZ header, event cards, reset-only CTA. */
function buildEventListingThankYouEmailHtml(params) {
    const { firstName, toEmail, eventTitles, resetUrl } = params;
    const safeName = escapeHtmlText(firstName);
    const safeEmail = escapeHtmlText(toEmail);
    const safeHref = escapeHtmlAttr(resetUrl);
    const social = [
        { label: "Facebook", href: "https://www.facebook.com/biztradefair/", letter: "f" },
        { label: "X", href: "https://x.com/biztradefair", letter: "𝕏" },
        { label: "LinkedIn", href: "https://www.linkedin.com/company/biztradefairs/", letter: "in" },
        { label: "Instagram", href: "https://www.instagram.com/biztradefairs/", letter: "IG" },
    ];
    const socialRow = social
        .map((s) => `<a href="${escapeHtmlAttr(s.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtmlAttr(s.label)}" style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;border-radius:999px;background:#4b5563;color:#ffffff;text-decoration:none;font-family:Inter,Arial,sans-serif;font-size:${s.letter === "in" || s.letter === "IG" ? "10px" : "14px"};font-weight:700;margin:0 6px;">${s.letter}</a>`)
        .join("");
    const bizzHexLogo = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="50" viewBox="0 0 44 50" aria-hidden="true">
  <polygon points="22,4 40,14 40,34 22,44 4,34 4,14" fill="none" stroke="#ffffff" stroke-width="2.2"/>
  <text x="22" y="31" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700">B</text>
</svg>`;
    const headerGraphic = `
<svg xmlns="http://www.w3.org/2000/svg" width="108" height="92" viewBox="0 0 108 92" aria-hidden="true">
  <polygon points="94,6 99,16 108,12 103,22 108,32 99,28 94,38 91,27 82,30 88,22 82,14 91,17" fill="#fbbf24" opacity="0.95"/>
  <polygon points="8,72 14,78 22,74 18,82 24,88 15,86 10,92 10,83 2,80 10,77" fill="#60a5fa"/>
  <polygon points="52,4 58,14 68,10 62,20 70,26 60,26 56,36 52,26 42,28 48,20 42,12" fill="#a78bfa" opacity="0.9"/>
  <rect x="12" y="18" width="72" height="62" rx="10" fill="#eff6ff" stroke="#93c5fd" stroke-width="2"/>
  <rect x="12" y="18" width="72" height="14" rx="4" fill="#2563eb"/>
  <rect x="22" y="38" width="14" height="10" rx="2" fill="#dbeafe"/>
  <rect x="42" y="38" width="14" height="10" rx="2" fill="#dbeafe"/>
  <rect x="62" y="38" width="14" height="10" rx="2" fill="#dbeafe"/>
  <circle cx="82" cy="34" r="17" fill="#22c55e"/>
  <path d="M75 34 L79 40 L91 26" stroke="#ffffff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
    const eventCardsHtml = eventTitles
        .map((raw) => {
        const safeTitle = escapeHtmlText(String(raw));
        return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;margin-bottom:12px;">
              <tr>
                <td style="padding:16px 14px;width:52px;" valign="middle">
                  <div style="width:44px;height:44px;border-radius:999px;background:#dbeafe;text-align:center;line-height:44px;font-size:20px;">📅</div>
                </td>
                <td valign="middle" style="padding:14px 10px 14px 0;">
                  <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.07em;font-weight:600;">Event name</div>
                  <div style="font-size:17px;font-weight:700;color:#0f172a;line-height:1.35;">${safeTitle}</div>
                </td>
                <td valign="middle" align="right" style="padding:14px 16px 14px 0;">
                  <div style="width:40px;height:40px;border-radius:999px;background:#dbeafe;text-align:center;line-height:40px;font-size:17px;">🎟</div>
                </td>
              </tr>
            </table>`;
    })
        .join("");
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;padding:0;background:#f1f5f9;">
  <tr>
    <td align="center" style="padding:24px 12px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#172554;padding:28px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              <td valign="top" style="width:62%;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td valign="middle" style="padding-right:10px;">${bizzHexLogo}</td>
                  <td valign="middle" style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:0.08em;">BIZZ</td>
                </tr></table>
                <h1 style="margin:20px 0 8px 0;font-size:24px;line-height:1.25;color:#ffffff;font-weight:800;">Event Listing Update</h1>
                <p style="margin:0;font-size:15px;line-height:1.5;color:rgba(255,255,255,0.9);">Your event details were processed successfully.</p>
              </td>
              <td valign="middle" align="right" style="width:38%;">${headerGraphic}</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px 8px 24px;background:#ffffff;">
            <p style="margin:0 0 10px 0;font-size:17px;line-height:1.5;color:#1e40af;"><strong>Hello ${safeName},</strong></p>
            <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">
              Great news! Your event listing has been processed successfully. Here are your event details:
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 24px 8px 24px;background:#ffffff;">${eventCardsHtml}</td>
        </tr>
        <tr>
          <td style="padding:8px 24px 20px 24px;background:#ffffff;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;">
              <tr>
                <td style="padding:24px 22px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                    <td valign="top" width="52">
                      <div style="width:46px;height:46px;border-radius:999px;background:#dcfce7;text-align:center;line-height:46px;font-size:22px;">🛡️</div>
                    </td>
                    <td valign="top" style="padding-left:4px;">
                      <div style="font-size:17px;font-weight:800;color:#0f172a;line-height:1.35;margin-bottom:8px;">Your account is ready!</div>
                      <p style="margin:0 0 22px 0;font-size:15px;line-height:1.6;color:#475569;">
                        Click the button below to set your password and access your account securely.
                      </p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                        <td align="center">
                          <a href="${safeHref}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">
                            Set Your Password&nbsp;&nbsp;&rarr;
                          </a>
                        </td>
                      </tr></table>
                      <div style="height:1px;background:#bae6fd;margin:22px 0 14px 0;"></div>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                        <td valign="top" style="padding-right:8px;font-size:16px;line-height:1;">✅</td>
                        <td valign="top" style="font-size:13px;line-height:1.55;color:#475569;">
                          This secure link will expire in <strong style="color:#2563eb;">15 minutes</strong>.
                        </td>
                      </tr></table>
                    </td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 18px 24px;background:#ffffff;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
              <tr>
                <td style="padding:18px 18px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                    <td valign="top" width="44">
                      <div style="width:38px;height:38px;border-radius:999px;background:#ffedd5;text-align:center;line-height:38px;font-size:18px;">✉️</div>
                    </td>
                    <td valign="top" style="padding-left:6px;font-size:14px;line-height:1.55;color:#78350f;">
                      Use this email (<strong style="color:#2563eb;">${safeEmail}</strong>) to set your password when prompted.
                    </td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 24px 24px;background:#ffffff;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;">
              <tr>
                <td style="padding:18px 18px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                    <td valign="top" width="42">
                      <div style="width:36px;height:36px;border-radius:999px;background:#ede9fe;text-align:center;line-height:36px;color:#6d28d9;font-weight:800;font-size:15px;">?</div>
                    </td>
                    <td valign="top" style="padding-left:6px;">
                      <div style="font-size:15px;font-weight:800;color:#6d28d9;line-height:1.35;">Didn't request this?</div>
                      <div style="font-size:14px;color:#5b21b6;line-height:1.55;margin-top:6px;opacity:0.92;">
                        If you didn't request access to this account, you can safely ignore this email.
                      </div>
                    </td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:12px 24px 32px 24px;background:#ffffff;border-top:1px solid #f1f5f9;">
            <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
              💙 Best regards,<br/>
              <strong style="color:#2563eb;font-size:16px;">The BizTradeFairs Team</strong>
            </p>
            <div style="font-size:0;line-height:0;">${socialRow}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
/** Venue Manager invitation — purple welcome layout (reset link only; matches marketing welcome emails). */
function buildVenueManagerWelcomeEmailHtml(params) {
    const { firstName, toEmail, resetUrl } = params;
    const safeName = escapeHtmlText(firstName);
    const safeEmail = escapeHtmlText(toEmail);
    const safeHref = escapeHtmlAttr(resetUrl);
    const social = [
        { label: "Facebook", href: "https://www.facebook.com/biztradefair/", letter: "f" },
        { label: "X", href: "https://x.com/biztradefair", letter: "𝕏" },
        { label: "LinkedIn", href: "https://www.linkedin.com/company/biztradefairs/", letter: "in" },
        { label: "Instagram", href: "https://www.instagram.com/biztradefairs/", letter: "IG" },
    ];
    const socialRow = social
        .map((s) => `<a href="${escapeHtmlAttr(s.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtmlAttr(s.label)}" style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;border-radius:999px;background:#374151;color:#ffffff;text-decoration:none;font-family:Inter,Arial,sans-serif;font-size:${s.letter === "in" || s.letter === "IG" ? "10px" : "14px"};font-weight:700;margin:0 6px;">${s.letter}</a>`)
        .join("");
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;padding:0;background:#f9f9ff;">
  <tr>
    <td align="center" style="padding:40px 16px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
        <!-- Logo -->
        <tr>
          <td align="center" style="padding:0 0 28px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td valign="middle" style="width:48px;height:48px;background:#7c3aed;border-radius:12px;text-align:center;line-height:48px;color:#ffffff;font-size:22px;font-weight:800;">B</td>
              <td valign="middle" style="padding-left:14px;">
                <div style="font-size:22px;font-weight:800;color:#1e1b4b;letter-spacing:0.12em;line-height:1.2;">BIZZ</div>
                <div style="font-size:13px;color:#64748b;margin-top:4px;">Connect. Explore. Grow.</div>
              </td>
            </tr></table>
          </td>
        </tr>
        <!-- Hero -->
        <tr>
          <td align="center" style="padding:0 24px 32px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="center">
                <svg xmlns="http://www.w3.org/2000/svg" width="132" height="108" viewBox="0 0 132 108" aria-hidden="true">
                  <circle cx="118" cy="22" r="8" fill="#ddd6fe"/>
                  <circle cx="14" cy="78" r="6" fill="#e9d5ff"/>
                  <rect x="16" y="28" width="100" height="64" rx="10" fill="#ffffff" stroke="#c4b5fd" stroke-width="2"/>
                  <path d="M16 36 L66 68 L116 36" fill="none" stroke="#c4b5fd" stroke-width="2"/>
                  <circle cx="66" cy="58" r="20" fill="#7c3aed"/>
                  <path d="M56 58 L63 65 L78 48" stroke="#ffffff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </td>
            </tr></table>
            <h1 style="margin:20px 0 10px 0;font-size:28px;line-height:1.25;color:#1e1b4b;font-weight:800;">Welcome to Bizz! 🎉</h1>
            <p style="margin:0;font-size:17px;line-height:1.55;color:#64748b;">Your account has been created successfully.</p>
            <p style="margin:14px 0 0 0;font-size:15px;line-height:1.55;color:#64748b;">Hello ${safeName}, your venue login email is <strong style="color:#1e1b4b;">${safeEmail}</strong>.</p>
          </td>
        </tr>
        <!-- CTA card -->
        <tr>
          <td style="padding:0 8px 24px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.08);">
              <tr>
                <td align="center" style="padding:36px 28px 28px 28px;">
                  <div style="width:56px;height:56px;margin:0 auto 18px auto;border-radius:999px;border:2px solid #7c3aed;background:#faf5ff;line-height:52px;text-align:center;font-size:22px;color:#7c3aed;">👤</div>
                  <h2 style="margin:0 0 12px 0;font-size:22px;color:#1e1b4b;font-weight:800;">Complete Your Account Setup</h2>
                  <p style="margin:0 0 28px 0;font-size:15px;line-height:1.6;color:#64748b;max-width:440px;">
                    To get started, please set a secure password for your account by clicking the button below.
                  </p>
                  <a href="${safeHref}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;">
                    Set Your Password
                  </a>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0 auto;"><tr>
                    <td valign="top" style="padding-right:10px;font-size:18px;line-height:1;">🛡️</td>
                    <td valign="top" style="text-align:left;">
                      <div style="font-size:14px;font-weight:700;color:#1e1b4b;line-height:1.4;">Your security matters</div>
                      <div style="font-size:13px;color:#64748b;line-height:1.5;margin-top:4px;">This link will expire in 15 minutes for security reasons.</div>
                    </td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Didn't request -->
        <tr>
          <td style="padding:0 12px 28px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ede9fe;border-radius:14px;">
              <tr>
                <td style="padding:22px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                    <td valign="top" width="44">
                      <div style="width:36px;height:36px;border-radius:999px;background:#7c3aed;color:#ffffff;text-align:center;line-height:36px;font-weight:700;font-size:16px;">?</div>
                    </td>
                    <td valign="top" style="padding-left:8px;">
                      <div style="font-size:15px;font-weight:700;color:#1e1b4b;line-height:1.35;">Didn't request this?</div>
                      <div style="font-size:14px;color:#64748b;line-height:1.55;margin-top:6px;">
                        If you didn't sign up for a Bizz account, you can safely ignore this email.
                      </div>
                    </td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td align="center" style="padding:8px 16px 32px 16px;">
            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#1e1b4b;">
              💜 <strong>Thanks,</strong> <span style="color:#7c3aed;font-weight:600;">The Bizz Team</span>
            </p>
            <p style="margin:0 0 12px 0;font-size:12px;color:#94a3b8;">BizTradeFairs</p>
            <div style="font-size:0;line-height:0;">${socialRow}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
/** Organizer admin invitation — dark blue header + cards (reset link only). */
function buildOrganizerAccountWelcomeEmailHtml(params) {
    const { firstName, toEmail, resetUrl } = params;
    const safeName = escapeHtmlText(firstName);
    const safeEmail = escapeHtmlText(toEmail);
    const safeHref = escapeHtmlAttr(resetUrl);
    const social = [
        { label: "Facebook", href: "https://www.facebook.com/biztradefair/", letter: "f" },
        { label: "X", href: "https://x.com/biztradefair", letter: "𝕏" },
        { label: "LinkedIn", href: "https://www.linkedin.com/company/biztradefairs/", letter: "in" },
        { label: "Instagram", href: "https://www.instagram.com/biztradefairs/", letter: "IG" },
    ];
    const socialRow = social
        .map((s) => `<a href="${escapeHtmlAttr(s.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtmlAttr(s.label)}" style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;border-radius:999px;background:#4b5563;color:#ffffff;text-decoration:none;font-family:Inter,Arial,sans-serif;font-size:${s.letter === "in" || s.letter === "IG" ? "10px" : "14px"};font-weight:700;margin:0 6px;">${s.letter}</a>`)
        .join("");
    const headerGraphic = `
<svg xmlns="http://www.w3.org/2000/svg" width="108" height="92" viewBox="0 0 108 92" aria-hidden="true">
  <polygon points="94,6 99,16 108,12 103,22 108,32 99,28 94,38 91,27 82,30 88,22 82,14 91,17" fill="#fbbf24" opacity="0.95"/>
  <polygon points="8,72 14,78 22,74 18,82 24,88 15,86 10,92 10,83 2,80 10,77" fill="#60a5fa"/>
  <rect x="12" y="18" width="72" height="62" rx="10" fill="#eff6ff" stroke="#93c5fd" stroke-width="2"/>
  <rect x="12" y="18" width="72" height="14" rx="4" fill="#2563eb"/>
  <rect x="22" y="38" width="14" height="10" rx="2" fill="#dbeafe"/>
  <rect x="42" y="38" width="14" height="10" rx="2" fill="#dbeafe"/>
  <rect x="62" y="38" width="14" height="10" rx="2" fill="#dbeafe"/>
  <circle cx="82" cy="34" r="17" fill="#22c55e"/>
  <path d="M75 34 L79 40 L91 26" stroke="#ffffff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;padding:0;background:#f1f5f9;">
  <tr>
    <td align="center" style="padding:24px 12px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <!-- Header -->
        <tr>
          <td style="background:#172554;padding:28px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              <td valign="top" style="width:62%;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td valign="middle" style="width:40px;height:40px;background:#ffffff;border-radius:8px;text-align:center;line-height:40px;color:#172554;font-size:18px;font-weight:800;">B</td>
                  <td valign="middle" style="padding-left:12px;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:0.08em;">BIZZ</td>
                </tr></table>
                <h1 style="margin:20px 0 8px 0;font-size:24px;line-height:1.25;color:#ffffff;font-weight:800;">Organizer Account Update</h1>
                <p style="margin:0;font-size:15px;line-height:1.5;color:rgba(255,255,255,0.9);">Your account details were processed successfully.</p>
              </td>
              <td valign="middle" align="right" style="width:38%;">${headerGraphic}</td>
            </tr></table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 24px 12px 24px;background:#ffffff;">
            <p style="margin:0 0 10px 0;font-size:17px;line-height:1.5;color:#1e40af;"><strong>Hello ${safeName},</strong></p>
            <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">
              Great news! Your organizer account is ready on BizTradeFairs. Use the secure link below to set your password and access your dashboard.
            </p>
          </td>
        </tr>
        <!-- Login email card -->
        <tr>
          <td style="padding:8px 24px 20px 24px;background:#ffffff;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e2e8f0;border-radius:12px;background:#fafafa;">
              <tr>
                <td style="padding:18px 16px;width:52px;" valign="middle">
                  <div style="width:44px;height:44px;border-radius:999px;background:#dbeafe;text-align:center;line-height:44px;font-size:20px;">📅</div>
                </td>
                <td valign="middle" style="padding:14px 8px 14px 0;">
                  <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.07em;font-weight:600;">Login email</div>
                  <div style="font-size:17px;font-weight:700;color:#0f172a;line-height:1.35;">${safeEmail}</div>
                </td>
                <td valign="middle" align="right" style="padding:14px 16px 14px 0;font-size:22px;opacity:0.35;line-height:1;">🎟</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- CTA card -->
        <tr>
          <td style="padding:8px 24px 20px 24px;background:#ffffff;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;">
              <tr>
                <td style="padding:24px 22px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                    <td valign="top" width="52">
                      <div style="width:46px;height:46px;border-radius:999px;background:#dcfce7;text-align:center;line-height:46px;font-size:22px;">🛡️</div>
                    </td>
                    <td valign="top" style="padding-left:4px;">
                      <div style="font-size:17px;font-weight:800;color:#0f172a;line-height:1.35;margin-bottom:8px;">Your account is ready!</div>
                      <p style="margin:0 0 22px 0;font-size:15px;line-height:1.6;color:#475569;">
                        Click the button below to set your password and access your account securely.
                      </p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                        <td align="center">
                          <a href="${safeHref}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">
                            Set Your Password&nbsp;&nbsp;&rarr;
                          </a>
                        </td>
                      </tr></table>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;"><tr>
                        <td valign="top" style="padding-right:8px;font-size:16px;">🛡️</td>
                        <td valign="top" style="font-size:13px;line-height:1.5;color:#15803d;">
                          This secure link will expire in <strong>15 minutes</strong>.
                        </td>
                      </tr></table>
                    </td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Email reminder banner -->
        <tr>
          <td style="padding:0 24px 18px 24px;background:#ffffff;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
              <tr>
                <td style="padding:18px 18px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                    <td valign="top" width="44">
                      <div style="width:38px;height:38px;border-radius:999px;background:#ffedd5;text-align:center;line-height:38px;font-size:18px;">✉️</div>
                    </td>
                    <td valign="top" style="padding-left:6px;font-size:14px;line-height:1.55;color:#78350f;">
                      Use this email (<strong style="color:#2563eb;">${safeEmail}</strong>) to set your password when prompted.
                    </td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Didn't request -->
        <tr>
          <td style="padding:0 24px 24px 24px;background:#ffffff;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;">
              <tr>
                <td style="padding:18px 18px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                    <td valign="top" width="42">
                      <div style="width:36px;height:36px;border-radius:999px;background:#ede9fe;text-align:center;line-height:36px;color:#6d28d9;font-weight:800;font-size:15px;">?</div>
                    </td>
                    <td valign="top" style="padding-left:6px;">
                      <div style="font-size:15px;font-weight:800;color:#6d28d9;line-height:1.35;">Didn't request this?</div>
                      <div style="font-size:14px;color:#5b21b6;line-height:1.55;margin-top:6px;opacity:0.92;">
                        If you didn't request access to this account, you can safely ignore this email.
                      </div>
                    </td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td align="center" style="padding:12px 24px 32px 24px;background:#ffffff;border-top:1px solid #f1f5f9;">
            <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
              💙 Best regards,<br/>
              <strong style="color:#2563eb;font-size:16px;">The BizTradeFairs Team</strong>
            </p>
            <div style="font-size:0;line-height:0;">${socialRow}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
async function sendUserAccountAccessEmail(params) {
    const { toEmail, firstName, roleLabel, setPasswordUrl, temporaryPassword, resetPasswordUrl } = params;
    const passwordSetupUrl = resetPasswordUrl ?? setPasswordUrl;
    const safePw = temporaryPassword
        ? String(temporaryPassword)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
        : "";
    const venueWelcome = roleLabel === "Venue Manager" && passwordSetupUrl
        ? {
            subject: "Welcome to Bizz — complete your account setup",
            html: buildVenueManagerWelcomeEmailHtml({
                firstName: firstName || "there",
                toEmail,
                resetUrl: passwordSetupUrl,
            }),
        }
        : null;
    const organizerWelcome = roleLabel === "Organizer" && passwordSetupUrl
        ? {
            subject: "Organizer Account Update",
            html: buildOrganizerAccountWelcomeEmailHtml({
                firstName: firstName || "there",
                toEmail,
                resetUrl: passwordSetupUrl,
            }),
        }
        : null;
    await dispatchMail({
        from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
        to: toEmail,
        subject: venueWelcome?.subject ?? organizerWelcome?.subject ?? `${roleLabel} account access details`,
        html: venueWelcome?.html ??
            organizerWelcome?.html ??
            `
      <div style="font-family: Inter, Arial, sans-serif; background: #f1f5f9; padding: 24px;">
        <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #0ea5e9 100%); color: #ffffff; padding: 22px 24px;">
            <h2 style="margin: 0; font-size: 22px; line-height: 1.3;">${roleLabel} Account Update</h2>
            <p style="margin: 8px 0 0 0; opacity: 0.92; font-size: 14px;">Your account details are ready on BizTradeFairs.</p>
          </div>
          <div style="padding: 22px 24px;">
            <p style="margin: 0 0 12px 0; color: #0f172a;">Hello <strong>${firstName || "there"}</strong>,</p>
            <p style="margin: 0 0 14px 0; color: #334155; line-height: 1.6;">
              Your <strong>${roleLabel}</strong> account is available with this email: <strong>${toEmail}</strong>.
            </p>
            ${temporaryPassword
                ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #334155; line-height: 1.6;">Sign in with this temporary password:</p>
                  <div style="margin: 0 0 18px 0; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-family: ui-monospace, monospace; font-size: 15px; letter-spacing: 0.03em; color: #0f172a;">${safePw}</div>
                  <p style="margin: 0 0 18px 0; font-size: 13px; color: #64748b; line-height: 1.6;">For security, change this password after signing in or use the reset link below to choose a new one.</p>`
                : ""}
            ${passwordSetupUrl
                ? `<p style="margin: 20px 0;">
                    <a href="${escapeHtmlAttr(passwordSetupUrl)}" style="background: #2563eb; color: #fff; padding: 12px 22px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Reset password</a>
                  </p>
                  <p style="font-size: 13px; color: #475569; line-height: 1.6;">
                    Use your email <strong>${toEmail}</strong> together with the link above if prompted.
                  </p>
                  <p style="font-size: 12px; color: #94a3b8; word-break: break-all; margin-top: 10px;">${escapeHtmlText(passwordSetupUrl)}</p>`
                : `<p style="margin: 8px 0 0 0; color: #475569;">You can sign in directly using your existing password.</p>`}
            <p style="margin: 22px 0 0 0; color: #334155;">Best regards,<br/><strong>The BizTradeFairs Team</strong></p>
          </div>
        </div>
      </div>
    `,
    });
}
/** Thank-you after public contact form submit. */
async function sendContactInquiryThankYouEmail(params) {
    const name = escapeHtmlText(params.fullName);
    const type = escapeHtmlText(params.inquiryType);
    await dispatchMail({
        from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
        to: params.to,
        subject: "We received your message — BizTradeFairs",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1d4ed8;">Thank you, ${name}!</h2>
        <p>We've received your inquiry regarding <strong>${type}</strong>.</p>
        <p>Our team will review your message and get back to you as soon as possible, typically within 1–2 business days.</p>
        <p style="color:#64748b;font-size:14px;">If your question is urgent, you can also reach us at
          <a href="mailto:support@biztradefairs.com">support@biztradefairs.com</a>.</p>
        <br/>
        <p>Best regards,<br/><strong>The BizTradeFairs Team</strong></p>
      </div>
    `,
    });
}
/** Optional internal copy — set `CONTACT_NOTIFY_EMAIL` (comma-separated allowed). */
async function sendContactInquiryStaffNotify(params) {
    const raw = process.env.CONTACT_NOTIFY_EMAIL?.trim();
    if (!raw)
        return;
    const recipients = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (recipients.length === 0)
        return;
    const body = [
        `New contact inquiry (${params.inquiryId})`,
        "",
        `Name: ${params.fullName}`,
        `Email: ${params.email}`,
        `Phone: ${params.phone || "—"}`,
        `Type: ${params.inquiryType}`,
        "",
        "Message:",
        params.message,
    ].join("\n");
    const html = `<pre style="font-family:monospace;font-size:13px;white-space:pre-wrap;">${escapeHtmlText(body)}</pre>`;
    for (const to of recipients) {
        // eslint-disable-next-line no-await-in-loop
        await dispatchMail({
            from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
            to,
            subject: `[Contact] ${params.inquiryType} — ${params.fullName}`,
            text: body,
            html,
        });
    }
}
function newsletterAssetUrl(u) {
    if (!u?.trim())
        return null;
    const t = u.trim();
    if (/^https?:\/\//i.test(t))
        return t;
    const base = FRONTEND_BASE.replace(/\/$/, "");
    return `${base}${t.startsWith("/") ? t : `/${t}`}`;
}
function formatNewsletterDateRange(startIso, endIso) {
    try {
        const s = new Date(startIso);
        const e = new Date(endIso);
        const o = { day: "numeric", month: "short", year: "numeric" };
        return `${s.toLocaleDateString("en-GB", o)} – ${e.toLocaleDateString("en-GB", o)}`;
    }
    catch {
        return "";
    }
}
function locationLine(ev) {
    if (ev.isVirtual)
        return "Online event";
    const parts = [ev.venueName, ev.city, ev.state, ev.country].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Venue TBA";
}
function buildNewsletterDigestHtml(events) {
    const base = FRONTEND_BASE.replace(/\/$/, "");
    const blocks = events
        .map((ev) => {
        const title = escapeHtmlText(ev.title);
        const blurb = escapeHtmlText((ev.shortDescription || "").slice(0, 220));
        const when = escapeHtmlText(formatNewsletterDateRange(ev.startDate, ev.endDate));
        const where = escapeHtmlText(locationLine(ev));
        const eventPath = `/event/${encodeURIComponent(ev.slug || ev.id)}`;
        const href = escapeHtmlAttr(`${base}${eventPath}`);
        const imgSrc = newsletterAssetUrl(ev.thumbnailImage || ev.bannerImage);
        const imgBlock = imgSrc
            ? `<a href="${href}" style="text-decoration:none;"><img src="${escapeHtmlAttr(imgSrc)}" alt="" width="520" style="display:block;width:100%;max-width:520px;height:180px;object-fit:cover;border:0;" /></a>`
            : "";
        return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px 0;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
        <tr>
          <td style="padding:0;">
            ${imgBlock}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 16px 16px 16px;font-family:Inter,Segoe UI,Arial,sans-serif;">
            <p style="margin:0 0 6px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Featured event</p>
            <h2 style="margin:0 0 8px 0;font-size:18px;line-height:1.25;color:#0f172a;">
              <a href="${href}" style="color:#1d4ed8;text-decoration:none;">${title}</a>
            </h2>
            <p style="margin:0 0 6px 0;font-size:13px;color:#475569;line-height:1.45;"><strong>When:</strong> ${when}</p>
            <p style="margin:0 0 10px 0;font-size:13px;color:#475569;line-height:1.45;"><strong>Where:</strong> ${where}</p>
            ${blurb ? `<p style="margin:0 0 12px 0;font-size:13px;color:#334155;line-height:1.5;">${blurb}${(ev.shortDescription || "").length > 220 ? "…" : ""}</p>` : ""}
            <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 55%,#0ea5e9 100%);color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;padding:10px 16px;border-radius:9px;">View event details</a>
          </td>
        </tr>
      </table>`;
    })
        .join("\n");
    return `
  <div style="margin:0;padding:0;background:#f1f5f9;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;padding:18px 10px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;">
            <tr>
              <td style="padding:0 0 10px 0;text-align:center;font-family:Inter,Segoe UI,Arial,sans-serif;">
                <p style="margin:0;font-size:12px;color:#64748b;">BizTradeFairs.com</p>
                <h1 style="margin:6px 0 0 0;font-size:19px;line-height:1.25;color:#0f172a;">Events picked for you</h1>
                <p style="margin:6px 0 0 0;font-size:13px;color:#475569;line-height:1.45;">Here are the latest happenings you can explore on our platform.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0;">
                ${blocks}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 8px 0 8px;text-align:center;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:#94a3b8;line-height:1.5;">
                You are receiving this because you subscribed to updates from BizTradeFairs.<br/>
                <a href="${escapeHtmlAttr(`${base}/contact`)}" style="color:#2563eb;">Contact us</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}
/** One personalized digest per subscriber (admin broadcast). */
async function sendNewsletterDigestEmail(params) {
    const html = buildNewsletterDigestHtml(params.events);
    const text = params.events
        .map((e) => `${e.title}\n${FRONTEND_BASE.replace(/\/$/, "")}/event/${encodeURIComponent(e.slug || e.id)}\n${formatNewsletterDateRange(e.startDate, e.endDate)} — ${locationLine(e)}\n`)
        .join("\n---\n");
    await dispatchMail({
        from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
        to: params.to,
        subject: params.subject,
        html,
        text,
    });
}
/** Optional welcome after footer signup. */
async function sendNewsletterWelcomeEmail(to) {
    const base = FRONTEND_BASE.replace(/\/$/, "");
    await dispatchMail({
        from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
        to,
        subject: "You’re subscribed — BizTradeFairs",
        html: `
      <div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="color:#1d4ed8;margin-top:0;">Welcome aboard!</h2>
        <p style="color:#334155;line-height:1.6;">Thanks for subscribing. We’ll occasionally send you curated trade fairs and business events.</p>
        <p style="margin:20px 0;">
          <a href="${escapeHtmlAttr(`${base}/event`)}" style="background:#2563eb;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;">Browse events</a>
        </p>
        <p style="font-size:13px;color:#64748b;">BizTradeFairs.com</p>
      </div>
    `,
        text: `Thanks for subscribing to BizTradeFairs updates.\nBrowse events: ${base}/event\n`,
    });
}
