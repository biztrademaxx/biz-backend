"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CANONICAL_PACKAGE_IDS = exports.ALL_CATEGORIES_LABEL = void 0;
exports.listPromotionPackages = listPromotionPackages;
exports.createPromotionPackage = createPromotionPackage;
exports.updatePromotionPackage = updatePromotionPackage;
exports.deletePromotionPackage = deletePromotionPackage;
const crypto_1 = require("crypto");
const admin_app_setting_1 = require("../../../lib/admin-app-setting");
const redis_1 = require("../../../config/redis");
function asJsonInput(v) {
    return JSON.parse(JSON.stringify(v));
}
const KEY = "promotion_packages_catalog";
exports.ALL_CATEGORIES_LABEL = "All Categories";
function defaultPackages() {
    return [
        {
            id: "pkg_starter",
            planKey: "starter",
            name: "STARTER",
            description: "For small event organizers",
            price: 9999,
            features: [
                "Verified Event Listing",
                "100 Monthly Lead Credits",
                "Standard Visibility",
                "Event Analytics Dashboard",
                "Basic Search Visibility",
                "Verified Event Badge",
                "Email Support",
            ],
            userCount: 100,
            duration: "month",
            durationDays: 30,
            categories: [exports.ALL_CATEGORIES_LABEL],
            recommended: false,
            isActive: true,
            userType: "ORGANIZER",
            order: 1,
            section: "subscription",
            ctaLabel: "Start Growing",
            visibilityLabel: "1X Visibility",
            leadsLabel: "100+ Leads / Month",
        },
        {
            id: "pkg_professional",
            planKey: "professional",
            name: "PROFESSIONAL",
            description: "For growing & serious organizers",
            price: 49999,
            features: [
                "Everything in Starter",
                "Featured Event Listing",
                "500 Monthly Lead Credits",
                "5X More Visibility",
                "Homepage Event Showcase",
                "Industry Category Feature",
                "Country Search Page Feature",
                "City Search Page Feature",
                "Newsletter Inclusion (Monthly)",
                "Social Media Promotion (2 Posts / Month)",
                "Priority Support",
            ],
            userCount: 500,
            duration: "month",
            durationDays: 30,
            categories: [exports.ALL_CATEGORIES_LABEL],
            recommended: true,
            isActive: true,
            userType: "ORGANIZER",
            order: 2,
            section: "subscription",
            ctaLabel: "Get Featured",
            visibilityLabel: "5X Visibility",
            leadsLabel: "500+ Leads / Month",
        },
        {
            id: "pkg_enterprise",
            planKey: "enterprise",
            name: "ENTERPRISE",
            description: "For large events & organizations",
            price: 99999,
            features: [
                "Everything in Professional",
                "Premium Featured Listing",
                "1,000 Monthly Lead Credits",
                "10X Maximum Visibility",
                "Dedicated Account Manager",
                "Newsletter Inclusion (Weekly)",
                "Social Media Promotion (4 Posts / Month)",
                "Premium Homepage Placement",
                "Custom Marketing Campaigns",
                "Dedicated Support",
            ],
            userCount: 1000,
            duration: "month",
            durationDays: 30,
            categories: [exports.ALL_CATEGORIES_LABEL],
            recommended: false,
            isActive: true,
            userType: "ORGANIZER",
            order: 3,
            section: "subscription",
            ctaLabel: "Contact Sales",
            visibilityLabel: "10X Visibility",
            leadsLabel: "1000+ Leads / Month",
        },
        {
            id: "pkg_visitor_reach",
            planKey: "visitor_reach",
            name: "VisitorReach Campaigns",
            description: "For organizers seeking direct access to targeted industry audiences.",
            price: 15000,
            features: [
                "Send Invitations & Re-Invitations to Opt-in Database",
                "Professional Drag-and-Drop Email Builder",
                "Open, Click & Registration Tracking",
                "Detailed Campaign Performance Reports",
                "Industry & Region-Based Audience Targeting",
            ],
            userCount: 0,
            duration: "per campaign",
            durationDays: 14,
            categories: [exports.ALL_CATEGORIES_LABEL],
            recommended: false,
            isActive: true,
            userType: "ORGANIZER",
            order: 4,
            section: "on_demand",
            ctaLabel: "Launch Campaign",
        },
        {
            id: "pkg_prospector",
            planKey: "prospector",
            name: "Exhibitor & Sponsor Prospector",
            description: "For sales teams looking to acquire exhibitors, sponsors, and partners.",
            price: 9999,
            features: [
                "Live Prospect Database by Industry Category",
                "Company Tracking & Market Intelligence Alerts",
                "Filter by Country, Industry, Company Size & Interests",
                "Contact Discovery & Lead Management Tools",
                "Export Prospects to CRM or Excel",
            ],
            userCount: 0,
            duration: "month",
            durationDays: 30,
            categories: [exports.ALL_CATEGORIES_LABEL],
            recommended: false,
            isActive: true,
            userType: "ORGANIZER",
            order: 5,
            section: "on_demand",
            ctaLabel: "Explore Prospector",
        },
        {
            id: "pkg_leadboost",
            planKey: "leadboost",
            name: "LeadBoost",
            description: "For organizers focused on measurable ROI and guaranteed lead generation.",
            price: 500,
            features: [
                "Qualified Exhibitor, Visitor & Sponsor Leads",
                "Pay Only for Verified Leads",
                "Automated Email & WhatsApp Follow-ups",
                "Real-Time Lead Delivery",
                "CRM & CSV Export Integration",
            ],
            userCount: 0,
            duration: "per qualified lead",
            durationDays: 30,
            categories: [exports.ALL_CATEGORIES_LABEL],
            recommended: false,
            isActive: true,
            userType: "ORGANIZER",
            order: 6,
            section: "on_demand",
            ctaLabel: "Start LeadBoost",
        },
    ];
}
exports.CANONICAL_PACKAGE_IDS = new Set(defaultPackages().map((p) => p.id));
const CANONICAL_IDS = exports.CANONICAL_PACKAGE_IDS;
/** Keep only the six canonical plans; drop legacy packages from the catalog. */
function normalizeToCanonicalCatalog(list) {
    const defaults = defaultPackages();
    const savedById = new Map(list.filter((p) => CANONICAL_IDS.has(p.id)).map((p) => [p.id, p]));
    return defaults.map((def) => {
        const saved = savedById.get(def.id);
        if (!saved)
            return def;
        return {
            ...def,
            ...saved,
            id: def.id,
            planKey: def.planKey,
            section: def.section,
            order: def.order,
        };
    });
}
async function loadPackages() {
    const defaults = defaultPackages();
    let list = await (0, admin_app_setting_1.getAppSettingJson)(KEY, null);
    if (!list || !Array.isArray(list) || list.length === 0) {
        await savePackages(defaults);
        return defaults;
    }
    const hasLegacy = list.some((p) => !CANONICAL_IDS.has(p.id));
    const normalized = normalizeToCanonicalCatalog(list);
    if (hasLegacy || normalized.length !== list.length) {
        await savePackages(normalized);
        return normalized;
    }
    return normalized;
}
async function savePackages(list) {
    await (0, admin_app_setting_1.setAppSettingJson)(KEY, asJsonInput(list));
}
async function listPromotionPackages() {
    return (0, redis_1.cached)(redis_1.CACHE_KEYS.promotionPackages(), redis_1.CACHE_TTL.PROMOTION_PACKAGES, async () => {
        const list = await loadPackages();
        return [...list].sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
    });
}
async function createPromotionPackage(input) {
    const list = await loadPackages();
    const item = {
        id: (0, crypto_1.randomUUID)(),
        name: String(input.name ?? "").trim(),
        description: String(input.description ?? "").trim(),
        price: Number(input.price ?? 0),
        features: Array.isArray(input.features) ? input.features.map(String) : [],
        userCount: Number(input.userCount ?? 0),
        duration: String(input.duration ?? ""),
        durationDays: Number(input.durationDays ?? 0),
        categories: Array.isArray(input.categories) ? input.categories.map(String) : [],
        recommended: !!input.recommended,
        isActive: input.isActive !== false,
        userType: String(input.userType ?? "BOTH"),
        order: Number(input.order ?? list.length),
        section: input.section === "on_demand" ? "on_demand" : "subscription",
        ctaLabel: input.ctaLabel ? String(input.ctaLabel) : undefined,
        visibilityLabel: input.visibilityLabel ? String(input.visibilityLabel) : undefined,
        leadsLabel: input.leadsLabel ? String(input.leadsLabel) : undefined,
        planKey: input.planKey ? String(input.planKey) : undefined,
    };
    list.push(item);
    await savePackages(list);
    await (0, redis_1.invalidatePromotionPackageCaches)();
    return item;
}
async function updatePromotionPackage(id, input) {
    const list = await loadPackages();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1)
        return null;
    const current = list[idx];
    const updated = {
        ...current,
        ...input,
        id: current.id,
        price: input.price !== undefined ? Number(input.price) : current.price,
        userCount: input.userCount !== undefined ? Number(input.userCount) : current.userCount,
        durationDays: input.durationDays !== undefined ? Number(input.durationDays) : current.durationDays,
        features: input.features !== undefined ? (Array.isArray(input.features) ? input.features.map(String) : []) : current.features,
        categories: input.categories !== undefined ? (Array.isArray(input.categories) ? input.categories.map(String) : []) : current.categories,
        section: input.section !== undefined
            ? input.section === "on_demand"
                ? "on_demand"
                : "subscription"
            : current.section,
    };
    list[idx] = updated;
    await savePackages(list);
    await (0, redis_1.invalidatePromotionPackageCaches)();
    return updated;
}
async function deletePromotionPackage(id) {
    if (CANONICAL_IDS.has(id))
        return false;
    const list = await loadPackages();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1)
        return false;
    list.splice(idx, 1);
    await savePackages(list);
    await (0, redis_1.invalidatePromotionPackageCaches)();
    return true;
}
