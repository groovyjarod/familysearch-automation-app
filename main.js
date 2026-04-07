const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater")
const fs = require("fs");
const fsPromise = require("fs").promises;
const path = require("path");
const os = require("os");
const puppeteer = require("puppeteer")
const child_process = require("child_process");
const pLimit = require("p-limit");
const pLimitDefault = require("p-limit").default;
require("@electron/remote/main").initialize();

// ------------ Logging System ------------

let logFilePath = null;
let logStream = null;

// Initialize logging system
async function initializeLogging() {
  const logsDir = path.join(app.getPath('userData'), 'logs');
  await ensureDir(logsDir);

  // Get current week identifier (YYYY-WW format)
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  const weekIdentifier = `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;

  logFilePath = path.join(logsDir, `app-${weekIdentifier}.log`);

  // Clean up old log files (keep only current week and previous 4 weeks)
  try {
    const files = await fsPromise.readdir(logsDir);
    const logFiles = files.filter(f => f.startsWith('app-') && f.endsWith('.log'));

    // Sort by filename (chronological due to YYYY-WW format)
    logFiles.sort().reverse();

    // Keep only the 5 most recent log files
    if (logFiles.length > 5) {
      const filesToDelete = logFiles.slice(5);
      await Promise.all(
        filesToDelete.map(file =>
          fsPromise.unlink(path.join(logsDir, file)).catch(err =>
            console.error(`Failed to delete old log file ${file}:`, err)
          )
        )
      );
    }
  } catch (err) {
    console.error('Failed to clean up old log files:', err);
  }

  // Create write stream for appending logs
  logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

  // Write session start marker
  const sessionStart = `\n========== Session Start: ${now.toISOString()} ==========\n`;
  logStream.write(sessionStart);

  // Capture console.log
  const originalLog = console.log;
  console.log = (...args) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [LOG] ${message}\n`;

    if (logStream) {
      logStream.write(logEntry);
    }
    originalLog.apply(console, args);
  };

  // Capture console.error
  const originalError = console.error;
  console.error = (...args) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [ERROR] ${message}\n`;

    if (logStream) {
      logStream.write(logEntry);
    }
    originalError.apply(console, args);
  };

  // Capture console.warn
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [WARN] ${message}\n`;

    if (logStream) {
      logStream.write(logEntry);
    }
    originalWarn.apply(console, args);
  };

  console.log('Logging system initialized');
  console.log(`Log file: ${logFilePath}`);
}

// Close log stream on app quit
app.on('before-quit', () => {
  if (logStream) {
    const sessionEnd = `========== Session End: ${new Date().toISOString()} ==========\n\n`;
    logStream.write(sessionEnd);
    logStream.end();
  }
});

// Windows-safe directory creation with retry logic
async function ensureDir(dirPath, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await fsPromise.mkdir(dirPath, { recursive: true });
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

// Initialize settings in userData for packaged app
async function initializeSettings() {
  const settingsFiles = ['wikiPaths.txt', 'initialUrl.txt', 'secretUserAgent.txt'];

  if (isPackaged) {
    // In production: use userData for writable settings
    const userDataSettings = path.join(app.getPath('userData'), 'settings');
    await ensureDir(userDataSettings);

    for (const file of settingsFiles) {
      const userFile = path.join(userDataSettings, file);
      const defaultFile = path.join(process.resourcesPath, 'settings', file);

      // Only copy if user file doesn't exist (first launch or deleted)
      try {
        await fsPromise.access(userFile);
      } catch {
        // File doesn't exist, copy from defaults
        try {
          await fsPromise.copyFile(defaultFile, userFile);
          console.log(`Initialized settings file: ${file}`);
        } catch (err) {
          console.error(`Failed to initialize ${file}:`, err);
        }
      }
    }
  }
}

// ------------ Update Code -----------

autoUpdater.logger = require('electron-log')
autoUpdater.logger.transports.file.level = 'info'

console.log('Updater provider:', autoUpdater.currentProvider?.constructor?.name || 'unknown')
console.log('Update feed URL:', autoUpdater.getFeedURL())

autoUpdater.setFeedURL({
  provider:"github",
  owner: "groovyjarod",
  repo: "familysearch-automation-app",
  releaseType: "release"
})

autoUpdater.on('checking-for-update', () => {
  console.log('Checking for updates...')
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-status', 'Checking for updates...')
})

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version)
  BrowserWindow.getAllWindows()[0].webContents.send('update-available', info)
})

