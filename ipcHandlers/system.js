const { app, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const child_process = require("child_process");
const os = require("os");
const pLimit = require("p-limit");

/**
 * Register system-related IPC handlers
 * Includes: version info, OS data, node binary check, external URL opening
 */
function registerSystemHandlers(nodeBinary) {
  ipcMain.handle('check-node', async () => {
    const testNodePath = path.join(process.resourcesPath, os.platform() === 'win32' ? 'node.exe' : 'node');

    try {
      fs.access(testNodePath, fs.constants.X_OK, (err) => {
        if (err) {
          console.error('Node binary is missing or not executable at:', testNodePath);
          throw err;
        } else {
          console.log('Node binary is accessible at:', testNodePath);
          child_process.execFile(testNodePath, ['--version'], (error, stdout, stderr) => {
            if (error) {
              console.error('Failed to execute node binary:', error);
              throw error;
            } else {
              console.log('Node binary version:', stdout.trim());
            }
          });
        }
      });
      return { success: true, testNodePath: testNodePath };
    } catch (err) {
      console.error('yeah that didn\'t work lol');
      return { success: false, error: err };
    }
  });

  ipcMain.handle("open-chrome", async (event, url) => {
    shell.openExternal(url);
  });

  ipcMain.handle("get-version", async () => app.getVersion());

  ipcMain.handle("access-os-data", async () => {
    const cores = os.cpus().length;
    const totalMemGB = os.totalmem() / 1024 ** 3;
    const safeMemoryUsage = totalMemGB * 0.8;

    const maxMemory = Math.floor(safeMemoryUsage / 0.5);
    const maxCpu = Math.floor(cores * 0.8);

    const concurrency = Math.max(1, Math.min(maxCpu, maxMemory));

    return concurrency;
  });

  ipcMain.handle("get-p-limit", async () => pLimit);
}

module.exports = {
  registerSystemHandlers
};
