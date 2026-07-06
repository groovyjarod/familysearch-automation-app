const { app } = require("electron");
const path = require("path");
const os = require("os");
const puppeteer = require("puppeteer");

const isPackaged = app.isPackaged;
const isDev = !app.isPackaged;

let nodeBinary;
let chromiumPath;

// Initialize paths based on environment
if (isPackaged) {
  const platform = os.platform();
  if (platform === "darwin") {
    chromiumPath = path.join(
      process.resourcesPath,
      'chrome-browser',
      'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
    );
    nodeBinary = path.join(process.resourcesPath, "node");
  } else if (platform === "win32") {
    chromiumPath = path.join(
      process.resourcesPath,
      'chrome-browser',
      'chrome-win64',
      'chrome.exe'
    );
    nodeBinary = path.join(process.resourcesPath, "node.exe");
  } else {
    chromiumPath = path.join(
      process.resourcesPath,
      'chrome-browser',
      'chrome-linux/chrome'
    );
    nodeBinary = path.join(process.resourcesPath, 'node');
  }
} else {
  console.log('Development environment detected.');
  chromiumPath = puppeteer.executablePath();
  nodeBinary = "node";
}

console.log(`Setting PUPPETEER_EXECUTABLE_PATH to ${chromiumPath}`);
process.env.PUPPETEER_EXECUTABLE_PATH = chromiumPath;

/**
 * Get the audits directory path (environment-aware)
 */
function getAuditsPath() {
  return isDev
    ? path.join(process.cwd(), 'audits')
    : path.join(app.getPath('documents'), 'audits');
}

/**
 * Get the settings directory path (environment-aware)
 */
function getSettingsPath() {
  return isDev
    ? path.join(process.cwd(), 'settings')
    : path.join(app.getPath('userData'), 'settings');
}

/**
 * Get the app resources path (scripts, etc.)
 */
function getResourcesPath() {
  return isDev
    ? process.cwd()
    : path.join(process.resourcesPath, 'app');
}

module.exports = {
  nodeBinary,
  chromiumPath,
  isPackaged,
  isDev,
  getAuditsPath,
  getSettingsPath,
  getResourcesPath
};
