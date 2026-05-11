import prisma from "../../../config/prisma";
import { parseListQuery } from "../../../lib/admin-response";

/** Admin financial UIs filter client-side; allow larger page sizes. */
function parseFinancialListQuery(query: Record<string, unknown>) {
  const base = parseListQuery(query);
  const limit = Math.min(500, Math.max(1, Number(query.limit) || 200));
  const page = Math.max(1, Number(query.page) || 1);
  const skip = (page - 1) * limit;
  return { ...base, page, limit, skip };
}

function mapRegPaymentStatus(raw: string | null | undefined): string {
  const u = (raw ?? "").toUpperCase();
  if (["CONFIRMED", "COMPLETED", "PAID", "SUCCESS", "ACTIVE"].includes(u)) return "COMPLETED";
  if (["FAILED", "DECLINED"].includes(u)) return "FAILED";
  if (["CANCELLED", "CANCELED"].includes(u)) return "CANCELLED";
  if (["REFUNDED"].includes(u)) return "REFUNDED";
  if (["PARTIALLY_REFUNDED", "PARTIAL_REFUND"].includes(u)) return "PARTIALLY_REFUNDED";
  return "PENDING";
}

function mapInvoiceStatus(raw: string | null | undefined): string {
  const s = mapRegPaymentStatus(raw);
  if (s === "COMPLETED") return "paid";
  if (s === "CANCELLED") return "cancelled";
  if (s === "FAILED") return "cancelled";
  return "pending";
}

function userDisplayName(u: { firstName: string; lastName: string; email: string | null }) {
  const n = `${u.firstName} ${u.lastName}`.trim();
  return n || u.email || "User";
}

