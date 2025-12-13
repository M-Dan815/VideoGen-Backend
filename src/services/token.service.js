// src/services/token.service.js
import jwt from "jsonwebtoken";
import config from "../config/index.js";

/**
 * Generate JWT token
 */
export const generateToken = (userId, expiresIn = config.jwt.expiresIn) => {
	return jwt.sign({id: userId}, config.jwt.secret, {
		expiresIn,
	});
};

/**
 * Verify JWT token
 */
export const verifyToken = (token) => {
	try {
		return jwt.verify(token, config.jwt.secret);
	} catch (error) {
		return null;
	}
};

/**
 * Decode JWT token without verification
 */
export const decodeToken = (token) => {
	try {
		return jwt.decode(token);
	} catch (error) {
		return null;
	}
};

/**
 * Generate access and refresh token pair
 */
export const generateTokenPair = (userId) => {
	const accessToken = generateToken(userId, "15m");
	const refreshToken = generateToken(userId, "7d");

	return {accessToken, refreshToken};
};

/**
 * Create token response with cookie settings
 */
export const createTokenResponse = (user, res) => {
	const token = generateToken(user._id);

	// Cookie options
	const cookieOptions = {
		expires: new Date(
			Date.now() + config.jwt.cookieExpiresIn * 24 * 60 * 60 * 1000
		),
		httpOnly: true,
		secure: config.env === "production",
		sameSite: config.env === "production" ? "strict" : "lax",
	};

	// Set cookie
	res.cookie("jwt", token, cookieOptions);

	return token;
};

/**
 * Clear authentication cookie
 */
export const clearTokenCookie = (res) => {
	res.cookie("jwt", "logged_out", {
		expires: new Date(Date.now() + 10 * 1000),
		httpOnly: true,
	});
};

export default {
	generateToken,
	verifyToken,
	decodeToken,
	generateTokenPair,
	createTokenResponse,
	clearTokenCookie,
};
