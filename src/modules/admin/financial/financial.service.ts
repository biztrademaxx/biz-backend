import prisma from "../../../config/prisma";
import { parseListQuery } from "../../../lib/admin-response";
import { billingKindToPlanType, getCatalogPlan } from "../../subscriptions/plan-catalog";

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

function mapPaymentTxStatus(status: string): string {
  const u = status.toUpperCase();
  if (u === "PAID" || u === "CONSUMED") return "COMPLETED";
  if (u === "FAILED") return "FAILED";
  if (u === "CREATED") return "PENDING";
  return "PENDING";
}

function mapPaymentTxInvoiceStatus(p: {
  status: string;
  createdAt: Date;
}): string {
  const u = p.status.toUpperCase();
  if (u === "PAID" || u === "CONSUMED") return "paid";
  if (u === "FAILED") return "cancelled";
  if (u === "CREATED") {
    const due = new Date(p.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (due < new Date()) return "overdue";
    return "pending";
  }
  return "pending";
}

function paymentTxDescription(p: {
  purpose: string;
  planName: string | null;
  planSlug: string | null;
  subscriptionRole: string | null;
  packageType: string | null;
  promotionChannel: string | null;
}): string {
  if (p.purpose === "SUBSCRIPTION") {
    const name = p.planName ?? p.planSlug ?? "Dashboard plan";
    const role = p.subscriptionRole ? ` (${p.subscriptionRole})` : "";
    return `${name}${role}`;
  }
  if (p.purpose === "PROMOTION") {
    const pkg = p.packageType ?? "Promotion package";
    const channel = p.promotionChannel ? ` — ${p.promotionChannel}` : "";
    return `${pkg}${channel}`;
  }
  return "Payment";
}

function paymentTxType(p: { purpose: string }): string {
  if (p.purpose === "SUBSCRIPTION") return "SUBSCRIPTION";
  if (p.purpose === "PROMOTION") return "PROMOTION";
  return p.purpose.toUpperCase();
}

type PaymentTxWithUser = Awaited<
  ReturnType<typeof prisma.paymentTransaction.findMany<{ include: { user: true } }>>
>[number];

function buildPaymentTxSearchWhere(search: string) {
  if (!search.length) return {};
  return {
    OR: [
      { user: { email: { contains: search, mode: "insensitive" as const } } },
      { user: { firstName: { contains: search, mode: "insensitive" as const } } },
      { user: { lastName: { contains: search, mode: "insensitive" as const } } },
      { razorpayOrderId: { contains: search, mode: "insensitive" as const } },
      { razorpayPaymentId: { contains: search, mode: "insensitive" as const } },
      { planName: { contains: search, mode: "insensitive" as const } },
      { planSlug: { contains: search, mode: "insensitive" as const } },
      { packageType: { contains: search, mode: "insensitive" as const } },
    ],
  };
}

function mapPaymentTxToTransaction(p: PaymentTxWithUser) {
  const u = p.user;
  const st = mapPaymentTxStatus(p.status);
  return {
    id: p.id,
    transactionId:
      p.razorpayPaymentId ?? p.razorpayOrderId ?? `TXN-${p.id.slice(0, 8).toUpperCase()}`,
    userId: p.userId,
    userName: userDisplayName(u),
    userEmail: u.email ?? "",
    amount: p.amountInr,
    currency: p.currency ?? "INR",
    status: st,
    gateway: (p.provider ?? "RAZORPAY").toUpperCase(),
    gatewayTransactionId: p.razorpayPaymentId ?? p.razorpayOrderId,
    description: paymentTxDescription(p),
    type: paymentTxType(p),
    createdAt: (p.paidAt ?? p.createdAt).toISOString(),
    refundAmount: undefined as number | undefined,
    refundReason: undefined as string | undefined,
    refundedAt: undefined as string | undefined,
  };
}

function mapPaymentTxToInvoice(p: PaymentTxWithUser) {
  const u = p.user;
  const invStatus = mapPaymentTxInvoiceStatus(p);
  const amount = p.amountInr;
  const invoiceDate = p.createdAt;
  const dueDate = new Date(p.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const description = paymentTxDescription(p);
  return {
    id: p.id,
    invoiceNumber: `INV-${p.id.slice(0, 8).toUpperCase()}`,
    userId: p.userId,
    userName: userDisplayName(u),
    userEmail: u.email ?? "",
    amount,
    currency: p.currency ?? "INR",
    status: invStatus,
    invoiceDate: invoiceDate.toISOString(),
    dueDate: dueDate.toISOString(),
    paidDate: invStatus === "paid" && p.paidAt ? p.paidAt.toISOString() : undefined,
    paymentMethod: "razorpay",
    description,
    items: [
      {
        description,
        quantity: 1,
        unitPrice: amount,
        total: amount,
      },
    ],
    subtotal: amount,
    tax: 0,
    total: amount,
  };
}

function mapPaymentTxToPayment(p: PaymentTxWithUser) {
  const u = p.user;
  const st = mapPaymentTxStatus(p.status);
  return {
    id: p.id,
    userId: p.userId,
    userName: userDisplayName(u),
    userEmail: u.email ?? "",
    amount: p.amountInr,
    currency: p.currency ?? "INR",
    status: st,
    gateway: (p.provider ?? "RAZORPAY").toUpperCase(),
    gatewayTransactionId: p.razorpayPaymentId ?? p.razorpayOrderId,
    description: paymentTxDescription(p),
    refundAmount: null as number | null,
    refundReason: null as string | null,
    refundedAt: null as string | null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    type: paymentTxType(p),
    eventRegistrationsCount: 0,
    venueBookingsCount: 0,
  };
}

function buildRegistrationSearchWhere(search: string) {
  if (!search.length) return {};
  return {
    OR: [
      { user: { email: { contains: search, mode: "insensitive" as const } } },
      { user: { firstName: { contains: search, mode: "insensitive" as const } } },
      { user: { lastName: { contains: search, mode: "insensitive" as const } } },
      { event: { title: { contains: search, mode: "insensitive" as const } } },
    ],
  };
}

function sortByDateDesc<T extends { createdAt?: string; invoiceDate?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const da = new Date(a.createdAt ?? a.invoiceDate ?? 0).getTime();
    const db = new Date(b.createdAt ?? b.invoiceDate ?? 0).getTime();
    return db - da;
  });
}

