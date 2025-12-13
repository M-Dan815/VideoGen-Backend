// src/services/email.service.js
import nodemailer from "nodemailer";
import config from "../config/index.js";

// Create transporter
const createTransporter = () => {
	return nodemailer.createTransport({
		host: config.email.host,
		port: config.email.port,
		secure: config.email.port === 465,
		auth: {
			user: config.email.user,
			pass: config.email.pass,
		},
	});
};

/**
 * Send email
 */
const sendEmail = async ({to, subject, html, text}) => {
	try {
		const transporter = createTransporter();

		const mailOptions = {
			from: `"Image to Video" <${config.email.from}>`,
			to,
			subject,
			text,
			html,
		};

		const info = await transporter.sendMail(mailOptions);
		console.log("Email sent:", info.messageId);

		return {success: true, messageId: info.messageId};
	} catch (error) {
		console.error("Email error:", error);
		throw error;
	}
};

/**
 * Email templates
 */
const templates = {
	verification: (name, url) => ({
		subject: "Verify Your Email - Image to Video",
		html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎬 Image to Video</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Welcome to Image to Video! Please verify your email address to get started.</p>
            <p style="text-align: center;">
              <a href="${url}" class="button">Verify Email</a>
            </p>
            <p>Or copy and paste this link:</p>
            <p style="word-break: break-all; color: #6366f1;">${url}</p>
            <p>This link will expire in 24 hours.</p>
          </div>
          <div class="footer">
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
		text: `Hello ${name}!\n\nWelcome to Image to Video! Please verify your email by clicking the link below:\n\n${url}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account, please ignore this email.`,
	}),

	passwordReset: (name, url) => ({
		subject: "Reset Your Password - Image to Video",
		html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .warning { background: #fef3c7; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>You requested to reset your password. Click the button below to set a new password:</p>
            <p style="text-align: center;">
              <a href="${url}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link:</p>
            <p style="word-break: break-all; color: #6366f1;">${url}</p>
            <div class="warning">
              ⚠️ This link will expire in 1 hour for security reasons.
            </div>
          </div>
          <div class="footer">
            <p>If you didn't request this, please ignore this email or contact support if you're concerned.</p>
          </div>
        </div>
      </body>
      </html>
    `,
		text: `Hello ${name}!\n\nYou requested to reset your password. Click the link below to set a new password:\n\n${url}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`,
	}),

	welcomeEmail: (name) => ({
		subject: "Welcome to Image to Video! 🎬",
		html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #6366f1; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎬 Welcome to Image to Video!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}! 👋</h2>
            <p>Your email has been verified and your account is ready to use!</p>
            <p>Here's what you can do:</p>
            <div class="feature">📸 Upload images and transform them into stunning videos</div>
            <div class="feature">🎨 Choose from 5 professional templates</div>
            <div class="feature">⚡ Experience real-time processing updates</div>
            <div class="feature">💾 Download in multiple formats</div>
            <p>You've received <strong>5 free credits</strong> to get started!</p>
            <p style="text-align: center;">
              <a href="${config.clientUrl}/dashboard" class="button">Go to Dashboard</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
		text: `Hello ${name}!\n\nWelcome to Image to Video! Your email has been verified.\n\nYou've received 5 free credits to get started!\n\nVisit your dashboard: ${config.clientUrl}/dashboard`,
	}),

	videoCompleted: (name, projectTitle, videoUrl) => ({
		subject: `Your video "${projectTitle}" is ready! 🎬`,
		html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Video Ready!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Great news! Your video "<strong>${projectTitle}</strong>" has been successfully generated.</p>
            <p style="text-align: center;">
              <a href="${videoUrl}" class="button">View & Download Video</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
		text: `Hello ${name}!\n\nYour video "${projectTitle}" is ready!\n\nView and download: ${videoUrl}`,
	}),
};

/**
 * Send verification email
 */
export const sendVerificationEmail = async (user, token) => {
	const verificationUrl = `${config.clientUrl}/verify-email?token=${token}`;
	const template = templates.verification(user.name, verificationUrl);

	return sendEmail({
		to: user.email,
		...template,
	});
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (user, token) => {
	const resetUrl = `${config.clientUrl}/reset-password?token=${token}`;
	const template = templates.passwordReset(user.name, resetUrl);

	return sendEmail({
		to: user.email,
		...template,
	});
};

/**
 * Send welcome email
 */
export const sendWelcomeEmail = async (user) => {
	const template = templates.welcomeEmail(user.name);

	return sendEmail({
		to: user.email,
		...template,
	});
};

/**
 * Send video completed email
 */
export const sendVideoCompletedEmail = async (user, project) => {
	const videoUrl = `${config.clientUrl}/projects/${project._id}`;
	const template = templates.videoCompleted(user.name, project.title, videoUrl);

	return sendEmail({
		to: user.email,
		...template,
	});
};

export default {
	sendEmail,
	sendVerificationEmail,
	sendPasswordResetEmail,
	sendWelcomeEmail,
	sendVideoCompletedEmail,
};
