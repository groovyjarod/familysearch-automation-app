const { app, BrowserWindow, ipcMain } = require("electron");
const fsPromise = require("fs").promises;
const path = require("path");

// ------------ Module Imports ------------
const { initializeLogging, closeLogging, getLogFilePath } = require("./lib/logging");
const { setupAutoUpdater, checkForUpdates } = require("./lib/updater");
const { ensureDir, initializeSettings } = require("./lib/initialization");
const { nodeBinary, chromiumPath, isPackaged, isDev, getAuditsPath, getSettingsPath, getResourcesPath } = require("./lib/paths");
const { createWindow, setupAppLifecycle } = require("./lib/window");
const {
  registerProcess,
  getProcess,
  unregisterProcess,
  getAllProcesses,
  killAllProcesses,
  startSession,
  cancelSession,
  isSessionCancelled,
  endSession,
  cancelAllSessions
} = require("./lib/process-manager");

// ------------ IPC Handler Imports ------------
const { registerSystemHandlers } = require("./ipcHandlers/system");
const { registerFolderHandlers } = require("./ipcHandlers/folders");
const { registerFileHandlers } = require("./ipcHandlers/files");
const { registerAuditHandlers } = require("./ipcHandlers/audit");
const { registerZendeskHandlers } = require("./ipcHandlers/zendesk");

// ------------ App Lifecycle ------------

app.on('before-quit', () => {
  closeLogging();
});

// ------------ Update Code -----------

setupAutoUpdater();

console.log("Currently running on: ", app.getVersion());

// ------------ Window-handling code ------------

// Create a wrapper function that passes dependencies to window.createWindow
const createWindowWrapper = () => {
  return createWindow(
    initializeLogging,
    ensureDir,
    initializeSettings,
    isPackaged,
    isDev,
    getAuditsPath,
    checkForUpdates
  );
};

// Setup app lifecycle handlers
setupAppLifecycle(createWindowWrapper, checkForUpdates);

// Register IPC handlers
registerSystemHandlers(nodeBinary);
registerFolderHandlers(isDev, getAuditsPath);
registerFileHandlers(isDev, getAuditsPath, getSettingsPath, ensureDir);
registerAuditHandlers(
  isDev,
  getAuditsPath,
  getResourcesPath,
  nodeBinary,
  chromiumPath,
  registerProcess,
  unregisterProcess,
  getProcess,
  killAllProcesses,
  cancelAllSessions,
  ensureDir
);
registerZendeskHandlers(
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
  ensureDir
);

// ------------ Log Viewing IPC Handlers ------------

ipcMain.handle("get-log-file-path", async () => {
  return getLogFilePath();
});

ipcMain.handle("read-log-file", async () => {
  try {
    const logFilePath = getLogFilePath();
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
