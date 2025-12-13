// src/models/Transaction.js
import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		type: {
			type: String,
			enum: ["subscription", "credits", "addon", "refund"],
			required: true,
		},

		// Stripe Information
		stripePaymentIntentId: String,
		stripeInvoiceId: String,
		stripeChargeId: String,

		// Amount
		amount: {
			type: Number,
			required: true,
		},
		currency: {
			type: String,
			default: "usd",
		},

		// Status
		status: {
			type: String,
			enum: ["pending", "succeeded", "failed", "refunded", "cancelled"],
			default: "pending",
		},

		// Description
		description: String,

		// Related entities
		subscription: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Subscription",
		},
		plan: String,
		creditsAdded: Number,

		// Metadata
		metadata: {
			type: Map,
			of: String,
		},

		// Receipt
		receiptUrl: String,
		invoiceUrl: String,

		// Refund info
		refundedAmount: Number,
		refundReason: String,
		refundedAt: Date,
	},
	{
		timestamps: true,
	}
);

// Indexes
transactionSchema.index({user: 1, createdAt: -1});
transactionSchema.index({stripePaymentIntentId: 1});
transactionSchema.index({status: 1});

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
