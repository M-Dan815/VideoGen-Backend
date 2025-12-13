// src/controllers/payment.controller.js
import Stripe from "stripe";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import Transaction from "../models/Transaction.js";
import ApiError from "../utils/ApiError.js";
import catchAsync from "../utils/catchAsync.js";
import config from "../config/index.js";

const stripe = new Stripe(config.stripe.secretKey);

/**
 * @desc    Get subscription plans
 * @route   GET /api/v1/payments/plans
 * @access  Public
 */
export const getPlans = catchAsync(async (req, res, next) => {
	const plans = Object.entries(config.plans).map(([key, plan]) => ({
		id: key,
		...plan,
		priceId: config.stripe.prices[key],
	}));

	res.status(200).json({
		success: true,
		data: {
			plans,
		},
	});
});

/**
 * @desc    Create checkout session
 * @route   POST /api/v1/payments/create-checkout
 * @access  Private
 */
export const createCheckoutSession = catchAsync(async (req, res, next) => {
	const {planId} = req.body;

	// Validate plan
	if (!config.plans[planId]) {
		return next(ApiError.badRequest("Invalid plan selected"));
	}

	const priceId = config.stripe.prices[planId];
	if (!priceId) {
		return next(ApiError.badRequest("Price not configured for this plan"));
	}

	// Get or create Stripe customer
	let customerId = req.user.subscription?.stripeCustomerId;

	if (!customerId) {
		const customer = await stripe.customers.create({
			email: req.user.email,
			name: req.user.name,
			metadata: {
				userId: req.user._id.toString(),
			},
		});
		customerId = customer.id;

		// Save customer ID
		req.user.subscription = {
			...req.user.subscription,
			stripeCustomerId: customerId,
		};
		await req.user.save();
	}

	// Create checkout session
	const session = await stripe.checkout.sessions.create({
		customer: customerId,
		payment_method_types: ["card"],
		line_items: [
			{
				price: priceId,
				quantity: 1,
			},
		],
		mode: "subscription",
		success_url: `${config.clientUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${config.clientUrl}/pricing?payment=cancelled`,
		metadata: {
			userId: req.user._id.toString(),
			planId,
		},
		subscription_data: {
			metadata: {
				userId: req.user._id.toString(),
				planId,
			},
		},
	});

	res.status(200).json({
		success: true,
		data: {
			sessionId: session.id,
			url: session.url,
		},
	});
});

/**
 * @desc    Get billing history
 * @route   GET /api/v1/payments/history
 * @access  Private
 */
export const getBillingHistory = catchAsync(async (req, res, next) => {
	const transactions = await Transaction.find({user: req.user._id})
		.sort("-createdAt")
		.limit(50);

	res.status(200).json({
		success: true,
		data: {
			transactions,
		},
	});
});

/**
 * @desc    Get current subscription
 * @route   GET /api/v1/payments/subscription
 * @access  Private
 */
export const getCurrentSubscription = catchAsync(async (req, res, next) => {
	const subscription = await Subscription.findOne({
		user: req.user._id,
		status: {$in: ["active", "trialing", "past_due"]},
	});

	const userSubscription = {
		plan: req.user.subscription?.plan || "free",
		status: req.user.subscription?.status || "inactive",
		credits: req.user.credits,
		currentPeriodEnd: req.user.subscription?.currentPeriodEnd,
	};

	res.status(200).json({
		success: true,
		data: {
			subscription: subscription || null,
			user: userSubscription,
		},
	});
});

/**
 * @desc    Cancel subscription
 * @route   POST /api/v1/payments/cancel-subscription
 * @access  Private
 */
export const cancelSubscription = catchAsync(async (req, res, next) => {
	const subscriptionId = req.user.subscription?.stripeSubscriptionId;

	if (!subscriptionId) {
		return next(ApiError.badRequest("No active subscription found"));
	}

	// Cancel at period end
	const subscription = await stripe.subscriptions.update(subscriptionId, {
		cancel_at_period_end: true,
	});

	// Update local subscription
	await Subscription.findOneAndUpdate(
		{stripeSubscriptionId: subscriptionId},
		{
			cancelAtPeriodEnd: true,
			cancelledAt: new Date(),
		}
	);

	res.status(200).json({
		success: true,
		message: "Subscription will be cancelled at the end of the billing period",
		data: {
			cancelAt: new Date(subscription.current_period_end * 1000),
		},
	});
});

