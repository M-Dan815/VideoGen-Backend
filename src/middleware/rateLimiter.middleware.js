// src/middleware/rateLimiter.middleware.js
import rateLimit from "express-rate-limit";
import ApiError from "../utils/ApiError.js";
import config from "../config/index.js";

// General API rate limiter
export const apiLimiter = rateLimit({
	windowMs: config.rateLimit.windowMs, // 15 minutes
	max: config.rateLimit.max, // 100 requests per window
	message: {
		success: false,
		message: "Too many requests, please try again later.",
	},
	standardHeaders: true,
	legacyHeaders: false,
	handler: (req, res, next, options) => {
		next(ApiError.tooManyRequests(options.message.message));
	},
});

// Strict limiter for auth routes
export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10, // 10 attempts per window
	message: {
		success: false,
		message:
			"Too many authentication attempts, please try again after 15 minutes.",
	},
	standardHeaders: true,
	legacyHeaders: false,
	skipSuccessfulRequests: true,
	handler: (req, res, next, options) => {
		next(ApiError.tooManyRequests(options.message.message));
	},
});

// Password reset limiter
export const passwordResetLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 5, // 5 requests per hour
	message: {
		success: false,
		message:
			"Too many password reset requests, please try again after an hour.",
	},
	standardHeaders: true,
	legacyHeaders: false,
	handler: (req, res, next, options) => {
		next(ApiError.tooManyRequests(options.message.message));
	},
});

// Upload limiter
export const uploadLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 100, // 100 uploads per hour
	message: {
		success: false,
		message: "Upload limit exceeded, please try again later.",
	},
	standardHeaders: true,
	legacyHeaders: false,
	handler: (req, res, next, options) => {
		next(ApiError.tooManyRequests(options.message.message));
	},
});

// Video generation limiter
export const generationLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 20, // 20 generations per hour
	message: {
		success: false,
		message: "Generation limit exceeded, please try again later.",
	},
	standardHeaders: true,
	legacyHeaders: false,
	handler: (req, res, next, options) => {
		next(ApiError.tooManyRequests(options.message.message));
	},
});

// Create custom rate limiter
export const createRateLimiter = (options) => {
	return rateLimit({
		standardHeaders: true,
		legacyHeaders: false,
		handler: (req, res, next, opts) => {
			next(
				ApiError.tooManyRequests(opts.message?.message || "Rate limit exceeded")
			);
		},
		...options,
	});
};
