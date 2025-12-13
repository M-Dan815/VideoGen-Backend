// src/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Name is required"],
			trim: true,
			minlength: [2, "Name must be at least 2 characters"],
			maxlength: [50, "Name cannot exceed 50 characters"],
		},
		email: {
			type: String,
			required: [true, "Email is required"],
			unique: true,
			lowercase: true,
			trim: true,
			match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
		},
		password: {
			type: String,
			required: [true, "Password is required"],
			minlength: [8, "Password must be at least 8 characters"],
			select: false,
		},
		avatar: {
			type: String,
			default: null,
		},
		role: {
			type: String,
			enum: ["user", "admin"],
			default: "user",
		},
		isEmailVerified: {
			type: Boolean,
			default: false,
		},
		emailVerificationToken: String,
		emailVerificationExpires: Date,
		passwordResetToken: String,
		passwordResetExpires: Date,
		passwordChangedAt: Date,

		// Subscription & Credits
		subscription: {
			plan: {
				type: String,
				enum: ["free", "starter", "creator", "pro", "business"],
				default: "free",
			},
			stripeCustomerId: String,
			stripeSubscriptionId: String,
			status: {
				type: String,
				enum: ["active", "cancelled", "past_due", "trialing", "inactive"],
				default: "inactive",
			},
			currentPeriodStart: Date,
			currentPeriodEnd: Date,
		},
		credits: {
			balance: {
				type: Number,
				default: 5, // Free credits for new users
				min: 0,
			},
			totalUsed: {
				type: Number,
				default: 0,
			},
			lastRefill: Date,
		},

		// User preferences
		preferences: {
			darkMode: {
				type: Boolean,
				default: false,
			},
			emailNotifications: {
				type: Boolean,
				default: true,
			},
			defaultTemplate: {
				type: String,
				default: "cinematic",
			},
		},

		// Account status
		isActive: {
			type: Boolean,
			default: true,
		},
		lastLogin: Date,
		loginCount: {
			type: Number,
			default: 0,
		},
	},
	{
		timestamps: true,
		toJSON: {virtuals: true},
		toObject: {virtuals: true},
	}
);

// Indexes
userSchema.index({email: 1});
userSchema.index({"subscription.stripeCustomerId": 1});
userSchema.index({createdAt: -1});

// Virtual for projects
userSchema.virtual("projects", {
	ref: "Project",
	foreignField: "user",
	localField: "_id",
});

// Hash password before saving
userSchema.pre("save", async function (next) {
	if (!this.isModified("password")) return next();

	this.password = await bcrypt.hash(this.password, 12);
	next();
});

// Update passwordChangedAt when password is modified
userSchema.pre("save", function (next) {
	if (!this.isModified("password") || this.isNew) return next();

	this.passwordChangedAt = Date.now() - 1000;
	next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
	return await bcrypt.compare(candidatePassword, this.password);
};

// Check if password was changed after token was issued
userSchema.methods.changedPasswordAfter = function (tokenIssuedAt) {
	if (this.passwordChangedAt) {
		const changedTimestamp = parseInt(
			this.passwordChangedAt.getTime() / 1000,
			10
		);
		return tokenIssuedAt < changedTimestamp;
	}
	return false;
};

// Generate email verification token
userSchema.methods.createEmailVerificationToken = function () {
	const token = crypto.randomBytes(32).toString("hex");

	this.emailVerificationToken = crypto
		.createHash("sha256")
		.update(token)
		.digest("hex");

	this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

	return token;
};

// Generate password reset token
userSchema.methods.createPasswordResetToken = function () {
	const token = crypto.randomBytes(32).toString("hex");

	this.passwordResetToken = crypto
		.createHash("sha256")
		.update(token)
		.digest("hex");

	this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour

	return token;
};

// Deduct credits
userSchema.methods.deductCredits = async function (amount) {
	if (this.credits.balance < amount) {
		throw new Error("Insufficient credits");
	}

	this.credits.balance -= amount;
	this.credits.totalUsed += amount;
	await this.save();

	return this.credits.balance;
};

// Add credits
userSchema.methods.addCredits = async function (amount) {
	this.credits.balance += amount;
	await this.save();

	return this.credits.balance;
};

// Check if user has enough credits
userSchema.methods.hasCredits = function (amount) {
	return this.credits.balance >= amount;
};

const User = mongoose.model("User", userSchema);

export default User;
