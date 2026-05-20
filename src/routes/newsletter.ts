import { Router } from "express";
import { publicNewsletterSubscribe } from "../modules/admin/newsletter/newsletter.controller";

const router = Router();

/** POST /api/newsletter/subscribe */
router.post("/newsletter/subscribe", publicNewsletterSubscribe);

export default router;
