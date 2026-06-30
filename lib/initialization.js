const { app } = require("electron");
const fsPromise = require("fs").promises;
const path = require("path");

/**
 * Windows-safe directory creation with retry logic
 * Handles Windows file locking issues with exponential backoff
 */
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

/**
 * Initialize settings in userData for packaged app
 * Copies default settings files from resources to userData on first launch
 */
async function initializeSettings(isPackaged) {
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
        } catch (err) {
          console.error(`Failed to initialize ${file}:`, err);
        }
      }
    }
  }
}

module.exports = {
  ensureDir,
  initializeSettings
};
