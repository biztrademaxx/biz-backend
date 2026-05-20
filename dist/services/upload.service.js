"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateImageFile = validateImageFile;
exports.validateDocumentFile = validateDocumentFile;
exports.handleImageUpload = handleImageUpload;
exports.handleDocumentUpload = handleDocumentUpload;
exports.validateMaterialFile = validateMaterialFile;
const node_path_1 = __importDefault(require("node:path"));
const cloudinary_service_1 = require("./cloudinary.service");
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB (align with organizer dashboard)
const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
/** Brochure / document uploads (Cloudinary raw). Images allowed for one-sheet “brochures”. */
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/rtf",
    "text/rtf",
    "text/plain",
    "text/csv",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);
const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".rtf",
    ".txt",
    ".csv",
    ".odt",
    ".ods",
    ".odp",
    ".jpeg",
    ".jpg",
    ".png",
    ".webp",
    ".gif",
]);
const MAX_MATERIAL_SIZE_BYTES = 20 * 1024 * 1024; // 20MB for presentation materials
const ALLOWED_MATERIAL_MIME_TYPES = new Set([
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "video/mp4",
]);
function ensureFilePresent(file) {
    if (!file) {
        throw new Error("FILE_MISSING");
    }
}
function validateImageFile(file) {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
        throw new Error("UNSUPPORTED_IMAGE_TYPE");
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        throw new Error("IMAGE_TOO_LARGE");
    }
}
function validateDocumentFile(file) {
    const ext = file.originalname ? node_path_1.default.extname(file.originalname).toLowerCase() : "";
    const extOk = ext.length > 0 && ALLOWED_DOCUMENT_EXTENSIONS.has(ext);
    const mimeOk = ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype);
    const looseBinary = (file.mimetype === "application/octet-stream" || file.mimetype === "") && extOk;
    if (!mimeOk && !looseBinary) {
        throw new Error("UNSUPPORTED_DOCUMENT_TYPE");
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
        throw new Error("DOCUMENT_TOO_LARGE");
    }
}
function toUploadResult(result) {
    return {
        url: result.secure_url,
        publicId: result.public_id,
    };
}
async function handleImageUpload(file) {
    ensureFilePresent(file);
    validateImageFile(file);
    const result = await (0, cloudinary_service_1.uploadImage)(file.buffer);
    return toUploadResult(result);
}
async function handleDocumentUpload(file) {
    ensureFilePresent(file);
    validateDocumentFile(file);
    const result = await (0, cloudinary_service_1.uploadDocument)(file.buffer);
    return toUploadResult(result);
}
function validateMaterialFile(file) {
    if (!file)
        throw new Error("FILE_MISSING");
    if (!ALLOWED_MATERIAL_MIME_TYPES.has(file.mimetype)) {
        throw new Error("UNSUPPORTED_MATERIAL_TYPE");
    }
    if (file.size > MAX_MATERIAL_SIZE_BYTES) {
        throw new Error("MATERIAL_TOO_LARGE");
    }
}
