// src/middleware/auth.middleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import catchAsync from "../utils/catchAsync.js";
import config from "../config/index.js";

// Protect routes - Require authentication
export const protect = catchAsync(async (req, res, next) => {
	let token;

	// Get token from Authorization header
	if (req.headers.authorization?.startsWith("Bearer")) {
		token = req.headers.authorization.split(" ")[1];
	}
	// Or from cookies
	else if (req.cookies?.jwt) {
		token = req.cookies.jwt;
	}

	if (!token) {
		return next(
			ApiError.unauthorized(
				"You are not logged in. Please login to get access."
			)
		);
	}

	try {
		// Verify token
		const decoded = jwt.verify(token, config.jwt.secret);

		// Check if user still exists
		const user = await User.findById(decoded.id).select("+password");

		if (!user) {
			return next(
				ApiError.unauthorized(
					"The user belonging to this token no longer exists."
				)
			);
		}

		// Check if user is active
		if (!user.isActive) {
			return next(
				ApiError.unauthorized(
					"Your account has been deactivated. Please contact support."
				)
			);
		}

		// Check if user changed password after the token was issued
		if (user.changedPasswordAfter(decoded.iat)) {
			return next(
				ApiError.unauthorized(
					"User recently changed password. Please login again."
				)
			);
		}

		// Grant access - attach user to request
		req.user = user;
		next();
	} catch (error) {
		if (error.name === "JsonWebTokenError") {
			return next(ApiError.unauthorized("Invalid token. Please login again."));
		}
		if (error.name === "TokenExpiredError") {
			return next(
				ApiError.unauthorized("Your token has expired. Please login again.")
			);
		}
		throw error;
	}
});

// Optional authentication - Attach user if token exists
export const optionalAuth = catchAsync(async (req, res, next) => {
	let token;

	if (req.headers.authorization?.startsWith("Bearer")) {
		token = req.headers.authorization.split(" ")[1];
	} else if (req.cookies?.jwt) {
		token = req.cookies.jwt;
	}

	if (!token) {
		return next();
	}

	try {
		const decoded = jwt.verify(token, config.jwt.secret);
		const user = await User.findById(decoded.id);

		if (user && user.isActive && !user.changedPasswordAfter(decoded.iat)) {
			req.user = user;
		}
	} catch (error) {
		// Silently fail - optional auth
	}

	next();
});

// Restrict to specific roles
export const restrictTo = (...roles) => {
	return (req, res, next) => {
		if (!roles.includes(req.user.role)) {
			return next(
				ApiError.forbidden("You do not have permission to perform this action.")
			);
		}
		next();
	};
};

// Require email verification
export const requireEmailVerification = (req, res, next) => {
	if (!req.user.isEmailVerified) {
		return next(
			ApiError.forbidden(
				"Please verify your email address to access this resource."
			)
		);
	}
	next();
};

// Require active subscription
export const requireSubscription = (req, res, next) => {
	const {subscription} = req.user;

	if (!subscription || subscription.status !== "active") {
		return next(
			ApiError.forbidden(
				"An active subscription is required to access this feature."
			)
		);
	}
	next();
};

// Require minimum plan
export const requirePlan = (...allowedPlans) => {
	return (req, res, next) => {
		const {subscription} = req.user;

		if (!subscription || !allowedPlans.includes(subscription.plan)) {
			return next(
				ApiError.forbidden(
					`This feature requires one of the following plans: ${allowedPlans.join(
						", "
					)}`
				)
			);
		}
		next();
	};
};

// Require credits
export const requireCredits = (amount = 1) => {
	return (req, res, next) => {
		if (!req.user.hasCredits(amount)) {
			return next(
				ApiError.forbidden(
					`Insufficient credits. You need ${amount} credits for this action.`
				)
			);
		}
		next();
	};
};
