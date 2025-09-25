import fs from 'fs/promises';
import path from 'path';
import createReport from './Audit_Logic/createFinalizedReport.mjs';

const [,, url, outputFile, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime] = process.argv;

if (!url || !outputFile) {
  console.error('Usage: node runAndWriteAudit.mjs <url> <outputFile> <testing_method> <user_agent> <viewport> <isUsingUserAgent> <isViewingAudit>');
  console.log('Audit incomplete.');
  process.exit(1);
}

async function getReportData(url, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime) {
  try {
    const returnData = await createReport(url, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime);
    console.log(`getReportData: Result received, accessibilityScore=${returnData.accessibilityScore || 'none'}`);
    return returnData;
  } catch (err) {
    console.error(`getReportData: Error for ${url}: ${err.message}, stack: ${err.stack}`);
    return { accessibilityScore: 0, error: err.message };
  }
}

async function main() {
  try {
    const jsonData = await getReportData(url, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime);
    const parsedData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    if (parsedData.accessibilityScore > 0) {
      console.log(`main: Writing report to ${outputFile}, accessibilityScore=${parsedData.accessibilityScore}`);
      const outputDir = path.dirname(outputFile);
      console.log(outputDir)
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(outputFile, JSON.stringify(parsedData, null, 2), 'utf8');
      console.log('main: Audit complete, report written successfully');
    } else {
      console.error(`main: Audit incomplete, accessibilityScore=${parsedData.accessibilityScore}, error=${parsedData.error || 'none'}`);
      console.log('main: Audit incomplete');
    }
  } catch (err) {
    console.error(`main: Audit failed for ${url}: ${err.message}`);
    console.error(`main: Stack: ${err.stack}`);
    console.log('main: Audit incomplete');
  }
}

main();