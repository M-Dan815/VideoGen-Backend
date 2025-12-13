// src/services/scraper.service.js
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

/**
 * Configuration
 */
const CONFIG = {
	timeout: 60000,
	maxImages: 100, // Increased limit
	minImageSize: 5000, // Reduced from 10000 to catch more images
	allowedDomains: ["realestate.com.au", "www.realestate.com.au"],
	imageHosts: ["reastatic.net", "rimh.io", "domain.com.au", "view.com.au"],

	browserArgs: [
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--disable-dev-shm-usage",
		"--disable-accelerated-2d-canvas",
		"--disable-gpu",
		"--window-size=1920,1080",
		"--disable-web-security",
		"--disable-features=IsolateOrigins,site-per-process",
	],

	userAgents: [
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
	],

	// Only skip obvious non-photo files
	strictSkipPatterns: [
		/\.gif$/i,
		/\.svg$/i,
		/favicon/i,
		/1x1/i,
		/spacer\.(?:jpg|png)/i,
		/blank\.(?:jpg|png)/i,
		/pixel\.(?:jpg|png)/i,
	],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRandomUserAgent = () => {
	return CONFIG.userAgents[
		Math.floor(Math.random() * CONFIG.userAgents.length)
	];
};

/**
 * Validate URL
 */
export const validateScrapingUrl = (url) => {
	try {
		const urlObj = new URL(url);

		if (!CONFIG.allowedDomains.includes(urlObj.hostname)) {
			return {
				valid: false,
				error: "Only realestate.com.au URLs are supported",
			};
		}

		return {valid: true};
	} catch (error) {
		return {
			valid: false,
			error: "Invalid URL format",
		};
	}
};

/**
 * Check if URL is a valid image (minimal filtering)
 */
const isValidImage = (url) => {
	if (!url || typeof url !== "string") return false;

	// Must be HTTP/HTTPS
	if (!url.startsWith("http")) return false;

	// Must be from allowed image hosts OR contain image extensions
	const isFromAllowedHost = CONFIG.imageHosts.some((host) =>
		url.includes(host)
	);
	const hasImageExtension = /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url);

	if (!isFromAllowedHost && !hasImageExtension) return false;

	// Only skip obvious non-photos
	if (CONFIG.strictSkipPatterns.some((pattern) => pattern.test(url)))
		return false;

	return true;
};

/**
 * Upgrade image to larger size
 */
