// src/app.js (Updated for Stripe webhook)
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";

import routes from "./routes/index.js";
import {errorHandler, notFoundHandler} from "./middleware/error.middleware.js";
import {apiLimiter} from "./middleware/rateLimiter.middleware.js";
import paymentController from "./controllers/payment.controller.js";

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Stripe webhook route - MUST be before body parsers
app.post(
	"/api/v1/payments/webhook",
	express.raw({type: "application/json"}),
	paymentController.handleWebhook
);

// Security Middleware
app.use(
	helmet({
		crossOriginResourcePolicy: {policy: "cross-origin"},
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				imgSrc: ["'self'", "data:", "https:"],
				scriptSrc: ["'self'"],
			},
		},
	})
);

// CORS Configuration
app.use(
	cors({
		origin: process.env.CLIENT_URL || "http://localhost:3000",
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
	})
);

// Body parsers
app.use(express.json({limit: "10mb"}));
app.use(express.urlencoded({extended: true, limit: "10mb"}));

// Cookie parser
app.use(cookieParser());

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Prevent HTTP Parameter Pollution
app.use(
	hpp({
		whitelist: ["sort", "limit", "page", "status", "template"],
	})
);

// Logging (only in development)
if (process.env.NODE_ENV === "development") {
	app.use(morgan("dev"));
}

// Rate limiting
app.use("/api", apiLimiter);

// Health check endpoint
app.get("/health", (req, res) => {
	res.status(200).json({
		success: true,
		message: "Server is healthy",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
	});
});

// API Routes
app.use("/api", routes);

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export default app;
