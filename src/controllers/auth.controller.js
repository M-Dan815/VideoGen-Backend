// src/controllers/auth.controller.js
import crypto from "crypto";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import catchAsync from "../utils/catchAsync.js";
import {sanitizeUser} from "../utils/helpers.js";
import {
	createTokenResponse,
	clearTokenCookie,
	generateToken,
} from "../services/token.service.js";
import {
	sendVerificationEmail,
	sendPasswordResetEmail,
	sendWelcomeEmail,
} from "../services/email.service.js";
import config from "../config/index.js";

/**
 * @desc    Register new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const register = catchAsync(async (req, res, next) => {
	const {name, email, password} = req.body;

	// Check if user already exists
	const existingUser = await User.findOne({email});
	if (existingUser) {
		return next(ApiError.conflict("Email already registered"));
	}

	// Create user
	const user = await User.create({
		name,
		email,
		password,
		credits: {
			balance: 5, // Free credits for new users
			totalUsed: 0,
		},
	});

	// Generate email verification token
	const verificationToken = user.createEmailVerificationToken();
	await user.save({validateBeforeSave: false});

	// Send verification email
	try {
		await sendVerificationEmail(user, verificationToken);
	} catch (error) {
		console.error("Failed to send verification email:", error);
		// Don't fail registration if email fails
	}

	// Create token and send response
	const token = createTokenResponse(user, res);

	res.status(201).json({
		success: true,
		message: "Registration successful. Please verify your email.",
		data: {
			user: sanitizeUser(user),
			token,
		},
	});
});

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = catchAsync(async (req, res, next) => {
	const {email, password} = req.body;

	// Find user and include password
	const user = await User.findOne({email}).select("+password");

	if (!user || !(await user.comparePassword(password))) {
		return next(ApiError.unauthorized("Invalid email or password"));
	}

	// Check if user is active
	if (!user.isActive) {
		return next(
			ApiError.unauthorized(
				"Your account has been deactivated. Please contact support."
			)
		);
	}

	// Update login stats
	user.lastLogin = new Date();
	user.loginCount += 1;
	await user.save({validateBeforeSave: false});

	// Create token and send response
	const token = createTokenResponse(user, res);

	res.status(200).json({
		success: true,
		message: "Login successful",
		data: {
			user: sanitizeUser(user),
			token,
		},
	});
});

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
export const logout = catchAsync(async (req, res, next) => {
	clearTokenCookie(res);

	res.status(200).json({
		success: true,
		message: "Logged out successfully",
	});
});

/**
 * @desc    Get current user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
export const getMe = catchAsync(async (req, res, next) => {
	const user = await User.findById(req.user._id);

	res.status(200).json({
		success: true,
		data: {
			user: sanitizeUser(user),
		},
	});
});

/**
 * @desc    Update user profile
 * @route   PATCH /api/v1/auth/profile
 * @access  Private
 */
export const updateProfile = catchAsync(async (req, res, next) => {
	const {name, avatar, preferences} = req.body;

	// Build update object
	const updates = {};
	if (name) updates.name = name;
	if (avatar) updates.avatar = avatar;
	if (preferences) {
		updates.preferences = {
			...req.user.preferences,
			...preferences,
		};
	}

	const user = await User.findByIdAndUpdate(req.user._id, updates, {
		new: true,
		runValidators: true,
	});

	res.status(200).json({
		success: true,
		message: "Profile updated successfully",
		data: {
			user: sanitizeUser(user),
		},
	});
});

/**
 * @desc    Change password
 * @route   POST /api/v1/auth/change-password
 * @access  Private
 */
export const changePassword = catchAsync(async (req, res, next) => {
	const {currentPassword, newPassword} = req.body;

	// Get user with password
	const user = await User.findById(req.user._id).select("+password");

	// Check current password
	if (!(await user.comparePassword(currentPassword))) {
		return next(ApiError.unauthorized("Current password is incorrect"));
	}

	// Update password
	user.password = newPassword;
	await user.save();

	// Create new token
	const token = createTokenResponse(user, res);

	res.status(200).json({
		success: true,
		message: "Password changed successfully",
		data: {
			token,
		},
	});
});

