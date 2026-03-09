const runAllTypesAudit = async (
  fullUrl,
  userAgent,
  pLimit,
  getLastPathSegment,
  folderPath,
  isCancelled,
  setRunningStatus,
  isUsingUserAgent,
  isConcise,
  loadingTime
) => {
  if (isCancelled) {
    throw new Error("Audit cancelled by user");
  }
  const SIZES = [1920, 1280, 900, 500];

  const retryAudit = async (fn, retries = 2) => {
    for (let i = 0; i < retries; i++) {
      if (isCancelled) throw new Error("Audit cancelled by user.");
      try {
        const result = await fn();
        if (isCancelled) throw new Error("Audit cancelled by user.");
        setRunningStatus("running");
        return result;
      } catch (err) {
        if (isCancelled) throw new Error("Audit cancelled by user.");
        setRunningStatus("warning");
        console.warn(`Retry ${i + 1} failed. Trying again...`, err);
        if (i < retries - 1) {
          if (!isCancelled) {
            setRunningStatus("warning");
          } else {
            console.log("Retry skipped due to cancellation.");
            setRunningStatus("cancelled");
            throw new Error("Audit cancelled by user.");
          }
        } else {
          console.log("Retries exhausted.");
          throw err;
        }
      }
    }
  };
  const failedAudits = []
  const runAllSizes = pLimit(2);
  const tasks = SIZES.map((size) => {
    const outputDirPath = 'all-audit-sizes'
    const outputFilePath = `${size}-${getLastPathSegment(fullUrl)}.json`
    const viewportWidth = size > 500 ? "desktop" : "mobile"
    const processId = `audit-${Date.now()}-${size}`;
    const isViewingAudit = "no";
    // Use passed loadingTime parameter instead of hardcoded value
    const loadingTimeMs = loadingTime || "25"

    return runAllSizes(() =>
      retryAudit(async () => {
        if (isCancelled) {
          console.log('In RunAllTypesAudit: isCancelled check worked.')
          throw new Error("Audit cancelled by user.")
        }
        try {
          const result = await window.electronAPI.getSpawn(
            fullUrl,
            outputDirPath,
            outputFilePath,
            viewportWidth,
            userAgent,
            size,
            processId,
            isUsingUserAgent,
            isViewingAudit,
            loadingTimeMs,
            isConcise
          );
          console.log(`get-spawn result for size ${size}:`, result)
          // Check if audit succeeded based on accessibilityScore
          if (typeof result === "object" && result.accessibilityScore > 0) {
            console.log(`Audit succeeded for size ${size}, score: ${result.accessibilityScore}`);
            return result;
          } else if (typeof result === "object" && result.error) {
            // Preserve full error details
            const error = new Error(`Audit failed for size ${size}px: ${result.error}`);
            error.errorDetails = {
              ...result,
              size: size,
              errorLocation: `RunAllTypesAudit.js - size ${size}px audit`
            };
            throw error;
          } else if (typeof result === "object" && result.accessibilityScore === 0) {
            const zeroScoreError = new Error(`Audit failed for size ${size}px: returned score of 0`);
            zeroScoreError.errorDetails = {
              error: `Audit returned accessibility score of 0 for ${size}px viewport`,
              errorLocation: `RunAllTypesAudit.js - size ${size}px validation`,
              friendlyMessage: `${size}px viewport audit did not complete successfully`,
              suggestion: 'This viewport size may have timed out. Try running it individually with increased timeout.',
              size: size,
              result: result
            };
            throw zeroScoreError;
          }
          // Unknown result format
          const unknownError = new Error(`Audit failed for size ${size}px: unexpected result format`);
          unknownError.errorDetails = {
            error: 'Unexpected audit result format',
            errorLocation: `RunAllTypesAudit.js - size ${size}px unknown result`,
            friendlyMessage: `${size}px viewport audit produced unexpected result`,
            suggestion: 'This is an internal error. Try running individual audits instead.',
            size: size,
            result: JSON.stringify(result)
          };
          throw unknownError;
        } catch (err) {
          // Preserve error details as we rethrow
          if (!err.errorDetails) {
            err.errorDetails = {
              error: err.message,
              errorLocation: `RunAllTypesAudit.js - size ${size}px exception`,
              size: size,
              stack: err.stack
            };
          }
          throw err;
        }
      })
    );
  });

  await Promise.allSettled(tasks);

  const allAudits = {};
  const auditPromises = SIZES.map(async (size) => {
    if (isCancelled) {
      setRunningStatus("cancelled");
      throw new Error("Audit cancelled by user");
    }
    try {
      const filePath = `all-audit-sizes/${size}-${getLastPathSegment(
        fullUrl
      )}.json`;
      const sizedAudit = await window.electronAPI.getAllSizedAudit(filePath);
      return { size, data: JSON.parse(sizedAudit) };
    } catch (err) {
      console.error(
        `Error reading audit file for size ${size}: ${err.message}`
      );

      // Add context to file read errors
      const fileError = new Error(`Failed to read audit file for ${size}px viewport`);
      fileError.errorDetails = {
        error: `Could not read or parse audit file for ${size}px`,
        errorLocation: 'RunAllTypesAudit.js - reading audit results',
        friendlyMessage: `Could not retrieve results for ${size}px viewport`,
        suggestion: 'The audit may have failed to save its results. Try running the audit again.',
        size: size,
        filePath: filePath,
        originalError: err.message,
        stack: err.stack
      };
      throw fileError;
    }
  });

  const auditResults = await Promise.all(auditPromises);
  auditResults.forEach(({ size, data }) => {
    allAudits[`stats${size}pxWidth`] = data;
  });

  try {
    const deleteWorked = await window.electronAPI.clearAllSizedAuditsFolder();
    console.log("clearAllSizedAuditsFolder result:", deleteWorked);
  } catch (err) {
    console.error(`Error clearing all-audit-sizes folder: ${err.message}`);
  }

  const filePath = `${folderPath}/allTypes-${getLastPathSegment(fullUrl)}.json`;
  const finalResult = await window.electronAPI.saveFile(filePath, allAudits);
  if (!finalResult) {
    const saveError = new Error(`Failed to save allTypes file`);
    saveError.errorDetails = {
      error: 'Could not save combined audit results',
      errorLocation: 'RunAllTypesAudit.js - saving final results',
      friendlyMessage: 'All audits completed but results could not be saved',
      suggestion: 'Check that the audits folder is writable and has sufficient disk space',
      filePath: filePath
    };
    throw saveError;
  }

  console.log(finalResult)

  return allAudits;
};

export default runAllTypesAudit;
