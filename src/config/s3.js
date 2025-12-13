// src/config/s3.js
import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import config from "./index.js";

// Initialize S3 Client
export const s3Client = new S3Client({
	region: config.aws.region,
	credentials: {
		accessKeyId: config.aws.accessKeyId,
		secretAccessKey: config.aws.secretAccessKey,
	},
});

// Upload file to S3
export const uploadToS3 = async (file, key, contentType) => {
	const command = new PutObjectCommand({
		Bucket: config.aws.s3Bucket,
		Key: key,
		Body: file,
		ContentType: contentType,
	});

	await s3Client.send(command);

	return {
		key,
		url: `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${key}`,
	};
};

// Get signed URL for private objects
export const getSignedDownloadUrl = async (key, expiresIn = 3600) => {
	const command = new GetObjectCommand({
		Bucket: config.aws.s3Bucket,
		Key: key,
	});

	return await getSignedUrl(s3Client, command, {expiresIn});
};

// Get signed URL for uploads
export const getSignedUploadUrl = async (
	key,
	contentType,
	expiresIn = 3600
) => {
	const command = new PutObjectCommand({
		Bucket: config.aws.s3Bucket,
		Key: key,
		ContentType: contentType,
	});

	return await getSignedUrl(s3Client, command, {expiresIn});
};

// Delete file from S3
export const deleteFromS3 = async (key) => {
	const command = new DeleteObjectCommand({
		Bucket: config.aws.s3Bucket,
		Key: key,
	});

	await s3Client.send(command);
	return {deleted: true, key};
};

// Delete multiple files from S3
export const deleteMultipleFromS3 = async (keys) => {
	const deletePromises = keys.map((key) => deleteFromS3(key));
	return await Promise.all(deletePromises);
};
