const { ipcMain } = require("electron");
const fsPromise = require("fs").promises;
const path = require("path");

/**
 * Helper function to load folder data (file list with metadata)
 */
const loadFolderData = async (folderName) => {
  const entries = await fsPromise.readdir(folderName);
  // Filter out hidden files (.DS_Store, .gitkeep, etc.)
  const filteredEntries = entries.filter(name => !name.startsWith('.'));
  return Promise.all(filteredEntries.map(async (name) => {
    const fullPath = path.join(folderName, name);
    try {
      const stats = await fsPromise.stat(fullPath);
      return {
        name,
        isDiectory: stats.isDirectory(),
        size: stats.size,
      };
    } catch (err) {
      console.error("In LoadFolderData: Error in fsPromise.stat", err);
    }
  }));
};

/**
 * Register folder-related IPC handlers
 * Includes: reading audit folders, zendesk folders, path counting
 */
function registerFolderHandlers(isDev, getAuditsPath) {
  ipcMain.handle("read-audit-folder", async () => {
    const basePath = isDev
      ? path.join(process.cwd(), "audits", "audit-results")
      : path.join(getAuditsPath(), "audit-results");

    try {
      return await loadFolderData(basePath);
    } catch (err) {
      console.error("error reading audit folder:", err.message);
      return [];
    }
  });

  ipcMain.handle("read-old-audit-folder", async () => {
    const basePath = isDev
      ? path.join(process.cwd(), "audits", "old-audit-results")
      : path.join(getAuditsPath(), "old-audit-results");

    try {
      return await loadFolderData(basePath);
    } catch (err) {
      console.error("error reading audit folder:", err.message);
      return [];
    }
  });

  ipcMain.handle("read-custom-audits", async () => {
    const basePath = isDev
      ? path.join(process.cwd(), "audits", "custom-audit-results")
      : path.join(getAuditsPath(), "custom-audit-results");

    try {
      return await loadFolderData(basePath);
    } catch (err) {
      console.error("error reading audit folder:", err.message);
      return [];
    }
  });

  ipcMain.handle("read-zendesk-paths", async () => {
    const basePath = isDev
      ? path.join(process.cwd(), "audits", "zendesk-paths")
      : path.join(getAuditsPath(), "zendesk-paths");

    try {
      return await loadFolderData(basePath);
    } catch (err) {
      console.error("error reading zendesk-paths folder:", err.message);
      return [];
    }
  });

  ipcMain.handle("read-zendesk-audit-results", async () => {
    const basePath = isDev
      ? path.join(process.cwd(), "audits", "zendesk-audit-results")
      : path.join(getAuditsPath(), "zendesk-audit-results");

    try {
      return await loadFolderData(basePath);
    } catch (err) {
      console.error("error reading zendesk-audit-results folder:", err.message);
      return [];
    }
  });

  ipcMain.handle("read-old-zendesk-audit-results", async () => {
    const basePath = isDev
      ? path.join(process.cwd(), "audits", "old-zendesk-audit-results")
      : path.join(getAuditsPath(), "old-zendesk-audit-results");

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
        ? path.join(process.cwd(), "audits", "zendesk-paths", filename)
        : path.join(getAuditsPath(), "zendesk-paths", filename);

      const content = await fsPromise.readFile(filePath, "utf8");
      const lines = content.split('\n').filter(line => line.trim()).length;

      return { lineCount: lines };
    } catch (err) {
      console.error(`Failed to read file ${filename}:`, err);
      throw new Error(`Unable to read file: ${err.message}`);
    }
  });
}

module.exports = {
  registerFolderHandlers
};