/**
 * @desc    Update payment method
 * @route   POST /api/v1/payments/update-payment-method
 * @access  Private
 */
export const updatePaymentMethod = catchAsync(async (req, res, next) => {
	const {paymentMethodId} = req.body;
	const customerId = req.user.subscription?.stripeCustomerId;

	if (!customerId) {
		return next(ApiError.badRequest("No customer record found"));
	}

	// Attach payment method to customer
	await stripe.paymentMethods.attach(paymentMethodId, {
		customer: customerId,
	});

	// Set as default
	await stripe.customers.update(customerId, {
		invoice_settings: {
			default_payment_method: paymentMethodId,
		},
	});

	res.status(200).json({
		success: true,
		message: "Payment method updated successfully",
	});
});

/**
 * @desc    Purchase additional credits
 * @route   POST /api/v1/payments/purchase-credits
 * @access  Private
 */
export const purchaseCredits = catchAsync(async (req, res, next) => {
	const {amount} = req.body;

	// Credit packages
	const creditPackages = {
		25: 29,
		50: 49,
		100: 89,
		200: 159,
		500: 349,
	};

	const price = creditPackages[amount];
	if (!price) {
		return next(ApiError.badRequest("Invalid credit package"));
	}

	let customerId = req.user.subscription?.stripeCustomerId;

	if (!customerId) {
		const customer = await stripe.customers.create({
			email: req.user.email,
			name: req.user.name,
			metadata: {
				userId: req.user._id.toString(),
			},
		});
		customerId = customer.id;

		req.user.subscription = {
			...req.user.subscription,
			stripeCustomerId: customerId,
		};
		await req.user.save();
	}

	// Create checkout session for one-time payment
	const session = await stripe.checkout.sessions.create({
		customer: customerId,
		payment_method_types: ["card"],
		line_items: [
			{
				price_data: {
					currency: "usd",
					product_data: {
						name: `${amount} Credits`,
						description: `Add ${amount} credits to your account`,
					},
					unit_amount: price * 100, // Convert to cents
				},
				quantity: 1,
			},
		],
		mode: "payment",
		success_url: `${config.clientUrl}/dashboard?credits=success&amount=${amount}`,
		cancel_url: `${config.clientUrl}/pricing?credits=cancelled`,
		metadata: {
			userId: req.user._id.toString(),
			type: "credits",
			creditAmount: amount.toString(),
		},
	});

	res.status(200).json({
		success: true,
		data: {
			sessionId: session.id,
			url: session.url,
		},
	});
});

/**
 * @desc    Handle Stripe webhook
 * @route   POST /api/v1/payments/webhook
 * @access  Public (Stripe signature verified)
 */
export const handleWebhook = catchAsync(async (req, res, next) => {
	const sig = req.headers["stripe-signature"];
	let event;

	try {
		event = stripe.webhooks.constructEvent(
			req.body,
			sig,
			config.stripe.webhookSecret
		);
	} catch (err) {
		console.error("Webhook signature verification failed:", err.message);
		return res.status(400).send(`Webhook Error: ${err.message}`);
	}

	// Handle the event
	switch (event.type) {
		case "checkout.session.completed":
			await handleCheckoutCompleted(event.data.object);
			break;

		case "customer.subscription.created":
		case "customer.subscription.updated":
			await handleSubscriptionUpdated(event.data.object);
			break;

		case "customer.subscription.deleted":
			await handleSubscriptionDeleted(event.data.object);
			break;

		case "invoice.payment_succeeded":
			await handleInvoicePaymentSucceeded(event.data.object);
			break;

		case "invoice.payment_failed":
			await handleInvoicePaymentFailed(event.data.object);
			break;

		default:
			console.log(`Unhandled event type: ${event.type}`);
	}

	res.json({received: true});
});

