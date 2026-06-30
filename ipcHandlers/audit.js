const { BrowserWindow, ipcMain } = require("electron");
const fsPromise = require("fs").promises;
const path = require("path");
const child_process = require("child_process");
const pLimitDefault = require("p-limit").default;

/**
 * Register audit-related IPC handlers
 * Includes: running audits, cancelling audits, moving/clearing audit files
 */
function registerAuditHandlers(
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
) {
  ipcMain.handle("get-spawn", async (event, urlPath, outputDirPath, outputFilePath, testing_method, user_agent, viewport, processId, isUsingUserAgent, isViewingAudit, loadingTime, isConcise) => {
    const TIMEOUT_ALL_TESTS = 70000;
    const TIMEOUT_SINGULAR_TEST = 45000;
    let timeoutId;
    let output = "";
    let errorOutput = "";

    const customOutputPath = isDev
      ? path.join(process.cwd(), 'audits', outputDirPath, outputFilePath)
      : path.join(getAuditsPath(), outputDirPath, outputFilePath);

    const scriptPath = isDev
      ? path.join(process.cwd(), "runAndWriteAudit.mjs")
      : path.join(getResourcesPath(), "runAndWriteAudit.mjs");

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
          cwd: isDev ? process.cwd() : getResourcesPath(),
          env: {
            ...process.env,
            NODE_PATH: isDev
              ? path.join(process.cwd(), 'node_modules')
              : path.join(getResourcesPath(), 'node_modules'),
            PUPPETEER_EXECUTABLE_PATH: chromiumPath
          }
        },
      );

      registerProcess(processId, child);

      child.stdout.on("data", (data) => {
        const log = data.toString();
        output += log;
        // stdout now only contains the final JSON result, don't log it to avoid noise
        BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-log', log);
      });

      child.stderr.on("data", (data) => {
        const error = data.toString();
        errorOutput += error;
        // stderr now contains all debug logs - forward to terminal
        console.error('[AUDIT LOG]:', error.trim());
        BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-error-1', error);
      });

      child.on("close", async (code) => {
        clearTimeout(timeoutId);
        unregisterProcess(processId);
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
                  errorLocation: 'audit.js - get-spawn handler (file read)',
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
              errorLocation: 'audit.js - get-spawn handler (JSON parsing)',
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
            errorLocation: 'audit.js - get-spawn handler (child process exit)',
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
        unregisterProcess(processId);
        console.error('[AUDIT ERROR] Process error:', err.message);
        BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-error-2', err);

        const processError = {
          error: `Failed to spawn audit process: ${err.message}`,
          errorLocation: 'audit.js - get-spawn handler (process spawn error)',
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
          BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-error-3', `Audit timeout for ${urlPath}`);
          console.warn(`[AUDIT TIMEOUT] ${urlPath} exceeded timeout limit`);
          const child = getProcess(processId);
          if (child) {
            child.kill("SIGTERM");
            setTimeout(() => {
              if (!child.killed) {
                console.warn(`[AUDIT TIMEOUT] Process ${processId} did not terminate gracefully, forcing kill`);
                BrowserWindow.getAllWindows()[0].webContents.send('puppeteer-error', `Child process ${processId} did not terminate, sending SIGKILL.`);
                child.kill("SIGKILL");
              }
              unregisterProcess(processId);
            }, 1000);
          }

          const timeoutError = {
            error: `Audit exceeded ${timeoutLimit/1000} second timeout limit`,
            errorLocation: 'audit.js - get-spawn handler (timeout)',
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
  });

  ipcMain.handle("cancel-audit", async () => {
    try {
      // Kill all active child processes
      killAllProcesses();

      // Mark all active sessions as cancelled to prevent new processes from starting
      cancelAllSessions();

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
      ? path.join(process.cwd(), "audits", fromFolderName)
      : path.join(getAuditsPath(), fromFolderName);
    const destinationDir = isDev
      ? path.join(process.cwd(), "audits", toFolderName)
      : path.join(getAuditsPath(), toFolderName);

    const limit = pLimitDefault(5);

    try {
      await ensureDir(sourceDir);
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
        ? path.join(process.cwd(), "audits", "all-audit-sizes")
        : path.join(getAuditsPath(), "all-audit-sizes");
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
}

module.exports = {
  registerAuditHandlers
};
