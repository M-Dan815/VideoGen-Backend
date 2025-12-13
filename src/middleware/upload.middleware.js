// src/middleware/upload.middleware.js
import multer from "multer";
import path from "path";
import ApiError from "../utils/ApiError.js";
import config from "../config/index.js";
import {generateUniqueFilename} from "../utils/helpers.js";

// File filter function
const fileFilter = (req, file, cb) => {
	// Check if file type is allowed
	if (config.upload.allowedTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(
			ApiError.badRequest(
				`Invalid file type. Allowed types: ${config.upload.allowedTypes.join(
					", "
				)}`
			),
			false
		);
	}
};

// Memory storage (for S3 upload)
const memoryStorage = multer.memoryStorage();

// Configure multer
const upload = multer({
	storage: memoryStorage,
	fileFilter,
	limits: {
		fileSize: config.upload.maxFileSize,
		files: config.upload.maxFiles,
	},
});

// Single image upload
export const uploadSingle = upload.single("image");

// Multiple images upload
export const uploadMultiple = upload.array("images", config.upload.maxFiles);

// Upload fields
export const uploadFields = upload.fields([
	{name: "images", maxCount: config.upload.maxFiles},
	{name: "thumbnail", maxCount: 1},
]);

// Error handler for multer
export const handleUploadError = (err, req, res, next) => {
	if (err instanceof multer.MulterError) {
		if (err.code === "LIMIT_FILE_SIZE") {
			return next(
				ApiError.badRequest(
					`File too large. Maximum size is ${
						config.upload.maxFileSize / 1024 / 1024
					}MB`
				)
			);
		}
		if (err.code === "LIMIT_FILE_COUNT") {
			return next(
				ApiError.badRequest(
					`Too many files. Maximum is ${config.upload.maxFiles} files`
				)
			);
		}
		if (err.code === "LIMIT_UNEXPECTED_FILE") {
			return next(ApiError.badRequest("Unexpected file field"));
		}
		return next(ApiError.badRequest(err.message));
	}

	if (err) {
		return next(err);
	}

	next();
};

// Validate uploaded files
export const validateUploadedFiles = (req, res, next) => {
	// Check if files were uploaded
	if (!req.file && (!req.files || req.files.length === 0)) {
		return next(ApiError.badRequest("No files uploaded"));
	}

	// Process single file
	if (req.file) {
		req.file.uniqueName = generateUniqueFilename(req.file.originalname, "img-");
	}

	// Process multiple files
	if (req.files && Array.isArray(req.files)) {
		req.files.forEach((file, index) => {
			file.uniqueName = generateUniqueFilename(
				file.originalname,
				`img-${index}-`
			);
		});
	}

	// Process fields
	if (req.files && !Array.isArray(req.files)) {
		Object.keys(req.files).forEach((field) => {
			req.files[field].forEach((file, index) => {
				file.uniqueName = generateUniqueFilename(
					file.originalname,
					`${field}-${index}-`
				);
			});
		});
	}

	next();
};
