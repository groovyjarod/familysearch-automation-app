import generatePuppeteerAudit from './generatePuppeteerAudit.mjs';
import trimAuditData from './trimAuditData.mjs';
import classifyIssue from './classifyIssue.mjs';

// run lighthouse and return data as json object
async function getRawAuditData(urlPath, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime) {
  try {
    const [rawResults, accessibilityScore] = await generatePuppeteerAudit(urlPath, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime);
    console.log(`getRawAuditData Completed. accessibilityScore=${accessibilityScore}, rawResultsType=${typeof rawResults}`);
    return accessibilityScore === 0 ? [null, 0] : [rawResults, accessibilityScore];
  } catch (err) {
    console.error(`getRawAuditData: Failed for ${urlPath}: ${err.message}, stack: ${err.stack}`);
    return [null, 0];
  }
}

// retrieve json object and return object with relevant data
async function getAuditAccessibilityData(urlPath, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime) {
  try {
    const [auditResults, accessibilityScore] = await getRawAuditData(urlPath, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime);
    if (accessibilityScore === 0) return [null, 0]
    const trimmedData = trimAuditData(auditResults)
    return [trimmedData, accessibilityScore];
  } catch (err) {
    console.error(`getAuditAccessibilityData: Failed for ${urlPath}: ${err.message}, stack: ${err.stack}`);
    return [null, 0];
  }
}

// extract relevant data
async function organizeData(urlPath, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime) {
  try {
    const [rawResultsData, accessibilityScore] = await getAuditAccessibilityData(urlPath, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime);
    if (accessibilityScore === 0) {
      console.log(`organizeData: accessibilityScore=0`);
      return { accessibilityScore: 0 };
    }

    const initialJsonReport = {};
    let itemCount = 0;
    initialJsonReport.accessibilityScore = accessibilityScore;
    rawResultsData.forEach((item, index) => {
      const { id, title, description, items } = item;
      const newItems = [];
      for (let itemData of items) {
        const newItem = {
          snippet: itemData.snippet,
          selector: itemData.selector,
          explanation: itemData.explanation,
          boundingRect: itemData.boundingRect,
          itemCategory: classifyIssue(itemData.selector, itemData.path || ''),
        };
        if (itemData.subItems && itemData.subItems.items) {
          const newSubItems = itemData.subItems.items.map(subItem => ({
            snippet: subItem.relatedNode?.snippet,
            selector: subItem.relatedNode?.selector,
            boundingRect: subItem.relatedNode?.boundingRect,
            nodeLabel: subItem.relatedNode?.nodeLabel,
            subItemCategory: classifyIssue(subItem.relatedNode?.selector, subItem.relatedNode?.path || ''),
          }));
          newItem.subItems = newSubItems;
        }
        newItems.push(newItem);
      }
      itemCount++;
      initialJsonReport[`${id}-${index + 1}`] = { title, description, items: newItems };
    });
    initialJsonReport['number-of-Items'] = itemCount;
    const finalizedJsonReport = JSON.stringify(initialJsonReport, null, 2);
    console.log(`organizeData: Completed, itemCount=${itemCount}`);
    return finalizedJsonReport;
  } catch (err) {
    console.error(`organizeData: Failed for ${urlPath}: ${err.message}`);
    return { accessibilityScore: 0 };
  }
}

// default function that invokes all others
export default async function createReport(urlPath, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime) {
  try {
    const dataToWrite = await organizeData(urlPath, testing_method, user_agent, viewport, isUsingUserAgent, isViewingAudit, loadingTime);
    console.log(`createReport: Completed for ${urlPath}`);
    return dataToWrite;
  } catch (err) {
    console.error(`createReport: Failed for ${urlPath}: ${err.message}`);
    console.error(`createReport: Stack: ${err.stack}`);
    return { accessibilityScore: 0 };
  }
}