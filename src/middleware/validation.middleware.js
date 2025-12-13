// src/middleware/validation.middleware.js
import ApiError from "../utils/ApiError.js";

/**
 * Validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 */
export const validateRequest = (schema, property = "body") => {
	return (req, res, next) => {
		const {error, value} = schema.validate(req[property], {
			abortEarly: false,
			stripUnknown: true,
		});

		if (error) {
			const errors = error.details.map((detail) => ({
				field: detail.path.join("."),
				message: detail.message.replace(/"/g, ""),
			}));

			return next(ApiError.validation(errors));
		}

		// Replace with validated and sanitized values
		req[property] = value;
		next();
	};
};

/**
 * Validate body
 */
export const validateBody = (schema) => validateRequest(schema, "body");

/**
 * Validate query parameters
 */
export const validateQuery = (schema) => validateRequest(schema, "query");

/**
 * Validate URL parameters
 */
export const validateParams = (schema) => validateRequest(schema, "params");

/**
 * Validate MongoDB ObjectId parameter
 */
export const validateObjectId = (paramName = "id") => {
	return (req, res, next) => {
		const id = req.params[paramName];

		if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
			return next(ApiError.badRequest(`Invalid ${paramName} format`));
		}

		next();
	};
};
