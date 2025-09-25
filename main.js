const { app, BrowserWindow, ipcMain, shell } = require("electron");
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

// ------------ Update Code -----------

autoUpdater.logger = require('electron-log')
autoUpdater.logger.transports.file.level = 'info'

console.log('Updater provider:', autoUpdater.currentProvider?.constructor?.nam || 'unknown')
console.log('Update feed URL:', autoUpdater.getFeedURL())

autoUpdater.setFeedURL({
  provider:"github",
  owner: "groovyjarod",
  repo: "lighthouse-desktop-app",
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
  BrowserWindow.getAllWindows()[0].webContents.send('update-downloaded', info)
  autoUpdater.quitAndInstall()
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
const createWindow = async () => {
  const allFolderPaths = ['all-audit-sizes', 'audit-results', 'old-audit-results', 'custom-audit-results']
  try {
    const auditsPath = path.join(app.getPath('documents'), 'audits')
    await fsPromise.mkdir(auditsPath, { recursive: true })
    for (let folderPath of allFolderPaths) {
      const newAuditPath = path.join(auditsPath, folderPath)
      await fsPromise.mkdir(newAuditPath, { recursive: true })
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
      width: 800,
      height: 600,
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
  return Promise.all(entries.map(async (name) => {
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

ipcMain.handle("get-wiki-paths", async () => {
  const basePath = isDev
    ? path.join(__dirname, 'settings', 'wikiPaths.txt')
    : path.join(process.resourcesPath, 'settings', 'wikiPaths.txt')
  const resultsRaw = await fsPromise.readFile(basePath, "utf8");
  const result = resultsRaw.split("\n").filter(Boolean);
  return result;
});

ipcMain.handle("get-file", async (event, filePath) => {
  const basePath = isDev
    ? path.join(__dirname, filePath)
    : path.join(process.resourcesPath, filePath)
  return await fsPromise.readFile(basePath, "utf8")
});

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
  const outputDir = isDev
    ? path.join(__dirname, "audits", filePath)
    : path.join(app.getPath('documents'), "audits", filePath)
  try {
    await fs.writeFileSync(
      outputDir,
      JSON.stringify(fileContent, null, 2),
      "utf8"
    );
    return { success: true, filePath: filePath, fileContent: fileContent };
  } catch (error) {
    console.error(`Failed to save file: ${error}`);
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
      : path.join(process.resourcesPath, newPath)

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

ipcMain.handle("get-spawn", async (event, urlPath, outputDirPath, outputFilePath, testing_method, user_agent, viewport, processId, isUsingUserAgent, isViewingAudit, loadingTime) => {
    const TIMEOUT_ALL_TESTS = 70000;
    const TIMEOUT_SINGULAR_TEST = 45000;
    let timeoutId;

    const customOutputPath = isDev ? path.join(__dirname, 'audits', outputDirPath, outputFilePath) : path.join(app.getPath('documents'), "audits", outputDirPath, outputFilePath)

    const scriptPath = isDev
      ? path.join(__dirname, "runAndWriteAudit.mjs")
      : path.join(process.resourcesPath, 'app', "runAndWriteAudit.mjs")

    // console.log(`Commencing test for ${urlPath}...`)

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
          loadingTime
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
          cwd: isDev ? process.cwd() : path.join(process.resourcesPath, 'app'),
          env: {
            ...process.env,
            NODE_PATH: isDev
              ? path.join(__dirname, 'node_modules')
              : path.join(process.resourcesPath, 'app', 'node_modules')
          }
        },
      );

      activeProcesses.set(processId, child);

      let output = "";
      let errorOutput = "";

      child.stdout.on("data", (data) => {
        const log = data.toString()
        output += log;
        BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-log', log)
      });

      child.stderr.on("data", (data) => {
        const error = data.toString()
        errorOutput += error;
        BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-error-1', error)
      });

      child.on("close", (code) => {
        clearTimeout(timeoutId);
        activeProcesses.delete(processId)
        if (code === 0) {
          try {
            const result = JSON.parse(output.trim());
            resolve(result);
          } catch (err) {
            resolve(output.trim());
          }
        } else {
          reject(new Error(`Child exited with code ${code}: ${errorOutput}`));
        }
      });

      child.on("error", (err) => {
        clearTimeout(timeoutId);
        activeProcesses.delete(processId);
        BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-error-2', err)
        reject(err);
      });
    });

    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(
        () => {
          BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-error-3', `Audit timeout for ${urlPath}`)
          console.warn(`Audit timeout for ${urlPath}`);
          const child = activeProcesses.get(processId)
          if (child) {
            child.kill("SIGTERM")
            setTimeout(() => {
              if (!child.killed) {
                BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-error', `Child process ${processId} did not terminate, sending SIGKILL.`)
                child.kill("SIGKILL")
              }
              activeProcesses.delete(processId)
            }, 1000);
          }
          resolve("get-spawn: did not resolve due to timeout");
        },
        testing_method == "all" ? TIMEOUT_ALL_TESTS : TIMEOUT_SINGULAR_TEST
      );
    });

    return Promise.race([spawnPromise, timeoutPromise]);
  }
);

ipcMain.handle("cancel-audit", async () => {
  try {
    for (const [id, process] of activeProcesses) {
      process.kill("SIGTERM");
      activeProcesses.delete(id);
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

ipcMain.handle("move-audit-files", async () => {
  const sourceDir = isDev
    ? path.join(__dirname, "audits", "audit-results")
    : path.join(app.getPath('documents'), "audits", "audit-results");
  const destinationDir = isDev
    ? path.join(__dirname, "audits", "old-audit-results")
    : path.join(app.getPath('documents'), "audits", "old-audit-results");

  const limit = pLimitDefault(5);

  try {
    await fsPromise.mkdir(sourceDir, { recursive: true })
    await fsPromise.mkdir(destinationDir, { recursive: true });

    const existingFiles = await fsPromise.readdir(destinationDir);
    await Promise.all(
      existingFiles.map((file) => {
        limit(() =>
          fsPromise.rm(path.join(destinationDir, file), {
            recursive: true,
            force: true,
          })
        );
      })
    );

    const filesToMove = await fsPromise.readdir(sourceDir);
    await Promise.all(
      filesToMove.map(async (file) => {
        limit(async () => {
          const sourcePath = path.join(sourceDir, file);
          const destinationPath = path.join(destinationDir, file);

          await fsPromise.copyFile(sourcePath, destinationPath);
          await fsPromise.rm(sourcePath);
        });
      })
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
