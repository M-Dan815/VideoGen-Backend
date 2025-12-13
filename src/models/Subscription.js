// src/models/Subscription.js
import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		plan: {
			type: String,
			enum: ["starter", "creator", "pro", "business"],
			required: true,
		},
		status: {
			type: String,
			enum: ["active", "cancelled", "past_due", "trialing", "expired"],
			default: "active",
		},

		// Stripe Information
		stripeSubscriptionId: {
			type: String,
			required: true,
			unique: true,
		},
		stripePriceId: String,
		stripeCustomerId: String,

		// Billing Period
		currentPeriodStart: {
			type: Date,
			required: true,
		},
		currentPeriodEnd: {
			type: Date,
			required: true,
		},

		// Credits
		creditsIncluded: {
			type: Number,
			required: true,
		},
		creditsUsedThisPeriod: {
			type: Number,
			default: 0,
		},

		// Cancellation
		cancelAtPeriodEnd: {
			type: Boolean,
			default: false,
		},
		cancelledAt: Date,
		cancellationReason: String,

		// Trial
		trialStart: Date,
		trialEnd: Date,

		// Payment
		latestInvoiceId: String,
		latestInvoiceStatus: String,
	},
	{
		timestamps: true,
	}
);

// Indexes
subscriptionSchema.index({stripeSubscriptionId: 1});
subscriptionSchema.index({user: 1, status: 1});

// Check if subscription is active
subscriptionSchema.methods.isActive = function () {
	return this.status === "active" || this.status === "trialing";
};

// Check if in grace period
subscriptionSchema.methods.inGracePeriod = function () {
	if (this.cancelAtPeriodEnd && this.status === "active") {
		return new Date() < this.currentPeriodEnd;
	}
	return false;
};

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;
