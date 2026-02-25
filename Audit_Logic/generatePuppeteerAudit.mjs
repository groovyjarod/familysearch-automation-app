import puppeteer from "puppeteer";
import lighthouse from "lighthouse";
import { URL } from "url";
import fs from 'fs'

export default async function generatePuppeteerAudit(
  puppeteerUrl,
  testing_method,
  user_agent,
  viewportWidth,
  isUsingUserAgent,
  isViewingAudit,
  loadingTime
) {
  const OUTPUT_FORMAT = "json";
  const TESTING_METHOD = testing_method === "all" ? "desktop" : testing_method;
  const isMobile = TESTING_METHOD === "mobile";
  const USER_AGENT = isUsingUserAgent === "yes" ? user_agent : "The user has indicated they do not want to use a User Agent Key for this run.";
  const LOADING_TIME = parseInt(loadingTime) * 1000; // timeout timer in milliseconds
  // const LIGHTHOUSE_TIMEOUT = 60000;
  const viewport = { width: parseInt(viewportWidth), height: 800 }
  // Use process ID for deterministic port assignment (faster than random)
  const EXPLICIT_PORT = 9222 + (process.pid % 1000)

  console.error(`Puppeteer js file loaded. url: ${puppeteerUrl}, testing method: ${TESTING_METHOD}, user agent: ${USER_AGENT}, loading time: ${LOADING_TIME}, viewport: ${viewportWidth}, port for this run: ${EXPLICIT_PORT}`)

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
  if (!fs.existsSync(executablePath)) {
    console.error(`Chromium binary not found at: ${executablePath}`)
    throw new Error(`Chromium binary missing at ${executablePath}`)
  }

  process.on('unhandledRejection', (reason, promise) => {
    console.error('unhandled Rejection:', reason.mesage || reason)
    console.error('Promise:', promise)
  })

  let puppeteerArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    `--remote-debugging-port=${EXPLICIT_PORT}`,
    '--remote-allow-origins=*',
    '--disable-dev-shm-usage',
    // Performance optimizations for faster Chrome startup
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
  ]

  if (isUsingUserAgent) puppeteerArgs.push(`--user-agent=${USER_AGENT}`)

  let browser
  const puppeteerHeadlessConfig = {
    executablePath,
    headless: true,
    args: puppeteerArgs,
  }
  const puppeteerConfig = {
    executablePath,
    headless: false,
    args: puppeteerArgs,
  }

  try {
    const useConfig = isViewingAudit == "no" ? puppeteerHeadlessConfig : puppeteerConfig;
    browser = await puppeteer.launch(useConfig);
    console.error('Puppeteer successfully launched.')

    // Get WebSocket endpoint for Lighthouse to connect
    const wsEndpoint = browser.wsEndpoint();
    const endpointURL = new URL(wsEndpoint);
    console.error('Browser debugging port:', endpointURL.port)

    const options = {
      port: parseInt(endpointURL.port),
      output: OUTPUT_FORMAT,
      logLevel: "error",
      maxWaitForLoad: LOADING_TIME,
      disableStorageReset: true,
      onlyCategories: ["accessibility"]
    };

    const configWithUserAgent = {
      extends: "lighthouse:default",
      settings: {
        formFactor: TESTING_METHOD,
        screenEmulation: {
          mobile: isMobile,
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          disabled: false,
        },
        onlyCategories: ["accessibility"],
        pauseAfterFcpMs: 0, // Reduced from 1000ms - accessibility audits don't need FCP delay
        pauseAfterLoadMs: 0, // Reduced from 1000ms - saves 2 seconds per audit
        maxWaitForLoad: LOADING_TIME,
        emulatedUserAgent: USER_AGENT,
        skipAudits: ['uses-http2', 'bf-cache', 'prioritize-lcp-image'],
        // Performance optimizations
        disableStorageReset: true,
        disableFullPageScreenshot: true, // Don't need screenshots for accessibility
        throttlingMethod: 'provided', // Skip throttling simulation
      },
    };

    const configWithoutUserAgent = {
      extends: "lighthouse:default",
      settings: {
        formFactor: TESTING_METHOD,
        screenEmulation: {
          mobile: isMobile,
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          disabled: false,
        },
        onlyCategories: ["accessibility"],
        pauseAfterFcpMs: 0, // Reduced from 1000ms - accessibility audits don't need FCP delay
        pauseAfterLoadMs: 0, // Reduced from 1000ms - saves 2 seconds per audit
        maxWaitForLoad: LOADING_TIME,
        skipAudits: ['uses-http2', 'bf-cache', 'prioritize-lcp-image'],
        // Performance optimizations
        disableStorageReset: true,
        disableFullPageScreenshot: true, // Don't need screenshots for accessibility
        throttlingMethod: 'provided', // Skip throttling simulation
      },
    };

    const config = isUsingUserAgent ? configWithUserAgent : configWithoutUserAgent

    try {
      console.error(`Starting Lighthouse audit for ${puppeteerUrl}...`);
      const runResult = await lighthouse(puppeteerUrl, options, config);
      console.error(`Lighthouse audit complete.`)

      if (!runResult || !runResult.lhr) {
        console.error('Lighthouse returned invalid result:', JSON.stringify(runResult, null, 2))
        throw new Error(`Invalid Lighthouse result`)
      }

      const report = runResult.report;
      const accessibilityScore = runResult.lhr.categories.accessibility.score * 100;
      console.error(`Accessibility Score: ${accessibilityScore}`)

      await browser.close();
      return [report, accessibilityScore];
    } catch (lighthouseError) {
      console.error('Lighthouse Error:', lighthouseError.message)
      console.error('Lighthouse Stack:', lighthouseError.stack)
      throw lighthouseError
    }

  } catch (err) {
    console.error("In generatePuppeteerAudit: ", err.message);
    console.error("Stack Trace:", err.stack)
    if (browser) await browser.close()
    return [err, 0];
  }
}
