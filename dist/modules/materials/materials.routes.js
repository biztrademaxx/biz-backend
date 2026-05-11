"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
const materials_controller_1 = require("./materials.controller");
const router = (0, express_1.Router)();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
router.post("/materials", auth_middleware_1.requireUser, upload.single("file"), materials_controller_1.postMaterialHandler);
router.patch("/materials/:id", auth_middleware_1.requireUser, materials_controller_1.patchMaterialHandler);
router.get("/materials/:id/download", materials_controller_1.getMaterialDownloadHandler);
router.delete("/materials/:id", auth_middleware_1.requireUser, materials_controller_1.deleteMaterialHandler);
router.post("/materials/:id/view", auth_middleware_1.requireUser, materials_controller_1.postMaterialViewHandler);
exports.default = router;
