// src/controllers/upload.controller.js
import Project from "../models/Project.js";
import ApiError from "../utils/ApiError.js";
import catchAsync from "../utils/catchAsync.js";
import {processAndUploadImages, uploadAvatar} from "../services/s3.service.js";

/**
 * @desc    Upload images to a project
 * @route   POST /api/v1/upload/:projectId/images
 * @access  Private
 */
export const uploadProjectImages = catchAsync(async (req, res, next) => {
	const {projectId} = req.params;

	// Check if files were uploaded
	if (!req.files || req.files.length === 0) {
		return next(ApiError.badRequest("No images uploaded"));
	}

	// Find project
	const project = await Project.findOne({
		_id: projectId,
		user: req.user._id,
		isDeleted: false,
	});

	if (!project) {
		return next(ApiError.notFound("Project not found"));
	}

	// Can only upload to draft or failed projects
	if (!["draft", "failed"].includes(project.status)) {
		return next(
			ApiError.badRequest("Cannot upload images to project in current status")
		);
	}

	// Check total image limit
	const currentImageCount = project.images ? project.images.length : 0;
	const newImageCount = req.files.length;
	const maxImages = 20;

	if (currentImageCount + newImageCount > maxImages) {
		return next(
			ApiError.badRequest(
				`Cannot upload more than ${maxImages} images per project`
			)
		);
	}

	// Update project status
	project.status = "uploading";
	await project.save();

	try {
		// Process and upload images to S3
		const uploadedImages = await processAndUploadImages(
			req.files,
			req.user._id.toString(),
			project._id.toString()
		);

		// Add order based on existing images
		const startOrder = currentImageCount;
		uploadedImages.forEach((img, index) => {
			img.order = startOrder + index;
		});

		// Add images to project
		project.images = [...(project.images || []), ...uploadedImages];
		project.status = "draft";
		await project.save();

		res.status(200).json({
			success: true,
			message: `${uploadedImages.length} image(s) uploaded successfully`,
			data: {
				images: uploadedImages,
				totalImages: project.images.length,
			},
		});
	} catch (error) {
		// Reset status on error
		project.status = "draft";
		await project.save();

		console.error("Upload error:", error);
		return next(ApiError.internal("Failed to upload images"));
	}
});

/**
 * @desc    Upload user avatar
 * @route   POST /api/v1/upload/avatar
 * @access  Private
 */
export const uploadUserAvatar = catchAsync(async (req, res, next) => {
	if (!req.file) {
		return next(ApiError.badRequest("No image uploaded"));
	}

	try {
		// Upload avatar
		const result = await uploadAvatar(req.file, req.user._id.toString());

		// Update user avatar
		req.user.avatar = result.url;
		await req.user.save();

		res.status(200).json({
			success: true,
			message: "Avatar uploaded successfully",
			data: {
				avatar: result.url,
			},
		});
	} catch (error) {
		console.error("Avatar upload error:", error);
		return next(ApiError.internal("Failed to upload avatar"));
	}
});

/**
 * @desc    Get presigned URL for direct upload
 * @route   POST /api/v1/upload/presigned
 * @access  Private
 */
export const getPresignedUrl = catchAsync(async (req, res, next) => {
	const {filename, contentType, projectId} = req.body;

	// Validate content type
	const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
	if (!allowedTypes.includes(contentType)) {
		return next(ApiError.badRequest("Invalid file type"));
	}

	// Verify project ownership if projectId provided
	if (projectId) {
		const project = await Project.findOne({
			_id: projectId,
			user: req.user._id,
			isDeleted: false,
		});

		if (!project) {
			return next(ApiError.notFound("Project not found"));
		}
	}

	// Generate presigned URL
	const {getSignedUploadUrl} = await import("../config/s3.js");
	const {v4: uuidv4} = await import("uuid");
	const {generateS3Key} = await import("../utils/helpers.js");

	const uniqueFilename = `${uuidv4()}-${filename}`;
	const folder = projectId ? `projects/${projectId}/images` : "temp";
	const key = generateS3Key(req.user._id.toString(), folder, uniqueFilename);

	const presignedUrl = await getSignedUploadUrl(key, contentType, 3600);

	res.status(200).json({
		success: true,
		data: {
			uploadUrl: presignedUrl,
			key,
			expiresIn: 3600,
		},
	});
});

/**
 * @desc    Confirm direct upload completion
 * @route   POST /api/v1/upload/confirm
 * @access  Private
 */
export const confirmUpload = catchAsync(async (req, res, next) => {
	const {projectId, images} = req.body;
	// images: [{ key, originalName, size, width, height }]

	if (!images || !Array.isArray(images) || images.length === 0) {
		return next(ApiError.badRequest("No images to confirm"));
	}

	const project = await Project.findOne({
		_id: projectId,
		user: req.user._id,
		isDeleted: false,
	});

	if (!project) {
		return next(ApiError.notFound("Project not found"));
	}

	// Add images to project
	const currentImageCount = project.images ? project.images.length : 0;

	const newImages = images.map((img, index) => ({
		originalName: img.originalName,
		key: img.key,
		url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${img.key}`,
		size: img.size,
		mimeType: img.mimeType || "image/jpeg",
		width: img.width,
		height: img.height,
		order: currentImageCount + index,
	}));

	project.images = [...(project.images || []), ...newImages];
	await project.save();

	res.status(200).json({
		success: true,
		message: "Upload confirmed",
		data: {
			images: newImages,
			totalImages: project.images.length,
		},
	});
});

export default {
	uploadProjectImages,
	uploadUserAvatar,
	getPresignedUrl,
	confirmUpload,
};
