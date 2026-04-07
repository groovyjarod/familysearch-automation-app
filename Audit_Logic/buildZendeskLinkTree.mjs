import lighthouse from "lighthouse";
import { URL } from "url";
import fsPromises from 'fs/promises';
import path from 'path';
import trimAuditData from './trimAuditData.mjs';
import classifyIssue from './classifyIssue.mjs';

/**
 * Normalizes a URL by removing query parameters and hash fragments
 */
function normalizeUrl(urlString) {
  try {
    const url = new URL(urlString);
    // Remove query params and hash
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch (err) {
    return null;
  }
}

/**
 * Checks if a URL is within the articles.familysearch.com/hc/en-us path (English only)
 */
function isZendeskUrl(urlString) {
  try {
    const url = new URL(urlString);
    // Must be articles.familysearch.com domain
    if (url.hostname !== 'articles.familysearch.com') {
      return false;
    }
    // Must start with /hc/en-us to ensure English content only
    if (!url.pathname.startsWith('/hc/en-us')) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Extracts all links from a page using Puppeteer
 */
async function extractLinks(page) {
  const links = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    return anchors.map(a => a.href).filter(href => href && href.startsWith('http'));
  });

  // Track filtering stats
  let totalLinks = links.length;
  let afterNormalize = 0;
  let afterFilter = 0;

  // Normalize and filter to only English Zendesk URLs
  const normalizedLinks = links
    .map(link => normalizeUrl(link))
    .filter(link => {
      if (!link) return false;
      afterNormalize++;
      const isValid = isZendeskUrl(link);
      if (isValid) afterFilter++;
      return isValid;
    });

  // Log filtering stats
  const filtered = totalLinks - afterFilter;
  if (filtered > 0) {
    console.error(`[TREE BUILDER] Filtered out ${filtered} non-English URLs (${totalLinks} total → ${afterFilter} English)`);
  }

  // Return unique links
  return [...new Set(normalizedLinks)];
}

/**
 * Runs a Lighthouse audit on the current page and saves results
 */
async function runAuditOnPage(page, browser, currentUrl, outputDir, loadingTime, viewport) {
  try {
    console.error(`\n[AUDIT] Starting audit for: ${currentUrl}`);

    // Get WebSocket endpoint for Lighthouse
    const wsEndpoint = browser.wsEndpoint();
    const endpointURL = new URL(wsEndpoint);

    const lighthouseOptions = {
      port: parseInt(endpointURL.port),
      output: 'json',
      logLevel: 'error',
      maxWaitForLoad: loadingTime,
      disableStorageReset: true,
      onlyCategories: ['accessibility']
    };

    const lighthouseConfig = {
      extends: 'lighthouse:default',
      settings: {
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          disabled: false,
        },
        onlyCategories: ['accessibility'],
        pauseAfterFcpMs: 0,
        pauseAfterLoadMs: 0,
        maxWaitForLoad: loadingTime,
        skipAudits: ['uses-http2', 'bf-cache', 'prioritize-lcp-image'],
        disableStorageReset: true,
        disableFullPageScreenshot: true,
        throttlingMethod: 'provided',
      },
    };

    const runResult = await lighthouse(currentUrl, lighthouseOptions, lighthouseConfig);

    if (!runResult || !runResult.lhr) {
      console.error(`[AUDIT] Warning: Invalid Lighthouse result for ${currentUrl}`);
      return null;
    }

    const report = runResult.report;
    const accessibilityScore = runResult.lhr.categories.accessibility.score * 100;
    console.error(`[AUDIT] Completed. Score: ${accessibilityScore}`);

    // Process the audit results
    const isConcise = "no";
    const trimmedData = trimAuditData(report, isConcise);

    const initialJsonReport = {};
    let itemCount = 0;
    initialJsonReport.accessibilityScore = accessibilityScore;
    initialJsonReport.url = currentUrl;

    trimmedData.forEach((item, index) => {
      const { id, title, description, items } = item;
      const newItems = [];
      for (let itemData of items) {
        const newItem = {
          snippet: itemData.snippet,
          selector: itemData.selector,
          explanation: itemData.explanation,
          boundingRect: itemData.boundingRect,
        };
        if (isConcise === "no") newItem.itemCategory = classifyIssue(itemData.selector, itemData.path || '');
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

    const urlPath = new URL(currentUrl).pathname.replace(/^\//, '').replace(/\//g, '-') || 'home';
    const filename = `${urlPath}-zendesk.json`;
    const outputPath = path.join(outputDir, filename);

    await fsPromises.writeFile(outputPath, JSON.stringify(initialJsonReport, null, 2), 'utf8');
    console.error(`[AUDIT] Saved to: ${filename}`);

    return accessibilityScore;
  } catch (err) {
    console.error(`[AUDIT] Error auditing ${currentUrl}: ${err.message}`);
    return null;
  }
}

/**
 * Builds a tree of Zendesk links by crawling the site
 * Returns an array of all unique URLs visited
 */
export default async function buildZendeskLinkTree(page, browser, startingUrl, outputDir, loadingTime, viewport, maxDepth = 5) {
  console.error(`\n[TREE BUILDER] Starting crawl from: ${startingUrl}`);
  console.error(`[TREE BUILDER] Max depth: ${maxDepth}`);
  console.error(`[TREE BUILDER] Language filter: English only (/hc/en-us)`);

  const visited = new Set(); // URLs we've already processed
  const queue = []; // Queue of {url, depth} objects to process
  const allUrls = []; // Array to return with all visited URLs

  // Normalize and add starting URL
  const normalizedStart = normalizeUrl(startingUrl);
  queue.push({ url: normalizedStart, depth: 0 });

  while (queue.length > 0) {
    const { url, depth } = queue.shift();

    // Skip if already visited
    if (visited.has(url)) {
      console.error(`[TREE BUILDER] Skipping already visited: ${url}`);
      continue;
    }

    // Mark as visited
    visited.add(url);
    allUrls.push(url);

    console.error(`\n[TREE BUILDER] Crawling (${visited.size} visited, ${queue.length} queued, depth ${depth}): ${url}`);

    try {
      // Navigate to the page
      console.error(`[TREE BUILDER] Navigating to: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: loadingTime
      });

      // Wait a moment for page to settle
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Run Lighthouse audit on this page
      await runAuditOnPage(page, browser, url, outputDir, loadingTime, viewport);

      // Extract links if we haven't reached max depth
      if (depth < maxDepth) {
        console.error(`[TREE BUILDER] Extracting links from page...`);
        const links = await extractLinks(page);
        console.error(`[TREE BUILDER] Found ${links.length} unique Zendesk links`);

        // Add new links to queue
        let newLinksAdded = 0;
        for (const link of links) {
          if (!visited.has(link) && !queue.some(item => item.url === link)) {
            queue.push({ url: link, depth: depth + 1 });
            newLinksAdded++;
          }
        }
        console.error(`[TREE BUILDER] Added ${newLinksAdded} new links to queue`);
      } else {
        console.error(`[TREE BUILDER] Max depth reached, not extracting links`);
      }

    } catch (err) {
      console.error(`[TREE BUILDER] Error processing ${url}: ${err.message}`);
      // Continue with next URL in queue
    }
  }

  console.error(`\n[TREE BUILDER] Crawl complete!`);
  console.error(`[TREE BUILDER] Total pages visited: ${visited.size}`);
  console.error(`[TREE BUILDER] All URLs:`, allUrls);

  return allUrls;
}
