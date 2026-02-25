# Build Scripts

## cleanup-chrome.js

This script optimizes the Chrome for Testing browser by removing unnecessary files before packaging the Electron application.

### Usage

```bash
# Clean up Chrome for all platforms
npm run cleanup-chrome

# Clean up only Windows-specific files
npm run cleanup-chrome-win

# Clean up only Mac-specific files
npm run cleanup-chrome-mac
```

### What Gets Removed

**Windows:**
- `chrome_proxy.exe` - Proxy functionality (not needed for headless)
- `chrome_pwa_launcher.exe` - PWA launcher (not needed)
- `elevation_service.exe` - UAC elevation (not needed)
- `notification_helper.exe` - Notifications (not needed)
- `setup.exe` & `Installer/` - Installation files (not needed)

**Mac:**
- `chrome_crashpad_handler` - Crash reporting (optional)
- `XPCServices/` - Inter-process services (optional)
- `chrome_notification_helper.app` - Notification service (not needed)

**Common:**
- `default_apps/` - Default Chrome apps
- `extensions/` - Default extensions
- `README`, `LICENSE`, `EULA` - Documentation files
- All locale files except `en-US.pak` (Windows) or `en.lproj` (Mac)

### Size Reduction

Typical savings: **~100MB** (from ~300-350MB down to ~200-250MB)

### When to Run

Run this script **after** downloading Chrome for Testing and **before** building your application:

```bash
# Recommended build workflow
npm run cleanup-chrome
npm run electron:pack-win    # or electron:pack-mac
```

### Safety

The script:
- ✅ Only removes non-essential files
- ✅ Preserves all files needed for Puppeteer/Lighthouse
- ✅ Keeps core Chrome functionality intact
- ✅ Shows before/after size comparison
- ✅ Cross-platform (Windows, Mac, Linux)

### Requirements

The `chrome-browser/` folder must exist in the project root before running this script.
