"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listConferencesByEvent = listConferencesByEvent;
exports.getConferenceById = getConferenceById;
exports.createConference = createConference;
exports.updateConference = updateConference;
exports.deleteConference = deleteConference;
const prisma_1 = __importDefault(require("../../config/prisma"));
async function listConferencesByEvent(eventId) {
    const conferences = await prisma_1.default.conference.findMany({
        where: { eventId },
        include: {
            sessions: {
                orderBy: { order: "asc" },
            },
        },
        orderBy: { createdAt: "desc" },
    });
    return conferences;
}
async function getConferenceById(id) {
    const conference = await prisma_1.default.conference.findUnique({
        where: { id },
        include: {
            sessions: {
                orderBy: { order: "asc" },
            },
        },
    });
    return conference;
}
async function createConference(body) {
    const { eventId, date, day, theme, sessions } = body;
    if (!eventId || !date || !day || !theme) {
        throw new Error("Missing required fields: eventId, date, day, theme");
    }
    const event = await prisma_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true },
    });
    if (!event) {
        throw new Error("Event not found");
    }
    const sessionData = Array.isArray(sessions)
        ? sessions.map((session, index) => ({
            time: session.time ?? "",
            title: session.title ?? "",
            description: session.description ?? null,
            speaker: session.speaker ?? null,
            type: session.type ?? "SESSION",
            order: index,
        }))
        : [];
    const conference = await prisma_1.default.conference.create({
        data: {
            eventId,
            date: String(date),
            day: String(day),
            theme: String(theme),
            isPublished: false,
            sessions: {
                create: sessionData,
            },
        },
        include: {
            sessions: {
                orderBy: { order: "asc" },
            },
        },
    });
    return conference;
}
async function updateConference(id, body) {
    const { date, day, theme, sessions, isPublished } = body;
    const existing = await prisma_1.default.conference.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!existing) {
        throw new Error("Conference not found");
    }
    await prisma_1.default.conferenceSession.deleteMany({
        where: { conferenceId: id },
    });
    const sessionData = Array.isArray(sessions)
        ? sessions.map((session, index) => ({
            time: session.time ?? "",
            title: session.title ?? "",
            description: session.description ?? null,
            speaker: session.speaker ?? null,
            type: session.type ?? "SESSION",
            order: index,
        }))
        : [];
    const conference = await prisma_1.default.conference.update({
        where: { id },
        data: {
            ...(date !== undefined && { date: String(date) }),
            ...(day !== undefined && { day: String(day) }),
            ...(theme !== undefined && { theme: String(theme) }),
            ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
            sessions: {
                create: sessionData,
            },
        },
        include: {
            sessions: {
                orderBy: { order: "asc" },
            },
        },
    });
    return conference;
}
async function deleteConference(id) {
    const existing = await prisma_1.default.conference.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!existing) {
        throw new Error("Conference not found");
    }
    await prisma_1.default.conference.delete({
        where: { id },
    });
    return { deleted: true };
}