export async function listTransactions(query: Record<string, unknown>) {
  const { page, limit, skip, search, status } = parseFinancialListQuery(query);

  const searchFilter =
    search.length > 0
      ? {
          OR: [
            { user: { email: { contains: search, mode: "insensitive" as const } } },
            { user: { firstName: { contains: search, mode: "insensitive" as const } } },
            { user: { lastName: { contains: search, mode: "insensitive" as const } } },
            { event: { title: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {};

  const where: any = { ...searchFilter };

  const [total, registrations] = await Promise.all([
    prisma.eventRegistration.count({ where }),
    prisma.eventRegistration.findMany({
      where,
      skip,
      take: limit,
      orderBy: { registeredAt: "desc" },
      include: { user: true, event: { select: { title: true } } },
    }),
  ]);

  let rows = registrations.map((r) => {
    const st = mapRegPaymentStatus(r.status);
    const u = r.user;
    return {
      id: r.id,
      transactionId: `TXN-REG-${r.id.slice(0, 8)}`,
      userId: r.userId,
      userName: userDisplayName(u),
      userEmail: u.email ?? "",
      amount: r.totalAmount ?? 0,
      currency: r.currency ?? "USD",
      status: st,
      gateway: "STRIPE",
      gatewayTransactionId: `ch_reg_${r.id.replace(/-/g, "").slice(0, 24)}`,
      description: r.event?.title ? `Event registration: ${r.event.title}` : "Event registration",
      type: "REGISTRATION",
      createdAt: r.registeredAt.toISOString(),
      refundAmount: undefined as number | undefined,
      refundReason: undefined as string | undefined,
      refundedAt: undefined as string | undefined,
    };
  });

  if (status && status !== "all") {
    const su = status.toUpperCase();
    rows = rows.filter((t) => t.status === su || t.status === status);
  }

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function listPayments(query: Record<string, unknown>) {
  const { page, limit, skip, search, status } = parseFinancialListQuery(query);

  const searchFilter =
    search.length > 0
      ? {
          OR: [
            { user: { email: { contains: search, mode: "insensitive" as const } } },
            { user: { firstName: { contains: search, mode: "insensitive" as const } } },
            { user: { lastName: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {};

  const where: any = { ...searchFilter };

  const [total, rows] = await Promise.all([
    prisma.eventRegistration.count({ where }),
    prisma.eventRegistration.findMany({
      where,
      skip,
      take: limit,
      orderBy: { registeredAt: "desc" },
      include: { user: true, event: { select: { title: true } } },
    }),
  ]);

  const data = rows.map((r) => {
    const st = mapRegPaymentStatus(r.status);
    const u = r.user;
    return {
      id: r.id,
      userId: r.userId,
      userName: userDisplayName(u),
      userEmail: u.email ?? "",
      amount: r.totalAmount ?? 0,
      currency: r.currency ?? "USD",
      status: st,
      gateway: "STRIPE",
      gatewayTransactionId: `ch_reg_${r.id.replace(/-/g, "").slice(0, 24)}`,
      description: r.event?.title ? `Registration — ${r.event.title}` : "Event registration",
      refundAmount: st === "REFUNDED" || st === "PARTIALLY_REFUNDED" ? r.totalAmount ?? 0 : null,
      refundReason: null as string | null,
      refundedAt: null as string | null,
      createdAt: r.registeredAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      eventRegistrationsCount: 1,
      venueBookingsCount: 0,
    };
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

async function ensureSubscriptionPlans() {
  const n = await prisma.adminSubscriptionPlan.count();
  if (n > 0) return;
  await prisma.adminSubscriptionPlan.createMany({
    data: [
      {
        name: "Starter",
        description: "Essential tools for small organizers",
        price: 29,
        currency: "USD",
        interval: "MONTHLY",
        features: ["Up to 3 events", "Email support", "Basic analytics"],
        active: true,
      },
      {
        name: "Professional",
        description: "Growth-focused plan",
        price: 99,
        currency: "USD",
        interval: "MONTHLY",
        features: ["Unlimited events", "Priority support", "Advanced analytics", "API access"],
        active: true,
      },
      {
        name: "Enterprise",
        description: "Annual billing, dedicated success",
        price: 999,
        currency: "USD",
        interval: "YEARLY",
        features: ["Everything in Pro", "SLA", "Dedicated CSM"],
        active: true,
      },
    ],
  });
}

async function seedDemoSubscriptionsIfEmpty() {
  const c = await prisma.adminUserSubscription.count();
  if (c > 0) return;
  const plans = await prisma.adminSubscriptionPlan.findMany({ take: 1, orderBy: { price: "asc" } });
  if (!plans.length) return;
  const organizers = await prisma.user.findMany({
    where: { role: "ORGANIZER" },
    take: 5,
    orderBy: { createdAt: "asc" },
  });
  const planId = plans[0].id;
  const renews = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  for (const u of organizers) {
    await prisma.adminUserSubscription.create({
      data: {
        userId: u.id,
        planId,
        status: "ACTIVE",
        renewsAt: renews,
        autoRenew: true,
      },
    });
  }
}

export async function listSubscriptions(query: Record<string, unknown>) {
  await ensureSubscriptionPlans();
  await seedDemoSubscriptionsIfEmpty();
  const { page, limit, skip, search, status } = parseFinancialListQuery(query);

  const whereSubs: any = {};
  if (search.length > 0) {
    whereSubs.OR = [
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { firstName: { contains: search, mode: "insensitive" } } },
      { user: { lastName: { contains: search, mode: "insensitive" } } },
      { plan: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (status && status !== "all") {
    whereSubs.status = status.toUpperCase();
  }

  const [total, subs] = await Promise.all([
    prisma.adminUserSubscription.count({ where: whereSubs }),
    prisma.adminUserSubscription.findMany({
      where: whereSubs,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: true, plan: true },
    }),
  ]);

  const planTypeMap: Record<string, "MONTHLY" | "YEARLY" | "QUARTERLY"> = {
    MONTHLY: "MONTHLY",
    YEARLY: "YEARLY",
    QUARTERLY: "QUARTERLY",
  };

  const data = subs.map((s) => {
    const u = s.user;
    const p = s.plan;
    const feats = Array.isArray(p.features) ? (p.features as string[]) : [];
    const interval = planTypeMap[p.interval] ?? "MONTHLY";
    const end = s.renewsAt ?? new Date(s.startedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      id: s.id,
      userId: s.userId,
      userName: userDisplayName(u),
      userEmail: u.email ?? "",
      userRole: u.role,
      planName: p.name,
      planType: interval,
      amount: p.price,
      currency: p.currency,
      status: s.status as "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAUSED",
      startDate: s.startedAt.toISOString(),
      endDate: end.toISOString(),
      nextBillingDate: s.renewsAt?.toISOString() ?? null,
      autoRenew: s.autoRenew,
      paymentMethod: "CARD",
      transactionId: `sub_${s.id.slice(0, 8)}`,
      features: feats.length ? feats : ["Included features"],
      cancelledAt: null as string | null,
      cancellationReason: null as string | null,
      createdAt: s.createdAt.toISOString(),
    };
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function listInvoices(query: Record<string, unknown>) {
  const { page, limit, skip, search, status } = parseFinancialListQuery(query);

  const searchFilter =
    search.length > 0
      ? {
          OR: [
            { user: { email: { contains: search, mode: "insensitive" as const } } },
            { user: { firstName: { contains: search, mode: "insensitive" as const } } },
            { user: { lastName: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {};

  const where: any = { ...searchFilter };

  const [total, rows] = await Promise.all([
    prisma.eventRegistration.count({ where }),
    prisma.eventRegistration.findMany({
      where,
      skip,
      take: limit,
      orderBy: { registeredAt: "desc" },
      include: { user: true, event: { select: { title: true } } },
    }),
  ]);

  const data = rows.map((r) => {
    const u = r.user;
    const invStatus = mapInvoiceStatus(r.status);
    const amount = r.totalAmount ?? 0;
    const qty = r.quantity ?? 1;
    const unit = qty > 0 ? amount / qty : amount;
    return {
      id: r.id,
      invoiceNumber: `INV-${r.id.slice(0, 8).toUpperCase()}`,
      userId: r.userId,
      userName: userDisplayName(u),
      userEmail: u.email ?? "",
      amount,
      currency: r.currency ?? "USD",
      status: invStatus,
      invoiceDate: r.registeredAt.toISOString(),
      dueDate: r.registeredAt.toISOString(),
      paidDate: invStatus === "paid" ? r.updatedAt.toISOString() : undefined,
      paymentMethod: "card",
      description: r.event?.title ? `Ticket — ${r.event.title}` : "Event ticket",
      items: [
        {
          description: r.event?.title ?? "Event registration",
          quantity: qty,
          unitPrice: unit,
          total: amount,
        },
      ],
      subtotal: amount,
      tax: 0,
      total: amount,
    };
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function listPromotionPackages(query: Record<string, unknown>) {
  const { page, limit, skip, search, status } = parseFinancialListQuery(query);
  const where: any = {};
  if (search.length > 0) {
    where.OR = [
      { packageType: { contains: search, mode: "insensitive" } },
      { organizer: { email: { contains: search, mode: "insensitive" } } },
      { exhibitor: { email: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (status && status !== "all") {
    where.status = status.toUpperCase();
  }

  const [total, rows] = await Promise.all([
    prisma.promotion.count({ where }),
    prisma.promotion.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        organizer: { select: { firstName: true, lastName: true, email: true } },
        exhibitor: { select: { firstName: true, lastName: true, email: true } },
        event: { select: { title: true } },
      },
    }),
  ]);

  const data = rows.map((p) => ({
    id: p.id,
    packageType: p.packageType,
    buyerType: p.organizerId ? "ORGANIZER" : p.exhibitorId ? "EXHIBITOR" : "UNKNOWN",
    buyerName: p.organizer
      ? userDisplayName(p.organizer)
      : p.exhibitor
        ? userDisplayName(p.exhibitor)
        : "—",
    eventTitle: p.event?.title ?? "—",
    amount: p.amount,
    status: p.status,
    durationDays: p.duration,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    impressions: p.impressions,
    clicks: p.clicks,
    conversions: p.conversions,
    createdAt: p.createdAt.toISOString(),
  }));

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
