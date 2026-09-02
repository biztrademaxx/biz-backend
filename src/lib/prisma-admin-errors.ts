import { Response } from "express";
import { Prisma } from "@prisma/client";
import { sendError } from "./admin-response";

/** Send an appropriate JSON error for admin route handlers. Always ends the response. */
export function respondWithAdminError(res: Response, e: unknown, fallback500: string): void {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      sendError(
        res,
        400,
        "A record with this unique value already exists (e.g. duplicate slug).",
        e.meta ? JSON.stringify(e.meta) : undefined,
      );
      return;
    }
    if (e.code === "P2021" || e.code === "P2022") {
      sendError(
        res,
        503,
        "Database schema is out of date. From the backend folder run: npx prisma migrate deploy",
        e.message,
      );
      return;
    }
  }

  const msg =
    e instanceof Error ? e.message : typeof e === "string" ? e : fallback500;

  if (
    msg.includes("Name is required") ||
    msg.includes("Could not derive slug") ||
    msg.includes("Role is required") ||
    msg.includes("Unknown or inactive role")
  ) {
    sendError(res, 400, msg);
    return;
  }

  if (
    msg.includes("already exists") ||
    msg.includes("already in use") ||
    msg.includes("Cannot change") ||
    msg.includes("Cannot delete") ||
    msg.includes("sub-admin(s) use this role")
  ) {
    sendError(res, 400, msg);
    return;
  }

  if (
    msg.includes("does not exist") &&
    (msg.includes("admin_role_definitions") || msg.includes("relation") || msg.includes("table"))
  ) {
    sendError(
      res,
      503,
      "Database schema is out of date. From the backend folder run: npx prisma migrate deploy",
      msg,
    );
    return;
  }

  sendError(res, 500, fallback500, msg);
}
