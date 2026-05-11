import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { handleImageUpload, handleDocumentUpload } from "../services/upload.service";
import { requireUser } from "../middleware/auth.middleware";

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Shared handler for image uploads
async function imageUploadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "File is required" });
    }

    const result = await handleImageUpload(file);
    return res.status(201).json({
      success: true,
      url: result.url,
      publicId: result.publicId,
    });
  } catch (err: any) {
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
router.post("/upload/cloudinary", requireUser, upload.single("file"), imageUploadHandler);

// POST /api/upload/image - image upload alias (authenticated)
router.post("/upload/image", requireUser, upload.single("file"), imageUploadHandler);

// POST /api/upload/brochure — documents & common brochure formats (PDF, Office, ODF, images), authenticated
router.post(
  "/upload/brochure",
  requireUser,
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, message: "File is required" });
      }

      const result = await handleDocumentUpload(file);
      return res.status(201).json({
        success: true,
        url: result.url,
        publicId: result.publicId,
      });
    } catch (err: any) {
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
  }
);

// Backwards-compatible legacy route: POST /api/brochure/upload
router.post(
  "/brochure/upload",
  requireUser,
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, message: "File is required" });
      }

      const result = await handleDocumentUpload(file);
      return res.status(201).json({
        success: true,
        url: result.url,
        publicId: result.publicId,
      });
    } catch (err: any) {
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
  }
);

export default router;

