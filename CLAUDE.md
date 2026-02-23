# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FamilySearch Automation App (v1.7.0) is an Electron-based GUI application for running automated Lighthouse accessibility audits. The application uses React for UI, Puppeteer for browser automation, and Lighthouse for auditing. It supports concurrent testing across multiple URLs and viewport sizes.

## Common Commands

### Development
```bash
npm install              # Install dependencies
npm run dev             # Start development server with hot reload (Vite + Electron)
npm run electron:start  # Start Electron only
npm start               # Start Vite dev server only
```

### Building and Releasing
```bash
npm run build                    # Build React app with Vite
npm run electron:pack           # Build for both Mac and Windows
npm run electron:pack-mac       # Build .dmg for Mac
npm run electron:pack-win       # Build .exe for Windows
npm run release:win             # Build and publish Windows release to GitHub

# Before releasing:
# 1. Update version in package.json (must be higher than current release)
# 2. Ensure bin/node.exe (or bin/node for Mac) exists
# 3. Ensure chrome-browser/ folder contains Chrome for Testing
```

### Testing
The app doesn't use traditional unit tests. Instead, testing happens through:
- Manual UI testing via `npm run dev`
- Running actual audits through the application interface
- Testing failed audits retry functionality through the "Retry Failed Audits" feature

## Architecture

### Audit Execution Flow

The audit process follows this path through the codebase:

1. **UI Layer** (`pages/AuditOne.jsx` or `pages/AuditAll.jsx`)
   - User configures audit parameters (URL, testing method, viewport, concurrency)
   - Calls `electronAPI.get-spawn` via IPC

2. **Electron Main Process** (`main.js`)
   - Receives IPC call and spawns child process using `child_process.spawn`
   - Invokes Node.js binary with `runAndWriteAudit.mjs` script
   - For concurrent audits: creates multiple spawn instances using `p-limit`
   - Manages chromium and node executable paths (different for dev vs packaged)

3. **Audit Runner** (`runAndWriteAudit.mjs`)
   - Entry point for spawned process
   - Parses CLI arguments (url, outputFile, testing_method, user_agent, viewport, etc.)
   - Calls `createFinalizedReport.mjs`

4. **Report Creation** (`Audit_Logic/createFinalizedReport.mjs`)
   - Orchestrates: `generatePuppeteerAudit` → `trimAuditData` → `classifyIssue`
   - Returns structured JSON with accessibility scores and issues

5. **Puppeteer + Lighthouse** (`Audit_Logic/generatePuppeteerAudit.mjs`)
   - Launches Chrome with Puppeteer using custom chromium path
   - Configures viewport, user agent, loading timeout
   - Scrolls page to trigger lazy-loaded content
   - Runs Lighthouse accessibility audit
   - Returns JSON report and accessibility score

6. **Output**
   - JSON files written to `audits/` folder (or Documents/audits in production)
   - Categorized into: `custom-audit-results/`, `listed-audit-results/`, `old-audit-results/`

### Key Components

**Pages** (`pages/`)
- `AuditOne.jsx` - Single URL audit interface
- `AuditAll.jsx` - Concurrent multi-URL audit interface
- `AuditCompare.jsx` - Compare audit results
- `ListAudits.jsx`, `ListCustomAudits.jsx`, `ListOldAudits.jsx` - View saved audits
- `SettingsMenu.jsx` - Configure URL, paths, and user agent

**Audit Logic** (`Audit_Logic/`)
- `generatePuppeteerAudit.mjs` - Core Puppeteer/Lighthouse integration
- `createFinalizedReport.mjs` - Orchestrates audit data processing pipeline
- `trimAuditData.mjs` - Filters audit data to accessibility-relevant info
- `classifyIssue.mjs` - Categorizes accessibility issues by selector/path

**Settings** (`settings/`)
- `initialUrl.txt` - Base URL for concurrent audits
- `wikiPaths.txt` - List of paths to combine with base URL
- `secretUserAgent.txt` - Custom user agent for bypassing bot detection

**Main Files**
- `main.js` - Electron main process, IPC handlers, auto-updater, spawn logic
- `preload.js` - Exposes Electron APIs to renderer (electronAPI)
- `ReactAppContainer.jsx` - Main React container
- `src/App.jsx` - React routing configuration

### Concurrency Architecture

The app uses `p-limit` to control concurrent audit execution:
- Recommended concurrency calculated based on available system memory
- User can override with custom concurrency number
- Each concurrent audit runs in separate `child_process.spawn` instance
- Failed audits can be retried with adjusted concurrency settings

**Concurrency Notes:**
- First-time audits may have higher failure rates
- If audits fail, reduce concurrency and retry
- Testing method "All Sizes" (4 viewports) forces concurrency=1 per path

### Environment-Specific Paths

**Development** (`isDev = true`):
- Uses `puppeteer.executablePath()` for Chrome
- Uses system Node.js

**Production** (`isPackaged = true`):
- Chrome path: `process.resourcesPath/chrome-browser/chrome.exe` (Windows) or `.../Google Chrome for Testing.app/...` (Mac)
- Node path: `process.resourcesPath/node.exe` (Windows) or `.../node` (Mac)
- Settings: `process.resourcesPath/settings/`

### Auto-Update System

- Uses `electron-updater` with GitHub releases
- Checks for updates on app startup
- Configured to pull from `groovyjarod/familysearch-automation-app`
- Version in `package.json` must be higher than published release for updates to work

## Important Technical Details

### User Agent Keys
Many websites block automated tools like Puppeteer. The "Secret Agent Key" (custom user agent) helps bypass these protections. Contact the website administrator to get a user agent whitelisted for your IP address.

### Viewport Options
- **Desktop**: 1920px width
- **Mobile**: 500px width
- **All Sizes**: Tests 500px, 900px, 1280px, and 1920px in a single JSON file

### Testing Methods
When editing code in `generatePuppeteerAudit.mjs`, note that many console error messages are commented out for production. Uncomment them when debugging.

### Audit Result Structure
JSON files contain:
- `accessibilityScore` - Lighthouse score (0-100)
- `number-of-Items` - Count of audit categories
- Per-issue objects with: `title`, `description`, `items[]` containing `snippet`, `selector`, `explanation`, `boundingRect`
- Optional `subItems[]` for related nodes

### Failed Audits
If `accessibilityScore === 0`, the audit is considered failed. Common causes:
- Page timeout (adjust loading time setting)
- Network issues
- Chrome launch failures
- Too high concurrency

### Build Requirements for Releases

Before running `npm run release:win`:
1. Create `bin/` folder with `node.exe` (Windows) or `node` (Mac)
2. Create `chrome-browser/` folder with Chrome for Testing binaries
3. Increment version in `package.json` (use `npm version patch` or edit manually)
4. Ensure GitHub token is configured for electron-builder publishing

### Modifying Paths

The `wikiPaths.txt` file should contain relative URL paths (one per line) that will be combined with the base URL from `initialUrl.txt` for concurrent audits.

Example:
- Base URL: `https://example.com`
- Path: `/about`
- Result: `https://example.com/about`
