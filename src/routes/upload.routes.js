// src/routes/upload.routes.js
import {Router} from "express";
import uploadController from "../controllers/upload.controller.js";
import {protect} from "../middleware/auth.middleware.js";
import {
	uploadMultiple,
	uploadSingle,
	handleUploadError,
	validateUploadedFiles,
} from "../middleware/upload.middleware.js";
import {uploadLimiter} from "../middleware/rateLimiter.middleware.js";
import {validateObjectId} from "../middleware/validation.middleware.js";

const router = Router();

// All upload routes are protected
router.use(protect);
router.use(uploadLimiter);

// Upload images to a project
router.post(
	"/:projectId/images",
	validateObjectId("projectId"),
	uploadMultiple,
	handleUploadError,
	validateUploadedFiles,
	uploadController.uploadProjectImages
);

// Upload user avatar
router.post(
	"/avatar",
	uploadSingle,
	handleUploadError,
	uploadController.uploadUserAvatar
);

// Get presigned URL for direct upload
router.post("/presigned", uploadController.getPresignedUrl);

// Confirm direct upload
router.post("/confirm", uploadController.confirmUpload);

export default router;
