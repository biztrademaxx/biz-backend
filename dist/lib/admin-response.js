"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendList = sendList;
exports.sendOne = sendOne;
exports.sendError = sendError;
exports.parseListQuery = parseListQuery;
function sendList(res, data, pagination) {
    return res.json({
        success: true,
        data,
        pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            totalPages: pagination.totalPages,
        },
    });
}
function sendOne(res, data) {
    return res.json({ success: true, data });
}
function sendError(res, status, message, details) {
    return res.status(status).json({
        success: false,
        error: message,
        ...(details && { details }),
    });
}
const SAFE_SORT_FIELDS = ["createdAt", "updatedAt", "email", "firstName", "lastName", "company", "venueName", "name"];
function parseListQuery(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const search = typeof query.search === "string" ? query.search.trim() : "";
    const status = typeof query.status === "string" ? query.status : undefined;
    const sortRaw = typeof query.sort === "string" ? query.sort : "createdAt";
    const sort = SAFE_SORT_FIELDS.includes(sortRaw) ? sortRaw : "createdAt";
    const order = query.order === "asc" ? "asc" : "desc";
    return { page, limit, search, status, sort, order, skip: (page - 1) * limit };
}
