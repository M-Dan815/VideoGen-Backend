// src/controllers/project.controller.js
import axios from "axios";
import * as cheerio from "cheerio";
import Project from "../models/Project.js";
import ApiError from "../utils/ApiError.js";
import catchAsync from "../utils/catchAsync.js";
import {
	paginate,
	paginationResponse,
	calculateCredits,
	isValidUrl,
} from "../utils/helpers.js";
import {deleteProjectFiles, getDownloadUrl} from "../services/s3.service.js";
import config from "../config/index.js";
import {
	scrapeRealEstateAu,
	validateScrapingUrl,
	verifyImages,
} from "../services/scraper.service.js";

import scraperService from "../services/scraper.service.js";
/**
 * @desc    Get all projects for current user
 * @route   GET /api/v1/projects
 * @access  Private
 */
export const getProjects = catchAsync(async (req, res, next) => {
	const {page = 1, limit = 10, status, sort = "-createdAt", search} = req.query;
	const {skip, limit: limitNum} = paginate(page, limit);

	// Build query
	const query = {
		user: req.user._id,
		isDeleted: false,
	};

	if (status) {
		query.status = status;
	}

	if (search) {
		query.$or = [
			{title: {$regex: search, $options: "i"}},
			{description: {$regex: search, $options: "i"}},
		];
	}

	// Execute query
	const [projects, total] = await Promise.all([
		Project.find(query).sort(sort).skip(skip).limit(limitNum).lean(),
		Project.countDocuments(query),
	]);

	res.status(200).json({
		success: true,
		data: {
			projects,
			pagination: paginationResponse(total, page, limitNum),
		},
	});
});

/**
 * @desc    Get single project
 * @route   GET /api/v1/projects/:id
 * @access  Private
 */
export const getProject = catchAsync(async (req, res, next) => {
	const project = await Project.findOne({
		_id: req.params.id,
		user: req.user._id,
		isDeleted: false,
	});

	if (!project) {
		return next(ApiError.notFound("Project not found"));
	}

	// Update view count
	project.views += 1;
	project.lastViewedAt = new Date();
	await project.save();

	res.status(200).json({
		success: true,
		data: {
			project,
		},
	});
});

/**
 * @desc    Create new project
 * @route   POST /api/v1/projects
 * @access  Private
 */
export const createProject = catchAsync(async (req, res, next) => {
	const {title, description, sourceUrl, sourceType, settings} = req.body;

	// Calculate estimated credits
	const estimatedCredits = settings ? calculateCredits(settings) : 1;

	const project = await Project.create({
		user: req.user._id,
		title,
		description,
		sourceUrl,
		sourceType: sourceType || "upload",
		settings: {
			...settings,
			watermark: {
				enabled: true,
				text: req.user.name,
				position: "bottom-right",
				...settings?.watermark,
			},
		},
		estimatedCredits,
		status: "draft",
	});

	res.status(201).json({
		success: true,
		message: "Project created successfully",
		data: {
			project,
		},
	});
});

/**
 * @desc    Update project
 * @route   PATCH /api/v1/projects/:id
 * @access  Private
 */
export const updateProject = catchAsync(async (req, res, next) => {
	const {title, description, settings, isPublic} = req.body;

	let project = await Project.findOne({
		_id: req.params.id,
		user: req.user._id,
		isDeleted: false,
	});

	if (!project) {
		return next(ApiError.notFound("Project not found"));
	}

	// Can only update draft or failed projects
	if (!["draft", "failed"].includes(project.status)) {
		return next(ApiError.badRequest("Cannot update project in current status"));
	}

	// Update fields
	if (title) project.title = title;
	if (description !== undefined) project.description = description;
	if (isPublic !== undefined) project.isPublic = isPublic;

	if (settings) {
		project.settings = {
			...project.settings,
			...settings,
		};
		project.estimatedCredits = calculateCredits(project.settings);
	}

	await project.save();

	res.status(200).json({
		success: true,
		message: "Project updated successfully",
		data: {
			project,
		},
	});
});

/**
 * @desc    Delete project
 * @route   DELETE /api/v1/projects/:id
 * @access  Private
 */
