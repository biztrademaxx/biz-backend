"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransactions = listTransactions;
exports.listPayments = listPayments;
exports.listSubscriptions = listSubscriptions;
exports.listInvoices = listInvoices;
exports.listPromotionPackages = listPromotionPackages;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const admin_response_1 = require("../../../lib/admin-response");
/** Admin financial UIs filter client-side; allow larger page sizes. */
function parseFinancialListQuery(query) {
    const base = (0, admin_response_1.parseListQuery)(query);
    const limit = Math.min(500, Math.max(1, Number(query.limit) || 200));
    const page = Math.max(1, Number(query.page) || 1);
    const skip = (page - 1) * limit;
    return { ...base, page, limit, skip };
}
function mapRegPaymentStatus(raw) {
    const u = (raw ?? "").toUpperCase();
    if (["CONFIRMED", "COMPLETED", "PAID", "SUCCESS", "ACTIVE"].includes(u))
        return "COMPLETED";
    if (["FAILED", "DECLINED"].includes(u))
        return "FAILED";
    if (["CANCELLED", "CANCELED"].includes(u))
        return "CANCELLED";
    if (["REFUNDED"].includes(u))
        return "REFUNDED";
    if (["PARTIALLY_REFUNDED", "PARTIAL_REFUND"].includes(u))
        return "PARTIALLY_REFUNDED";
    return "PENDING";
}
function mapInvoiceStatus(raw) {
    const s = mapRegPaymentStatus(raw);
    if (s === "COMPLETED")
        return "paid";
    if (s === "CANCELLED")
        return "cancelled";
    if (s === "FAILED")
        return "cancelled";
    return "pending";
}
function userDisplayName(u) {
    const n = `${u.firstName} ${u.lastName}`.trim();
    return n || u.email || "User";
}
async function listTransactions(query) {
    const { page, limit, skip, search, status } = parseFinancialListQuery(query);
    const searchFilter = search.length > 0
        ? {
            OR: [
                { user: { email: { contains: search, mode: "insensitive" } } },
                { user: { firstName: { contains: search, mode: "insensitive" } } },
                { user: { lastName: { contains: search, mode: "insensitive" } } },
                { event: { title: { contains: search, mode: "insensitive" } } },
            ],
        }
        : {};
    const where = { ...searchFilter };
    const [total, registrations] = await Promise.all([
        prisma_1.default.eventRegistration.count({ where }),
        prisma_1.default.eventRegistration.findMany({
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
            refundAmount: undefined,
            refundReason: undefined,
            refundedAt: undefined,
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
async function listPayments(query) {
    const { page, limit, skip, search, status } = parseFinancialListQuery(query);
    const searchFilter = search.length > 0
        ? {
            OR: [
                { user: { email: { contains: search, mode: "insensitive" } } },
                { user: { firstName: { contains: search, mode: "insensitive" } } },
                { user: { lastName: { contains: search, mode: "insensitive" } } },
            ],
        }
        : {};
    const where = { ...searchFilter };
    const [total, rows] = await Promise.all([
        prisma_1.default.eventRegistration.count({ where }),
        prisma_1.default.eventRegistration.findMany({
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
            refundReason: null,
            refundedAt: null,
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
    const n = await prisma_1.default.adminSubscriptionPlan.count();
    if (n > 0)
        return;
    await prisma_1.default.adminSubscriptionPlan.createMany({
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
    const c = await prisma_1.default.adminUserSubscription.count();
    if (c > 0)
        return;
    const plans = await prisma_1.default.adminSubscriptionPlan.findMany({ take: 1, orderBy: { price: "asc" } });
    if (!plans.length)
        return;
    const organizers = await prisma_1.default.user.findMany({
        where: { role: "ORGANIZER" },
        take: 5,
        orderBy: { createdAt: "asc" },
    });
    const planId = plans[0].id;
    const renews = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    for (const u of organizers) {
        await prisma_1.default.adminUserSubscription.create({
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
async function listSubscriptions(query) {
    await ensureSubscriptionPlans();
    await seedDemoSubscriptionsIfEmpty();
    const { page, limit, skip, search, status } = parseFinancialListQuery(query);
    const whereSubs = {};
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
        prisma_1.default.adminUserSubscription.count({ where: whereSubs }),
        prisma_1.default.adminUserSubscription.findMany({
            where: whereSubs,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: { user: true, plan: true },
        }),
    ]);
    const planTypeMap = {
        MONTHLY: "MONTHLY",
        YEARLY: "YEARLY",
        QUARTERLY: "QUARTERLY",
    };
    const data = subs.map((s) => {
        const u = s.user;
        const p = s.plan;
        const feats = Array.isArray(p.features) ? p.features : [];
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
            status: s.status,
            startDate: s.startedAt.toISOString(),
            endDate: end.toISOString(),
            nextBillingDate: s.renewsAt?.toISOString() ?? null,
            autoRenew: s.autoRenew,
            paymentMethod: "CARD",
            transactionId: `sub_${s.id.slice(0, 8)}`,
            features: feats.length ? feats : ["Included features"],
            cancelledAt: null,
            cancellationReason: null,
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
async function listInvoices(query) {
    const { page, limit, skip, search, status } = parseFinancialListQuery(query);
    const searchFilter = search.length > 0
        ? {
            OR: [
                { user: { email: { contains: search, mode: "insensitive" } } },
                { user: { firstName: { contains: search, mode: "insensitive" } } },
                { user: { lastName: { contains: search, mode: "insensitive" } } },
            ],
        }
        : {};
    const where = { ...searchFilter };
    const [total, rows] = await Promise.all([
        prisma_1.default.eventRegistration.count({ where }),
        prisma_1.default.eventRegistration.findMany({
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
async function listPromotionPackages(query) {
    const { page, limit, skip, search, status } = parseFinancialListQuery(query);
    const where = {};
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
        prisma_1.default.promotion.count({ where }),
        prisma_1.default.promotion.findMany({
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
