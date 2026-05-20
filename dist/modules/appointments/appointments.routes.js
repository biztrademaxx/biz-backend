"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const appointments_controller_1 = require("./appointments.controller");
const router = (0, express_1.Router)();
// Event–exhibitor appointments (Schedule Meeting on event exhibitor list).
// Proxied from Next.js /api/appointments; uses backend event/exhibitor IDs (UUID).
router.get("/appointments", appointments_controller_1.getAppointmentsHandler);
router.post("/appointments", appointments_controller_1.createAppointmentHandler);
router.put("/appointments", appointments_controller_1.updateAppointmentHandler);
// Venue appointments used by /api/venue-appointments proxy
router.get("/venue-appointments", appointments_controller_1.getVenueAppointmentsHandler);
router.post("/venue-appointments", appointments_controller_1.createVenueAppointmentHandler);
router.patch("/venue-appointments", appointments_controller_1.updateVenueAppointmentHandler);
exports.default = router;