/**
 * @desc    Forgot password
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = catchAsync(async (req, res, next) => {
	const {email} = req.body;

	const user = await User.findOne({email});

	if (!user) {
		// Don't reveal if email exists
		return res.status(200).json({
			success: true,
			message:
				"If an account with that email exists, a password reset link has been sent.",
		});
	}

	// Generate reset token
	const resetToken = user.createPasswordResetToken();
	await user.save({validateBeforeSave: false});

	// Send email
	try {
		await sendPasswordResetEmail(user, resetToken);

		res.status(200).json({
			success: true,
			message:
				"If an account with that email exists, a password reset link has been sent.",
		});
	} catch (error) {
		// Clear reset token on error
		user.passwordResetToken = undefined;
		user.passwordResetExpires = undefined;
		await user.save({validateBeforeSave: false});

		return next(
			ApiError.internal("Error sending email. Please try again later.")
		);
	}
});

/**
 * @desc    Reset password
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 */
export const resetPassword = catchAsync(async (req, res, next) => {
	const {token, password} = req.body;

	// Hash the token
	const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

	// Find user with valid token
	const user = await User.findOne({
		passwordResetToken: hashedToken,
		passwordResetExpires: {$gt: Date.now()},
	});

	if (!user) {
		return next(ApiError.badRequest("Invalid or expired reset token"));
	}

	// Update password
	user.password = password;
	user.passwordResetToken = undefined;
	user.passwordResetExpires = undefined;
	await user.save();

	// Create new token
	const authToken = createTokenResponse(user, res);

	res.status(200).json({
		success: true,
		message: "Password reset successful",
		data: {
			token: authToken,
		},
	});
});

/**
 * @desc    Verify email
 * @route   POST /api/v1/auth/verify-email
 * @access  Public
 */
export const verifyEmail = catchAsync(async (req, res, next) => {
	const {token} = req.body;

	// Hash the token
	const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

	// Find user with valid token
	const user = await User.findOne({
		emailVerificationToken: hashedToken,
		emailVerificationExpires: {$gt: Date.now()},
	});

	if (!user) {
		return next(ApiError.badRequest("Invalid or expired verification token"));
	}

	// Verify email
	user.isEmailVerified = true;
	user.emailVerificationToken = undefined;
	user.emailVerificationExpires = undefined;
	await user.save({validateBeforeSave: false});

	// Send welcome email
	try {
		await sendWelcomeEmail(user);
	} catch (error) {
		console.error("Failed to send welcome email:", error);
	}

	res.status(200).json({
		success: true,
		message: "Email verified successfully",
		data: {
			user: sanitizeUser(user),
		},
	});
});

/**
 * @desc    Resend verification email
 * @route   POST /api/v1/auth/resend-verification
 * @access  Private
 */
export const resendVerification = catchAsync(async (req, res, next) => {
	const user = await User.findById(req.user._id);

	if (user.isEmailVerified) {
		return next(ApiError.badRequest("Email is already verified"));
	}

	// Generate new verification token
	const verificationToken = user.createEmailVerificationToken();
	await user.save({validateBeforeSave: false});

	// Send email
	try {
		await sendVerificationEmail(user, verificationToken);

		res.status(200).json({
			success: true,
			message: "Verification email sent successfully",
		});
	} catch (error) {
		user.emailVerificationToken = undefined;
		user.emailVerificationExpires = undefined;
		await user.save({validateBeforeSave: false});

		return next(
			ApiError.internal("Error sending email. Please try again later.")
		);
	}
});

/**
 * @desc    Refresh token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Private
 */
export const refreshToken = catchAsync(async (req, res, next) => {
	const token = createTokenResponse(req.user, res);

	res.status(200).json({
		success: true,
		data: {
			token,
		},
	});
});

export default {
	register,
	login,
	logout,
	getMe,
	updateProfile,
	changePassword,
	forgotPassword,
	resetPassword,
	verifyEmail,
	resendVerification,
	refreshToken,
};
