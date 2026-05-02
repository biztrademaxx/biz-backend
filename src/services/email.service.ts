import nodemailer from "nodemailer";
import { Resend } from "resend";
import { Agent, fetch as undiciFetch } from "undici";

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

/** Read at call time so `dotenv` / `load-env` runs before any import of this module. */
function getResendApiKey(): string {
  return (process.env.RESEND_API_KEY ?? "").trim();
}

function getResendFromEmail(): string | undefined {
  return process.env.RESEND_FROM_EMAIL?.trim();
}

function getSendGridApiKey(): string {
  return (process.env.SENDGRID_API_KEY ?? "").trim();
}

/** Bare email used inside `"BizTradeFairs" <…>` — Resend vs SendGrid vs SMTP. */
function getEffectiveFromEmail(): string | undefined {
  if (getResendApiKey()) {
    const r = getResendFromEmail();
    if (r) return r;
  }
  const fromSg = process.env.SENDGRID_FROM_EMAIL?.trim();
  if (fromSg) return fromSg;
  const u = process.env.EMAIL_USER?.trim();
  return u || undefined;
}

/** Escape dynamic fragments embedded in HTML emails. */
function escapeHtmlMail(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function mailConfigured(): boolean {
  if (getResendApiKey()) return !!getResendFromEmail();
  if (getSendGridApiKey()) return !!getEffectiveFromEmail();
  return !!(process.env.EMAIL_USER?.trim() && process.env.EMAIL_PASS);
}

if (!mailConfigured() && process.env.NODE_ENV !== "test") {
  // eslint-disable-next-line no-console
  console.warn(
    "[email.service] Set RESEND_API_KEY + RESEND_FROM_EMAIL (e.g. noreply@yourdomain.com), or SENDGRID_* , or EMAIL_USER + EMAIL_PASS (Gmail SMTP).",
  );
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  /** Fail fast; long SMTP hangs cause nginx 504 on routes that await sendMail (e.g. send-otp). */
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 20_000,
});

/** Undici default connect timeout is 10s; small VPS / flaky routes can hit UND_ERR_CONNECT_TIMEOUT. */
const sendgridAgent = new Agent({
  connect: { timeout: 30_000 },
  headersTimeout: 45_000,
  bodyTimeout: 45_000,
});

function parseFromHeader(from: string): { name?: string; email: string } {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) {
    const name = m[1].trim();
    return { email: m[2].trim(), ...(name ? { name } : {}) };
  }
  return { email: from.trim() };
}

function requireMailConfig(): void {
  if (getResendApiKey()) {
    if (!getResendFromEmail()) {
      throw new Error(
        "Set RESEND_FROM_EMAIL (address on a domain verified in Resend), e.g. noreply@biztradefairs.com.",
      );
    }
    return;
  }
  if (getSendGridApiKey()) {
    if (!getEffectiveFromEmail()) {
      throw new Error(
        "Set SENDGRID_FROM_EMAIL (verified sender in SendGrid) or EMAIL_USER when using SENDGRID_API_KEY.",
      );
    }
    return;
  }
  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error("Email credentials are not configured");
  }
}

type MailAttachment = { filename: string; content: Buffer; contentType?: string };

