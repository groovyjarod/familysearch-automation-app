#!/bin/bash

# Script to clean up Chrome for Testing to reduce application size
# This removes unnecessary files while keeping core functionality intact

set -e

CHROME_DIR="chrome-browser"
PLATFORM="${1:-all}"

echo "=========================================="
echo "Chrome for Testing Cleanup Script"
echo "=========================================="
echo ""

# Check if chrome-browser directory exists
if [ ! -d "$CHROME_DIR" ]; then
    echo "❌ Error: $CHROME_DIR directory not found!"
    echo "Please download Chrome for Testing first."
    exit 1
fi

# Show initial size
echo "📊 Calculating initial size..."
INITIAL_SIZE=$(du -sh "$CHROME_DIR" | cut -f1)
echo "Initial size: $INITIAL_SIZE"
echo ""

# Function to safely remove files/folders
safe_remove() {
    if [ -e "$1" ]; then
        rm -rf "$1"
        echo "✓ Removed: $1"
    fi
}

# Clean up Windows-specific files
if [ "$PLATFORM" = "win" ] || [ "$PLATFORM" = "all" ]; then
    echo "🧹 Cleaning up Windows Chrome files..."
    safe_remove "$CHROME_DIR/chrome_proxy.exe"
    safe_remove "$CHROME_DIR/chrome_pwa_launcher.exe"
    safe_remove "$CHROME_DIR/elevation_service.exe"
    safe_remove "$CHROME_DIR/notification_helper.exe"
    safe_remove "$CHROME_DIR/setup.exe"
    safe_remove "$CHROME_DIR/Installer"
    echo ""
fi

# Clean up Mac-specific files
if [ "$PLATFORM" = "mac" ] || [ "$PLATFORM" = "all" ]; then
    echo "🧹 Cleaning up Mac Chrome files..."
    MAC_CHROME="$CHROME_DIR/Google Chrome for Testing.app"
    if [ -d "$MAC_CHROME" ]; then
        safe_remove "$MAC_CHROME/Contents/Frameworks/Google Chrome Framework.framework/Helpers/chrome_crashpad_handler"
        safe_remove "$MAC_CHROME/Contents/Frameworks/Google Chrome Framework.framework/XPCServices"
        # Keep the main helper but remove notification helper
        safe_remove "$MAC_CHROME/Contents/Frameworks/Google Chrome Framework.framework/Helpers/chrome_notification_helper.app"
    fi
    echo ""
fi

# Clean up common files
echo "🧹 Cleaning up common files..."
safe_remove "$CHROME_DIR/default_apps"
safe_remove "$CHROME_DIR/extensions"
safe_remove "$CHROME_DIR/README"
safe_remove "$CHROME_DIR/LICENSE"
safe_remove "$CHROME_DIR/EULA"

# Windows locales path
if [ -d "$CHROME_DIR/locales" ]; then
    echo "🌍 Cleaning up locale files (keeping en-US only)..."
    LOCALE_COUNT=$(ls "$CHROME_DIR/locales" | wc -l)
    echo "Found $LOCALE_COUNT locale files"

    # Remove all locale files except en-US.pak
    cd "$CHROME_DIR/locales"
    ls | grep -v "en-US.pak" | xargs rm -f 2>/dev/null || true
    cd ../..
    echo "✓ Kept en-US.pak, removed others"
fi

# Mac locales path
MAC_CHROME="$CHROME_DIR/Google Chrome for Testing.app"
if [ -d "$MAC_CHROME/Contents/Frameworks/Google Chrome Framework.framework/Resources" ]; then
    echo "🌍 Cleaning up Mac locale files (keeping en.lproj only)..."
    RESOURCES_DIR="$MAC_CHROME/Contents/Frameworks/Google Chrome Framework.framework/Resources"

    # Count locale folders
    LOCALE_COUNT=$(find "$RESOURCES_DIR" -name "*.lproj" | wc -l)
    echo "Found $LOCALE_COUNT locale folders"

    # Remove all .lproj folders except en.lproj
    find "$RESOURCES_DIR" -name "*.lproj" ! -name "en.lproj" -exec rm -rf {} + 2>/dev/null || true
    echo "✓ Kept en.lproj, removed others"
fi

echo ""
echo "✅ Cleanup complete!"
echo ""

# Show final size
echo "📊 Calculating final size..."
FINAL_SIZE=$(du -sh "$CHROME_DIR" | cut -f1)
echo "Final size: $FINAL_SIZE"
echo ""

# Calculate savings (approximate, as du output format varies)
echo "=========================================="
echo "Summary:"
echo "  Initial: $INITIAL_SIZE"
echo "  Final:   $FINAL_SIZE"
echo "=========================================="
echo ""
echo "✨ Chrome browser is now optimized for packaging!"
