import fs from 'fs/promises';
import path from 'path';
import createReport from './Audit_Logic/createFinalizedReport.mjs';

const [,, url, outputFile, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime, isConcise] = process.argv;

// Windows-safe directory creation with retry logic
async function ensureDir(dirPath, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
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

if (!url || !outputFile) {
  console.error('Usage: node runAndWriteAudit.mjs <url> <outputFile> <testing_method> <user_agent> <viewport> <isUsingUserAgent> <isViewingAudit>');
  console.log('Audit incomplete.');
  process.exit(1);
}

async function getReportData(url, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime, isConcise) {
  try {
    const returnData = await createReport(url, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime, isConcise);
    // console.log(`getReportData: Result received, accessibilityScore=${returnData.accessibilityScore || 'none'}`);
    return returnData;
  } catch (err) {
    console.error(`getReportData: Error for ${url}: ${err.message}, stack: ${err.stack}`);
    return { accessibilityScore: 0, error: err.message };
  }
}

async function main() {
  try {
    const jsonData = await getReportData(url, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime, isConcise);
    const parsedData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    if (parsedData.accessibilityScore > 0) {
      console.error(`main: Writing report to ${outputFile}, accessibilityScore=${parsedData.accessibilityScore}`);
      const outputDir = path.dirname(outputFile);
      console.error(`main: Output directory: ${outputDir}`);
      await ensureDir(outputDir);
      await fs.writeFile(outputFile, JSON.stringify(parsedData, null, 2), 'utf8');
      console.error('main: Audit complete, sending result to parent process');
      // Output ONLY the JSON result to stdout for parent to parse
      console.log(JSON.stringify(parsedData));
      process.exit(0);
    } else {
      console.error(`main: Audit incomplete, accessibilityScore=${parsedData.accessibilityScore}, error=${parsedData.error || 'none'}`);
      console.log(JSON.stringify({ error: 'Audit incomplete', accessibilityScore: 0 }));
      process.exit(1);
    }
  } catch (err) {
    console.error(`main: Audit failed for ${url}: ${err.message}`);
    console.error(`main: Stack: ${err.stack}`);
    console.log(JSON.stringify({ error: err.message, accessibilityScore: 0 }));
    process.exit(1);
  }
}

main();