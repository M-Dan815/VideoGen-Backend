// src/routes/project.routes.js
import {Router} from "express";
import projectController from "../controllers/project.controller.js";
import {
	protect,
	optionalAuth,
	requireCredits,
} from "../middleware/auth.middleware.js";
import {
	validateBody,
	validateQuery,
	validateObjectId,
} from "../middleware/validation.middleware.js";
import {generationLimiter} from "../middleware/rateLimiter.middleware.js";
import {projectSchemas} from "../utils/validators.js";

const router = Router();

// Public routes
router.get("/shared/:token", projectController.getSharedProject);

// Protected routes
router.use(protect);

// Get all projects
router.get(
	"/",
	validateQuery(projectSchemas.query),
	projectController.getProjects
);

// Scrape images from URL
router.post(
	"/scrape",
	// validateBody(projectSchemas.scrape),
	projectController.scrapeImages
);

// Create new project
router.post(
	"/",
	validateBody(projectSchemas.create),
	projectController.createProject
);

// Get single project
router.get("/:id", validateObjectId("id"), projectController.getProject);

// Update project
router.patch(
	"/:id",
	validateObjectId("id"),
	validateBody(projectSchemas.update),
	projectController.updateProject
);

// Delete project
router.delete("/:id", validateObjectId("id"), projectController.deleteProject);

// Generate video
router.post(
	"/:id/generate",
	validateObjectId("id"),
	generationLimiter,
	validateBody(projectSchemas.generate),
	projectController.generateVideo
);

// Get project status
router.get(
	"/:id/status",
	validateObjectId("id"),
	projectController.getProjectStatus
);

// Download video
router.get(
	"/:id/download",
	validateObjectId("id"),
	projectController.downloadVideo
);

// Reorder images
router.patch(
	"/:id/images/reorder",
	validateObjectId("id"),
	projectController.reorderImages
);

// Delete image
router.delete(
	"/:id/images/:imageId",
	validateObjectId("id"),
	projectController.deleteImage
);

router.post(
	"/:id/import-scraped",
	validateObjectId("id"),
	projectController.importScrapedImages
);

export default router;
