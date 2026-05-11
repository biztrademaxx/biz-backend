import { Router } from "express";
import multer from "multer";
import { requireAdmin } from "../../../middleware/auth.middleware";
import * as ctrl from "./venues.controller";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get("/", requireAdmin, ctrl.list);
router.get("/:id", requireAdmin, ctrl.getById);
router.post("/", requireAdmin, ctrl.create);
router.post("/import", requireAdmin, upload.single("file"), ctrl.importBulk);
router.post("/send-account-email", requireAdmin, ctrl.sendAccountEmail);
router.patch("/:id", requireAdmin, ctrl.update);
router.delete("/:id", requireAdmin, ctrl.remove);

export default router;