autoUpdater.on('update-not-available', () => {
  console.log('No update available.')
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-not-available')
})

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version)

  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} is downloaded and ready to install. Do you want to restart now to install?`,
      buttons: ['Restart Now', 'Later']
    }).then(result => {
      if (result.response === 0) autoUpdater.quitAndInstall()
    })
  }
})

autoUpdater.on('error', (err) => {
  console.error('Auto-update error:', err)
  BrowserWindow.getAllWindows()[0].webContents.send('update-error', err.message)
})

console.log("Currently running on: ", app.getVersion())
console.log('Update feed URL:', autoUpdater.getFeedURL());

// ------------ Setup Code ------------

let nodeBinary
let chromiumPath;
const isPackaged = app.isPackaged;
const isDev = !app.isPackaged

if (isPackaged) {
  const platform = os.platform();
  if (platform === "darwin") {
    chromiumPath = path.join(
      process.resourcesPath,
      'chrome-browser',
      'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
    );
    nodeBinary = path.join(process.resourcesPath, "node")
  } else if (platform === "win32") {
    chromiumPath = path.join(
      process.resourcesPath,
      'chrome-browser',
      'chrome.exe'
    );
    nodeBinary = path.join(process.resourcesPath, "node.exe")
  } else {
    chromiumPath = path.join(
      process.resourcesPath,
      'chrome-browser',
      'chrome-linux/chrome'
    )
    nodeBinary = path.join(process.resourcesPath, 'node')
  }
} else {
  console.log('Development environment detected.')
  chromiumPath = puppeteer.executablePath();
  nodeBinary = "node"
}

console.log(`Setting PUPPETEER_EXECUTABLE_PATH to ${chromiumPath}`);

process.env.PUPPETEER_EXECUTABLE_PATH = chromiumPath

// ------------ Window-handling code ------------

const activeProcesses = new Map();
const cancelledSessions = new Set();
const activeSessions = new Set(); // Track currently running audit sessions
const createWindow = async () => {
  // Initialize logging system first
  await initializeLogging();

  // Initialize settings in userData before anything else
  await initializeSettings();

  const allFolderPaths = [
    'all-audit-sizes',
    'audit-results',
    'old-audit-results',
    'custom-audit-results',
    'zendesk-audit-results',
    'old-zendesk-audit-results',
    'zendesk-paths'
  ]
  try {
    const auditsPath = isDev
      ? path.join(__dirname, 'audits')
      : path.join(app.getPath('documents'), 'audits')
    await ensureDir(auditsPath)
    for (let folderPath of allFolderPaths) {
      const newAuditPath = path.join(auditsPath, folderPath)
      await ensureDir(newAuditPath)
    }
  } catch (err) {
    console.error('Error in creating folder paths in documents:', err)
    throw err
  }

  try {
    const preloadPath = path.join(__dirname, "preload.js");
    console.log('Preload path:', preloadPath);
    try {
      await fsPromise.access(preloadPath)
    } catch (err) {
      console.error('Preload file not accessible:', err)
      throw err
    }

    const win = new BrowserWindow({
      width: 850,
      height: 700,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        preload: preloadPath,
        // contextIsolation: false,
        // enableRemoteModule: true,
        // nodeIntegration: true,
      },
    });

    win.webContents.on('preload-error', (event, preloadPath, error) => {
      console.error(`Preload error for ${preloadPath}:`, error)
    })

    const startURL = isDev
      ? "http://localhost:5173"
      : `file://${path.join(__dirname, "build/index.html")}`;

    if (isDev) {
      win.loadURL("http://localhost:5173");
    } else {
      win.loadFile(path.join(__dirname, "build", "index.html"))
    }
    console.log('Window successfully loaded.')
    win.on("closed", () => win.destroy());

  } catch (err) {
    console.error('Failed to create window:', err)
    app.quit()
  }
};

