import puppeteer from "puppeteer";
import { URL } from "url";
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

/**
 * Normalizes a URL by removing query parameters and hash fragments
 */
function normalizeUrl(urlString) {
  try {
    const url = new URL(urlString);
    // Remove query params and hash
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch (err) {
    return null;
  }
}

/**
 * Checks if a URL is within the familysearch.zendesk.com/hc/en-us path (English only)
 */
function isZendeskUrl(urlString) {
  try {
    const url = new URL(urlString);
    // Must be familysearch.zendesk.com domain
    if (url.hostname !== 'familysearch.zendesk.com') {
      return false;
    }
    // Must start with /hc/en-us to ensure English content only
    if (!url.pathname.startsWith('/hc/en-us')) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Extracts all links from a page using Puppeteer
 */
async function extractLinks(page) {
  const links = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    return anchors.map(a => a.href).filter(href => href && href.startsWith('http'));
  });

  // Track filtering stats
  let totalLinks = links.length;
  let afterFilter = 0;

  // Normalize and filter to only English Zendesk URLs
  const normalizedLinks = links
    .map(link => normalizeUrl(link))
    .filter(link => {
      if (!link) return false;
      const isValid = isZendeskUrl(link);
      if (isValid) afterFilter++;
      return isValid;
    });

  // Log filtering stats
  const filtered = totalLinks - afterFilter;
  if (filtered > 0) {
    console.error(`[SCRAPER] Filtered out ${filtered} non-English URLs (${totalLinks} total → ${afterFilter} English)`);
  }

  // Return unique links
  return [...new Set(normalizedLinks)];
}

/**
 * Scrapes Zendesk site for article links only (no auditing)
 * Returns an array of all unique URLs discovered
 */
async function scrapeZendeskLinks(page, startingUrl, loadingTime, maxDepth = 5) {
  console.error(`\n[SCRAPER] Starting crawl from: ${startingUrl}`);
  console.error(`[SCRAPER] Max depth: ${maxDepth}`);
  console.error(`[SCRAPER] Language filter: English only (/hc/en-us)`);

  const visited = new Set(); // URLs we've already processed
  const queue = []; // Queue of {url, depth} objects to process
  const allUrls = []; // Array to return with all visited URLs

  // Normalize and add starting URL
  const normalizedStart = normalizeUrl(startingUrl);
  queue.push({ url: normalizedStart, depth: 0 });

  while (queue.length > 0) {
    const { url, depth } = queue.shift();

    // Skip if already visited
    if (visited.has(url)) {
      console.error(`[SCRAPER] Skipping already visited: ${url}`);
      continue;
    }

    // Mark as visited
    visited.add(url);
    allUrls.push(url);

    console.error(`\n[SCRAPER] Crawling (${visited.size} visited, ${queue.length} queued, depth ${depth}): ${url}`);

    try {
      // Navigate to the page
      console.error(`[SCRAPER] Navigating to: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: loadingTime
      });

      // Wait a moment for page to settle
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract links if we haven't reached max depth
      if (depth < maxDepth) {
        console.error(`[SCRAPER] Extracting links from page...`);
        const links = await extractLinks(page);
        console.error(`[SCRAPER] Found ${links.length} unique Zendesk links`);

        // Add new links to queue
        let newLinksAdded = 0;
        for (const link of links) {
          if (!visited.has(link) && !queue.some(item => item.url === link)) {
            queue.push({ url: link, depth: depth + 1 });
            newLinksAdded++;
          }
        }
        console.error(`[SCRAPER] Added ${newLinksAdded} new links to queue`);
      } else {
        console.error(`[SCRAPER] Max depth reached, not extracting links`);
      }

    } catch (err) {
      console.error(`[SCRAPER] Error processing ${url}: ${err.message}`);
      // Continue with next URL in queue
    }
  }

  console.error(`\n[SCRAPER] Crawl complete!`);
  console.error(`[SCRAPER] Total pages discovered: ${visited.size}`);

  return allUrls;
}

/**
 * Main function: Scrapes Zendesk and saves URLs to file
 */
export default async function scrapeAndSaveZendeskLinks(
  loginId,
  password,
  startingUrl,
  isViewingAudit,
  loadingTime
) {
  const LOADING_TIME = parseInt(loadingTime) * 1000;
  const viewport = { width: 1920, height: 1080 };
  const EXPLICIT_PORT = 9222 + (process.pid % 1000);

  console.error(`Zendesk scraper script loaded. URL: ${startingUrl}, port: ${EXPLICIT_PORT}`);

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!fs.existsSync(executablePath)) {
    console.error(`Chromium binary not found at: ${executablePath}`);
    throw new Error(`Chromium binary missing at ${executablePath}`);
  }

  let puppeteerArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    `--remote-debugging-port=${EXPLICIT_PORT}`,
    '--remote-allow-origins=*',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--disable-default-apps',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-translate',
    '--disable-features=AudioServiceOutOfProcess,Translate,BackForwardCache',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-component-extensions-with-background-pages',
    '--disable-ipc-flooding-protection',
    '--disable-renderer-backgrounding',
    '--mute-audio',
    '--no-default-browser-check',
    '--no-first-run',
    '--metrics-recording-only',
    '--disable-hang-monitor',
    '--disable-prompt-on-repost',
    '--disable-domain-reliability',
    '--disable-component-update'
  ];

  let browser;
  const puppeteerHeadlessConfig = {
    executablePath,
    headless: true,
    args: puppeteerArgs,
  };
  const puppeteerConfig = {
    executablePath,
    headless: false,
    args: puppeteerArgs,
  };

  try {
    const useConfig = isViewingAudit === "no" ? puppeteerHeadlessConfig : puppeteerConfig;
    browser = await puppeteer.launch(useConfig);
    console.error('Puppeteer successfully launched for Zendesk scraping.');

    const page = await browser.newPage();
    await page.setViewport(viewport);

    page.setDefaultNavigationTimeout(LOADING_TIME);
    page.setDefaultTimeout(LOADING_TIME);

    console.error(`Navigating to ${startingUrl}...`);
    await page.goto(startingUrl, {
      waitUntil: 'networkidle2',
      timeout: LOADING_TIME
    });

    console.error('Page loaded. Ready for login interaction.');

    // Login logic (copied from zendeskLogin.mjs)
    console.error('Waiting for login form...');

    const loginIdSelectors = [
      'input[type="email"]',
      'input[name="user[email]"]',
      'input[id="user_email"]',
      '#email',
      'input[name="email"]',
      'input[type="text"]'
    ];

    let loginIdInput = null;
    for (const selector of loginIdSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        loginIdInput = selector;
        console.error(`Found login ID input with selector: ${selector}`);
        break;
      } catch (err) {
        // Try next selector
      }
    }

    if (!loginIdInput) {
      throw new Error('Could not find login ID input field');
    }

    console.error(`Typing login ID into ${loginIdInput}...`);
    await page.type(loginIdInput, loginId);
    console.error('Login ID entered.');

    const passwordSelectors = [
      'input[type="password"]',
      'input[name="user[password]"]',
      'input[id="user_password"]',
      '#password',
      'input[name="password"]'
    ];

    let passwordInput = null;
    for (const selector of passwordSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        passwordInput = selector;
        console.error(`Found password input with selector: ${selector}`);
        break;
      } catch (err) {
        // Try next selector
      }
    }

    if (!passwordInput) {
      throw new Error('Could not find password input field');
    }

    console.error(`Typing password into ${passwordInput}...`);
    await page.type(passwordInput, password);
    console.error('Password entered.');

    const signInSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Sign in")',
      'input[value="Sign in"]',
      '.submit',
      '#submit'
    ];

    let signInButton = null;
    for (const selector of signInSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        signInButton = selector;
        console.error(`Found sign in button with selector: ${selector}`);
        break;
      } catch (err) {
        // Try next selector
      }
    }

    if (!signInButton) {
      throw new Error('Could not find Sign in button');
    }

    console.error(`Clicking sign in button...`);
    await page.click(signInButton);
    console.error('Sign in button clicked.');

    // Wait for navigation to target page
    console.error('Waiting for navigation to https://familysearch.zendesk.com/hc/en-us...');
    const targetUrlPattern = /familysearch\.zendesk\.com\/hc\/en-us/;
    let navigationComplete = false;
    let attempts = 0;
    const maxAttempts = 20;

    while (!navigationComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      const currentUrl = page.url();
      console.error(`Attempt ${attempts}: Current URL: ${currentUrl}`);

      if (targetUrlPattern.test(currentUrl)) {
        navigationComplete = true;
        console.error('Successfully navigated to target page!');
      }
    }

    if (!navigationComplete) {
      console.error('Warning: Did not reach target page within timeout, but continuing...');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Scrape all links
    const currentUrl = page.url();
    console.error('\n=== Starting link scraping ===');
    const allUrls = await scrapeZendeskLinks(page, currentUrl, LOADING_TIME, 5);
    console.error(`=== Scraping complete! Total URLs: ${allUrls.length} ===\n`);

    // Format URLs: full URLs and relative paths separately
    const fullUrls = allUrls;
    const relativePaths = allUrls.map(url => {
      const match = url.match(/(articles\/.*)/);
      return match ? match[1] : url;
    });

    // Save to two separate files
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const filenameFullUrls = `zendesk-articles-full-${timestamp}.txt`;
    const filenamePaths = `zendesk-articles-paths-${timestamp}.txt`;

    let outputDir;
    if (process.env.AUDIT_OUTPUT_DIR) {
      outputDir = path.join(process.env.AUDIT_OUTPUT_DIR, '..', 'zendesk-paths');
    } else {
      outputDir = path.join(process.cwd(), 'audits', 'zendesk-paths');
    }

    await fsPromises.mkdir(outputDir, { recursive: true });

    // Write full URLs file
    const outputPathFullUrls = path.join(outputDir, filenameFullUrls);
    const fullUrlsContent = fullUrls.join('\n');
    await fsPromises.writeFile(outputPathFullUrls, fullUrlsContent, 'utf8');
    console.error(`Saved ${fullUrls.length} full URLs to: ${outputPathFullUrls}`);

    // Write relative paths file
    const outputPathPaths = path.join(outputDir, filenamePaths);
    const pathsContent = relativePaths.join('\n');
    await fsPromises.writeFile(outputPathPaths, pathsContent, 'utf8');
    console.error(`Saved ${relativePaths.length} relative paths to: ${outputPathPaths}`);

    if (isViewingAudit === "yes") {
      console.error('Keeping browser open for viewing (5 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    await browser.close();

    return {
      success: true,
      message: `Successfully scraped ${allUrls.length} article URLs`,
      totalUrlsScraped: allUrls.length,
      outputFilePathFullUrls: outputPathFullUrls,
      outputFilePathPaths: outputPathPaths
    };

  } catch (err) {
    console.error("Error in scrapeAndSaveZendeskLinks:", err.message);
    console.error("Stack Trace:", err.stack);

    if (browser) {
      await browser.close();
    }

    throw err;
  }
}
