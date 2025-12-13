// test-puppeteer.js
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scrapeWithBrowser = async (url) => {
	console.log("🌐 Using Puppeteer (browser-based scraping)");
	console.log("═".repeat(60));
	console.log(`URL: ${url}\n`);

	let browser;

	try {
		console.log("🚀 Launching browser...");
		browser = await puppeteer.launch({
			headless: "new",
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-dev-shm-usage",
				"--disable-web-security",
				"--disable-features=IsolateOrigins,site-per-process",
			],
			defaultViewport: {
				width: 1920,
				height: 1080,
			},
		});

		const page = await browser.newPage();

		// Set user agent
		await page.setUserAgent(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
		);

		// Collect images from network requests
		const imageUrls = new Set();

		page.on("response", async (response) => {
			const url = response.url();
			if (
				(url.includes("reastatic.net") || url.includes("rimh.io")) &&
				/\.(jpg|jpeg|png|webp)/.test(url)
			) {
				// Filter out icons, logos, etc.
				const skipPatterns =
					/logo|icon|agent|avatar|profile|sprite|placeholder|favicon|1x1|spacer/i;
				if (!skipPatterns.test(url)) {
					imageUrls.add(url);
				}
			}
		});

		console.log("📥 Loading page...");

		try {
			await page.goto(url, {
				waitUntil: "networkidle2",
				timeout: 45000,
			});

			console.log("✅ Page loaded\n");
		} catch (error) {
			if (error.message.includes("429") || error.name === "HTTPError") {
				console.log("❌ Still rate limited even with Puppeteer");
				console.log("   Wait 30 minutes and try again.\n");
				return;
			}
			if (error.name === "TimeoutError") {
				console.log("⚠️  Page load timeout, but continuing...\n");
			} else {
				throw error;
			}
		}

		// Get page info
		const pageInfo = await page.evaluate(() => {
			const title =
				document.querySelector("h1")?.textContent?.trim() ||
				document.querySelector("title")?.textContent?.trim() ||
				"Unknown";

			const listingCount = document.querySelectorAll(
				'[data-testid="listing-card"], [class*="listing-card"], [class*="property-card"]'
			).length;

			return {title, listingCount};
		});

		console.log(`📄 Page: ${pageInfo.title}`);
		if (pageInfo.listingCount > 0) {
			console.log(
				`🏘️  Found ${pageInfo.listingCount} property listings on page`
			);
		}
		console.log("");

		// Wait for images to load
		console.log("⏳ Waiting for images to load...");
		await sleep(3000);

		// Scroll to load lazy images
		console.log("⏬ Scrolling to load all images...");
		await autoScroll(page);
		await sleep(2000); // Wait after scrolling

		console.log("✅ Scrolling complete\n");

		// Extract images from page DOM
		console.log("📷 Extracting images from page...");
		const pageImages = await page.evaluate(() => {
			const images = [];

			// Get images from img tags
			document.querySelectorAll("img").forEach((img) => {
				const sources = [
					img.src,
					img.dataset.src,
					img.dataset.lazySrc,
					img.dataset.original,
					img.currentSrc,
				];

				sources.forEach((src) => {
					if (
						src &&
						(src.includes("reastatic.net") || src.includes("rimh.io"))
					) {
						images.push(src);
					}
				});
			});

			// Get images from picture/source elements
			document.querySelectorAll("picture source").forEach((source) => {
				const srcset = source.srcset;
				if (srcset) {
					srcset.split(",").forEach((part) => {
						const src = part.trim().split(/\s+/)[0];
						if (
							src &&
							(src.includes("reastatic.net") || src.includes("rimh.io"))
						) {
							images.push(src);
						}
					});
				}
			});

			// Check background images
			document.querySelectorAll('[style*="background"]').forEach((el) => {
				const style = el.getAttribute("style");
				if (style) {
					const matches =
						style.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/g) || [];
					matches.forEach((match) => {
						const url = match.replace(/url\(['"]?/, "").replace(/['"]?\)/, "");
						if (
							url &&
							(url.includes("reastatic.net") || url.includes("rimh.io"))
						) {
							images.push(url);
						}
					});
				}
			});

			return images;
		});

		// Combine network and page images
		pageImages.forEach((url) => imageUrls.add(url));

		console.log(`   Found ${imageUrls.size} raw image URLs\n`);

		// Process images
		const skipPatterns =
			/logo|icon|agent|avatar|profile|sprite|placeholder|loading|1x1|spacer|blank|\.gif$|\.svg$|favicon|button|arrow|chevron|menu|social/i;

		const images = Array.from(imageUrls)
			.filter((url) => !skipPatterns.test(url))
			.map((url) => {
				// Upgrade to larger size
				return url
					.replace(/\/w_\d+,h_\d+/, "/w_1920,h_1440")
					.replace(/\/w_\d+/, "/w_1920")
					.replace(/\/h_\d+/, "/h_1440")
					.replace(/\/c_fill/, "/c_fit")
					.replace(/\/q_\d+/, "/q_90")
					.replace(/\/\d{2,4}x\d{2,4}\//, "/1920x1440/")
					.replace(/\/thumbnails?\//, "/photos/")
					.replace(/\/thumb\//, "/large/")
					.replace(/\/small\//, "/large/")
					.replace(/\/medium\//, "/large/");
			});

		// Remove duplicates (normalize URLs)
		const uniqueImages = [
			...new Set(
				images.map((url) => {
					try {
						const urlObj = new URL(url);
						return urlObj.origin + urlObj.pathname;
					} catch {
						return url.split("?")[0];
					}
				})
			),
		];

		console.log("📸 Property Images Found:");
		console.log("─".repeat(60));

		if (uniqueImages.length === 0) {
			console.log("   ⚠️  No property images found\n");
			console.log("   This could mean:");
			console.log("   • The page has no property images");
			console.log("   • Images are loaded differently");
			console.log("   • Still being blocked\n");
		} else {
			uniqueImages.slice(0, 30).forEach((img, i) => {
				const shortUrl = img.length > 60 ? img.substring(0, 60) + "..." : img;
				console.log(`${(i + 1).toString().padStart(2)}. ${shortUrl}`);
			});

			if (uniqueImages.length > 30) {
				console.log(`    ... and ${uniqueImages.length - 30} more images`);
			}

			console.log("");
			console.log("═".repeat(60));
			console.log(`✅ Successfully extracted ${uniqueImages.length} images\n`);
		}

		await browser.close();
	} catch (error) {
		if (browser) {
			await browser.close().catch(() => {});
		}

		console.error("❌ Error:", error.message);

		if (error.message.includes("429")) {
			console.log("\n💡 Still rate limited. Wait 30 minutes and try again.");
		} else if (error.message.includes("navigation")) {
			console.log(
				"\n💡 Navigation failed. The site might be blocking automated browsers."
			);
		} else {
			console.log("\n💡 Try again in a few minutes.");
		}
	}
};

async function autoScroll(page) {
	await page.evaluate(async () => {
		await new Promise((resolve) => {
			let totalHeight = 0;
			const distance = 300;
			const maxScrolls = 30;
			let scrollCount = 0;

			const timer = setInterval(() => {
				const scrollHeight = document.body.scrollHeight;
				window.scrollBy(0, distance);
				totalHeight += distance;
				scrollCount++;

				if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
					clearInterval(timer);
					window.scrollTo(0, 0); // Scroll back to top
					resolve();
				}
			}, 100);
		});
	});
}

// Get URL from command line
const url = process.argv[2];

if (!url) {
	console.log("Usage: node test-puppeteer.js <URL>\n");
	console.log("Example:");
	console.log(
		'  node test-puppeteer.js "https://www.realestate.com.au/nsw/red-head-2430/"\n'
	);
	process.exit(1);
}

if (!url.includes("realestate.com.au")) {
	console.log("❌ URL must be from realestate.com.au\n");
	process.exit(1);
}

scrapeWithBrowser(url);
