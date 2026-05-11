"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVisitorAppointmentsForAdmin = listVisitorAppointmentsForAdmin;
const prisma_1 = __importDefault(require("../../../config/prisma"));
async function listVisitorAppointmentsForAdmin() {
    const appointments = await prisma_1.default.appointment.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            requester: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    company: true,
                },
            },
            exhibitor: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    company: true,
                },
            },
            event: {
                select: {
                    id: true,
                    title: true,
                    startDate: true,
                    endDate: true,
                },
            },
        },
    });
    return {
        appointments: appointments.map((a) => ({
            id: a.id,
            visitor: {
                name: a.requester
                    ? `${a.requester.firstName ?? ""} ${a.requester.lastName ?? ""}`.trim() || "Visitor"
                    : "Visitor",
                email: a.requester?.email ?? "",
                phone: a.requester?.phone ?? undefined,
                company: a.requester?.company ?? undefined,
            },
            exhibitor: {
                name: a.exhibitor
                    ? `${a.exhibitor.firstName ?? ""} ${a.exhibitor.lastName ?? ""}`.trim() || "Exhibitor"
                    : "Exhibitor",
                company: a.exhibitor?.company ?? "",
                email: a.exhibitor?.email ?? "",
            },
            event: {
                title: a.event?.title ?? "",
                date: a.event?.startDate?.toISOString() ?? "",
            },
            title: a.title,
            description: a.description ?? undefined,
            type: a.type,
            status: a.status,
            priority: a.priority,
            requestedDate: a.requestedDate.toISOString().split("T")[0],
            requestedTime: a.requestedTime,
            confirmedDate: a.confirmedDate?.toISOString().split("T")[0],
            confirmedTime: a.confirmedTime ?? undefined,
            duration: a.duration,
            meetingType: a.meetingType,
            location: a.location ?? undefined,
            meetingLink: a.meetingLink ?? undefined,
            purpose: a.purpose ?? undefined,
            createdAt: a.createdAt.toISOString(),
        })),
    };
}