app.on("ready", () => {
  createWindow()
  autoUpdater.checkForUpdatesAndNotify()
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ------------ IPC Handler Functions ------------

const loadFolderData = async (folderName) => {
  const entries = await fsPromise.readdir(folderName);
  // Filter out hidden files (.DS_Store, .gitkeep, etc.)
  const filteredEntries = entries.filter(name => !name.startsWith('.'));
  return Promise.all(filteredEntries.map(async (name) => {
    const fullPath = path.join(folderName, name)
    try {
      const stats = await fsPromise.stat(fullPath)
      return {
        name,
        isDiectory: stats.isDirectory(),
        size: stats.size,
      }
    } catch (err) {
      console.error("In LoadFolderData: Error in fsPromise.stat", err)
    }
  }))
};

ipcMain.handle('check-node', async () => {
  const testNodePath = path.join(process.resourcesPath, os.platform() === 'win32' ? 'node.exe' : 'node');

  try {
    fs.access(testNodePath, fs.constants.X_OK, (err) => {
      if (err) {
        console.error('Node binary is missing or not executable at:', testNodePath);
        throw err
      } else {
        console.log('Node binary is accessible at:', testNodePath);
        child_process.execFile(testNodePath, ['--version'], (error, stdout, stderr) => {
          if (error) {
            console.error('Failed to execute node binary:', error);
            throw error
          } else {
            console.log('Node binary version:', stdout.trim());
          }
        });
      }
    });
    return { success: true, testNodePath: testNodePath }
  } catch (err) {
    console.error('yeah that didn\'t work lol' )
    return { success: false, error: err}
  }
})

ipcMain.handle("open-chrome", async (event, url) => {
  shell.openExternal(url)
})

ipcMain.handle("get-wiki-paths", async () => {
  const basePath = isDev
    ? path.join(__dirname, 'settings', 'wikiPaths.txt')
    : path.join(app.getPath('userData'), 'settings', 'wikiPaths.txt')
  const resultsRaw = await fsPromise.readFile(basePath, "utf8");
  const result = resultsRaw.split("\n").filter(Boolean);
  return result;
});

ipcMain.handle("get-file", async (event, filePath) => {
  const basePath = isDev
    ? path.join(__dirname, filePath)
    : path.join(app.getPath('userData'), filePath)
  return await fsPromise.readFile(basePath, "utf8")
});

ipcMain.handle("get-version", async () => app.getVersion())

ipcMain.handle("get-all-sized-audit", async (event, filePath) => {
  const basePath = isDev
    ? path.join(__dirname, "audits", filePath)
    : path.join(app.getPath('documents'), "audits", filePath)
  return await fsPromise.readFile(basePath, "utf8")
})

ipcMain.handle("read-audit-folder", async () => {
  const basePath = isDev
    ? path.join(__dirname, "audits", "audit-results")
    : path.join(app.getPath('documents'), "audits", "audit-results");

  try {
    return await loadFolderData(basePath)
  } catch (err) {
    console.error("error reading audit folder:", err.message)
    return []
  }
});

ipcMain.handle("read-old-audit-folder", async () => {
  const basePath = isDev
    ? path.join(__dirname, "audits", "old-audit-results")
    : path.join(app.getPath('documents'), "audits", "old-audit-results");

  try {
    return await loadFolderData(basePath)
  } catch (err) {
    console.error("error reading audit folder:", err.message)
    return []
  }
});

ipcMain.handle("read-custom-audits", async () => {
  const basePath = isDev
    ? path.join(__dirname, "audits", "custom-audit-results")
    : path.join(app.getPath('documents'), "audits", "custom-audit-results");

  try {
    return await loadFolderData(basePath)
  } catch (err) {
    console.error("error reading audit folder:", err.message)
    return []
  }
});

ipcMain.handle("get-audit-metadata", async (event, fileFolder, auditData) => {
  try {
    const filePath = isDev
      ? path.join(__dirname, "audits", fileFolder, auditData)
      : path.join(app.getPath('documents'), "audits", fileFolder, auditData);
    let jsonAuditRaw;
    try {
      jsonAuditRaw = await fsPromise.readFile(filePath, "utf8");
    } catch (err) {
      console.error(`Failed to read file ${filePath}:`, err);
      throw new Error(`Unable to read audit file: ${err.message}`);
    }

    let jsonAudit;
    try {
      jsonAudit = JSON.parse(jsonAuditRaw);
    } catch (err) {
      console.error(`Failed to parse JSON for ${filePath}:`, err);
      throw new Error(`Invalid JSON in audit file: ${err.message}`);
    }

    let itemCount = 0;
    let subItemCount = 0;
    let accessibilityScore;

    if (jsonAudit.hasOwnProperty("stats1920pxWidth")) {
      return {
        itemCount: "All",
        subItemCount: "Sizes",
        score: "Audit",
        length: jsonAuditRaw.split("\n").length,
      };
    }

    for (const [key, value] of Object.entries(jsonAudit)) {
      if (typeof value === "object" && value?.items) {
        for (let itemData of value["items"]) {
          itemCount++;
          for (const [itemKey, itemValue] of Object.entries(itemData)) {
            if (itemKey === "subItems") subItemCount++;
          }
        }
      } else if (key === "accessibilityScore") {
        accessibilityScore = value;
      }
    }

    return {
      itemCount: itemCount,
      subItemCount: subItemCount,
      score: accessibilityScore,
      length: jsonAuditRaw.split("\n").length,
    };
  } catch (err) {
    console.error("get-audit-metadata failed:", err);
    throw err;
  }
});

ipcMain.handle('open-results-file', async (event, filename, folder) => {
  try {
    const fullPath = isDev
      ? path.join(__dirname, "audits", folder, filename)
      : path.join(app.getPath('documents'), "audits", folder, filename)
    shell.openPath(fullPath)
    shell.showItemInFolder(fullPath)
  } catch (err) {
    console.error('Could not open results file:', err)
    throw err
  }
})

ipcMain.handle("save-file", async (event, filePath, fileContent) => {
  const outputPath = isDev
    ? path.join(__dirname, "audits", filePath)
    : path.join(app.getPath('documents'), "audits", filePath)
  try {
    const outputDir = path.dirname(outputPath);
    await ensureDir(outputDir);

    await fsPromise.writeFile(
      outputPath,
      JSON.stringify(fileContent, null, 2),
      "utf8"
    );
    return { success: true, filePath: filePath, fileContent: fileContent };
  } catch (error) {
    console.error(`Failed to save file ${outputPath}: ${error.message}`);
    console.error(`Error stack: ${error.stack}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-current-filename", async () => {
  const auditDirectory = path.join(__dirname, "settings");
  try {
    const files = fs.readdirSync(auditDirectory);
    return files.length > 0
      ? { success: true, filename: files[0] }
      : { success: false, error: "No .txt file found in folder." };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("replace-file", async (event, newData, newPath) => {
  try {
    const basePath = isDev
      ? path.join(__dirname, newPath)
      : path.join(app.getPath('userData'), newPath)

    if (typeof newData === "object") {
      const parsedNewData = newData.join("\n");
      fs.writeFileSync(basePath, parsedNewData, "utf8");
      return { success: true, info: newData }
    } else {
      fs.writeFileSync(basePath, newData, "utf8");
      return { success: true, info: newData }
    }
  } catch (err) {
    console.error('Replace File failed:', err)
    return { success: false, error: err }
  }
});

ipcMain.handle("access-os-data", async () => {
  const cores = os.cpus().length;
  const totalMemGB = os.totalmem() / 1024 ** 3;
  const safeMemoryUsage = totalMemGB * 0.8;

  const maxMemory = Math.floor(safeMemoryUsage / 0.5);
  const maxCpu = Math.floor(cores * 0.8);

  const concurrency = Math.max(1, Math.min(maxCpu, maxMemory));

  return concurrency;
});

ipcMain.handle("get-spawn", async (event, urlPath, outputDirPath, outputFilePath, testing_method, user_agent, viewport, processId, isUsingUserAgent, isViewingAudit, loadingTime, isConcise) => {
  const TIMEOUT_ALL_TESTS = 70000;
  const TIMEOUT_SINGULAR_TEST = 45000;
  let timeoutId;
  let output = "";
  let errorOutput = "";

    const customOutputPath = isDev ? path.join(__dirname, 'audits', outputDirPath, outputFilePath) : path.join(app.getPath('documents'), "audits", outputDirPath, outputFilePath)

    const scriptPath = isDev
      ? path.join(__dirname, "runAndWriteAudit.mjs")
      : path.join(process.resourcesPath, 'app', "runAndWriteAudit.mjs")

    console.log(`[AUDIT START] ${urlPath} (ID: ${processId}, method: ${testing_method}, viewport: ${viewport})`);

    const spawnPromise = new Promise((resolve, reject) => {
      const child = child_process.spawn(
        nodeBinary,
        [
          scriptPath,
          urlPath,
          customOutputPath,
          testing_method,
          user_agent,
          viewport,
          isUsingUserAgent,
          isViewingAudit,
          loadingTime,
          isConcise
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
          cwd: isDev ? process.cwd() : path.join(process.resourcesPath, 'app'),
          env: {
            ...process.env,
            NODE_PATH: isDev
              ? path.join(__dirname, 'node_modules')
              : path.join(process.resourcesPath, 'app', 'node_modules'),
            PUPPETEER_EXECUTABLE_PATH: chromiumPath
          }
        },
      );

      activeProcesses.set(processId, child);

      child.stdout.on("data", (data) => {
        const log = data.toString()
        output += log;
        // stdout now only contains the final JSON result, don't log it to avoid noise
        BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-log', log)
      });

      child.stderr.on("data", (data) => {
        const error = data.toString()
        errorOutput += error;
        // stderr now contains all debug logs - forward to terminal
        console.error('[AUDIT LOG]:', error.trim());
        BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-error-1', error)
      });

      child.on("close", async (code) => {
        clearTimeout(timeoutId);
        activeProcesses.delete(processId)
        console.log(`[AUDIT COMPLETE] Process ${processId} exited with code ${code} for ${urlPath}`);
        if (code === 0) {
          try {
            const response = JSON.parse(output.trim());

            // Check if this is a success indicator (new format)
            if (response.success && response.outputFile) {
              console.log(`[AUDIT SUCCESS] Score: ${response.accessibilityScore} for ${urlPath}, reading from file...`);

              try {
                // Read the full audit result from the file to avoid stdout truncation
                const fileContent = await fsPromise.readFile(customOutputPath, 'utf8');
                const result = JSON.parse(fileContent);
                console.log(`[AUDIT FILE READ] Successfully loaded ${urlPath} from ${customOutputPath}`);
                resolve(result);
              } catch (fileErr) {
                console.error('[AUDIT ERROR] Failed to read audit file:', fileErr.message);
                const fileReadError = {
                  error: `Failed to read audit file: ${fileErr.message}`,
                  errorLocation: 'main.js - get-spawn handler (file read)',
                  friendlyMessage: 'Audit completed but could not read results file',
                  suggestion: 'The audit file may be locked or corrupted. Try running the audit again.',
                  url: urlPath,
                  stack: fileErr.stack,
                  accessibilityScore: 0
                };
                resolve(fileReadError);
              }
            }
            // Legacy format or error response with full JSON
            else if (response.accessibilityScore !== undefined) {
              if (response.accessibilityScore > 0) {
                console.log(`[AUDIT SUCCESS] Score: ${response.accessibilityScore} for ${urlPath}`);
              } else {
                console.error(`[AUDIT FAILED] Score: 0 for ${urlPath}`);
              }
              resolve(response);
            }
            else {
              throw new Error('Unexpected response format from audit process');
            }
          } catch (err) {
            console.error('[AUDIT ERROR] Failed to parse JSON output:', err.message);
            console.error('[AUDIT ERROR] Raw output:', output.substring(0, 200));

            const parseError = {
              error: `Failed to parse audit result: ${err.message}`,
              errorLocation: 'main.js - get-spawn handler (JSON parsing)',
              friendlyMessage: 'Could not read audit results',
              suggestion: 'The audit may have produced invalid output. Check console logs.',
              url: urlPath,
              stack: err.stack,
              rawOutput: output.substring(0, 500),
              accessibilityScore: 0
            };

            resolve(parseError);
          }
        } else {
          console.error(`[AUDIT FAILED] Process exited with code ${code} for ${urlPath}`);
          console.error('[AUDIT FAILED] Last error output:', errorOutput.substring(errorOutput.length - 500));

          // Try to parse error details from output
          try {
            const errorResult = JSON.parse(output.trim());
            // If we have a structured error from the child process, pass it through
            if (errorResult.error) {
              console.error('[AUDIT FAILED] Structured error from child:', errorResult.error);
              resolve(errorResult);
              return;
            }
          } catch (parseErr) {
            // If we can't parse, create our own error object
            console.error('[AUDIT FAILED] Could not parse error response from child process:', parseErr.message);
            console.error('[AUDIT FAILED] Raw output:', output.substring(0, 300));
          }

          const exitError = {
            error: `Audit process failed with exit code ${code}`,
            errorLocation: 'main.js - get-spawn handler (child process exit)',
            friendlyMessage: 'Audit process crashed or failed to complete',
            suggestion: 'Check the error logs for details. This may indicate a Chrome crash or system resource issue.',
            url: urlPath,
            exitCode: code,
            lastErrorOutput: errorOutput.substring(errorOutput.length - 1000),
            accessibilityScore: 0
          };

          resolve(exitError);
        }
      });

      child.on("error", (err) => {
        clearTimeout(timeoutId);
        activeProcesses.delete(processId);
        console.error('[AUDIT ERROR] Process error:', err.message);
        BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-error-2', err)

        const processError = {
          error: `Failed to spawn audit process: ${err.message}`,
          errorLocation: 'main.js - get-spawn handler (process spawn error)',
          friendlyMessage: 'Could not start the audit process',
          suggestion: 'This may indicate a problem with Node.js or system permissions. Try restarting the app.',
          url: urlPath,
          stack: err.stack,
          accessibilityScore: 0
        };

        resolve(processError);
      });
    });

    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(
        () => {
          const timeoutLimit = testing_method == "all" ? TIMEOUT_ALL_TESTS : TIMEOUT_SINGULAR_TEST;
          BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-error-3', `Audit timeout for ${urlPath}`)
          console.warn(`[AUDIT TIMEOUT] ${urlPath} exceeded timeout limit`);
          const child = activeProcesses.get(processId)
          if (child) {
            child.kill("SIGTERM")
            setTimeout(() => {
              if (!child.killed) {
                console.warn(`[AUDIT TIMEOUT] Process ${processId} did not terminate gracefully, forcing kill`);
                BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-error', `Child process ${processId} did not terminate, sending SIGKILL.`)
                child.kill("SIGKILL")
              }
              activeProcesses.delete(processId)
            }, 1000);
          }

          const timeoutError = {
            error: `Audit exceeded ${timeoutLimit/1000} second timeout limit`,
            errorLocation: 'main.js - get-spawn handler (timeout)',
            friendlyMessage: 'Audit took too long and was terminated',
            suggestion: testing_method == "all"
              ? 'All-sizes audits take longer. Ensure stable internet connection and try again.'
              : 'The page may be loading slowly. Try increasing the timeout in settings or check your connection.',
            url: urlPath,
            timeoutLimit: `${timeoutLimit/1000} seconds`,
            testingMethod: testing_method,
            accessibilityScore: 0
          };

          resolve(timeoutError);
        },
        testing_method == "all" ? TIMEOUT_ALL_TESTS : TIMEOUT_SINGULAR_TEST
      );
    });

    return Promise.race([spawnPromise, timeoutPromise]);
  }
);

ipcMain.handle("cancel-audit", async () => {
  try {
    // Kill all active child processes
    for (const [id, process] of activeProcesses) {
      process.kill("SIGTERM");
      activeProcesses.delete(id);
    }

    // Mark all active sessions as cancelled to prevent new processes from starting
    for (const sessionId of activeSessions) {
      cancelledSessions.add(sessionId);
      console.log(`[CANCEL] Marked session ${sessionId} as cancelled`);
    }

    const folderPath = "./audits/all-audit-sizes";
    try {
      const files = await fsPromise.readdir(folderPath);
      await Promise.all(
        files.map((file) => fsPromise.unlink(path.join(folderPath, file)))
      );
    } catch (error) {
      console.warn("Failed to clean up temporary files:", error);
    }
    return {
      success: true,
      message: "All active audits cancelled and temporary files cleaned.",
    };
  } catch (error) {
    console.error("Failed to cancel audits:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("move-audit-files", async (event, fromFolderName, toFolderName) => {
  const sourceDir = isDev
    ? path.join(__dirname, "audits", fromFolderName)
    : path.join(app.getPath('documents'), "audits", fromFolderName);
  const destinationDir = isDev
    ? path.join(__dirname, "audits", toFolderName)
    : path.join(app.getPath('documents'), "audits", toFolderName);

  const limit = pLimitDefault(5);

  try {
    await ensureDir(sourceDir)
    await ensureDir(destinationDir);

    const existingFiles = await fsPromise.readdir(destinationDir);
    await Promise.all(
      existingFiles.map((file) =>
        limit(() =>
          fsPromise.rm(path.join(destinationDir, file), {
            recursive: true,
            force: true,
          })
        )
      )
    );

    const filesToMove = await fsPromise.readdir(sourceDir);
    await Promise.all(
      filesToMove.map((file) =>
        limit(async () => {
          const sourcePath = path.join(sourceDir, file);
          const destinationPath = path.join(destinationDir, file);

          await fsPromise.copyFile(sourcePath, destinationPath);
          await fsPromise.rm(sourcePath);
        })
      )
    );

    return { success: true, message: "Files moved successfully." };
  } catch (err) {
    console.error("Error moving audit files:", err);
    return {
      success: false,
      message: "Failed to move files.",
      error: err.message,
    };
  }
});

ipcMain.handle("clear-all-sized-audits-folder", async () => {
  const limit = pLimitDefault(1);
  try {
    const destination = isDev
      ? path.join(__dirname, "audits", "all-audit-sizes")
      : path.join(app.getPath('documents'), "audits", "all-audit-sizes")
    const existingFiles = await fsPromise.readdir(destination);
    await Promise.all(
      existingFiles.map((file) => {
        limit(() =>
          fsPromise.rm(path.join(destination, file), {
            recursive: true,
            force: true,
          })
        );
      })
    );
    return { success: true };
  } catch (err) {
    return { success: false, message: err };
  }
});

ipcMain.handle("get-p-limit", async () => pLimit);

ipcMain.handle("zendesk-login", async (_event, loginId, password, isViewingAudit, loadingTime) => {
  let output = "";
  let errorOutput = "";

  const scriptPath = isDev
    ? path.join(__dirname, "runZendeskLogin.mjs")
    : path.join(process.resourcesPath, 'app', "runZendeskLogin.mjs");

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
        cwd: isDev ? process.cwd() : path.join(process.resourcesPath, 'app'),
        env: {
          ...process.env,
          NODE_PATH: isDev
            ? path.join(__dirname, 'node_modules')
            : path.join(process.resourcesPath, 'app', 'node_modules'),
          PUPPETEER_EXECUTABLE_PATH: chromiumPath,
          AUDIT_OUTPUT_DIR: isDev
            ? path.join(__dirname, 'audits', 'custom-audit-results')
            : path.join(app.getPath('documents'), 'audits', 'custom-audit-results')
        }
      }
    );

    activeProcesses.set(processId, child);

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
      activeProcesses.delete(processId);
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
      activeProcesses.delete(processId);
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
    ? path.join(__dirname, "runZendeskScrape.mjs")
    : path.join(process.resourcesPath, 'app', "runZendeskScrape.mjs");

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
        cwd: isDev ? process.cwd() : path.join(process.resourcesPath, 'app'),
        env: {
          ...process.env,
          NODE_PATH: isDev
            ? path.join(__dirname, 'node_modules')
            : path.join(process.resourcesPath, 'app', 'node_modules'),
          PUPPETEER_EXECUTABLE_PATH: chromiumPath,
          AUDIT_OUTPUT_DIR: isDev
            ? path.join(__dirname, 'audits', 'custom-audit-results')
            : path.join(app.getPath('documents'), 'audits', 'custom-audit-results')
        }
      }
    );

    activeProcesses.set(processId, child);

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
      activeProcesses.delete(processId);
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
      activeProcesses.delete(processId);
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
    ? path.join(__dirname, "runZendeskSingleAuditWithCookies.mjs")
    : path.join(process.resourcesPath, 'app', "runZendeskSingleAuditWithCookies.mjs");

  // Read wikiPaths.txt to get URLs to audit
  const settingsDir = isDev
    ? path.join(__dirname, 'settings')
    : path.join(app.getPath('userData'), 'settings');

  const wikiPathsFile = path.join(settingsDir, 'wikiPaths.txt');

  let urlsToAudit = [];
  try {
    const pathsContent = await fsPromise.readFile(wikiPathsFile, 'utf8');
    const paths = pathsContent.split('\n').filter(p => p.trim());

    // Build full URLs from paths
    const baseUrl = zendeskUrl.endsWith('/') ? zendeskUrl.slice(0, -1) : zendeskUrl;
    urlsToAudit = paths.map(p => {
      const cleanPath = p.startsWith('/') ? p : '/' + p;
      return baseUrl + cleanPath;
    });
  } catch (err) {
    console.error('[ZENDESK AUDIT] Failed to read wikiPaths.txt:', err.message);
    return {
      success: false,
      error: `Failed to read wikiPaths.txt: ${err.message}`,
      friendlyMessage: 'Could not find paths to audit',
      suggestion: 'Make sure wikiPaths.txt exists in the settings folder'
    };
  }

  if (urlsToAudit.length === 0) {
    return {
      success: false,
      error: 'No URLs found in wikiPaths.txt',
      friendlyMessage: 'No paths to audit',
      suggestion: 'Add paths to wikiPaths.txt in the settings'
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
    activeSessions.add(sessionId);
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
      ? path.join(__dirname, 'temp')
      : path.join(app.getPath('userData'), 'temp');
    await ensureDir(tempDir);

    const cookieFilePath = path.join(tempDir, `zendesk-cookies-${Date.now()}.json`);
    await fsPromise.writeFile(cookieFilePath, JSON.stringify(cookies, null, 2), 'utf8');
    console.log(`[ZENDESK AUDIT] Cookies saved to: ${cookieFilePath}`);

    // Close login browser
    await browser.close();
    console.log('[ZENDESK AUDIT] Login browser closed. Starting concurrent audits...');

    // === STEP 2: Spawn concurrent audits with saved cookies ===
    const outputDir = isDev
      ? path.join(__dirname, 'audits', 'zendesk-audit-results')
      : path.join(app.getPath('documents'), 'audits', 'zendesk-audit-results');

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
        if (cancelledSessions.has(sessionId)) {
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
            cwd: isDev ? process.cwd() : path.join(process.resourcesPath, 'app'),
            env: {
              ...process.env,
              NODE_PATH: isDev
                ? path.join(__dirname, 'node_modules')
                : path.join(process.resourcesPath, 'app', 'node_modules'),
              PUPPETEER_EXECUTABLE_PATH: chromiumPath,
              AUDIT_OUTPUT_DIR: outputDir
            }
          }
        );

        activeProcesses.set(processId, child);

        child.stdout.on("data", (data) => {
          output += data.toString();
        });

        child.stderr.on("data", (data) => {
          errorOutput += data.toString();
          console.error(`[ZENDESK AUDIT ${index + 1}]:`, data.toString().trim());
        });

        child.on("close", (code) => {
          activeProcesses.delete(processId);

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
          activeProcesses.delete(processId);
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
      console.log('[ZENDESK AUDIT] Cookie file cleaned up');
    } catch (err) {
      console.warn('[ZENDESK AUDIT] Failed to delete cookie file:', err.message);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[ZENDESK AUDIT] Complete: ${successCount}/${urlsToAudit.length} successful`);

    // Clean up session tracking
    activeSessions.delete(sessionId);
    cancelledSessions.delete(sessionId);
    console.log(`[ZENDESK AUDIT] Session ${sessionId} cleaned up`);

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
    activeSessions.delete(sessionId);
    cancelledSessions.delete(sessionId);

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
    ? path.join(__dirname, "runZendeskSingleAuditWithCookies.mjs")
    : path.join(process.resourcesPath, 'app', "runZendeskSingleAuditWithCookies.mjs");

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
    activeSessions.add(sessionId);
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
      ? path.join(__dirname, 'temp')
      : path.join(app.getPath('userData'), 'temp');
    await ensureDir(tempDir);

    const cookieFilePath = path.join(tempDir, `zendesk-retry-cookies-${Date.now()}.json`);
    await fsPromise.writeFile(cookieFilePath, JSON.stringify(cookies, null, 2), 'utf8');

    await browser.close();
    console.log('[ZENDESK RETRY] Login browser closed. Starting retry audits...');

    // === STEP 2: Run retry audits with cookies ===
    const outputDir = isDev
      ? path.join(__dirname, 'audits', 'zendesk-audit-results')
      : path.join(app.getPath('documents'), 'audits', 'zendesk-audit-results');

    await ensureDir(outputDir);

    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(parseInt(concurrency) || 1);

    const results = [];
    const failedAudits = [];

    const spawnSingleAudit = (url, index) => {
      return new Promise((resolve) => {
        // Check if this session has been cancelled
        if (cancelledSessions.has(sessionId)) {
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
            cwd: isDev ? process.cwd() : path.join(process.resourcesPath, 'app'),
            env: {
              ...process.env,
              NODE_PATH: isDev
                ? path.join(__dirname, 'node_modules')
                : path.join(process.resourcesPath, 'app', 'node_modules'),
              PUPPETEER_EXECUTABLE_PATH: chromiumPath,
              AUDIT_OUTPUT_DIR: outputDir
            }
          }
        );

        activeProcesses.set(processId, child);

        child.stdout.on("data", (data) => {
          output += data.toString();
        });

        child.stderr.on("data", (data) => {
          console.error(`[ZENDESK RETRY ${index + 1}]:`, data.toString().trim());
        });

        child.on("close", (code) => {
          activeProcesses.delete(processId);

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
          activeProcesses.delete(processId);
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
    activeSessions.delete(sessionId);
    cancelledSessions.delete(sessionId);
    console.log(`[ZENDESK RETRY] Session ${sessionId} cleaned up`);

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
    activeSessions.delete(sessionId);
    cancelledSessions.delete(sessionId);

    return {
      success: false,
      error: err.message
    };
  }
});

ipcMain.handle("read-zendesk-paths", async () => {
  const basePath = isDev
    ? path.join(__dirname, "audits", "zendesk-paths")
    : path.join(app.getPath('documents'), "audits", "zendesk-paths");

  try {
    return await loadFolderData(basePath);
  } catch (err) {
    console.error("error reading zendesk-paths folder:", err.message);
    return [];
  }
});

ipcMain.handle("read-zendesk-audit-results", async () => {
  const basePath = isDev
    ? path.join(__dirname, "audits", "zendesk-audit-results")
    : path.join(app.getPath('documents'), "audits", "zendesk-audit-results");

  try {
    return await loadFolderData(basePath);
  } catch (err) {
    console.error("error reading zendesk-audit-results folder:", err.message);
    return [];
  }
});

ipcMain.handle("read-old-zendesk-audit-results", async () => {
  const basePath = isDev
    ? path.join(__dirname, "audits", "old-zendesk-audit-results")
    : path.join(app.getPath('documents'), "audits", "old-zendesk-audit-results");

  try {
    return await loadFolderData(basePath);
  } catch (err) {
    console.error("error reading old-zendesk-audit-results folder:", err.message);
    return [];
  }
});

ipcMain.handle("get-zendesk-path-line-count", async (_event, filename) => {
  try {
    const filePath = isDev
      ? path.join(__dirname, "audits", "zendesk-paths", filename)
      : path.join(app.getPath('documents'), "audits", "zendesk-paths", filename);

    const content = await fsPromise.readFile(filePath, "utf8");
    const lines = content.split('\n').filter(line => line.trim()).length;

    return { lineCount: lines };
  } catch (err) {
    console.error(`Failed to read file ${filename}:`, err);
    throw new Error(`Unable to read file: ${err.message}`);
  }
});

// ------------ Log Viewing IPC Handlers ------------

ipcMain.handle("get-log-file-path", async () => {
  return logFilePath;
});

ipcMain.handle("read-log-file", async () => {
  try {
    if (!logFilePath) {
      return { success: false, error: 'Log file not initialized' };
    }

    // Check if log file exists
    try {
      await fsPromise.access(logFilePath);
    } catch {
      return { success: true, content: 'No logs yet for this week.' };
    }

    const content = await fsPromise.readFile(logFilePath, 'utf8');
    return { success: true, content };
  } catch (err) {
    console.error('Failed to read log file:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("get-all-log-files", async () => {
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    await ensureDir(logsDir);

    const files = await fsPromise.readdir(logsDir);
    const logFiles = files.filter(f => f.startsWith('app-') && f.endsWith('.log'));

    // Sort by filename (reverse chronological)
    logFiles.sort().reverse();

    return { success: true, files: logFiles };
  } catch (err) {
    console.error('Failed to get log files:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("read-specific-log-file", async (_event, filename) => {
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    const filePath = path.join(logsDir, filename);

    const content = await fsPromise.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (err) {
    console.error(`Failed to read log file ${filename}:`, err);
    return { success: false, error: err.message };
  }
});
