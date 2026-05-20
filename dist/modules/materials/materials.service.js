"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMaterial = createMaterial;
exports.updateMaterial = updateMaterial;
exports.getMaterialById = getMaterialById;
exports.getMaterialForDownload = getMaterialForDownload;
exports.deleteMaterialById = deleteMaterialById;
exports.recordMaterialView = recordMaterialView;
const prisma_1 = __importDefault(require("../../config/prisma"));
const cloudinary_service_1 = require("../../services/cloudinary.service");
const upload_service_1 = require("../../services/upload.service");
const MATERIAL_FILE_TYPES = {
    "application/pdf": "DOCUMENT",
    "application/vnd.ms-powerpoint": "PRESENTATION",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PRESENTATION",
    "application/msword": "DOCUMENT",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCUMENT",
    "image/jpeg": "IMAGE",
    "image/png": "IMAGE",
    "video/mp4": "VIDEO",
};
async function createMaterial(file, sessionId, speakerId, options) {
    (0, upload_service_1.validateMaterialFile)(file);
    const session = await prisma_1.default.speakerSession.findFirst({
        where: { id: sessionId, speakerId },
        select: { id: true },
    });
    if (!session) {
        throw new Error("Session not found or you are not the speaker");
    }
    const uploadResult = await (0, cloudinary_service_1.uploadDocument)(file.buffer, `materials/${sessionId}`);
    const fileType = MATERIAL_FILE_TYPES[file.mimetype] || "OTHER";
    const material = await prisma_1.default.sessionMaterial.create({
        data: {
            sessionId,
            speakerId,
            fileName: file.originalname,
            fileUrl: uploadResult.secure_url,
            publicId: uploadResult.public_id ?? null,
            fileSize: file.size,
            fileType,
            mimeType: file.mimetype,
            status: options?.status ?? "DRAFT",
            allowDownload: options?.allowDownload ?? true,
            description: options?.description ?? null,
        },
        include: {
            session: {
                select: {
                    title: true,
                    event: { select: { title: true } },
                },
            },
        },
    });
    return {
        material: {
            id: material.id,
            fileName: material.fileName,
            fileUrl: material.fileUrl,
            fileSize: material.fileSize,
            fileType: material.fileType,
            mimeType: material.mimeType,
            status: material.status,
            allowDownload: material.allowDownload,
            uploadedAt: material.uploadedAt.toISOString(),
            downloadCount: material.downloadCount,
            viewCount: material.viewCount,
        },
    };
}
async function updateMaterial(materialId, userId, data) {
    const material = await prisma_1.default.sessionMaterial.findFirst({
        where: { id: materialId, speakerId: userId },
    });
    if (!material) {
        throw new Error("Material not found or access denied");
    }
    const updated = await prisma_1.default.sessionMaterial.update({
        where: { id: materialId },
        data: {
            ...(typeof data.allowDownload === "boolean" && { allowDownload: data.allowDownload }),
            ...(data.status && { status: data.status }),
            ...(data.description !== undefined && { description: data.description }),
        },
    });
    return {
        material: {
            id: updated.id,
            fileName: updated.fileName,
            fileUrl: updated.fileUrl,
            fileSize: updated.fileSize,
            fileType: updated.fileType,
            mimeType: updated.mimeType,
            status: updated.status,
            allowDownload: updated.allowDownload,
            uploadedAt: updated.uploadedAt.toISOString(),
            downloadCount: updated.downloadCount,
            viewCount: updated.viewCount,
        },
    };
}
async function getMaterialById(materialId, userId) {
    const material = await prisma_1.default.sessionMaterial.findFirst({
        where: { id: materialId, speakerId: userId },
    });
    if (!material)
        return null;
    return material;
}
async function getMaterialForDownload(materialId) {
    const material = await prisma_1.default.sessionMaterial.findUnique({
        where: { id: materialId },
    });
    if (!material)
        return null;
    await prisma_1.default.sessionMaterial.update({
        where: { id: materialId },
        data: { downloadCount: { increment: 1 } },
    });
    return material;
}
async function deleteMaterialById(materialId, userId) {
    const material = await prisma_1.default.sessionMaterial.findFirst({
        where: { id: materialId, speakerId: userId },
    });
    if (!material) {
        throw new Error("Material not found or access denied");
    }
    if (material.publicId) {
        await (0, cloudinary_service_1.deleteAsset)(material.publicId, "raw");
    }
    await prisma_1.default.sessionMaterial.delete({
        where: { id: materialId },
    });
    return { success: true };
}
async function recordMaterialView(materialId, userId) {
    const material = await prisma_1.default.sessionMaterial.findFirst({
        where: { id: materialId, speakerId: userId },
    });
    if (!material)
        return null;
    await prisma_1.default.sessionMaterial.update({
        where: { id: materialId },
        data: { viewCount: { increment: 1 } },
    });
    return { success: true };
}
