// src/config/database.js
import mongoose from "mongoose";
import config from "./index.js";

export const connectDatabase = async () => {
	try {
		const options = {
			maxPoolSize: 10,
			serverSelectionTimeoutMS: 5000,
			socketTimeoutMS: 45000,
			family: 4,
		};

		const conn = await mongoose.connect(config.mongodbUri, options);

		console.log(`MongoDB Connected: ${conn.connection.host}`);

		// Handle connection events
		mongoose.connection.on("error", (err) => {
			console.error("MongoDB connection error:", err);
		});

		mongoose.connection.on("disconnected", () => {
			console.warn("MongoDB disconnected. Attempting to reconnect...");
		});

		mongoose.connection.on("reconnected", () => {
			console.log("MongoDB reconnected");
		});

		return conn;
	} catch (error) {
		console.error("MongoDB connection failed:", error.message);
		throw error;
	}
};

export const disconnectDatabase = async () => {
	try {
		await mongoose.connection.close();
		console.log("MongoDB connection closed");
	} catch (error) {
		console.error("Error closing MongoDB connection:", error);
		throw error;
	}
};