const upgradeImageSize = (url) => {
	return url
		.replace(/\/w_\d+,h_\d+/, "/w_1920,h_1440")
		.replace(/\/w_\d+/, "/w_1920")
		.replace(/\/h_\d+/, "/h_1440")
		.replace(/\/c_fill/, "/c_fit")
		.replace(/\/q_\d+/, "/q_90")
		.replace(/\/\d{2,4}x\d{2,4}\//, "/1920x1440/")
		.replace(/size=\d+x\d+/, "size=1920x1440")
		.replace(/width=\d+/, "width=1920")
		.replace(/height=\d+/, "height=1440")
		.replace(/([?&])w=\d+/, "$1w=1920")
		.replace(/([?&])h=\d+/, "$1h=1440")
		.replace(/\/thumbnails?\//, "/photos/")
		.replace(/\/thumb\//, "/large/")
		.replace(/\/small\//, "/large/")
		.replace(/\/medium\//, "/large/");
};

/**
 * Normalize URL for deduplication
 */
const normalizeUrl = (url) => {
	try {
		const urlObj = new URL(url);
		// Remove size parameters and hash
		let normalized = urlObj.origin + urlObj.pathname;
		normalized = normalized
			.replace(/\/\d+x\d+\//g, "/")
			.replace(/w_\d+,?h?_?\d*/g, "")
			.replace(/\/$/, "");
		return normalized;
	} catch {
		return url.split("?")[0].split("#")[0];
	}
};

/**
 * Categorize image type
 */
const categorizeImage = (url) => {
	const urlLower = url.toLowerCase();

	if (/logo/i.test(urlLower)) return "logo";
	if (/icon/i.test(urlLower)) return "icon";
	if (/agent|avatar|profile/i.test(urlLower)) return "agent";
	if (/map|streetview/i.test(urlLower)) return "map";
	if (/floorplan/i.test(urlLower)) return "floorplan";
	if (/thumb|small|medium/i.test(urlLower)) return "thumbnail";
	if (/large|photo|image|1920|1600|1200|800/i.test(urlLower)) return "photo";

	return "other";
};

/**
 * Auto-scroll page
 */
const autoScroll = async (page) => {
	await page.evaluate(async () => {
		await new Promise((resolve) => {
			let totalHeight = 0;
			const distance = 300;
			const maxScrolls = 40;
			let scrollCount = 0;

			const timer = setInterval(() => {
				const scrollHeight = document.body.scrollHeight;
				window.scrollBy(0, distance);
				totalHeight += distance;
				scrollCount++;

				if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
					clearInterval(timer);
					window.scrollTo(0, 0);
					setTimeout(resolve, 500);
				}
			}, 100);
		});
	});
};

/**
 * Extract all images from page
 */
const extractImagesFromPage = async (page) => {
	return await page.evaluate(() => {
		const imageUrls = new Set();

		// 1. All img elements
		document.querySelectorAll("img").forEach((img) => {
			const sources = [
				img.src,
				img.currentSrc,
				img.dataset.src,
				img.dataset.lazySrc,
				img.dataset.original,
				img.dataset.fullSrc,
				img.dataset.highResSrc,
			];

			sources.forEach((src) => {
				if (src && src.startsWith("http")) {
					imageUrls.add(src);
				}
			});

			// srcset
			const srcset = img.srcset || img.dataset.srcset;
			if (srcset) {
				srcset.split(",").forEach((part) => {
					const url = part.trim().split(/\s+/)[0];
					if (url && url.startsWith("http")) {
						imageUrls.add(url);
					}
				});
			}
		});

		// 2. Picture/source elements
		document.querySelectorAll("picture source, source").forEach((source) => {
			const srcset = source.srcset || source.dataset.srcset;
			if (srcset) {
				srcset.split(",").forEach((part) => {
					const url = part.trim().split(/\s+/)[0];
					if (url && url.startsWith("http")) {
						imageUrls.add(url);
					}
				});
			}

			const src = source.src;
			if (src && src.startsWith("http")) {
				imageUrls.add(src);
			}
		});

		// 3. Inline background images
		document.querySelectorAll('[style*="background"]').forEach((el) => {
			const style = el.getAttribute("style") || "";
			const matches =
				style.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/g) || [];
			matches.forEach((match) => {
				const url = match.replace(/url\(['"]?/, "").replace(/['"]?\)/, "");
				if (url) imageUrls.add(url);
			});
		});

		// 4. Computed background images (more thorough)
		const elementsToCheck = document.querySelectorAll(
			"div, section, article, a, li, span, figure"
		);
		elementsToCheck.forEach((el) => {
			try {
				const bg = window.getComputedStyle(el).backgroundImage;
				if (bg && bg !== "none") {
					const matches =
						bg.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/g) || [];
					matches.forEach((match) => {
						const url = match.replace(/url\(['"]?/, "").replace(/['"]?\)/, "");
						if (url) imageUrls.add(url);
					});
				}
			} catch (e) {}
		});

		// 5. Data attributes that might contain images
		document
			.querySelectorAll(
				"[data-image], [data-img], [data-background], [data-bg]"
			)
			.forEach((el) => {
				const attrs = ["data-image", "data-img", "data-background", "data-bg"];
				attrs.forEach((attr) => {
					const val = el.getAttribute(attr);
					if (val && val.startsWith("http")) {
						imageUrls.add(val);
					}
				});
			});

		return Array.from(imageUrls);
	});
};

/**
 * Extract property links
 */
const extractPropertyLinks = async (page) => {
	return await page.evaluate(() => {
		const links = new Set();

		const selectors = [
			'a[href*="/property-"]',
			'[data-testid="listing-card"] a',
			'[class*="listing-card"] a',
			'[class*="property-card"] a',
			'article a[href*="/property-"]',
		];

		selectors.forEach((selector) => {
			document.querySelectorAll(selector).forEach((link) => {
				const href = link.href;
				if (href && href.includes("/property-")) {
					links.add(href);
				}
			});
		});

		return Array.from(links);
	});
};

/**
 * Extract page info
 */
const extractPageInfo = async (page) => {
	return await page.evaluate(() => {
		const getTextContent = (selectors) => {
			for (const sel of selectors) {
				const el = document.querySelector(sel);
				if (el && el.textContent.trim()) {
					return el.textContent.trim();
				}
			}
			return "";
		};

		const title =
			getTextContent([
				"h1",
				'[data-testid="listing-details__summary-title"]',
				'[class*="property-title"]',
				"title",
			]) || document.title;

		const location =
			getTextContent([
				'[data-testid="listing-details__summary-address"]',
				'[class*="property-address"]',
				'[class*="suburb"]',
				"h1",
			]) || title;

		const price = getTextContent([
			'[data-testid="listing-details__summary-price"]',
			'[class*="property-price"]',
			'[class*="listing-price"]',
		]);

		const listingCount = document.querySelectorAll(
			'[data-testid="listing-card"], [class*="listing-card"], [class*="property-card"]'
		).length;

		const isPropertyPage = window.location.pathname.includes("/property-");
		const isSearchPage =
			listingCount > 0 ||
			window.location.pathname.includes("/buy/") ||
			window.location.pathname.includes("/rent/") ||
			window.location.pathname.includes("/sold/");
		const isLifestylePage = window.location.pathname.includes("/lifestyle/");

		return {
			title: title.split("|")[0].trim(),
			location,
			price,
			listingCount,
			pageType: isPropertyPage
				? "property"
				: isSearchPage
				? "search"
				: isLifestylePage
				? "lifestyle"
				: "location",
		};
	});
};

/**
 * Process images - minimal filtering, return everything
 */
const processImages = (imageUrls, pageInfo) => {
	const images = [];
	const seen = new Set();

	imageUrls.forEach((rawUrl) => {
		try {
			let url = rawUrl.trim();

			// Must be valid image URL
			if (!isValidImage(url)) return;

			// Upgrade to larger size
			const upgradedUrl = upgradeImageSize(url);

			// Check for duplicates
			const normalized = normalizeUrl(upgradedUrl);
			if (seen.has(normalized)) return;
			seen.add(normalized);

			// Categorize the image
			const category = categorizeImage(upgradedUrl);

			images.push({
				url: upgradedUrl,
				originalUrl: url,
				alt: pageInfo.location || pageInfo.title || "Property Image",
				source: "realestate.com.au",
				category, // Add category for frontend filtering if needed
			});
		} catch (e) {
			// Skip invalid URLs
		}
	});

	// Sort: photos first, then by size hints in URL
	return images.sort((a, b) => {
		// Priority order
		const priority = {
			photo: 5,
			other: 4,
			thumbnail: 3,
			floorplan: 2,
			map: 1,
			agent: 0,
			icon: -1,
			logo: -2,
		};

		const aPriority = priority[a.category] || 0;
		const bPriority = priority[b.category] || 0;

		if (aPriority !== bPriority) {
			return bPriority - aPriority;
		}

		// Within same category, prefer larger images
		const getSize = (url) => {
			let score = 0;
			const sizeMatch = url.match(/(\d{3,4})x(\d{3,4})/);
			if (sizeMatch) score += parseInt(sizeMatch[1]) + parseInt(sizeMatch[2]);
			const wMatch = url.match(/w[=_](\d{3,4})/);
			if (wMatch) score += parseInt(wMatch[1]);
			if (url.includes("/large/") || url.includes("/1920x")) score += 2000;
			if (url.includes("/photos/")) score += 500;
			return score;
		};

		return getSize(b.url) - getSize(a.url);
	});
};

/**
 * Main scraping function
 */
export const scrapeRealEstateAu = async (url, options = {}) => {
	const {
		deepScrape = false,
		maxProperties = 5,
		verify = false,
		headless = true,
	} = options;

	// Validate
	const validation = validateScrapingUrl(url);
	if (!validation.valid) {
		throw new Error(validation.error);
	}

	console.log(`🌐 Scraping with Puppeteer: ${url}`);

	let browser = null;
	let allImages = [];

	try {
		// Launch browser
		console.log("🚀 Launching browser...");
		browser = await puppeteer.launch({
			headless: headless ? "new" : false,
			args: CONFIG.browserArgs,
			defaultViewport: {width: 1920, height: 1080},
		});

		const page = await browser.newPage();
		await page.setUserAgent(getRandomUserAgent());
		await page.setExtraHTTPHeaders({"Accept-Language": "en-AU,en;q=0.9"});

		// Track network images
		const networkImages = new Set();

		page.on("response", async (response) => {
			const resUrl = response.url();
			if (isValidImage(resUrl)) {
				networkImages.add(resUrl);
			}
		});

		// Navigate
		console.log("📥 Loading page...");

		try {
			await page.goto(url, {
				waitUntil: "networkidle2",
				timeout: CONFIG.timeout,
			});
		} catch (error) {
			if (error.name === "TimeoutError") {
				console.log("⚠️  Page load timeout, continuing anyway...");
				await sleep(3000);
			} else {
				throw error;
			}
		}

		console.log("✅ Page loaded");
		await sleep(3000);

		// Get page info
		const pageInfo = await extractPageInfo(page);
		console.log(`📄 Page type: ${pageInfo.pageType}`);
		console.log(`📍 ${pageInfo.title}`);

		if (pageInfo.listingCount > 0) {
			console.log(`🏘️  Found ${pageInfo.listingCount} property listings`);
		}

		// Scroll
		console.log("⏬ Scrolling to load images...");
		await autoScroll(page);
		await sleep(2000);

		// Extract images
		console.log("📷 Extracting images...");
		const pageImages = await extractImagesFromPage(page);

		// Combine all sources
		const allUrls = new Set([...networkImages, ...pageImages]);
		console.log(`   Found ${allUrls.size} total image URLs`);

		// Process with minimal filtering
		allImages = processImages(Array.from(allUrls), pageInfo);
		console.log(`   Kept ${allImages.length} valid images after deduplication`);

		// Show breakdown by category
		const categoryCounts = allImages.reduce((acc, img) => {
			acc[img.category] = (acc[img.category] || 0) + 1;
			return acc;
		}, {});
		console.log(`   Breakdown:`, categoryCounts);

		// Deep scrape if enabled
		if (
			deepScrape &&
			pageInfo.pageType !== "property" &&
			allImages.length < CONFIG.maxImages
		) {
			console.log("🔗 Deep scraping property pages...");

			const propertyLinks = await extractPropertyLinks(page);
			console.log(`   Found ${propertyLinks.length} property links`);

			const linksToScrape = propertyLinks.slice(0, maxProperties);

			for (let i = 0; i < linksToScrape.length; i++) {
				const propUrl = linksToScrape[i];

				try {
					console.log(`   → Property ${i + 1}/${linksToScrape.length}...`);

					const propPage = await browser.newPage();
					await propPage.setUserAgent(getRandomUserAgent());

					const propImages = new Set();
					propPage.on("response", async (response) => {
						const resUrl = response.url();
						if (isValidImage(resUrl)) {
							propImages.add(resUrl);
						}
					});

					await propPage
						.goto(propUrl, {
							waitUntil: "networkidle2",
							timeout: 30000,
						})
						.catch(() => {});

					await sleep(2000);
					await autoScroll(propPage);

					const propPageImages = await extractImagesFromPage(propPage);
					propPageImages.forEach((img) => propImages.add(img));

					const propProcessed = processImages(Array.from(propImages), pageInfo);

					// Merge without duplicates
					const existingUrls = new Set(
						allImages.map((img) => normalizeUrl(img.url))
					);
					propProcessed.forEach((img) => {
						const normalized = normalizeUrl(img.url);
						if (!existingUrls.has(normalized)) {
							allImages.push(img);
							existingUrls.add(normalized);
						}
					});

					console.log(
						`     Added ${propProcessed.length} new images (total: ${allImages.length})`
					);

					await propPage.close();

					if (allImages.length >= CONFIG.maxImages) {
						console.log(`   Reached ${CONFIG.maxImages} images limit`);
						break;
					}

					await sleep(2000);
				} catch (error) {
					console.log(`     ⚠️  Failed: ${error.message}`);
				}
			}
		}

		await browser.close();
		browser = null;

		// Limit total results
		allImages = allImages.slice(0, CONFIG.maxImages);

		console.log(`✅ Scraping complete: ${allImages.length} images`);

		if (allImages.length === 0) {
			throw new Error(
				"No images found. This page may not contain any images, or they are loaded in an unexpected way."
			);
		}

		// Verify if requested
		if (verify) {
			console.log("🔎 Verifying images...");
			allImages = await verifyImages(allImages);
			console.log(`✅ Verified ${allImages.length} images`);
		}

		return {
			images: allImages,
			pageInfo,
			pageType: pageInfo.pageType,
			count: allImages.length,
			categories: allImages.reduce((acc, img) => {
				acc[img.category] = (acc[img.category] || 0) + 1;
				return acc;
			}, {}),
			method: "puppeteer",
		};
	} catch (error) {
		if (browser) {
			await browser.close().catch(() => {});
		}

		console.error("❌ Scraping error:", error.message);
		throw error;
	}
};

/**
 * Verify images
 */
export const verifyImages = async (images, options = {}) => {
	const {maxConcurrent = 3, timeout = 5000} = options;
	const verified = [];

	const axios = (await import("axios")).default;

	for (let i = 0; i < images.length; i += maxConcurrent) {
		const batch = images.slice(i, i + maxConcurrent);

		if (i > 0) await sleep(300);

		const results = await Promise.allSettled(
			batch.map(async (img) => {
				try {
					const res = await axios.head(img.url, {
						timeout,
						headers: {"User-Agent": getRandomUserAgent()},
					});

					const contentType = res.headers["content-type"];
					const contentLength = parseInt(res.headers["content-length"] || "0");

					if (
						contentType?.startsWith("image/") &&
						contentLength > CONFIG.minImageSize
					) {
						return {
							...img,
							size: contentLength,
							type: contentType,
							verified: true,
						};
					}
					return null;
				} catch {
					return null;
				}
			})
		);

		results.forEach((r) => {
			if (r.status === "fulfilled" && r.value) {
				verified.push(r.value);
			}
		});
	}

	return verified;
};

/**
 * Download image
 */
export const downloadImage = async (imageUrl) => {
	const axios = (await import("axios")).default;

	await sleep(300);

	const response = await axios.get(imageUrl, {
		responseType: "arraybuffer",
		timeout: 30000,
		headers: {"User-Agent": getRandomUserAgent()},
	});

	return {
		buffer: Buffer.from(response.data),
		contentType: response.headers["content-type"],
		size: response.data.length,
	};
};

export default {
	scrapeRealEstateAu,
	validateScrapingUrl,
	verifyImages,
	downloadImage,
};
