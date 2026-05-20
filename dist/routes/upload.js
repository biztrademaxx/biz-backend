"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const upload_service_1 = require("../services/upload.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
// Shared handler for image uploads
async function imageUploadHandler(req, res, next) {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ success: false, message: "File is required" });
        }
        const result = await (0, upload_service_1.handleImageUpload)(file);
        return res.status(201).json({
            success: true,
            url: result.url,
            publicId: result.publicId,
        });
    }
    catch (err) {
        if (err instanceof Error) {
            if (err.message === "FILE_MISSING") {
                return res.status(400).json({ success: false, message: "File is required" });
            }
            if (err.message === "UNSUPPORTED_IMAGE_TYPE") {
                return res.status(400).json({ success: false, message: "Unsupported image type" });
            }
            if (err.message === "IMAGE_TOO_LARGE") {
                return res.status(400).json({ success: false, message: "Image exceeds 5MB size limit" });
            }
        }
        return next(err);
    }
}
// POST /api/upload/cloudinary - image upload (authenticated)
router.post("/upload/cloudinary", auth_middleware_1.requireUser, upload.single("file"), imageUploadHandler);
// POST /api/upload/image - image upload alias (authenticated)
router.post("/upload/image", auth_middleware_1.requireUser, upload.single("file"), imageUploadHandler);
// POST /api/upload/brochure — documents & common brochure formats (PDF, Office, ODF, images), authenticated
router.post("/upload/brochure", auth_middleware_1.requireUser, upload.single("file"), async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ success: false, message: "File is required" });
        }
        const result = await (0, upload_service_1.handleDocumentUpload)(file);
        return res.status(201).json({
            success: true,
            url: result.url,
            publicId: result.publicId,
        });
    }
    catch (err) {
        if (err instanceof Error) {
            if (err.message === "FILE_MISSING") {
                return res.status(400).json({ success: false, message: "File is required" });
            }
            if (err.message === "UNSUPPORTED_DOCUMENT_TYPE") {
                return res.status(400).json({ success: false, message: "Unsupported document type" });
            }
            if (err.message === "DOCUMENT_TOO_LARGE") {
                return res
                    .status(400)
                    .json({ success: false, message: "Document exceeds 15MB size limit" });
            }
        }
        return next(err);
    }
});
// Backwards-compatible legacy route: POST /api/brochure/upload
router.post("/brochure/upload", auth_middleware_1.requireUser, upload.single("file"), async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ success: false, message: "File is required" });
        }
        const result = await (0, upload_service_1.handleDocumentUpload)(file);
        return res.status(201).json({
            success: true,
            url: result.url,
            publicId: result.publicId,
        });
    }
    catch (err) {
        if (err instanceof Error) {
            if (err.message === "FILE_MISSING") {
                return res.status(400).json({ success: false, message: "File is required" });
            }
            if (err.message === "UNSUPPORTED_DOCUMENT_TYPE") {
                return res.status(400).json({ success: false, message: "Unsupported document type" });
            }
            if (err.message === "DOCUMENT_TOO_LARGE") {
                return res
                    .status(400)
                    .json({ success: false, message: "Document exceeds 15MB size limit" });
            }
        }
        return next(err);
    }
});
exports.default = router;