export async function listTransactions(query: Record<string, unknown>) {
  const { page, limit, skip, search, status } = parseFinancialListQuery(query);

  const [paymentRows, registrations] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: buildPaymentTxSearchWhere(search),
      orderBy: { createdAt: "desc" },
      include: { user: true },
    }),
    prisma.eventRegistration.findMany({
      where: buildRegistrationSearchWhere(search),
      orderBy: { registeredAt: "desc" },
      include: { user: true, event: { select: { title: true } } },
    }),
  ]);

  let rows = [
    ...paymentRows.map(mapPaymentTxToTransaction),
    ...registrations.map((r) => {
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
    }),
  ];

  if (status && status !== "all") {
    const su = status.toUpperCase();
    rows = rows.filter((t) => t.status === su || t.status === status);
  }

  rows = sortByDateDesc(rows);
  const total = rows.length;
  const data = rows.slice(skip, skip + limit);

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

export async function listPayments(query: Record<string, unknown>) {
  const { page, limit, skip, search, status } = parseFinancialListQuery(query);

  const [paymentRows, registrations] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: buildPaymentTxSearchWhere(search),
      orderBy: { createdAt: "desc" },
      include: { user: true },
    }),
    prisma.eventRegistration.findMany({
      where: buildRegistrationSearchWhere(search),
      orderBy: { registeredAt: "desc" },
      include: { user: true, event: { select: { title: true } } },
    }),
  ]);

  let rows = [
    ...paymentRows.map(mapPaymentTxToPayment),
    ...registrations.map((r) => {
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
        type: "REGISTRATION",
        eventRegistrationsCount: 1,
        venueBookingsCount: 0,
      };
    }),
  ];

  if (status && status !== "all") {
    const su = status.toUpperCase();
    rows = rows.filter((p) => p.status === su || p.status === status);
  }

  rows = sortByDateDesc(rows);
  const total = rows.length;
  const data = rows.slice(skip, skip + limit);

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
  const realCount = await prisma.userPlanSubscription.count();
  if (realCount > 0) return;

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

  const dashboardCount = await prisma.userPlanSubscription.count();
  if (dashboardCount > 0) {
    const whereDash: any = {};
    if (search.length > 0) {
      whereDash.OR = [
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { firstName: { contains: search, mode: "insensitive" } } },
        { user: { lastName: { contains: search, mode: "insensitive" } } },
        { planName: { contains: search, mode: "insensitive" } },
        { planSlug: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status && status !== "all") {
      whereDash.status = status.toUpperCase();
    }

    const [total, subs] = await Promise.all([
      prisma.userPlanSubscription.count({ where: whereDash }),
      prisma.userPlanSubscription.findMany({
        where: whereDash,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { user: true, paymentTransaction: true },
      }),
    ]);

    const data = subs.map((s) => {
      const u = s.user;
      const catalog = getCatalogPlan(s.role, s.planSlug);
      const billingKind = catalog?.billingKind ?? "ONE_TIME";
      const planType = billingKindToPlanType(billingKind);
      const end =
        s.expiresAt ??
        (billingKind === "YEARLY"
          ? new Date(s.startedAt.getTime() + 365 * 24 * 60 * 60 * 1000)
          : null);

      return {
        id: s.id,
        userId: s.userId,
        userName: userDisplayName(u),
        userEmail: u.email ?? "",
        userRole: s.role,
        planName: s.planName,
        planSlug: s.planSlug,
        planType,
        amount: s.amountInr,
        currency: "INR",
        status: s.status as "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAUSED" | "SUPERSEDED",
        startDate: s.startedAt.toISOString(),
        endDate: end?.toISOString() ?? null,
        nextBillingDate: billingKind === "YEARLY" ? end?.toISOString() ?? null : null,
        autoRenew: false,
        paymentMethod: s.paymentTransactionId ? "RAZORPAY" : "FREE",
        transactionId:
          s.paymentTransaction?.razorpayPaymentId ??
          s.paymentTransaction?.razorpayOrderId ??
          (s.paymentTransactionId ? `pay_${s.paymentTransactionId.slice(0, 8)}` : `free_${s.id.slice(0, 8)}`),
        features: catalog ? [catalog.billingNote, `${s.role} dashboard plan`] : ["Dashboard plan"],
        cancelledAt: s.status === "SUPERSEDED" ? s.updatedAt.toISOString() : null,
        cancellationReason: s.status === "SUPERSEDED" ? "Upgraded or changed plan" : null,
        createdAt: s.createdAt.toISOString(),
        source: "DASHBOARD_PLAN" as const,
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

  const [paymentRows, registrations] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: {
        ...buildPaymentTxSearchWhere(search),
        amountInr: { gt: 0 },
      },
      orderBy: { createdAt: "desc" },
      include: { user: true },
    }),
    prisma.eventRegistration.findMany({
      where: buildRegistrationSearchWhere(search),
      orderBy: { registeredAt: "desc" },
      include: { user: true, event: { select: { title: true } } },
    }),
  ]);

  let rows = [
    ...paymentRows.map(mapPaymentTxToInvoice),
    ...registrations.map((r) => {
      const u = r.user;
      const invStatus = mapInvoiceStatus(r.status);
      const amount = r.totalAmount ?? 0;
      const qty = r.quantity ?? 1;
      const unit = qty > 0 ? amount / qty : amount;
      return {
        id: r.id,
        invoiceNumber: `INV-REG-${r.id.slice(0, 8).toUpperCase()}`,
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
    }),
  ];

  if (status && status !== "all") {
    rows = rows.filter((inv) => inv.status === status);
  }

  rows = sortByDateDesc(rows);
  const total = rows.length;
  const data = rows.slice(skip, skip + limit);

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