export const deleteProject = catchAsync(async (req, res, next) => {
	const project = await Project.findOne({
		_id: req.params.id,
		user: req.user._id,
		isDeleted: false,
	});

	if (!project) {
		return next(ApiError.notFound("Project not found"));
	}

	// Soft delete
	await project.softDelete();

	// Delete files from S3 (optional - can be done via background job)
	try {
		await deleteProjectFiles(req.user._id.toString(), project._id.toString());
	} catch (error) {
		console.error("Error deleting project files:", error);
	}

	res.status(200).json({
		success: true,
		message: "Project deleted successfully",
	});
});

/**
 * @desc    Generate video for project
 * @route   POST /api/v1/projects/:id/generate
 * @access  Private
 */
export const generateVideo = catchAsync(async (req, res, next) => {
	const {settings} = req.body;

	const project = await Project.findOne({
		_id: req.params.id,
		user: req.user._id,
		isDeleted: false,
	});

	if (!project) {
		return next(ApiError.notFound("Project not found"));
	}

	// Check if project has images
	if (!project.images || project.images.length === 0) {
		return next(
			ApiError.badRequest("Project has no images. Please upload images first.")
		);
	}

	// Can only generate from draft or failed status
	if (!["draft", "failed"].includes(project.status)) {
		return next(
			ApiError.badRequest("Cannot generate video for project in current status")
		);
	}

	// Update settings if provided
	if (settings) {
		project.settings = {
			...project.settings,
			...settings,
		};
	}

	// Calculate credits needed
	const creditsNeeded = calculateCredits(project.settings);

	// Check if user has enough credits
	if (!req.user.hasCredits(creditsNeeded)) {
		return next(
			ApiError.badRequest(
				`Insufficient credits. You need ${creditsNeeded} credits.`
			)
		);
	}

	// Deduct credits
	await req.user.deductCredits(creditsNeeded);

	// Update project status
	project.status = "processing";
	project.progress = 0;
	project.statusMessage = "Initializing video generation...";
	project.creditsUsed = creditsNeeded;
	project.startedAt = new Date();
	project.errorMessage = undefined;
	project.errorCode = undefined;
	await project.save();

	// In Phase 1, we'll simulate the processing
	// In Phase 2, this will be replaced with actual AI integration
	// In Phase 3, this will be added to a queue

	// Simulate processing (remove in production)
	simulateVideoGeneration(project._id);

	res.status(200).json({
		success: true,
		message: "Video generation started",
		data: {
			project,
			creditsUsed: creditsNeeded,
			remainingCredits: req.user.credits.balance,
		},
	});
});

/**
 * Simulate video generation (Phase 1 placeholder)
 */
const simulateVideoGeneration = async (projectId) => {
	try {
		const project = await Project.findById(projectId);
		if (!project) return;

		const stages = [
			{progress: 10, message: "Analyzing images..."},
			{progress: 25, message: "Preparing AI model..."},
			{progress: 40, message: "Generating video frames..."},
			{progress: 60, message: "Processing motion..."},
			{progress: 75, message: "Applying effects..."},
			{progress: 90, message: "Finalizing video..."},
		];

		for (const stage of stages) {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			await project.updateProgress(stage.progress, stage.message);
		}

		// Simulate completion with mock video data
		await project.markAsCompleted({
			key: `users/${project.user}/projects/${project._id}/videos/output.mp4`,
			url: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4", // Placeholder
			duration: project.settings.duration,
			width: 1920,
			height: 1080,
			size: 5242880,
			format: "mp4",
			quality: "1080p",
		});
	} catch (error) {
		console.error("Simulation error:", error);
		const project = await Project.findById(projectId);
		if (project) {
			await project.markAsFailed(error.message, "SIMULATION_ERROR");
		}
	}
};

/**
 * @desc    Get project status
 * @route   GET /api/v1/projects/:id/status
 * @access  Private
 */
export const getProjectStatus = catchAsync(async (req, res, next) => {
	const project = await Project.findOne({
		_id: req.params.id,
		user: req.user._id,
		isDeleted: false,
	}).select("status progress statusMessage errorMessage video");

	if (!project) {
		return next(ApiError.notFound("Project not found"));
	}

	res.status(200).json({
		success: true,
		data: {
			status: project.status,
			progress: project.progress,
			message: project.statusMessage,
			error: project.errorMessage,
			video: project.video,
		},
	});
});