// Webhook handlers
async function handleCheckoutCompleted(session) {
	const {userId, type, creditAmount, planId} = session.metadata;

	if (type === "credits") {
		// Add credits to user
		const user = await User.findById(userId);
		if (user) {
			await user.addCredits(parseInt(creditAmount));

			// Create transaction record
			await Transaction.create({
				user: userId,
				type: "credits",
				amount: session.amount_total / 100,
				status: "succeeded",
				description: `Purchased ${creditAmount} credits`,
				creditsAdded: parseInt(creditAmount),
				stripePaymentIntentId: session.payment_intent,
			});
		}
	}
}

async function handleSubscriptionUpdated(subscription) {
	const userId = subscription.metadata.userId;
	const planId = subscription.metadata.planId;

	if (!userId) return;

	const user = await User.findById(userId);
	if (!user) return;

	const plan = config.plans[planId];
	const status = subscription.status;

	// Update user subscription
	user.subscription = {
		plan: planId,
		stripeCustomerId: subscription.customer,
		stripeSubscriptionId: subscription.id,
		status: status,
		currentPeriodStart: new Date(subscription.current_period_start * 1000),
		currentPeriodEnd: new Date(subscription.current_period_end * 1000),
	};

	// Add credits if subscription is active and it's a new period
	if (status === "active" && plan) {
		const existingSub = await Subscription.findOne({
			stripeSubscriptionId: subscription.id,
		});

		if (
			!existingSub ||
			existingSub.currentPeriodStart.getTime() !==
				subscription.current_period_start * 1000
		) {
			user.credits.balance += plan.credits;
			user.credits.lastRefill = new Date();
		}
	}

	await user.save();

	// Update or create subscription record
	await Subscription.findOneAndUpdate(
		{stripeSubscriptionId: subscription.id},
		{
			user: userId,
			plan: planId,
			status: status,
			stripeSubscriptionId: subscription.id,
			stripePriceId: subscription.items.data[0]?.price.id,
			stripeCustomerId: subscription.customer,
			currentPeriodStart: new Date(subscription.current_period_start * 1000),
			currentPeriodEnd: new Date(subscription.current_period_end * 1000),
			creditsIncluded: plan?.credits || 0,
			cancelAtPeriodEnd: subscription.cancel_at_period_end,
		},
		{upsert: true, new: true}
	);
}

async function handleSubscriptionDeleted(subscription) {
	const userId = subscription.metadata.userId;

	if (!userId) return;

	const user = await User.findById(userId);
	if (!user) return;

	user.subscription = {
		plan: "free",
		stripeCustomerId: user.subscription?.stripeCustomerId,
		status: "inactive",
	};

	await user.save();

	await Subscription.findOneAndUpdate(
		{stripeSubscriptionId: subscription.id},
		{status: "expired"}
	);
}

async function handleInvoicePaymentSucceeded(invoice) {
	if (!invoice.subscription) return;

	const subscription = await stripe.subscriptions.retrieve(
		invoice.subscription
	);
	const userId = subscription.metadata.userId;

	if (!userId) return;

	// Create transaction record
	await Transaction.create({
		user: userId,
		type: "subscription",
		amount: invoice.amount_paid / 100,
		status: "succeeded",
		description: `Subscription payment`,
		stripeInvoiceId: invoice.id,
		stripePaymentIntentId: invoice.payment_intent,
		plan: subscription.metadata.planId,
		receiptUrl: invoice.hosted_invoice_url,
		invoiceUrl: invoice.invoice_pdf,
	});
}

async function handleInvoicePaymentFailed(invoice) {
	if (!invoice.subscription) return;

	const subscription = await stripe.subscriptions.retrieve(
		invoice.subscription
	);
	const userId = subscription.metadata.userId;

	if (!userId) return;

	// Update user subscription status
	await User.findByIdAndUpdate(userId, {
		"subscription.status": "past_due",
	});

	// Create failed transaction record
	await Transaction.create({
		user: userId,
		type: "subscription",
		amount: invoice.amount_due / 100,
		status: "failed",
		description: "Subscription payment failed",
		stripeInvoiceId: invoice.id,
	});
}

export default {
	getPlans,
	createCheckoutSession,
	getBillingHistory,
	getCurrentSubscription,
	cancelSubscription,
	updatePaymentMethod,
	purchaseCredits,
	handleWebhook,
};
