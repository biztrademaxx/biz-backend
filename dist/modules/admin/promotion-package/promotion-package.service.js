"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPromotionPackages = listPromotionPackages;
exports.createPromotionPackage = createPromotionPackage;
exports.updatePromotionPackage = updatePromotionPackage;
exports.deletePromotionPackage = deletePromotionPackage;
const crypto_1 = require("crypto");
const admin_app_setting_1 = require("../../../lib/admin-app-setting");
function asJsonInput(v) {
    return JSON.parse(JSON.stringify(v));
}
const KEY = "promotion_packages_catalog";
function defaultPackages() {
    return [
        {
            id: "pkg_featured_home",
            name: "Featured on Homepage",
            description: "Premium placement on the main discovery feed.",
            price: 299,
            features: ["7-day placement", "Highlighted card", "Priority in search"],
            userCount: 0,
            duration: "7 days",
            durationDays: 7,
            categories: [],
            recommended: true,
            isActive: true,
            userType: "BOTH",
            order: 1,
        },
        {
            id: "pkg_event_boost",
            name: "Event Boost",
            description: "Increased visibility for a single event.",
            price: 149,
            features: ["14-day boost", "Email mention", "Social snippet"],
            userCount: 0,
            duration: "14 days",
            durationDays: 14,
            categories: [],
            recommended: false,
            isActive: true,
            userType: "ORGANIZER",
            order: 2,
        },
        {
            id: "pkg_exhibitor_spotlight",
            name: "Exhibitor Spotlight",
            description: "Dedicated exhibitor promotion slot.",
            price: 199,
            features: ["Booth map pin", "Lead form CTA"],
            userCount: 0,
            duration: "10 days",
            durationDays: 10,
            categories: [],
            recommended: false,
            isActive: true,
            userType: "EXHIBITOR",
            order: 3,
        },
    ];
}
async function loadPackages() {
    let list = await (0, admin_app_setting_1.getAppSettingJson)(KEY, null);
    if (!list || !Array.isArray(list) || list.length === 0) {
        list = defaultPackages();
        await (0, admin_app_setting_1.setAppSettingJson)(KEY, asJsonInput(list));
    }
    return list;
}
async function savePackages(list) {
    await (0, admin_app_setting_1.setAppSettingJson)(KEY, asJsonInput(list));
}
async function listPromotionPackages() {
    const list = await loadPackages();
    return [...list].sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
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
    };
    list.push(item);
    await savePackages(list);
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
    };
    list[idx] = updated;
    await savePackages(list);
    return updated;
}
async function deletePromotionPackage(id) {
    const list = await loadPackages();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1)
        return false;
    list.splice(idx, 1);
    await savePackages(list);
    return true;
}