/**
 * @desc    Download project video
 * @route   GET /api/v1/projects/:id/download
 * @access  Private
 */
export const downloadVideo = catchAsync(async (req, res, next) => {
	const project = await Project.findOne({
		_id: req.params.id,
		user: req.user._id,
		isDeleted: false,
	});

	if (!project) {
		return next(ApiError.notFound("Project not found"));
	}

	if (project.status !== "completed" || !project.video) {
		return next(ApiError.badRequest("Video is not available for download"));
	}

	// Generate signed URL for download
	const downloadUrl = await getDownloadUrl(project.video.key, 3600);

	// Update download count
	project.downloads += 1;
	await project.save();

	res.status(200).json({
		success: true,
		data: {
			downloadUrl,
			filename: `${project.title}.${project.video.format}`,
			expiresIn: 3600,
		},
	});
});

/**
 * @desc    Scrape images from URL
 * @route   POST /api/v1/projects/scrape
 * @access  Private
 */
/**
 * @desc    Scrape images from realestate.com.au URL
 * @route   POST /api/v1/projects/scrape
 * @access  Private
 */
export const scrapeImages = catchAsync(async (req, res, next) => {
	const {url, usePuppeteer = true, verify = false} = req.body;

	// Validate URL
	const validation = scraperService.validateScrapingUrl(url);
	if (!validation.valid) {
		return next(ApiError.badRequest(validation.error));
	}

	try {
		// Scrape with optional Puppeteer fallback
		const result = await scraperService.scrapeRealEstateAu(url, {
			usePuppeteer,
			verify,
		});

		if (result.images.length === 0) {
			return next(
				ApiError.badRequest(
					"No property images found. The listing may have been removed or has no photos."
				)
			);
		}

		res.status(200).json({
			success: true,
			message: `Found ${result.count} images`,
			data: {
				sourceUrl: url,
				property: result.property,
				images: result.images,
				count: result.count,
				method: result.method,
			},
		});
	} catch (error) {
		console.error("Scrape error:", error);

		// Handle specific errors
		if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
			return next(ApiError.badRequest("Request timed out. Please try again."));
		}

		if (
			error.message.includes("ACCESS_DENIED") ||
			error.response?.status === 403
		) {
			return next(
				ApiError.badRequest(
					"Access temporarily blocked by the website. Please try again in a few minutes."
				)
			);
		}

		if (error.message.includes("not found") || error.response?.status === 404) {
			return next(
				ApiError.badRequest("Property listing not found. Please check the URL.")
			);
		}

		if (error.message.includes("No property images")) {
			return next(ApiError.badRequest(error.message));
		}

		return next(
			ApiError.badRequest(
				"Failed to scrape images. Please try again or upload images manually."
			)
		);
	}
});

/**
 * @desc    Import scraped images to project
 * @route   POST /api/v1/projects/:id/import-scraped
 * @access  Private
 */
export const importScrapedImages = catchAsync(async (req, res, next) => {
	const {id} = req.params;
	const {images, sourceUrl} = req.body;

	if (!images || !Array.isArray(images) || images.length === 0) {
		return next(ApiError.badRequest("No images provided"));
	}

	// Find project
	const project = await Project.findOne({
		_id: id,
		user: req.user._id,
		isDeleted: false,
	});

	if (!project) {
		return next(ApiError.notFound("Project not found"));
	}

	if (!["draft", "failed"].includes(project.status)) {
		return next(
			ApiError.badRequest("Cannot import images in current project status")
		);
	}

	// Update project status
	project.status = "uploading";
	project.sourceUrl = sourceUrl;
	project.sourceType = "scrape";
	await project.save();

	try {
		const importedImages = [];
		const errors = [];

		// Download and upload each image
		for (let i = 0; i < Math.min(images.length, 20); i++) {
			const img = images[i];

			try {
				// Download image
				const downloaded = await scraperService.downloadImage(img.url);

				// Upload to S3
				const {processAndUploadImage} = await import(
					"../services/s3.service.js"
				);
				const uploaded = await processAndUploadImage(
					{buffer: downloaded.buffer, originalname: `image-${i + 1}.jpg`},
					req.user._id.toString(),
					project._id.toString()
				);

				importedImages.push({
					...uploaded,
					order: project.images.length + i,
					sourceUrl: img.url,
				});
			} catch (err) {
				console.error(`Failed to import image ${i + 1}:`, err.message);
				errors.push({index: i, url: img.url, error: err.message});
			}
		}

		// Add images to project
		project.images = [...(project.images || []), ...importedImages];
		project.status = "draft";
		await project.save();

		res.status(200).json({
			success: true,
			message: `Imported ${importedImages.length} images`,
			data: {
				imported: importedImages.length,
				failed: errors.length,
				errors: errors.length > 0 ? errors : undefined,
				totalImages: project.images.length,
			},
		});
	} catch (error) {
		project.status = "draft";
		await project.save();

		console.error("Import error:", error);
		return next(ApiError.internal("Failed to import images"));
	}
});

