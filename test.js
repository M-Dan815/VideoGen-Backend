// test-scraper.js
import {
	scrapeRealEstateAu,
	validateScrapingUrl,
} from "./src/services/scraper.service.js";

const testUrl = process.argv[2];
const deepScrape = process.argv.includes("--deep");
const verify = process.argv.includes("--verify");
const showAll = process.argv.includes("--all");

if (!testUrl) {
	console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              realestate.com.au Image Scraper Test                ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Usage: node test-scraper.js <URL> [OPTIONS]                     ║
║                                                                  ║
║  Options:                                                        ║
║    --deep      Follow property links to get more images          ║
║    --verify    Verify images are accessible                      ║
║    --all       Show all images (default: first 30)               ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);
	process.exit(1);
}

async function test() {
	console.log("");
	console.log("🏠 realestate.com.au Image Scraper (Puppeteer)");
	console.log("═".repeat(60));
	console.log(`URL: ${testUrl}`);
	if (deepScrape) console.log("Deep Scrape: Enabled");
	if (verify) console.log("Verify Images: Enabled");
	console.log("");

	const validation = validateScrapingUrl(testUrl);
	if (!validation.valid) {
		console.error(`❌ ${validation.error}`);
		process.exit(1);
	}

	try {
		const result = await scrapeRealEstateAu(testUrl, {
			deepScrape,
			maxProperties: 5,
			verify,
			headless: true,
		});

		console.log("");
		console.log("📋 Results:");
		console.log("─".repeat(60));
		console.log(`Page Type: ${result.pageType}`);
		console.log(`Title: ${result.pageInfo.title}`);
		if (result.pageInfo.price) {
			console.log(`Price: ${result.pageInfo.price}`);
		}

		console.log("");
		console.log(`📸 Found ${result.count} images:`);

		// Show category breakdown
		console.log("─".repeat(60));
		console.log("Categories:");
		Object.entries(result.categories).forEach(([cat, count]) => {
			console.log(`  ${cat}: ${count}`);
		});

		console.log("");
		console.log("Images:");
		console.log("─".repeat(60));

		const displayLimit = showAll ? result.count : 30;

		result.images.slice(0, displayLimit).forEach((img, i) => {
			const shortUrl =
				img.url.length > 55 ? img.url.substring(0, 55) + "..." : img.url;
			console.log(
				`${(i + 1).toString().padStart(2)}. [${img.category}] ${shortUrl}`
			);
		});

		if (result.count > displayLimit) {
			console.log(
				`    ... and ${result.count - displayLimit} more (use --all to show)`
			);
		}

		console.log("");
		console.log("═".repeat(60));
		console.log("✅ Success!");
		console.log(`   Total: ${result.count} images`);
		console.log(`   Method: ${result.method}`);
		console.log("");
	} catch (error) {
		console.error("");
		console.error("❌ Error:", error.message);
		console.error("");
		process.exit(1);
	}
}

test();
