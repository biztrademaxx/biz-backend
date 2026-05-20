"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listNotifications = listNotifications;
exports.getCount = getCount;
async function listNotifications(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
}
async function getCount() {
    return { count: 0 };
}
