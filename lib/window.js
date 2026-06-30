const { app, BrowserWindow } = require("electron");
const fsPromise = require("fs").promises;
const path = require("path");

/**
 * Create the main application window
 * Initializes logging, settings, and required directories
 */
async function createWindow(initializeLogging, ensureDir, initializeSettings, isPackaged, isDev, getAuditsPath, checkForUpdates) {
  // Initialize logging system first
  await initializeLogging(ensureDir);

  // Initialize settings in userData before anything else
  await initializeSettings(isPackaged);

  const allFolderPaths = [
    'all-audit-sizes',
    'audit-results',
    'old-audit-results',
    'custom-audit-results',
    'zendesk-audit-results',
    'old-zendesk-audit-results',
    'zendesk-paths'
  ];

  try {
    const auditsPath = getAuditsPath();
    await ensureDir(auditsPath);
    for (let folderPath of allFolderPaths) {
      const newAuditPath = path.join(auditsPath, folderPath);
      await ensureDir(newAuditPath);
    }
  } catch (err) {
    console.error('Error in creating folder paths in documents:', err);
    throw err;
  }

  try {
    const preloadPath = path.join(__dirname, "..", "preload.js");
    try {
      await fsPromise.access(preloadPath);
    } catch (err) {
      console.error('Preload file not accessible:', err);
      throw err;
    }

    const win = new BrowserWindow({
      width: 850,
      height: 700,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        preload: preloadPath,
      },
    });

    win.webContents.on('preload-error', (event, preloadPath, error) => {
      console.error(`Preload error for ${preloadPath}:`, error);
    });

    const startURL = isDev
      ? "http://localhost:5173"
      : `file://${path.join(__dirname, "..", "build/index.html")}`;

    if (isDev) {
      win.loadURL("http://localhost:5173");
    } else {
      win.loadFile(path.join(__dirname, "..", "build", "index.html"));
    }
    console.log('Window successfully loaded.');
    win.on("closed", () => win.destroy());

  } catch (err) {
    console.error('Failed to create window:', err);
    app.quit();
  }
}

/**
 * Set up app lifecycle event handlers
 */
function setupAppLifecycle(createWindowFn, checkForUpdates) {
  app.on("ready", () => {
    // Start update check immediately in parallel with window creation
    // This prevents slow window initialization from delaying the update notification
    checkForUpdates();

    // Create window (may take time on slower machines)
    createWindowFn();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindowFn();
  });
}

module.exports = {
  createWindow,
  setupAppLifecycle
};