/**
 * @desc    Get project by share token (public access)
 * @route   GET /api/v1/projects/shared/:token
 * @access  Public
 */
export const getSharedProject = catchAsync(async (req, res, next) => {
	const project = await Project.findOne({
		shareToken: req.params.token,
		isPublic: true,
		isDeleted: false,
		status: "completed",
	}).select("-queueId -queuePriority -errorMessage -errorCode");

	if (!project) {
		return next(
			ApiError.notFound("Project not found or not publicly accessible")
		);
	}

	// Update view count
	project.views += 1;
	await project.save();

	res.status(200).json({
		success: true,
		data: {
			project,
		},
	});
});

/**
 * @desc    Reorder project images
 * @route   PATCH /api/v1/projects/:id/images/reorder
 * @access  Private
 */
export const reorderImages = catchAsync(async (req, res, next) => {
	const {imageOrder} = req.body; // Array of image IDs in new order

	const project = await Project.findOne({
		_id: req.params.id,
		user: req.user._id,
		isDeleted: false,
	});

	if (!project) {
		return next(ApiError.notFound("Project not found"));
	}

	if (!["draft", "failed"].includes(project.status)) {
		return next(ApiError.badRequest("Cannot reorder images in current status"));
	}

	// Reorder images
	const reorderedImages = imageOrder
		.map((imageId, index) => {
			const image = project.images.find(
				(img) => img._id.toString() === imageId
			);
			if (image) {
				image.order = index;
				return image;
			}
			return null;
		})
		.filter(Boolean);

	project.images = reorderedImages;
	await project.save();

	res.status(200).json({
		success: true,
		message: "Images reordered successfully",
		data: {
			images: project.images,
		},
	});
});

/**
 * @desc    Delete project image
 * @route   DELETE /api/v1/projects/:id/images/:imageId
 * @access  Private
 */
export const deleteImage = catchAsync(async (req, res, next) => {
	const {id, imageId} = req.params;

	const project = await Project.findOne({
		_id: id,
		user: req.user._id,
		isDeleted: false,
	});

	if (!project) {
		return next(ApiError.notFound("Project not found"));
	}

	if (!["draft", "failed"].includes(project.status)) {
		return next(ApiError.badRequest("Cannot delete images in current status"));
	}

	// Find and remove image
	const imageIndex = project.images.findIndex(
		(img) => img._id.toString() === imageId
	);

	if (imageIndex === -1) {
		return next(ApiError.notFound("Image not found"));
	}

	const [removedImage] = project.images.splice(imageIndex, 1);

	// Reorder remaining images
	project.images.forEach((img, index) => {
		img.order = index;
	});

	await project.save();

	// Delete from S3 (optional - can be done via background job)
	try {
		const {deleteFile} = await import("../services/s3.service.js");
		await deleteFile(removedImage.key);
	} catch (error) {
		console.error("Error deleting image from S3:", error);
	}

	res.status(200).json({
		success: true,
		message: "Image deleted successfully",
		data: {
			images: project.images,
		},
	});
});

export default {
	getProjects,
	getProject,
	createProject,
	updateProject,
	deleteProject,
	generateVideo,
	getProjectStatus,
	downloadVideo,
	scrapeImages,
	getSharedProject,
	reorderImages,
	deleteImage,
	importScrapedImages,
};
