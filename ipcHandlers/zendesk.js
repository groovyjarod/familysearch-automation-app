const { app, BrowserWindow, ipcMain } = require("electron");
const fsPromise = require("fs").promises;
const path = require("path");
const child_process = require("child_process");

/**
 * Register Zendesk-related IPC handlers
 * Includes: login, scraping, concurrent audits, retry failed audits
 */
function registerZendeskHandlers(
  isDev,
  getAuditsPath,
  getResourcesPath,
  nodeBinary,
  chromiumPath,
  registerProcess,
  unregisterProcess,
  startSession,
  isSessionCancelled,
  endSession,
  ensureDir,
  getSettings
) {
ipcMain.handle("zendesk-login", async (_event, loginId, password, isViewingAudit, loadingTime) => {
  let output = "";
  let errorOutput = "";

  const scriptPath = isDev
    ? path.join(process.cwd(), "runZendeskLogin.mjs")
    : path.join(getResourcesPath(), "runZendeskLogin.mjs");

  const processId = `zendesk-login-${Date.now()}`;
  console.log(`[ZENDESK LOGIN START] Process ID: ${processId}`);

  const spawnPromise = new Promise((resolve) => {
    const child = child_process.spawn(
      nodeBinary,
      [
        scriptPath,
        loginId,
        password,
        isViewingAudit,
        loadingTime
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: isDev ? process.cwd() : path.join(getResourcesPath()),
        env: {
          ...process.env,
          NODE_PATH: isDev
            ? path.join(process.cwd(), 'node_modules')
            : path.join(getResourcesPath(), 'node_modules'),
          PUPPETEER_EXECUTABLE_PATH: chromiumPath,
          AUDIT_OUTPUT_DIR: isDev
            ? path.join(process.cwd(), 'audits', 'custom-audit-results')
            : path.join(getAuditsPath(), 'audits', 'custom-audit-results')
        }
      }
    );

    registerProcess(processId, child);

    child.stdout.on("data", (data) => {
      const log = data.toString();
      output += log;
      BrowserWindow.getAllWindows()[0].webContents.send('zendesk-log', log);
    });

    child.stderr.on("data", (data) => {
      const error = data.toString();
      errorOutput += error;
      console.error('[ZENDESK LOGIN LOG]:', error.trim());
      BrowserWindow.getAllWindows()[0].webContents.send('zendesk-error-log', error);
    });

    child.on("close", (code) => {
      unregisterProcess(processId);
      console.log(`[ZENDESK LOGIN COMPLETE] Process ${processId} exited with code ${code}`);

      if (code === 0) {
        try {
          const result = JSON.parse(output.trim());
          console.log(`[ZENDESK LOGIN SUCCESS] Result:`, result);
          resolve(result);
        } catch (err) {
          console.error('[ZENDESK LOGIN ERROR] Failed to parse JSON output:', err.message);
          console.error('[ZENDESK LOGIN ERROR] Raw output:', output.substring(0, 200));

          const parseError = {
            success: false,
            error: `Failed to parse login result: ${err.message}`,
            errorLocation: 'main.js - zendesk-login handler (JSON parsing)',
            friendlyMessage: 'Could not read login results',
            suggestion: 'The login process may have produced invalid output. Check console logs.',
            stack: err.stack,
            rawOutput: output.substring(0, 500)
          };

          resolve(parseError);
        }
      } else {
        console.error(`[ZENDESK LOGIN FAILED] Process exited with code ${code}`);
        console.error('[ZENDESK LOGIN FAILED] Last error output:', errorOutput.substring(errorOutput.length - 500));

        try {
          const errorResult = JSON.parse(output.trim());
          if (errorResult.error) {
            console.error('[ZENDESK LOGIN FAILED] Structured error from child:', errorResult.error);
            resolve(errorResult);
            return;
          }
        } catch (parseErr) {
          // If we can't parse, create our own error object
        }

        const exitError = {
          success: false,
          error: `Login process failed with exit code ${code}`,
          errorLocation: 'main.js - zendesk-login handler (child process exit)',
          friendlyMessage: 'Login process crashed or failed to complete',
          suggestion: 'Check the error logs for details. This may indicate incorrect credentials or a Chrome crash.',
          exitCode: code,
          lastErrorOutput: errorOutput.substring(errorOutput.length - 1000)
        };

        resolve(exitError);
      }
    });

    child.on("error", (err) => {
      unregisterProcess(processId);
      console.error('[ZENDESK LOGIN ERROR] Process error:', err.message);
      BrowserWindow.getAllWindows()[0].webContents.send('zendesk-error', err);

      const processError = {
        success: false,
        error: `Failed to spawn login process: ${err.message}`,
        errorLocation: 'main.js - zendesk-login handler (process spawn error)',
        friendlyMessage: 'Could not start the login process',
        suggestion: 'This may indicate a problem with Node.js or system permissions. Try restarting the app.',
        stack: err.stack
      };

      resolve(processError);
    });
  });

  return spawnPromise;
});

ipcMain.handle("zendesk-scrape", async (_event, loginId, password, zendeskUrl, isViewingAudit, loadingTime) => {
  let output = "";
  let errorOutput = "";

  const scriptPath = isDev
    ? path.join(process.cwd(), "runZendeskScrape.mjs")
    : path.join(getResourcesPath(), "runZendeskScrape.mjs");

  const processId = `zendesk-scrape-${Date.now()}`;
  console.log(`[ZENDESK SCRAPE START] Process ID: ${processId}`);

  const spawnPromise = new Promise((resolve) => {
    const child = child_process.spawn(
      nodeBinary,
      [
        scriptPath,
        loginId,
        password,
        zendeskUrl,
        isViewingAudit,
        loadingTime
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: isDev ? process.cwd() : path.join(getResourcesPath()),
        env: {
          ...process.env,
          NODE_PATH: isDev
            ? path.join(process.cwd(), 'node_modules')
            : path.join(getResourcesPath(), 'node_modules'),
          PUPPETEER_EXECUTABLE_PATH: chromiumPath,
          AUDIT_OUTPUT_DIR: isDev
            ? path.join(process.cwd(), 'audits', 'custom-audit-results')
            : path.join(getAuditsPath(), 'audits', 'custom-audit-results')
        }
      }
    );

    registerProcess(processId, child);

    child.stdout.on("data", (data) => {
      const log = data.toString();
      output += log;
    });

    child.stderr.on("data", (data) => {
      const error = data.toString();
      errorOutput += error;
      console.error('[ZENDESK SCRAPE LOG]:', error.trim());
    });

    child.on("close", (code) => {
      unregisterProcess(processId);
      console.log(`[ZENDESK SCRAPE COMPLETE] Process ${processId} exited with code ${code}`);

      if (code === 0) {
        try {
          const result = JSON.parse(output.trim());
          console.log(`[ZENDESK SCRAPE SUCCESS] Result:`, result);
          resolve(result);
        } catch (err) {
          console.error('[ZENDESK SCRAPE ERROR] Failed to parse JSON output:', err.message);
          resolve({
            success: false,
            error: `Failed to parse scraping result: ${err.message}`
          });
        }
      } else {
        console.error(`[ZENDESK SCRAPE FAILED] Process exited with code ${code}`);
        resolve({
          success: false,
          error: `Scraping process failed with exit code ${code}`,
          lastErrorOutput: errorOutput.substring(errorOutput.length - 1000)
        });
      }
    });

    child.on("error", (err) => {
      unregisterProcess(processId);
      console.error('[ZENDESK SCRAPE ERROR] Process error:', err.message);
      resolve({
        success: false,
        error: `Failed to spawn scraping process: ${err.message}`
      });
    });
  });

  return spawnPromise;
});

ipcMain.handle("zendesk-concurrent-audit", async (_event, loginId, password, zendeskUrl, isViewingAudit, loadingTime, concurrency) => {
  const puppeteer = (await import('puppeteer')).default;

  // Generate unique session ID for this audit run
  const sessionId = `zendesk-session-${Date.now()}`;
  console.log(`[ZENDESK AUDIT] Starting session: ${sessionId}`);

  const scriptPath = isDev
    ? path.join(process.cwd(), "runZendeskSingleAuditWithCookies.mjs")
    : path.join(getResourcesPath(), "runZendeskSingleAuditWithCookies.mjs");

  // Read wikiPaths from settings to get URLs to audit
  let urlsToAudit = [];
  try {
    const { wikiPaths } = await getSettings();

    // Build full URLs from paths
    const baseUrl = zendeskUrl.endsWith('/') ? zendeskUrl.slice(0, -1) : zendeskUrl;
    urlsToAudit = wikiPaths.map(p => {
      const cleanPath = p.startsWith('/') ? p : '/' + p;
      return baseUrl + cleanPath;
    });
  } catch (err) {
    console.error('[ZENDESK AUDIT] Failed to read settings:', err.message);
    return {
      success: false,
      error: `Failed to read settings: ${err.message}`,
      friendlyMessage: 'Could not find paths to audit',
      suggestion: 'Check the settings page and re-save your wiki paths'
    };
  }

  if (urlsToAudit.length === 0) {
    return {
      success: false,
      error: 'No URLs found in wikiPaths setting',
      friendlyMessage: 'No paths to audit',
      suggestion: 'Add paths to Page Paths in the settings page'
    };
  }

  console.log(`[ZENDESK AUDIT] Found ${urlsToAudit.length} URLs to audit with concurrency ${concurrency}`);

  // === STEP 1: Login once and save cookies ===
  const LOADING_TIME = parseInt(loadingTime) * 1000;
  const viewport = { width: 1920, height: 1080 };
  const EXPLICIT_PORT = 9222 + (process.pid % 1000);

  let browser;
  const puppeteerArgs = [
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

  const puppeteerConfig = {
    executablePath: chromiumPath,
    headless: isViewingAudit === "no",
    args: puppeteerArgs,
  };

  try {
    // Track this session as active
    startSession(sessionId);
    console.log('[ZENDESK AUDIT] Step 1: Performing login to save cookies...');
    browser = await puppeteer.launch(puppeteerConfig);

    const loginPage = await browser.newPage();
    await loginPage.setViewport(viewport);
    loginPage.setDefaultNavigationTimeout(LOADING_TIME);
    loginPage.setDefaultTimeout(LOADING_TIME);

    console.log(`[ZENDESK AUDIT] Navigating to ${zendeskUrl} for login...`);
    await loginPage.goto(zendeskUrl, {
      waitUntil: 'networkidle2',
      timeout: LOADING_TIME
    });

    // Login flow
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
        await loginPage.waitForSelector(selector, { timeout: 5000 });
        loginIdInput = selector;
        console.log(`[ZENDESK AUDIT] Found login ID input: ${selector}`);
        break;
      } catch (err) {
        // Try next selector
      }
    }

    if (!loginIdInput) {
      await browser.close();
      return {
        success: false,
        error: 'Could not find login ID input field',
        friendlyMessage: 'Login form not found',
        suggestion: 'Verify the URL is correct and the page loaded properly'
      };
    }

    await loginPage.type(loginIdInput, loginId);
    console.log('[ZENDESK AUDIT] Login ID entered');

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
        await loginPage.waitForSelector(selector, { timeout: 3000 });
        passwordInput = selector;
        console.log(`[ZENDESK AUDIT] Found password input: ${selector}`);
        break;
      } catch (err) {
        // Try next selector
      }
    }

    if (!passwordInput) {
      await browser.close();
      return {
        success: false,
        error: 'Could not find password input field',
        friendlyMessage: 'Password field not found',
        suggestion: 'Login form may have changed structure'
      };
    }

    await loginPage.type(passwordInput, password);
    console.log('[ZENDESK AUDIT] Password entered');

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
        await loginPage.waitForSelector(selector, { timeout: 3000 });
        signInButton = selector;
        console.log(`[ZENDESK AUDIT] Found sign in button: ${selector}`);
        break;
      } catch (err) {
        // Try next selector
      }
    }

    if (!signInButton) {
      await browser.close();
      return {
        success: false,
        error: 'Could not find Sign in button',
        friendlyMessage: 'Sign in button not found',
        suggestion: 'Login form may have changed structure'
      };
    }

    await loginPage.click(signInButton);
    console.log('[ZENDESK AUDIT] Sign in button clicked. Waiting for 2FA...');

    // Wait for navigation to complete (includes 2FA)
    const targetUrlPattern = /articles\.familysearch\.org\/hc\/en-us/;
    let navigationComplete = false;
    let attempts = 0;
    const maxAttempts = 60;

    while (!navigationComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      const currentUrl = loginPage.url();
      console.log(`[ZENDESK AUDIT] Login attempt ${attempts}: ${currentUrl}`);

      if (targetUrlPattern.test(currentUrl)) {
        navigationComplete = true;
        console.log('[ZENDESK AUDIT] Successfully logged in!');
      }
    }

    if (!navigationComplete) {
      await browser.close();
      return {
        success: false,
        error: 'Failed to complete login within timeout',
        friendlyMessage: '2FA timeout or login failed',
        suggestion: 'Ensure 2FA code is entered quickly or increase timeout'
      };
    }

    // Wait for session to establish
    console.log('[ZENDESK AUDIT] Waiting 3 seconds for session to establish...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Save cookies to temporary file
    const cookies = await loginPage.cookies();
    console.log(`[ZENDESK AUDIT] Retrieved ${cookies.length} cookies from authenticated session`);

    const tempDir = isDev
      ? path.join(process.cwd(), 'temp')
      : path.join(getAuditsPath(), 'temp');
    await ensureDir(tempDir);

    const cookieFilePath = path.join(tempDir, `zendesk-cookies-${Date.now()}.json`);
    await fsPromise.writeFile(cookieFilePath, JSON.stringify(cookies, null, 2), 'utf8');
    console.log(`[ZENDESK AUDIT] Cookies saved to: ${cookieFilePath}`);

    // Close login browser
    await browser.close();
    console.log('[ZENDESK AUDIT] Login browser closed. Starting concurrent audits...');

    // === STEP 2: Spawn concurrent audits with saved cookies ===
    const outputDir = isDev
      ? path.join(process.cwd(), 'audits', 'zendesk-audit-results')
      : path.join(getAuditsPath(), 'audits', 'zendesk-audit-results');

    await ensureDir(outputDir);

    // Import p-limit dynamically
    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(parseInt(concurrency) || 1);

    const results = [];
    const failedAudits = [];

    // Helper function to spawn a single audit process with cookies
    const spawnSingleAudit = (url, index) => {
      return new Promise((resolve) => {
        // Check if this session has been cancelled
        if (isSessionCancelled(sessionId)) {
          resolve({
            success: false,
            url,
            error: 'Audit cancelled by user',
            accessibilityScore: 0,
            cancelled: true
          });
          return;
        }

        const urlPath = new URL(url).pathname.replace(/^\//, '').replace(/\//g, '-') || 'home';
        const filename = `${urlPath}-zendesk.json`;
        const outputFile = path.join(outputDir, filename);

        const processId = `zendesk-audit-${Date.now()}-${index}`;
        let output = "";
        let errorOutput = "";

        console.log(`[ZENDESK AUDIT ${index + 1}/${urlsToAudit.length}] Starting: ${url}`);

        const child = child_process.spawn(
          nodeBinary,
          [
            scriptPath,
            cookieFilePath, // Pass cookie file path
            url, // URL to audit
            outputFile,
            loadingTime,
            isViewingAudit
          ],
          {
            stdio: ["ignore", "pipe", "pipe"],
            cwd: isDev ? process.cwd() : path.join(getResourcesPath()),
            env: {
              ...process.env,
              NODE_PATH: isDev
                ? path.join(process.cwd(), 'node_modules')
                : path.join(getResourcesPath(), 'node_modules'),
              PUPPETEER_EXECUTABLE_PATH: chromiumPath,
              AUDIT_OUTPUT_DIR: outputDir
            }
          }
        );

        registerProcess(processId, child);

        child.stdout.on("data", (data) => {
          output += data.toString();
        });

        child.stderr.on("data", (data) => {
          errorOutput += data.toString();
          console.error(`[ZENDESK AUDIT ${index + 1}]:`, data.toString().trim());
        });

        child.on("close", (code) => {
          unregisterProcess(processId);

          if (code === 0) {
            try {
              const result = JSON.parse(output.trim());
              console.log(`[ZENDESK AUDIT ${index + 1}] Success: ${url} (Score: ${result.accessibilityScore})`);
              resolve({
                success: true,
                url,
                accessibilityScore: result.accessibilityScore,
                filename
              });
            } catch (err) {
              console.error(`[ZENDESK AUDIT ${index + 1}] Parse error:`, err.message);
              resolve({
                success: false,
                url,
                error: `Failed to parse result: ${err.message}`,
                accessibilityScore: 0
              });
            }
          } else {
            console.error(`[ZENDESK AUDIT ${index + 1}] Failed with code ${code}: ${url}`);
            let errorMessage = 'Audit process failed';
            try {
              const errorResult = JSON.parse(output.trim());
              errorMessage = errorResult.error || errorMessage;
            } catch (e) {
              // Use default error message
            }
            resolve({
              success: false,
              url,
              error: errorMessage,
              accessibilityScore: 0
            });
          }
        });

        child.on("error", (err) => {
          unregisterProcess(processId);
          console.error(`[ZENDESK AUDIT ${index + 1}] Process error:`, err.message);
          resolve({
            success: false,
            url,
            error: `Failed to spawn: ${err.message}`,
            accessibilityScore: 0
          });
        });
      });
    };

    // Run all audits with concurrency control
    const auditPromises = urlsToAudit.map((url, index) => {
      return limit(() => spawnSingleAudit(url, index).then(result => {
        results.push(result);
        if (!result.success) {
          failedAudits.push({ url, error: result.error });
        }
        return result;
      }));
    });

    await Promise.all(auditPromises);

    // Clean up cookie file
    try {
      await fsPromise.unlink(cookieFilePath);
    } catch (err) {
      console.warn('[ZENDESK AUDIT] Failed to delete cookie file:', err.message);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[ZENDESK AUDIT] Complete: ${successCount}/${urlsToAudit.length} successful`);

    // Clean up session tracking
    endSession(sessionId);

    return {
      success: true,
      message: `Completed ${urlsToAudit.length} audits (${successCount} successful, ${failedAudits.length} failed)`,
      totalAudits: urlsToAudit.length,
      successfulAudits: successCount,
      failedAudits: failedAudits,
      results: results,
      outputDir: outputDir
    };

  } catch (err) {
    console.error('[ZENDESK AUDIT] Error during login or audit:', err.message);
    if (browser) {
      await browser.close().catch(() => {});
    }

    // Clean up session tracking on error
    endSession(sessionId);

    return {
      success: false,
      error: err.message,
      friendlyMessage: 'Login or audit process failed',
      suggestion: 'Check credentials and network connection'
    };
  }
});

ipcMain.handle("zendesk-retry-failed-audits", async (_event, loginId, password, zendeskUrl, failedUrls, isViewingAudit, loadingTime, concurrency) => {
  // Use the same cookie-based approach as the main audit handler
  const puppeteer = (await import('puppeteer')).default;

  // Generate unique session ID for this retry run
  const sessionId = `zendesk-retry-${Date.now()}`;
  console.log(`[ZENDESK RETRY] Starting session: ${sessionId}`);

  const scriptPath = isDev
    ? path.join(process.cwd(), "runZendeskSingleAuditWithCookies.mjs")
    : path.join(getResourcesPath(), "runZendeskSingleAuditWithCookies.mjs");

  console.log(`[ZENDESK RETRY] Retrying ${failedUrls.length} failed audits with concurrency ${concurrency}`);

  // === STEP 1: Login once and save cookies ===
  const LOADING_TIME = parseInt(loadingTime) * 1000;
  const viewport = { width: 1920, height: 1080 };
  const EXPLICIT_PORT = 9222 + (process.pid % 1000);

  let browser;
  const puppeteerArgs = [
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

  const puppeteerConfig = {
    executablePath: chromiumPath,
    headless: isViewingAudit === "no",
    args: puppeteerArgs,
  };

  try {
    // Track this session as active
    startSession(sessionId);
    console.log('[ZENDESK RETRY] Step 1: Performing login to save cookies...');
    browser = await puppeteer.launch(puppeteerConfig);

    const loginPage = await browser.newPage();
    await loginPage.setViewport(viewport);
    loginPage.setDefaultNavigationTimeout(LOADING_TIME);
    loginPage.setDefaultTimeout(LOADING_TIME);

    console.log(`[ZENDESK RETRY] Navigating to ${zendeskUrl} for login...`);
    await loginPage.goto(zendeskUrl, {
      waitUntil: 'networkidle2',
      timeout: LOADING_TIME
    });

    // Login flow (same as main audit)
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
        await loginPage.waitForSelector(selector, { timeout: 5000 });
        loginIdInput = selector;
        break;
      } catch (err) {
        // Try next selector
      }
    }

    if (!loginIdInput) {
      await browser.close();
      return {
        success: false,
        error: 'Could not find login ID input field'
      };
    }

    await loginPage.type(loginIdInput, loginId);

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
        await loginPage.waitForSelector(selector, { timeout: 3000 });
        passwordInput = selector;
        break;
      } catch (err) {
        // Try next selector
      }
    }

    if (!passwordInput) {
      await browser.close();
      return {
        success: false,
        error: 'Could not find password input field'
      };
    }

    await loginPage.type(passwordInput, password);

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
        await loginPage.waitForSelector(selector, { timeout: 3000 });
        signInButton = selector;
        break;
      } catch (err) {
        // Try next selector
      }
    }

    if (!signInButton) {
      await browser.close();
      return {
        success: false,
        error: 'Could not find Sign in button'
      };
    }

    await loginPage.click(signInButton);
    console.log('[ZENDESK RETRY] Sign in button clicked. Waiting for 2FA...');

    // Wait for navigation
    const targetUrlPattern = /articles\.familysearch\.org\/hc\/en-us/;
    let navigationComplete = false;
    let attempts = 0;
    const maxAttempts = 60;

    while (!navigationComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      const currentUrl = loginPage.url();

      if (targetUrlPattern.test(currentUrl)) {
        navigationComplete = true;
        console.log('[ZENDESK RETRY] Successfully logged in!');
      }
    }

    if (!navigationComplete) {
      await browser.close();
      return {
        success: false,
        error: 'Failed to complete login within timeout'
      };
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Save cookies
    const cookies = await loginPage.cookies();
    console.log(`[ZENDESK RETRY] Retrieved ${cookies.length} cookies`);

    const tempDir = isDev
      ? path.join(process.cwd(), 'temp')
      : path.join(getAuditsPath(), 'temp');
    await ensureDir(tempDir);

    const cookieFilePath = path.join(tempDir, `zendesk-retry-cookies-${Date.now()}.json`);
    await fsPromise.writeFile(cookieFilePath, JSON.stringify(cookies, null, 2), 'utf8');

    await browser.close();
    console.log('[ZENDESK RETRY] Login browser closed. Starting retry audits...');

    // === STEP 2: Run retry audits with cookies ===
    const outputDir = isDev
      ? path.join(process.cwd(), 'audits', 'zendesk-audit-results')
      : path.join(getAuditsPath(), 'audits', 'zendesk-audit-results');

    await ensureDir(outputDir);

    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(parseInt(concurrency) || 1);

    const results = [];
    const failedAudits = [];

    const spawnSingleAudit = (url, index) => {
      return new Promise((resolve) => {
        // Check if this session has been cancelled
        if (isSessionCancelled(sessionId)) {
          resolve({
            success: false,
            url,
            error: 'Retry cancelled by user',
            accessibilityScore: 0,
            cancelled: true
          });
          return;
        }

        const urlPath = new URL(url).pathname.replace(/^\//, '').replace(/\//g, '-') || 'home';
        const filename = `${urlPath}-zendesk.json`;
        const outputFile = path.join(outputDir, filename);

        const processId = `zendesk-retry-${Date.now()}-${index}`;
        let output = "";

        const child = child_process.spawn(
          nodeBinary,
          [
            scriptPath,
            cookieFilePath,
            url,
            outputFile,
            loadingTime,
            isViewingAudit
          ],
          {
            stdio: ["ignore", "pipe", "pipe"],
            cwd: isDev ? process.cwd() : path.join(getResourcesPath()),
            env: {
              ...process.env,
              NODE_PATH: isDev
                ? path.join(process.cwd(), 'node_modules')
                : path.join(getResourcesPath(), 'node_modules'),
              PUPPETEER_EXECUTABLE_PATH: chromiumPath,
              AUDIT_OUTPUT_DIR: outputDir
            }
          }
        );

        registerProcess(processId, child);

        child.stdout.on("data", (data) => {
          output += data.toString();
        });

        child.stderr.on("data", (data) => {
          console.error(`[ZENDESK RETRY ${index + 1}]:`, data.toString().trim());
        });

        child.on("close", (code) => {
          unregisterProcess(processId);

          if (code === 0) {
            try {
              const result = JSON.parse(output.trim());
              resolve({
                success: true,
                url,
                accessibilityScore: result.accessibilityScore,
                filename
              });
            } catch (err) {
              resolve({
                success: false,
                url,
                error: `Failed to parse result: ${err.message}`,
                accessibilityScore: 0
              });
            }
          } else {
            let errorMessage = 'Audit process failed';
            try {
              const errorResult = JSON.parse(output.trim());
              errorMessage = errorResult.error || errorMessage;
            } catch (e) {
              // Use default
            }
            resolve({
              success: false,
              url,
              error: errorMessage,
              accessibilityScore: 0
            });
          }
        });

        child.on("error", (err) => {
          unregisterProcess(processId);
          resolve({
            success: false,
            url,
            error: `Failed to spawn: ${err.message}`,
            accessibilityScore: 0
          });
        });
      });
    };

    const auditPromises = failedUrls.map((url, index) => {
      return limit(() => spawnSingleAudit(url, index).then(result => {
        results.push(result);
        if (!result.success) {
          failedAudits.push({ url, error: result.error });
        }
        return result;
      }));
    });

    await Promise.all(auditPromises);

    // Clean up cookie file
    try {
      await fsPromise.unlink(cookieFilePath);
    } catch (err) {
      console.warn('[ZENDESK RETRY] Failed to delete cookie file:', err.message);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[ZENDESK RETRY] Complete: ${successCount}/${failedUrls.length} successful`);

    // Clean up session tracking
    endSession(sessionId);

    return {
      success: true,
      message: `Retry completed: ${successCount}/${failedUrls.length} successful`,
      totalAudits: failedUrls.length,
      successfulAudits: successCount,
      failedAudits: failedAudits,
      results: results,
      outputDir: outputDir
    };

  } catch (err) {
    console.error('[ZENDESK RETRY] Error:', err.message);
    if (browser) {
      await browser.close().catch(() => {});
    }

    // Clean up session tracking on error
    endSession(sessionId);

    return {
      success: false,
      error: err.message
    };
  }
});

}

module.exports = {
  registerZendeskHandlers
};
