// src/utils/validators.js
import Joi from "joi";

// Common validation rules
const password = Joi.string()
	.min(8)
	.max(128)
	.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
	.message(
		"Password must contain at least one uppercase letter, one lowercase letter, and one number"
	);

const email = Joi.string().email().lowercase().trim();

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

// Auth Schemas
export const authSchemas = {
	register: Joi.object({
		name: Joi.string().min(2).max(50).trim().required(),
		email: email.required(),
		password: password.required(),
		confirmPassword: Joi.string()
			.valid(Joi.ref("password"))
			.required()
			.messages({"any.only": "Passwords do not match"}),
	}),

	login: Joi.object({
		email: email.required(),
		password: Joi.string().required(),
	}),

	forgotPassword: Joi.object({
		email: email.required(),
	}),

	resetPassword: Joi.object({
		token: Joi.string().required(),
		password: password.required(),
		confirmPassword: Joi.string()
			.valid(Joi.ref("password"))
			.required()
			.messages({"any.only": "Passwords do not match"}),
	}),

	changePassword: Joi.object({
		currentPassword: Joi.string().required(),
		newPassword: password.required(),
		confirmPassword: Joi.string()
			.valid(Joi.ref("newPassword"))
			.required()
			.messages({"any.only": "Passwords do not match"}),
	}),

	updateProfile: Joi.object({
		name: Joi.string().min(2).max(50).trim(),
		avatar: Joi.string().uri(),
		preferences: Joi.object({
			darkMode: Joi.boolean(),
			emailNotifications: Joi.boolean(),
			defaultTemplate: Joi.string().valid(
				"cinematic",
				"dynamic",
				"smooth",
				"dramatic",
				"minimal"
			),
		}),
	}),

	verifyEmail: Joi.object({
		token: Joi.string().required(),
	}),
};

// Project Schemas
export const projectSchemas = {
	create: Joi.object({
		title: Joi.string().max(100).trim().required(),
		description: Joi.string().max(500).trim(),
		sourceUrl: Joi.string().uri().trim(),
		sourceType: Joi.string().valid("upload", "scrape", "url"),
		settings: Joi.object({
			template: Joi.string().valid(
				"cinematic",
				"dynamic",
				"smooth",
				"dramatic",
				"minimal"
			),
			duration: Joi.number().min(4).max(60),
			aspectRatio: Joi.string().valid("16:9", "9:16", "1:1", "4:3"),
			motion: Joi.string().valid("low", "medium", "high"),
			style: Joi.string(),
			prompt: Joi.string().max(1000),
			negativePrompt: Joi.string().max(500),
			music: Joi.object({
				enabled: Joi.boolean(),
				track: Joi.string(),
				volume: Joi.number().min(0).max(100),
			}),
			watermark: Joi.object({
				enabled: Joi.boolean(),
				text: Joi.string().max(50),
				position: Joi.string().valid(
					"top-left",
					"top-right",
					"bottom-left",
					"bottom-right",
					"center"
				),
			}),
			aiEngine: Joi.string().valid("luma", "runway", "svd", "veo3", "sora2"),
		}),
	}),

	update: Joi.object({
		title: Joi.string().max(100).trim(),
		description: Joi.string().max(500).trim().allow(""),
		settings: Joi.object({
			template: Joi.string().valid(
				"cinematic",
				"dynamic",
				"smooth",
				"dramatic",
				"minimal"
			),
			duration: Joi.number().min(4).max(60),
			aspectRatio: Joi.string().valid("16:9", "9:16", "1:1", "4:3"),
			motion: Joi.string().valid("low", "medium", "high"),
			style: Joi.string(),
			prompt: Joi.string().max(1000),
			negativePrompt: Joi.string().max(500),
			music: Joi.object({
				enabled: Joi.boolean(),
				track: Joi.string(),
				volume: Joi.number().min(0).max(100),
			}),
			watermark: Joi.object({
				enabled: Joi.boolean(),
				text: Joi.string().max(50),
				position: Joi.string().valid(
					"top-left",
					"top-right",
					"bottom-left",
					"bottom-right",
					"center"
				),
			}),
			aiEngine: Joi.string().valid("luma", "runway", "svd", "veo3", "sora2"),
		}),
		isPublic: Joi.boolean(),
	}),

	generate: Joi.object({
		settings: Joi.object({
			template: Joi.string().valid(
				"cinematic",
				"dynamic",
				"smooth",
				"dramatic",
				"minimal"
			),
			duration: Joi.number().min(4).max(60),
			aspectRatio: Joi.string().valid("16:9", "9:16", "1:1", "4:3"),
			motion: Joi.string().valid("low", "medium", "high"),
			style: Joi.string(),
			prompt: Joi.string().max(1000),
			negativePrompt: Joi.string().max(500),
			aiEngine: Joi.string().valid("luma", "runway", "svd", "veo3", "sora2"),
		}),
	}),

	// In projectSchemas object, update the scrape schema:
	scrape: Joi.object({
		url: Joi.string()
			.uri({scheme: ["http", "https"]})
			.required()
			.custom((value, helpers) => {
				try {
					const urlObj = new URL(value);
					if (
						!["realestate.com.au", "www.realestate.com.au"].includes(
							urlObj.hostname
						)
					) {
						return helpers.error("custom.domain");
					}
					if (!value.includes("/property-") && !value.includes("/sold-")) {
						return helpers.error("custom.path");
					}
					return value;
				} catch {
					return helpers.error("string.uri");
				}
			})
			.messages({
				"custom.domain": "Only realestate.com.au URLs are supported",
				"custom.path": "Please provide a valid property listing URL",
				"string.uri": "Please provide a valid URL",
				"any.required": "URL is required",
			}),
		usePuppeteer: Joi.boolean().default(true),
		verify: Joi.boolean().default(false),
	}),

	importScraped: Joi.object({
		images: Joi.array()
			.items(
				Joi.object({
					url: Joi.string().uri().required(),
					alt: Joi.string().allow(""),
				})
			)
			.min(1)
			.max(30)
			.required(),
		sourceUrl: Joi.string().uri(),
	}),

	query: Joi.object({
		page: Joi.number().integer().min(1).default(1),
		limit: Joi.number().integer().min(1).max(50).default(10),
		status: Joi.string().valid("draft", "processing", "completed", "failed"),
		sort: Joi.string().valid(
			"createdAt",
			"-createdAt",
			"title",
			"-title",
			"updatedAt",
			"-updatedAt"
		),
		search: Joi.string().max(100),
	}),
};

// Payment Schemas
export const paymentSchemas = {
	createCheckout: Joi.object({
		planId: Joi.string()
			.valid("starter", "creator", "pro", "business")
			.required(),
	}),

	purchaseCredits: Joi.object({
		amount: Joi.number().valid(25, 50, 100, 200, 500).required(),
	}),

	updatePaymentMethod: Joi.object({
		paymentMethodId: Joi.string().required(),
	}),
};

// Upload Schemas
export const uploadSchemas = {
	projectId: Joi.object({
		projectId: objectId.required(),
	}),
};

// Validate helper function
export const validate = (schema) => (data) => {
	const {error, value} = schema.validate(data, {
		abortEarly: false,
		stripUnknown: true,
	});

	if (error) {
		const errors = error.details.map((detail) => ({
			field: detail.path.join("."),
			message: detail.message,
		}));
		return {error: errors, value: null};
	}

	return {error: null, value};
};
