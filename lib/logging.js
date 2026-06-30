const { app } = require("electron");
const fs = require("fs");
const fsPromise = require("fs").promises;
const path = require("path");

let logFilePath = null;
let logStream = null;

/**
 * Initialize the logging system
 * - Creates weekly log files in userData/logs
 * - Keeps only the 5 most recent weeks
 * - Intercepts console.log, console.error, console.warn
 */
async function initializeLogging(ensureDir) {
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
}

/**
 * Close the log stream gracefully
 * Called when the app is shutting down
 */
function closeLogging() {
  if (logStream) {
    const sessionEnd = `========== Session End: ${new Date().toISOString()} ==========\n\n`;
    logStream.write(sessionEnd);
    logStream.end();
  }
}

/**
 * Get the current log file path
 * Used by IPC handlers to allow UI to display logs
 */
function getLogFilePath() {
  return logFilePath;
}

module.exports = {
  initializeLogging,
  closeLogging,
  getLogFilePath
};
