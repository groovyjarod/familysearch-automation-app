const { ipcMain, shell } = require("electron");
const fs = require("fs");
const fsPromise = require("fs").promises;
const path = require("path");

function registerFileHandlers(isDev, getAuditsPath, getSettingsPath, ensureDir) {
  ipcMain.handle("get-all-sized-audit", async (event, filePath) => {
    const basePath = isDev
      ? path.join(process.cwd(), "audits", filePath)
      : path.join(getAuditsPath(), filePath);
    return await fsPromise.readFile(basePath, "utf8");
  });

  ipcMain.handle("get-audit-metadata", async (event, fileFolder, auditData) => {
    try {
      const filePath = isDev
        ? path.join(process.cwd(), "audits", fileFolder, auditData)
        : path.join(getAuditsPath(), fileFolder, auditData);
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
        ? path.join(process.cwd(), "audits", folder, filename)
        : path.join(getAuditsPath(), folder, filename);
      shell.openPath(fullPath);
      shell.showItemInFolder(fullPath);
    } catch (err) {
      console.error('Could not open results file:', err);
      throw err;
    }
  });

  ipcMain.handle("save-file", async (event, filePath, fileContent) => {
    const outputPath = isDev
      ? path.join(process.cwd(), "audits", filePath)
      : path.join(getAuditsPath(), filePath);
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
    const auditDirectory = isDev
      ? path.join(process.cwd(), "settings")
      : getSettingsPath();
    try {
      const files = fs.readdirSync(auditDirectory);
      return files.length > 0
        ? { success: true, filename: files[0] }
        : { success: false, error: "No .txt file found in folder." };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

}

module.exports = { registerFileHandlers }