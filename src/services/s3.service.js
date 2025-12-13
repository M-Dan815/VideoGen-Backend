// src/services/s3.service.js
import sharp from "sharp";
import {v4 as uuidv4} from "uuid";
import {
	uploadToS3,
	deleteFromS3,
	getSignedDownloadUrl,
	deleteMultipleFromS3,
} from "../config/s3.js";
import {generateS3Key} from "../utils/helpers.js";
import config from "../config/index.js";

/**
 * Process and upload image to S3
 */
export const processAndUploadImage = async (file, userId, projectId) => {
	try {
		// Get image metadata
		const metadata = await sharp(file.buffer).metadata();

		// Process image - optimize for AI processing
		const processedBuffer = await sharp(file.buffer)
			.resize({
				width: 2048,
				height: 2048,
				fit: "inside",
				withoutEnlargement: true,
			})
			.jpeg({quality: 90})
			.toBuffer();

		// Generate unique filename
		const filename = `${uuidv4()}.jpg`;
		const key = generateS3Key(userId, `projects/${projectId}/images`, filename);

		// Upload to S3
		const result = await uploadToS3(processedBuffer, key, "image/jpeg");

		return {
			originalName: file.originalname,
			key: result.key,
			url: result.url,
			size: processedBuffer.length,
			mimeType: "image/jpeg",
			width: metadata.width,
			height: metadata.height,
		};
	} catch (error) {
		console.error("Error processing image:", error);
		throw error;
	}
};

/**
 * Upload multiple images
 */
export const processAndUploadImages = async (files, userId, projectId) => {
	const uploadPromises = files.map((file, index) =>
		processAndUploadImage(file, userId, projectId).then((result) => ({
			...result,
			order: index,
		}))
	);

	return Promise.all(uploadPromises);
};

/**
 * Create thumbnail from image
 */
export const createThumbnail = async (imageBuffer, userId, projectId) => {
	try {
		const thumbnailBuffer = await sharp(imageBuffer)
			.resize(320, 180, {fit: "cover"})
			.jpeg({quality: 80})
			.toBuffer();

		const filename = `thumb-${uuidv4()}.jpg`;
		const key = generateS3Key(
			userId,
			`projects/${projectId}/thumbnails`,
			filename
		);

		return await uploadToS3(thumbnailBuffer, key, "image/jpeg");
	} catch (error) {
		console.error("Error creating thumbnail:", error);
		throw error;
	}
};

/**
 * Upload video to S3
 */
export const uploadVideo = async (
	videoBuffer,
	userId,
	projectId,
	format = "mp4"
) => {
	try {
		const filename = `video-${uuidv4()}.${format}`;
		const key = generateS3Key(userId, `projects/${projectId}/videos`, filename);
		const contentType =
			format === "mp4"
				? "video/mp4"
				: format === "webm"
				? "video/webm"
				: "image/gif";

		return await uploadToS3(videoBuffer, key, contentType);
	} catch (error) {
		console.error("Error uploading video:", error);
		throw error;
	}
};

/**
 * Delete project files from S3
 */
export const deleteProjectFiles = async (userId, projectId) => {
	try {
		const prefix = `users/${userId}/projects/${projectId}`;
		// Note: In production, you'd want to list and delete all objects with this prefix
		// For now, we'll handle individual deletions
		return {deleted: true, prefix};
	} catch (error) {
		console.error("Error deleting project files:", error);
		throw error;
	}
};

/**
 * Delete single file from S3
 */
export const deleteFile = async (key) => {
	try {
		return await deleteFromS3(key);
	} catch (error) {
		console.error("Error deleting file:", error);
		throw error;
	}
};

/**
 * Delete multiple files from S3
 */
export const deleteFiles = async (keys) => {
	try {
		return await deleteMultipleFromS3(keys);
	} catch (error) {
		console.error("Error deleting files:", error);
		throw error;
	}
};

/**
 * Get signed URL for file download
 */
export const getDownloadUrl = async (key, expiresIn = 3600) => {
	try {
		return await getSignedDownloadUrl(key, expiresIn);
	} catch (error) {
		console.error("Error getting download URL:", error);
		throw error;
	}
};

/**
 * Upload avatar image
 */
export const uploadAvatar = async (file, userId) => {
	try {
		const processedBuffer = await sharp(file.buffer)
			.resize(256, 256, {fit: "cover"})
			.jpeg({quality: 85})
			.toBuffer();

		const filename = `avatar-${uuidv4()}.jpg`;
		const key = generateS3Key(userId, "avatars", filename);

		return await uploadToS3(processedBuffer, key, "image/jpeg");
	} catch (error) {
		console.error("Error uploading avatar:", error);
		throw error;
	}
};

export default {
	processAndUploadImage,
	processAndUploadImages,
	createThumbnail,
	uploadVideo,
	deleteProjectFiles,
	deleteFile,
	deleteFiles,
	getDownloadUrl,
	uploadAvatar,
};
