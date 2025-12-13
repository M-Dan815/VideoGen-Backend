// src/models/Project.js
import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
	{
		originalName: String,
		key: {
			type: String,
			required: true,
		},
		url: {
			type: String,
			required: true,
		},
		size: Number,
		mimeType: String,
		width: Number,
		height: Number,
		order: {
			type: Number,
			default: 0,
		},
		// AI-enhanced versions
		enhanced: {
			key: String,
			url: String,
		},
	},
	{_id: true}
);

const videoSchema = new mongoose.Schema(
	{
		key: String,
		url: String,
		duration: Number,
		width: Number,
		height: Number,
		size: Number,
		format: {
			type: String,
			enum: ["mp4", "webm", "gif"],
			default: "mp4",
		},
		quality: {
			type: String,
			enum: ["720p", "1080p", "4k"],
			default: "1080p",
		},
		thumbnail: {
			key: String,
			url: String,
		},
		watermarked: {
			type: Boolean,
			default: false,
		},
	},
	{_id: true}
);

const projectSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		title: {
			type: String,
			required: [true, "Project title is required"],
			trim: true,
			maxlength: [100, "Title cannot exceed 100 characters"],
		},
		description: {
			type: String,
			trim: true,
			maxlength: [500, "Description cannot exceed 500 characters"],
		},

		// Source
		sourceUrl: {
			type: String,
			trim: true,
		},
		sourceType: {
			type: String,
			enum: ["upload", "scrape", "url"],
			default: "upload",
		},

		// Images
		images: [imageSchema],

		// Video Output
		video: videoSchema,

		// Generation Settings
		settings: {
			template: {
				type: String,
				enum: ["cinematic", "dynamic", "smooth", "dramatic", "minimal"],
				default: "cinematic",
			},
			duration: {
				type: Number,
				default: 8,
				min: 4,
				max: 60,
			},
			aspectRatio: {
				type: String,
				enum: ["16:9", "9:16", "1:1", "4:3"],
				default: "16:9",
			},
			motion: {
				type: String,
				enum: ["low", "medium", "high"],
				default: "medium",
			},
			style: {
				type: String,
				default: "auto",
			},
			prompt: {
				type: String,
				maxlength: [1000, "Prompt cannot exceed 1000 characters"],
			},
			negativePrompt: {
				type: String,
				maxlength: [500, "Negative prompt cannot exceed 500 characters"],
			},
			music: {
				enabled: {
					type: Boolean,
					default: false,
				},
				track: String,
				volume: {
					type: Number,
					default: 50,
					min: 0,
					max: 100,
				},
			},
			watermark: {
				enabled: {
					type: Boolean,
					default: true,
				},
				text: String,
				position: {
					type: String,
					enum: [
						"top-left",
						"top-right",
						"bottom-left",
						"bottom-right",
						"center",
					],
					default: "bottom-right",
				},
			},
			aiEngine: {
				type: String,
				enum: ["luma", "runway", "svd", "veo3", "sora2"],
				default: "luma",
			},
		},

		// Processing Status
		status: {
			type: String,
			enum: [
				"draft",
				"uploading",
				"processing",
				"generating",
				"post-processing",
				"completed",
				"failed",
				"cancelled",
			],
			default: "draft",
			index: true,
		},
		progress: {
			type: Number,
			default: 0,
			min: 0,
			max: 100,
		},
		statusMessage: String,
		errorMessage: String,
		errorCode: String,

		// Queue Information (for Phase 3)
		queueId: String,
		queuePriority: {
			type: Number,
			default: 0,
		},
		startedAt: Date,
		completedAt: Date,
		processingTime: Number, // in seconds

		// Cost & Credits
		creditsUsed: {
			type: Number,
			default: 0,
		},
		estimatedCredits: {
			type: Number,
			default: 1,
		},

		// Analytics
		views: {
			type: Number,
			default: 0,
		},
		downloads: {
			type: Number,
			default: 0,
		},
		lastViewedAt: Date,

		// Sharing
		isPublic: {
			type: Boolean,
			default: false,
		},
		shareToken: String,

		// Soft delete
		isDeleted: {
			type: Boolean,
			default: false,
			index: true,
		},
		deletedAt: Date,
	},
	{
		timestamps: true,
		toJSON: {virtuals: true},
		toObject: {virtuals: true},
	}
);

// Indexes
projectSchema.index({user: 1, createdAt: -1});
projectSchema.index({user: 1, status: 1});
projectSchema.index({status: 1, createdAt: -1});
projectSchema.index({shareToken: 1}, {sparse: true});

// Virtual for image count
projectSchema.virtual("imageCount").get(function () {
	return this.images ? this.images.length : 0;
});

// Virtual for processing duration
projectSchema.virtual("processingDuration").get(function () {
	if (this.startedAt && this.completedAt) {
		return Math.round((this.completedAt - this.startedAt) / 1000);
	}
	return null;
});

// Pre-save middleware
projectSchema.pre("save", function (next) {
	// Auto-generate share token if public
	if (this.isPublic && !this.shareToken) {
		this.shareToken = crypto.randomBytes(16).toString("hex");
	}
	next();
});

// Static method to find user projects
projectSchema.statics.findByUser = function (userId, options = {}) {
	const query = this.find({
		user: userId,
		isDeleted: false,
	});

	if (options.status) {
		query.where("status").equals(options.status);
	}

	if (options.sort) {
		query.sort(options.sort);
	} else {
		query.sort("-createdAt");
	}

	if (options.limit) {
		query.limit(options.limit);
	}

	if (options.skip) {
		query.skip(options.skip);
	}

	return query;
};

// Method to update progress
projectSchema.methods.updateProgress = async function (progress, message) {
	this.progress = progress;
	if (message) {
		this.statusMessage = message;
	}
	await this.save();
};

// Method to mark as failed
projectSchema.methods.markAsFailed = async function (error, errorCode) {
	this.status = "failed";
	this.errorMessage = error;
	this.errorCode = errorCode;
	this.completedAt = new Date();
	await this.save();
};

// Method to mark as completed
projectSchema.methods.markAsCompleted = async function (videoData) {
	this.status = "completed";
	this.progress = 100;
	this.video = videoData;
	this.completedAt = new Date();

	if (this.startedAt) {
		this.processingTime = Math.round(
			(this.completedAt - this.startedAt) / 1000
		);
	}

	await this.save();
};

// Method to soft delete
projectSchema.methods.softDelete = async function () {
	this.isDeleted = true;
	this.deletedAt = new Date();
	await this.save();
};

const Project = mongoose.model("Project", projectSchema);

export default Project;
