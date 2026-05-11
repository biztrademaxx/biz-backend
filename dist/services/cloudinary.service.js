"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImage = uploadImage;
exports.uploadDocument = uploadDocument;
exports.uploadRaw = uploadRaw;
exports.deleteAsset = deleteAsset;
exports.extractPublicId = extractPublicId;
const cloudinary_1 = require("cloudinary");
// Configure Cloudinary for the backend service
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});
async function uploadInternal(file, options) {
    // If we get a Buffer, use upload_stream; if string, use upload directly
    if (Buffer.isBuffer(file)) {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.v2.uploader.upload_stream(options, (error, result) => {
                if (error || !result) {
                    return reject(error ?? new Error("Cloudinary upload returned no result"));
                }
                resolve(result);
            });
            uploadStream.end(file);
        });
    }
    return new Promise((resolve, reject) => {
        cloudinary_1.v2.uploader.upload(file, options, (error, result) => {
            if (error || !result) {
                return reject(error ?? new Error("Cloudinary upload returned no result"));
            }
            resolve(result);
        });
    });
}
async function uploadImage(file, folder = "images") {
    return uploadInternal(file, {
        folder,
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "gif", "svg", "avif"],
    });
}
async function uploadDocument(file, folder = "documents") {
    return uploadInternal(file, {
        folder,
        resource_type: "raw",
    });
}
async function uploadRaw(file, folder = "raw", options = {}) {
    return uploadInternal(file, {
        folder,
        resource_type: options.resource_type ?? "raw",
        ...options,
    });
}
async function deleteAsset(publicId, resourceType = "image") {
    return cloudinary_1.v2.uploader.destroy(publicId, {
        resource_type: resourceType,
    });
}
// Helper to extract public ID from a Cloudinary URL
function extractPublicId(url) {
    try {
        if (!url.includes("cloudinary.com"))
            return null;
        const urlParts = url.split("/");
        const uploadIndex = urlParts.indexOf("upload");
        if (uploadIndex === -1)
            return null;
        // Get everything after the upload/version/ part
        const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join("/");
        // Remove file extension
        const publicId = publicIdWithExtension.split(".")[0];
        return publicId;
    }
    catch {
        return null;
    }
}
