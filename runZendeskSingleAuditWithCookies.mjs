import puppeteer from "puppeteer";
import lighthouse from "lighthouse";
import { URL } from "url";
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import trimAuditData from './Audit_Logic/trimAuditData.mjs';
import classifyIssue from './Audit_Logic/classifyIssue.mjs';

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

// Parse CLI arguments
const [,, cookieFilePath, auditUrl, outputFile, loadingTime, isViewingAudit] = process.argv;

if (!cookieFilePath || !auditUrl || !outputFile || !loadingTime) {
  console.error('Usage: node runZendeskSingleAuditWithCookies.mjs <cookieFilePath> <auditUrl> <outputFile> <loadingTime> <isViewingAudit>');
  console.log(JSON.stringify({ error: 'Missing required arguments', accessibilityScore: 0 }));
  process.exit(1);
}

const LOADING_TIME = parseInt(loadingTime) * 1000;
const viewport = { width: 1920, height: 1080 };
const EXPLICIT_PORT = 9222 + (process.pid % 1000);

console.error(`[ZENDESK AUDIT] Audit URL: ${auditUrl}`);

async function main() {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!fs.existsSync(executablePath)) {
    console.error(`Chromium binary not found at: ${executablePath}`);
    console.log(JSON.stringify({
      error: `Chromium binary missing at ${executablePath}`,
      accessibilityScore: 0
    }));
    process.exit(1);
  }

  // Load saved cookies
  let cookies;
  try {
    const cookieData = await fsPromises.readFile(cookieFilePath, 'utf8');
    cookies = JSON.parse(cookieData);
  } catch (err) {
    console.error(`[ZENDESK AUDIT] Failed to load cookies: ${err.message}`);
    console.log(JSON.stringify({
      error: `Failed to load cookies: ${err.message}`,
      accessibilityScore: 0
    }));
    process.exit(1);
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
    console.error('[ZENDESK AUDIT] Puppeteer launched successfully');

    // Create page and set cookies
    const auditPage = await browser.newPage();
    await auditPage.setViewport(viewport);

    // Set cookies before navigating
    console.error('[ZENDESK AUDIT] Setting cookies...');
    await auditPage.setCookie(...cookies);
    console.error(`[ZENDESK AUDIT] ${cookies.length} cookies set successfully`);

    // Configure Lighthouse options
    const lighthouseOptions = {
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

    console.error(`[ZENDESK AUDIT] Running Lighthouse audit for: ${auditUrl}`);
    const runResult = await lighthouse(auditUrl, lighthouseOptions, lighthouseConfig, auditPage);

    if (!runResult || !runResult.lhr) {
      console.error('[ZENDESK AUDIT] Warning: Invalid Lighthouse result');
      await browser.close();
      console.log(JSON.stringify({
        success: false,
        url: auditUrl,
        error: 'Invalid Lighthouse result',
        accessibilityScore: 0
      }));
      process.exit(1);
    }

    const report = runResult.report;
    const accessibilityScore = runResult.lhr.categories.accessibility.score * 100;
    console.error(`[ZENDESK AUDIT] Completed. Score: ${accessibilityScore}`);

    // Process audit results
    const isConcise = "no";
    const trimmedData = trimAuditData(report, isConcise);

    const initialJsonReport = {};
    let itemCount = 0;
    initialJsonReport.accessibilityScore = accessibilityScore;
    initialJsonReport.url = auditUrl;

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

    // Write audit result to file
    const outputDir = path.dirname(outputFile);
    await ensureDir(outputDir);
    await fsPromises.writeFile(outputFile, JSON.stringify(initialJsonReport, null, 2), 'utf8');
    console.error(`[ZENDESK AUDIT] Saved to: ${outputFile}`);

    // Close browser
    await browser.close();

    // Send success response
    console.log(JSON.stringify({
      success: true,
      url: auditUrl,
      accessibilityScore,
      outputFile
    }));
    process.exit(0);

  } catch (err) {
    console.error(`[ZENDESK AUDIT] Error: ${err.message}`);
    console.error(`[ZENDESK AUDIT] Stack: ${err.stack}`);

    if (browser) {
      await browser.close().catch(() => {});
    }

    console.log(JSON.stringify({
      success: false,
      url: auditUrl,
      error: err.message,
      stack: err.stack,
      accessibilityScore: 0
    }));
    process.exit(1);
  }
}

main();
