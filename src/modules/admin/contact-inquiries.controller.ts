import { Request, Response } from "express";
import prisma from "../../config/prisma";

/**
 * GET /api/admin/contact-inquiries?limit=&offset=
 * Lists public contact form rows (newest first).
 */
export async function listContactInquiriesHandler(req: Request, res: Response) {
  try {
    const limitRaw = req.query.limit;
    const offsetRaw = req.query.offset;
    const limit = Math.min(500, Math.max(1, parseInt(String(limitRaw ?? "100"), 10) || 100));
    const offset = Math.max(0, parseInt(String(offsetRaw ?? "0"), 10) || 0);

    const [rows, total] = await Promise.all([
      prisma.contactInquiry.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.contactInquiry.count(),
    ]);

    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        inquiryType: r.inquiryType,
        message: r.message,
        thankYouSent: r.thankYouSent,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("admin contact-inquiries", e);
    res.status(500).json({ success: false, error: "Failed to load contact inquiries" });
  }
}
