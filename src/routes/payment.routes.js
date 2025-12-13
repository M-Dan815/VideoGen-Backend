// src/routes/payment.routes.js
import {Router} from "express";
import express from "express";
import paymentController from "../controllers/payment.controller.js";
import {protect} from "../middleware/auth.middleware.js";
import {validateBody} from "../middleware/validation.middleware.js";
import {paymentSchemas} from "../utils/validators.js";

const router = Router();

// Webhook route - must be before body parser
// Note: This needs raw body, handled specially in app.js
router.post(
	"/webhook",
	express.raw({type: "application/json"}),
	paymentController.handleWebhook
);

// Public routes
router.get("/plans", paymentController.getPlans);

// Protected routes
router.use(protect);

router.post(
	"/create-checkout",
	validateBody(paymentSchemas.createCheckout),
	paymentController.createCheckoutSession
);

router.get("/history", paymentController.getBillingHistory);

router.get("/subscription", paymentController.getCurrentSubscription);

router.post("/cancel-subscription", paymentController.cancelSubscription);

router.post(
	"/update-payment-method",
	validateBody(paymentSchemas.updatePaymentMethod),
	paymentController.updatePaymentMethod
);

router.post(
	"/purchase-credits",
	validateBody(paymentSchemas.purchaseCredits),
	paymentController.purchaseCredits
);

export default router;
