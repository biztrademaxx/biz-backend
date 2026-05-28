import { Router } from "express";
import * as ctrl from "./geo.controller";

const router = Router();

router.get("/visitor", ctrl.getVisitorGeo);

export default router;
