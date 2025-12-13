// src/middleware/error.middleware.js
import ApiError from "../utils/ApiError.js";
import config from "../config/index.js";

// Handle Mongoose CastError (Invalid ObjectId)
const handleCastError = (err) => {
	const message = `Invalid ${err.path}: ${err.value}`;
	return ApiError.badRequest(message);
};

// Handle Mongoose Duplicate Key Error
const handleDuplicateKeyError = (err) => {
	const field = Object.keys(err.keyValue)[0];
	const message = `${field} already exists`;
	return ApiError.conflict(message);
};

// Handle Mongoose Validation Error
const handleValidationError = (err) => {
	const errors = Object.values(err.errors).map((el) => ({
		field: el.path,
		message: el.message,
	}));
	return ApiError.validation(errors);
};

// Handle JWT Error
const handleJWTError = () => {
	return ApiError.unauthorized("Invalid token. Please login again.");
};

// Handle JWT Expired Error
const handleJWTExpiredError = () => {
	return ApiError.unauthorized("Your token has expired. Please login again.");
};

// Development Error Response
const sendErrorDev = (err, res) => {
	res.status(err.statusCode).json({
		success: false,
		status: err.status,
		message: err.message,
		errors: err.errors,
		stack: err.stack,
		error: err,
	});
};

// Production Error Response
const sendErrorProd = (err, res) => {
	// Operational, trusted error: send message to client
	if (err.isOperational) {
		res.status(err.statusCode).json({
			success: false,
			status: err.status,
			message: err.message,
			errors: err.errors,
		});
	} else {
		// Programming or other unknown error: don't leak error details
		console.error("ERROR 💥:", err);
		res.status(500).json({
			success: false,
			status: "error",
			message: "Something went wrong",
		});
	}
};

// Global Error Handler
export const errorHandler = (err, req, res, next) => {
	err.statusCode = err.statusCode || 500;
	err.status = err.status || "error";

	if (config.env === "development") {
		sendErrorDev(err, res);
	} else {
		let error = {...err};
		error.message = err.message;

		// Handle specific error types
		if (err.name === "CastError") error = handleCastError(err);
		if (err.code === 11000) error = handleDuplicateKeyError(err);
		if (err.name === "ValidationError") error = handleValidationError(err);
		if (err.name === "JsonWebTokenError") error = handleJWTError();
		if (err.name === "TokenExpiredError") error = handleJWTExpiredError();

		sendErrorProd(error, res);
	}
};

// 404 Not Found Handler
export const notFoundHandler = (req, res, next) => {
	next(ApiError.notFound(`Route ${req.originalUrl} not found`));
};
