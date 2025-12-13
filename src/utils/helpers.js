// src/utils/helpers.js
import crypto from "crypto";

/**
 * Generate a random string
 */
export const generateRandomString = (length = 32) => {
	return crypto.randomBytes(length).toString("hex");
};

/**
 * Generate a unique filename
 */
export const generateUniqueFilename = (originalName, prefix = "") => {
	const timestamp = Date.now();
	const randomString = crypto.randomBytes(8).toString("hex");
	const extension = originalName.split(".").pop();
	return `${prefix}${timestamp}-${randomString}.${extension}`;
};

/**
 * Generate S3 key for user uploads
 */
export const generateS3Key = (userId, folder, filename) => {
	return `users/${userId}/${folder}/${filename}`;
};

/**
 * Calculate credits needed based on settings
 */
export const calculateCredits = (settings) => {
	let credits = 1; // Base credit

	// Duration-based credits
	if (settings.duration > 8) {
		credits += Math.ceil((settings.duration - 8) / 4);
	}

	// Quality-based credits
	if (settings.quality === "4k") {
		credits += 1;
	}

	// Engine-based credits
	const engineCredits = {
		luma: 0,
		runway: 0,
		svd: 0,
		veo3: 4,
		sora2: 5,
	};
	credits += engineCredits[settings.aiEngine] || 0;

	return credits;
};

/**
 * Format file size
 */
export const formatFileSize = (bytes) => {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * Paginate results
 */
export const paginate = (page = 1, limit = 10) => {
	const skip = (page - 1) * limit;
	return {skip, limit: parseInt(limit, 10)};
};

/**
 * Create pagination response
 */
export const paginationResponse = (total, page, limit) => {
	const totalPages = Math.ceil(total / limit);
	return {
		total,
		page: parseInt(page, 10),
		limit: parseInt(limit, 10),
		totalPages,
		hasNextPage: page < totalPages,
		hasPrevPage: page > 1,
	};
};

/**
 * Sanitize user object for response
 */
export const sanitizeUser = (user) => {
	const userObj = user.toObject ? user.toObject() : user;
	delete userObj.password;
	delete userObj.emailVerificationToken;
	delete userObj.emailVerificationExpires;
	delete userObj.passwordResetToken;
	delete userObj.passwordResetExpires;
	delete userObj.__v;
	return userObj;
};

/**
 * Sleep helper for testing/debugging
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extract domain from URL
 */
export const extractDomain = (url) => {
	try {
		const urlObj = new URL(url);
		return urlObj.hostname;
	} catch {
		return null;
	}
};

/**
 * Validate URL
 */
export const isValidUrl = (string) => {
	try {
		new URL(string);
		return true;
	} catch {
		return false;
	}
};
