import prisma from "../config/prisma";
import type { AdminType, Prisma } from "@prisma/client";

type AdminAuth = {
  sub: string;
  role: string;
  domain?: string;
};

export async function recordAdminActivity(
  auth: AdminAuth | undefined,
  payload: {
    action: string;
    resource: string;
    resourceId?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  if (!auth?.sub || auth.domain !== "ADMIN") return;
  const adminType: AdminType = auth.role === "SUB_ADMIN" ? "SUB_ADMIN" : "SUPER_ADMIN";
  await prisma.adminLog.create({
    data: {
      adminId: auth.sub,
      adminType,
      action: payload.action,
      resource: payload.resource,
      resourceId: payload.resourceId ?? null,
      details:
        payload.details != null
          ? (payload.details as Prisma.InputJsonValue)
          : undefined,
    },
  });
}
