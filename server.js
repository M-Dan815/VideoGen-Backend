// server.js
import dotenv from "dotenv";
import mongoose from "mongoose";

// Load environment variables
dotenv.config();

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
	console.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
	console.error(err.name, err.message);
	console.error(err.stack);
	process.exit(1);
});

import app from "./src/app.js";
import {connectDatabase} from "./src/config/database.js";

const PORT = process.env.PORT || 5000;

// Connect to database and start server
const startServer = async () => {
	try {
		// Connect to MongoDB
		await connectDatabase();
		console.log("✅ Database connected successfully");

		// Start Express server
		const server = app.listen(PORT, () => {
			console.log(
				`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
			);
		});

		// Handle unhandled promise rejections
		process.on("unhandledRejection", (err) => {
			console.error("UNHANDLED REJECTION! 💥 Shutting down...");
			console.error(err.name, err.message);
			server.close(() => {
				process.exit(1);
			});
		});

		// Handle SIGTERM signal
		process.on("SIGTERM", () => {
			console.log("👋 SIGTERM received. Shutting down gracefully");
			server.close(() => {
				console.log("💤 Process terminated");
				mongoose.connection.close(false, () => {
					process.exit(0);
				});
			});
		});
	} catch (error) {
		console.error("Failed to start server:", error);
		process.exit(1);
	}
};

startServer();