async function sendViaResend(opts: {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: MailAttachment[];
}): Promise<void> {
  const apiKey = getResendApiKey();
  if (!opts.html && !opts.text) {
    throw new Error("Email must include html or text content");
  }

  const resend = new Resend(apiKey);
  const base = {
    from: opts.from.trim(),
    to: opts.to,
    subject: opts.subject,
  };
  const attachments =
    opts.attachments?.map((a) => ({
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
    } else {
      result = await resend.emails.send({
        ...base,
        text: opts.text!,
        ...(attachments.length ? { attachments } : {}),
      });
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    // eslint-disable-next-line no-console
    console.error("[email.service] Resend request failed:", err);
    throw new Error(`Resend network error: ${err.message}`);
  }

  if (result.error) {
    const er = result.error;
    // eslint-disable-next-line no-console
    console.error("[email.service] Resend API error:", er);
    throw new Error(
      `Resend error ${er.statusCode ?? "?"}: ${er.message}${er.name ? ` (${er.name})` : ""}`,
    );
  }
}

async function sendViaSendGrid(opts: {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: MailAttachment[];
}): Promise<void> {
  const fromParsed = parseFromHeader(opts.from);
  const fromEmail = getEffectiveFromEmail() || fromParsed.email || EMAIL_USER;
  if (!fromEmail) {
    throw new Error("Missing sender email for SendGrid.");
  }

  const content: Array<{ type: string; value: string }> = [];
  if (opts.text) {
    content.push({ type: "text/plain", value: opts.text });
  }
  if (opts.html) {
    content.push({ type: "text/html", value: opts.html });
  }
  if (content.length === 0) {
    throw new Error("Email must include html or text content");
  }

  const body: Record<string, unknown> = {
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

  let res: Awaited<ReturnType<typeof undiciFetch>>;
  try {
    res = await undiciFetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getSendGridApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      dispatcher: sendgridAgent,
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    // eslint-disable-next-line no-console
    console.error("[email.service] SendGrid fetch failed:", err);
    throw new Error(`SendGrid network error: ${err.message}`);
  }

  if (!res.ok) {
    const errText = await res.text();
    let summary = errText.slice(0, 800);
    try {
      const parsed = JSON.parse(errText) as { errors?: Array<{ message?: string }> };
      if (parsed.errors?.length) {
        summary = parsed.errors.map((e) => e.message).filter(Boolean).join("; ") || summary;
      }
    } catch {
      /* keep raw text */
    }
    // eslint-disable-next-line no-console
    console.error("[email.service] SendGrid HTTP", res.status, errText.slice(0, 2000));
    throw new Error(`SendGrid error ${res.status}: ${summary}`);
  }
}

async function dispatchMail(opts: {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: MailAttachment[];
}): Promise<void> {
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

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
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

export async function sendBadgeEmail(
  email: string,
  badgeDataUrl: string,
  attendeeName: string,
  eventName: string
): Promise<void> {
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

export async function sendVerificationEmail(email: string, otp: string): Promise<void> {
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

function parseFrontendBases(): string[] {
  const raw =
    process.env.FRONTEND_URL?.trim() ||
    process.env.APP_PUBLIC_URL?.trim() ||
    "http://localhost:3000";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\/$/, ""));
}

export function resolveFrontendBase(preferredOrigin?: string): string {
  const bases = parseFrontendBases();
  if (preferredOrigin) {
    const normalized = preferredOrigin.replace(/\/$/, "");
    if (bases.includes(normalized)) return normalized;
  }
  return bases[0] || "http://localhost:3000";
}

const FRONTEND_BASE = resolveFrontendBase();

export async function sendPasswordResetLinkEmail(params: {
  toEmail: string;
  resetUrl: string;
  firstName: string;
  roleLabel: string;
}): Promise<void> {
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
export async function sendAdminPasswordResetOtpEmail(params: {
  toEmail: string;
  otp: string;
  name: string;
  adminKind: "Super Admin" | "Sub Admin";
}): Promise<void> {
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

export { FRONTEND_BASE };

/** Sent after bulk event import finishes — one email per organizer with event titles. */
export async function sendEventImportThankYouEmail(params: {
  toEmail: string;
  firstName: string;
  eventTitles: string[];
  setPasswordUrl?: string;
  /** Shown in email when email is not verified — together with reset link. */
  tempPassword?: string;
}): Promise<void> {
  const { toEmail, firstName, eventTitles, setPasswordUrl, tempPassword } = params;
  const pwdPlain = tempPassword?.trim() ? tempPassword.trim() : "";
  const pwdHtml = pwdPlain ? escapeHtmlMail(pwdPlain) : "";
  const listHtml = eventTitles
    .map(
      (t) =>
        `<li style="margin: 8px 0; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">${String(
          t
        ).replace(/</g, "&lt;")}</li>`
    )
    .join("");

  const textLines = [
    `Hello ${firstName || "there"},`,
    "",
    "The following event(s) have been added on your behalf:",
    ...eventTitles.map((t) => `• ${t}`),
    "",
  ];
  if (pwdPlain || setPasswordUrl) {
    textLines.push("Your sign-in details:", `Email: ${toEmail}`);
    if (pwdPlain) textLines.push(`Temporary password: ${pwdPlain}`, "");
    if (setPasswordUrl) textLines.push(`Reset password (choose your own): ${setPasswordUrl}`, "");
  }
  textLines.push("Best regards,", "The BizTradeFairs Team");

  await dispatchMail({
    from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
    to: toEmail,
    subject: `Your events were imported (${eventTitles.length})`,
    text: textLines.join("\n"),
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
        ${
          pwdPlain || setPasswordUrl
            ? `<div style="margin: 22px 0; padding: 16px 18px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 10px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #0f172a;"><strong>Your sign-in details</strong></p>
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;">Email: <strong>${escapeHtmlMail(toEmail)}</strong></p>
              ${
                pwdPlain
                  ? `<p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;">Temporary password:</p>
                    <p style="margin: 4px 0 8px 0; font-size: 15px;">
                      <code style="padding: 8px 12px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #0f172a;">${pwdHtml}</code>
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">For security, change this password after you sign in, or use reset password below.</p>`
                  : ""
              }
            </div>
            ${
              setPasswordUrl
                ? `<p style="margin: 18px 0;">
                    <a href="${setPasswordUrl}" style="background: #2563eb; color: #fff; padding: 12px 22px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Reset password</a>
                  </p>
                  <p style="font-size: 13px; color: #475569; line-height: 1.6;">Prefer to pick your own password? Click the button above (link expires in 7 days).</p>
                  <p style="font-size: 12px; color: #94a3b8; word-break: break-all; margin-top: 6px;">${setPasswordUrl}</p>`
                : ""
            }`
            : `<p style="margin: 8px 0 0 0; color: #475569;">You can sign in with this email address to manage your events.</p>`
        }
            <p style="margin: 22px 0 0 0; color: #334155;">Best regards,<br/><strong>The BizTradeFairs Team</strong></p>
          </div>
        </div>
      </div>
    `,
  });
}

export async function sendMarketingEmail(params: {
  to: string;
  subject: string;
  content: string;
  htmlContent?: string;
}): Promise<void> {
  const html =
    params.htmlContent ||
    `<div style="font-family: Arial, sans-serif; line-height: 1.6; white-space: pre-wrap;">${params.content}</div>`;

  await dispatchMail({
    from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
    to: params.to,
    subject: params.subject,
    text: params.content,
    html,
  });
}

export async function sendEventListingThankYouEmail(params: {
  toEmail: string;
  firstName: string;
  eventTitles: string[];
  setPasswordUrl?: string;
  /** Plain-text temporary password to display in the email (admin-created accounts only). */
  tempPassword?: string;
}): Promise<void> {
  const { toEmail, firstName, eventTitles, setPasswordUrl, tempPassword } = params;
  const pwdPlain = tempPassword?.trim() ? tempPassword.trim() : "";
  const pwdHtml = pwdPlain ? escapeHtmlMail(pwdPlain) : "";
  const listHtml = eventTitles
    .map(
      (t) =>
        `<li style="margin: 8px 0; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">${String(
          t
        ).replace(/</g, "&lt;")}</li>`
    )
    .join("");

  const textLines = [
    `Hello ${firstName || "there"},`,
    "",
    "Your event listing has been processed. Events:",
    ...eventTitles.map((t) => `• ${t}`),
    "",
  ];
  if (pwdPlain || setPasswordUrl) {
    textLines.push("Your sign-in details:", `Email: ${toEmail}`);
    if (pwdPlain) textLines.push(`Temporary password: ${pwdPlain}`, "");
    if (setPasswordUrl) textLines.push(`Reset password (choose your own): ${setPasswordUrl}`, "");
  }
  textLines.push("Best regards,", "The BizTradeFairs Team");

  await dispatchMail({
    from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
    to: toEmail,
    subject: `Event listing update (${eventTitles.length})`,
    text: textLines.join("\n"),
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background: #f1f5f9; padding: 24px;">
        <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #0ea5e9 100%); color: #ffffff; padding: 22px 24px;">
            <h2 style="margin: 0; font-size: 22px; line-height: 1.3;">Event Listing Update</h2>
            <p style="margin: 8px 0 0 0; opacity: 0.92; font-size: 14px;">Your event details were processed successfully.</p>
          </div>

          <div style="padding: 22px 24px;">
            <p style="margin: 0 0 12px 0; color: #0f172a;">Hello <strong>${firstName || "there"}</strong>,</p>
            <p style="margin: 0 0 14px 0; color: #334155; line-height: 1.6;">
              Your event listing has been processed. Events:
            </p>
            <ul style="padding: 0; margin: 0 0 18px 0; list-style: none;">${listHtml}</ul>
        ${
          pwdPlain || setPasswordUrl
            ? `<div style="margin: 22px 0; padding: 16px 18px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 10px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #0f172a;"><strong>Your sign-in details</strong></p>
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;">Email: <strong>${escapeHtmlMail(toEmail)}</strong></p>
              ${
                pwdPlain
                  ? `<p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;">Temporary password:</p>
                    <p style="margin: 4px 0 8px 0; font-size: 15px;">
                      <code style="padding: 8px 12px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #0f172a;">${pwdHtml}</code>
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">For security, change this password after you sign in, or use reset password below.</p>`
                  : ""
              }
            </div>
            ${
              setPasswordUrl
                ? `<p style="margin: 18px 0;">
                    <a href="${setPasswordUrl}" style="background: #2563eb; color: #fff; padding: 12px 22px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Reset password</a>
                  </p>
                  <p style="font-size: 13px; color: #475569; line-height: 1.6;">Prefer to pick your own password? Click the button above (link expires in 7 days).</p>
                  <p style="font-size: 12px; color: #94a3b8; word-break: break-all; margin-top: 6px;">${setPasswordUrl}</p>`
                : ""
            }`
            : ""
        }
            <p style="margin: 22px 0 0 0; color: #334155;">Best regards,<br/><strong>The BizTradeFairs Team</strong></p>
          </div>
        </div>
      </div>
    `,
  });
}

export async function sendUserAccountAccessEmail(params: {
  toEmail: string;
  firstName: string;
  roleLabel: "Organizer" | "Venue Manager";
  setPasswordUrl?: string;
  /** When email is not verified — shown together with reset link. */
  tempPassword?: string;
}): Promise<void> {
  const { toEmail, firstName, roleLabel, setPasswordUrl, tempPassword } = params;
  const pwdPlain = tempPassword?.trim() ? tempPassword.trim() : "";
  const pwdHtml = pwdPlain ? escapeHtmlMail(pwdPlain) : "";

  const textLines = [`Hello ${firstName || "there"},`, ""];
  textLines.push(
    `Your ${roleLabel} account uses this email: ${toEmail}.`,
    "",
  );
  if (pwdPlain || setPasswordUrl) {
    textLines.push("Your sign-in details:", `Email: ${toEmail}`);
    if (pwdPlain) textLines.push(`Temporary password: ${pwdPlain}`, "");
    if (setPasswordUrl) textLines.push(`Reset password (choose your own): ${setPasswordUrl}`, "");
  } else {
    textLines.push("You can sign in with your existing password.", "");
  }
  textLines.push("Best regards,", "The BizTradeFairs Team");

  await dispatchMail({
    from: `"BizTradeFairs" <${getEffectiveFromEmail()}>`,
    to: toEmail,
    subject: `${roleLabel} account access details`,
    text: textLines.join("\n"),
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background: #f1f5f9; padding: 24px;">
        <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #0ea5e9 100%); color: #ffffff; padding: 22px 24px;">
            <h2 style="margin: 0; font-size: 22px; line-height: 1.3;">${roleLabel} Account Update</h2>
            <p style="margin: 8px 0 0 0; opacity: 0.92; font-size: 14px;">Your account details are ready on BizTradeFairs.</p>
          </div>
          <div style="padding: 22px 24px;">
            <p style="margin: 0 0 12px 0; color: #0f172a;">Hello <strong>${firstName || "there"}</strong>,</p>
            <p style="margin: 0 0 14px 0; color: #334155; line-height: 1.6;">
              Your <strong>${roleLabel}</strong> account is available with this email: <strong>${escapeHtmlMail(toEmail)}</strong>.
            </p>
            ${
              pwdPlain || setPasswordUrl
                ? `<div style="margin: 18px 0; padding: 16px 18px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 10px;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #0f172a;"><strong>Your sign-in details</strong></p>
                    <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;">Email: <strong>${escapeHtmlMail(toEmail)}</strong></p>
                    ${
                      pwdPlain
                        ? `<p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;">Temporary password:</p>
                          <p style="margin: 4px 0 8px 0; font-size: 15px;">
                            <code style="padding: 8px 12px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #0f172a;">${pwdHtml}</code>
                          </p>
                          <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">Change this after sign-in or use reset password below.</p>`
                        : ""
                    }
                  </div>
                  ${
                    setPasswordUrl
                      ? `<p style="margin: 18px 0;">
                          <a href="${setPasswordUrl}" style="background: #2563eb; color: #fff; padding: 12px 22px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Reset password</a>
                        </p>
                        <p style="font-size: 13px; color: #475569; line-height: 1.6;">
                          Verify your email and choose your own password (link expires in 7 days).
                        </p>
                        <p style="font-size: 12px; color: #94a3b8; word-break: break-all; margin-top: 6px;">${setPasswordUrl}</p>`
                      : ""
                  }`
                : `<p style="margin: 8px 0 0 0; color: #475569;">You can sign in directly using your existing password.</p>`
            }
            <p style="margin: 22px 0 0 0; color: #334155;">Best regards,<br/><strong>The BizTradeFairs Team</strong></p>
          </div>
        </div>
      </div>
    `,
  });
}

