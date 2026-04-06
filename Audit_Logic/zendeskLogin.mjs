import puppeteer from "puppeteer";
import lighthouse from "lighthouse";
import { URL } from "url";
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import trimAuditData from './trimAuditData.mjs';
import classifyIssue from './classifyIssue.mjs';
import buildZendeskLinkTree from './buildZendeskLinkTree.mjs';

// Windows-safe directory creation with retry logic
async function ensureDir(dirPath, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await fsPromises.mkdir(dirPath, { recursive: true });
      return; // Success
    } catch (err) {
      // Ignore EEXIST - directory already exists (safe)
      if (err.code === 'EEXIST') {
        return;
      }
      // Retry on Windows file locking errors
      if ((err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'EBUSY') && i < retries - 1) {
        console.error(`ensureDir: Retry ${i + 1} for ${dirPath} due to ${err.code}`);
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1))); // Exponential backoff
        continue;
      }
      // Other errors or retries exhausted - throw
      throw err;
    }
  }
}

export default async function zendeskLogin(
  loginId,
  password,
  isViewingAudit,
  loadingTime
) {
  const LOADING_TIME = parseInt(loadingTime) * 1000; // timeout timer in milliseconds
  const ZENDESK_URL = "https://familysearch.zendesk.com";
  const viewport = { width: 1920, height: 1080 };
  // Use process ID for deterministic port assignment
  const EXPLICIT_PORT = 9222 + (process.pid % 1000);

  console.error(`Zendesk login script loaded. URL: ${ZENDESK_URL}, port: ${EXPLICIT_PORT}`);

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!fs.existsSync(executablePath)) {
    console.error(`Chromium binary not found at: ${executablePath}`);
    throw new Error(`Chromium binary missing at ${executablePath}`);
  }

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason.message || reason);
    console.error('Promise:', promise);
  });

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
    console.error('Puppeteer successfully launched for Zendesk login.');

    const page = await browser.newPage();
    await page.setViewport(viewport);

    // Set a longer timeout for navigation
    page.setDefaultNavigationTimeout(LOADING_TIME);
    page.setDefaultTimeout(LOADING_TIME);

    console.error(`Navigating to ${ZENDESK_URL}...`);
    await page.goto(ZENDESK_URL, {
      waitUntil: 'networkidle2',
      timeout: LOADING_TIME
    });

    console.error('Page loaded. Ready for login interaction.');

    // Wait for login form to appear - try multiple common selectors
    console.error('Waiting for login form...');

    // Try to find login ID input (email/username field)
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

    // Fill in login ID
    console.error(`Typing login ID into ${loginIdInput}...`);
    await page.type(loginIdInput, loginId);
    console.error('Login ID entered.');

    // Find password input
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

    // Fill in password
    console.error(`Typing password into ${passwordInput}...`);
    await page.type(passwordInput, password);
    console.error('Password entered.');

    // Find and click Sign in button
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

    // Click the Sign in button
    console.error(`Clicking sign in button...`);
    await page.click(signInButton);
    console.error('Sign in button clicked.');

    // Wait for navigation to the target page (checking every second for up to 20 seconds)
    console.error('Waiting for navigation to https://familysearch.zendesk.com/hc/en-us...');
    const targetUrlPattern = /familysearch\.zendesk\.com\/hc\/en-us/;
    let navigationComplete = false;
    let attempts = 0;
    const maxAttempts = 20; // 20 seconds

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

    // Wait a moment for the page to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.error('Running Lighthouse accessibility audit on current page...');

    // Get WebSocket endpoint for Lighthouse
    const wsEndpoint = browser.wsEndpoint();
    const endpointURL = new URL(wsEndpoint);

    const lighthouseOptions = {
      port: parseInt(endpointURL.port),
      output: 'json',
      logLevel: 'error',
      maxWaitForLoad: LOADING_TIME,
      disableStorageReset: true,
      onlyCategories: ['accessibility']
    };

    const lighthouseConfig = {
      extends: 'lighthouse:default',
      settings: {
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          disabled: false,
        },
        onlyCategories: ['accessibility'],
        pauseAfterFcpMs: 0,
        pauseAfterLoadMs: 0,
        maxWaitForLoad: LOADING_TIME,
        skipAudits: ['uses-http2', 'bf-cache', 'prioritize-lcp-image'],
        disableStorageReset: true,
        disableFullPageScreenshot: true,
        throttlingMethod: 'provided',
      },
    };

    const currentUrl = page.url();
    console.error(`Running Lighthouse on: ${currentUrl}`);
    const runResult = await lighthouse(currentUrl, lighthouseOptions, lighthouseConfig);

    if (!runResult || !runResult.lhr) {
      throw new Error('Lighthouse returned invalid result');
    }

    const report = runResult.report;
    const accessibilityScore = runResult.lhr.categories.accessibility.score * 100;
    console.error(`Lighthouse audit complete. Accessibility Score: ${accessibilityScore}`);

    // Process the audit results using existing pipeline
    console.error('Processing audit data...');
    const isConcise = "no"; // Use full report
    const trimmedData = trimAuditData(report, isConcise);

    const initialJsonReport = {};
    let itemCount = 0;
    initialJsonReport.accessibilityScore = accessibilityScore;

    trimmedData.forEach((item, index) => {
      const { id, title, description, items } = item;
      const newItems = [];
      for (let itemData of items) {
        const newItem = {
          snippet: itemData.snippet,
          selector: itemData.selector,
          explanation: itemData.explanation,
          boundingRect: itemData.boundingRect,
        };
        if (isConcise === "no") newItem.itemCategory = classifyIssue(itemData.selector, itemData.path || '');
        if (itemData.subItems && itemData.subItems.items) {
          const newSubItems = itemData.subItems.items.map(subItem => ({
            snippet: subItem.relatedNode?.snippet,
            selector: subItem.relatedNode?.selector,
            boundingRect: subItem.relatedNode?.boundingRect,
            nodeLabel: subItem.relatedNode?.nodeLabel,
            subItemCategory: classifyIssue(subItem.relatedNode?.selector, subItem.relatedNode?.path || ''),
          }));
          newItem.subItems = newSubItems;
        }
        newItems.push(newItem);
      }
      itemCount++;
      initialJsonReport[`${id}-${index + 1}`] = { title, description, items: newItems };
    });
    initialJsonReport['number-of-Items'] = itemCount;

    // Determine output path - use environment variable passed from main process
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const filename = `desktop-full-zendesk-hc-${timestamp}.json`;

    // The output directory will be passed via environment or we'll use cwd
    let outputDir;
    if (process.env.AUDIT_OUTPUT_DIR) {
      outputDir = process.env.AUDIT_OUTPUT_DIR;
    } else {
      // Fallback to project directory for dev
      outputDir = path.join(process.cwd(), 'audits', 'custom-audit-results');
    }

    const outputPath = path.join(outputDir, filename);

    // Ensure directory exists
    await ensureDir(outputDir);

    // Write audit results to file
    console.error(`Writing audit results to: ${outputPath}`);
    await fsPromises.writeFile(outputPath, JSON.stringify(initialJsonReport, null, 2), 'utf8');
    console.error('Initial audit results saved successfully!');

    // Now build the link tree and audit all discovered pages
    console.error('\n=== Starting link tree crawl and audits ===');
    const allVisitedUrls = await buildZendeskLinkTree(
      page,
      browser,
      currentUrl,
      outputDir,
      LOADING_TIME,
      viewport,
      5 // Max depth of 5 levels
    );
    console.error(`=== Crawl complete! Total pages audited: ${allVisitedUrls.length} ===\n`);

    // Keep browser open a bit longer if viewing to see final state
    if (isViewingAudit === "yes") {
      console.error('Keeping browser open for viewing (5 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    await browser.close();

    return {
      success: true,
      message: `Zendesk login and crawl completed successfully. Audited ${allVisitedUrls.length} pages.`,
      url: currentUrl,
      auditFilePath: outputPath,
      accessibilityScore: accessibilityScore,
      visitedUrls: allVisitedUrls,
      totalPagesAudited: allVisitedUrls.length
    };

  } catch (err) {
    console.error("Error in zendeskLogin:", err.message);
    console.error("Stack Trace:", err.stack);

    if (browser) {
      await browser.close();
    }

    // Add context to error
    if (!err.location) {
      err.location = 'zendeskLogin.mjs';
      err.url = ZENDESK_URL;

      if (err.message.includes('Timeout') || err.message.includes('timeout')) {
        err.friendlyMessage = `Page took too long to load (exceeded ${LOADING_TIME/1000} second timeout)`;
        err.suggestion = 'Try increasing the timeout value or check your internet connection';
      } else if (err.message.includes('Navigation')) {
        err.friendlyMessage = 'Failed to navigate to Zendesk';
        err.suggestion = 'Verify the URL is accessible and you have internet connection';
      } else if (err.message.includes('Target closed') || err.message.includes('Session closed')) {
        err.friendlyMessage = 'Browser closed unexpectedly during login';
        err.suggestion = 'This may happen with unexpected redirects or popups';
      }
    }

    throw err;
  }
}
