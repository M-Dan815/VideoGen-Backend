// src/config/index.js
import dotenv from "dotenv";
dotenv.config();

const config = {
	// Server
	env: process.env.NODE_ENV || "development",
	port: parseInt(process.env.PORT, 10) || 5000,
	clientUrl: process.env.CLIENT_URL || "http://localhost:5173",

	// Database
	mongodbUri: process.env.MONGODB_URI,

	// JWT
	jwt: {
		secret: process.env.JWT_SECRET,
		expiresIn: process.env.JWT_EXPIRES_IN || "7d",
		cookieExpiresIn: parseInt(process.env.JWT_COOKIE_EXPIRES_IN, 10) || 7,
	},

	// AWS S3
	aws: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		region: process.env.AWS_REGION || "us-east-1",
		s3Bucket: process.env.AWS_S3_BUCKET,
	},

	// Email
	email: {
		host: process.env.SMTP_HOST,
		port: parseInt(process.env.SMTP_PORT, 10) || 587,
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
		from: process.env.EMAIL_FROM,
	},

	// Stripe
	stripe: {
		secretKey: process.env.STRIPE_SECRET_KEY,
		webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
		prices: {
			starter: process.env.STRIPE_PRICE_STARTER,
			creator: process.env.STRIPE_PRICE_CREATOR,
			pro: process.env.STRIPE_PRICE_PRO,
			business: process.env.STRIPE_PRICE_BUSINESS,
		},
	},

	// Rate Limiting
	rateLimit: {
		windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
		max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
	},

	// File Upload
	upload: {
		maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760, // 10MB
		maxFiles: parseInt(process.env.MAX_FILES, 10) || 20,
		allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
	},

	// Subscription Plans
	plans: {
		starter: {
			name: "Starter",
			credits: 25,
			price: 19,
			features: ["Luma only", "Watermark customization", "Email support"],
		},
		creator: {
			name: "Creator",
			credits: 70,
			price: 39,
			features: [
				"5 templates",
				"Backup AI engine",
				"Priority queue",
				"HD exports",
			],
		},
		pro: {
			name: "Pro",
			credits: 160,
			price: 79,
			features: [
				"Premium videos (Veo 3)",
				"Real-time queue",
				"Advanced enhancements",
				"Priority support",
			],
		},
		business: {
			name: "Business",
			credits: 350,
			price: 149,
			features: [
				"Sora 2 access",
				"Team accounts",
				"Admin tools",
				"Optional API",
				"Dedicated support",
			],
		},
	},
};

export default config;
