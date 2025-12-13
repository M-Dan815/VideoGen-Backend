// src/routes/index.js
import {Router} from "express";
import authRoutes from "./auth.routes.js";
import projectRoutes from "./project.routes.js";
import uploadRoutes from "./upload.routes.js";
import paymentRoutes from "./payment.routes.js";

const router = Router();

// API Status
router.get("/", (req, res) => {
	res.json({
		success: true,
		message: "Image to Video API ",
		version: "1.0.0",
		endpoints: {
			auth: "/api/auth",
			projects: "/api/projects",
			upload: "/api/upload",
			payments: "/api/payments",
		},
	});
});

// Mount routes
router.use("/auth", authRoutes);
router.use("/projects", projectRoutes);
router.use("/upload", uploadRoutes);
router.use("/payments", paymentRoutes);

export default router;
