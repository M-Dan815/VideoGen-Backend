// src/routes/auth.routes.js
import {Router} from "express";
import authController from "../controllers/auth.controller.js";
import {protect} from "../middleware/auth.middleware.js";
import {validateBody} from "../middleware/validation.middleware.js";
import {
	authLimiter,
	passwordResetLimiter,
} from "../middleware/rateLimiter.middleware.js";
import {authSchemas} from "../utils/validators.js";

const router = Router();

// Public routes with rate limiting
router.post(
	"/register",
	authLimiter,
	// validateBody(authSchemas.register),
	authController.register
);

router.post(
	"/login",
	authLimiter,
	validateBody(authSchemas.login),
	authController.login
);

router.post(
	"/forgot-password",
	passwordResetLimiter,
	validateBody(authSchemas.forgotPassword),
	authController.forgotPassword
);

router.post(
	"/reset-password",
	passwordResetLimiter,
	validateBody(authSchemas.resetPassword),
	authController.resetPassword
);

router.post(
	"/verify-email",
	validateBody(authSchemas.verifyEmail),
	authController.verifyEmail
);

// Protected routes
router.use(protect);

router.post("/logout", authController.logout);

router.get("/me", authController.getMe);

router.patch(
	"/profile",
	validateBody(authSchemas.updateProfile),
	authController.updateProfile
);

router.post(
	"/change-password",
	validateBody(authSchemas.changePassword),
	authController.changePassword
);

router.post("/resend-verification", authController.resendVerification);

router.post("/refresh-token", authController.refreshToken);

export default router;
