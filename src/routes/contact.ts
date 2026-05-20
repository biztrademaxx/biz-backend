import { Request, Response, Router } from "express";
import prisma from "../config/prisma";
import {
  sendContactInquiryStaffNotify,
  sendContactInquiryThankYouEmail,
} from "../services/email.service";

const router = Router();

const INQUIRY_TYPES = new Set(["Organizer", "Exhibitor", "Visitor", "Partnership"]);

function normalizeEmail(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  if (!t || t.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  return t;
}

/**
 * POST /api/contact/inquiries
 * Public: save contact form + send thank-you email when mail is configured.
 */
router.post("/contact/inquiries", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = normalizeEmail(body.email);
    const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
    const phone = phoneRaw.length > 0 ? phoneRaw.slice(0, 40) : null;
    const inquiryType = typeof body.inquiryType === "string" ? body.inquiryType.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!fullName || fullName.length > 200) {
      res.status(400).json({ success: false, error: "Please enter your full name." });
      return;
    }
    if (!email) {
      res.status(400).json({ success: false, error: "Please enter a valid email address." });
      return;
    }
    if (!INQUIRY_TYPES.has(inquiryType)) {
      res.status(400).json({ success: false, error: "Please choose a valid inquiry type." });
      return;
    }
    if (!message || message.length > 20000) {
      res.status(400).json({ success: false, error: "Please enter a message (max 20,000 characters)." });
      return;
    }

    const row = await prisma.contactInquiry.create({
      data: {
        fullName,
        email,
        phone,
        inquiryType,
        message,
        thankYouSent: false,
      },
    });

    let thankYouSent = false;
    let emailError: string | undefined;

    try {
      await sendContactInquiryThankYouEmail({
        to: email,
        fullName,
        inquiryType,
      });
      thankYouSent = true;
      await prisma.contactInquiry.update({
        where: { id: row.id },
        data: { thankYouSent: true },
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[contact/inquiries] thank-you email failed", e);
      emailError = "We saved your message but could not send the confirmation email. Our team will still reply by email.";
    }

    try {
      await sendContactInquiryStaffNotify({
        fullName,
        email,
        phone,
        inquiryType,
        message,
        inquiryId: row.id,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[contact/inquiries] staff notify failed", e);
    }

    res.status(201).json({
      success: true,
      id: row.id,
      thankYouSent,
      ...(emailError ? { warning: emailError } : {}),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("contact/inquiries", e);
    res.status(500).json({ success: false, error: "Could not submit your inquiry. Please try again later." });
  }
});

export default router;
