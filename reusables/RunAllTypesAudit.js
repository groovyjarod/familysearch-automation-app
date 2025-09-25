const runAllTypesAudit = async (
  fullUrl,
  userAgent,
  pLimit,
  getLastPathSegment,
  folderPath,
  isCancelled,
  setRunningStatus,
  isUsingUserAgent
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
    const loadingTime = 25000

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
            loadingTime
          );
          console.log(`get-spawn result for size ${size}`)
          if (typeof result === "string" && result.includes("Audit complete, report written successfully")) {
            return "Audit complete, report written successfully";
          } else if (typeof result === "string" && result.includes("Audit incomplete")) {
            throw new Error(`Audit failed for size ${size}: ${result}`);
          } else if (typeof result === "object" && result.accessibilityScore > 0) {
            return "Audit complete, report written successfully";
          }
          throw new Error (`Audit failed for size ${size}: ${JSON.stringify(result)}`)
        } catch (err) {
          throw err
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
      throw err;
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
    throw new Error(`Failed to save allTypes file: ${filePath}`);
  }

  console.log(finalResult)

  return allAudits;
};

export default runAllTypesAudit;
