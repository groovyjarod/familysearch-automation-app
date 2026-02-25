#!/usr/bin/env node

/**
 * Script to clean up Chrome for Testing to reduce application size
 * This removes unnecessary files while keeping core functionality intact
 * Works on Windows, Mac, and Linux
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHROME_DIR = 'chrome-browser';
const platform = process.argv[2] || 'all';

console.log('==========================================');
console.log('Chrome for Testing Cleanup Script');
console.log('==========================================');
console.log('');

// Check if chrome-browser directory exists
if (!fs.existsSync(CHROME_DIR)) {
    console.error(`❌ Error: ${CHROME_DIR} directory not found!`);
    console.error('Please download Chrome for Testing first.');
    process.exit(1);
}

// Get directory size
function getDirectorySize(dirPath) {
    let totalSize = 0;

    function walkDir(currentPath) {
        const files = fs.readdirSync(currentPath);

        files.forEach(file => {
            const filePath = path.join(currentPath, file);
            const stats = fs.statSync(filePath);

            if (stats.isDirectory()) {
                walkDir(filePath);
            } else {
                totalSize += stats.size;
            }
        });
    }

    walkDir(dirPath);
    return totalSize;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Function to safely remove files/folders
function safeRemove(targetPath) {
    if (fs.existsSync(targetPath)) {
        const stats = fs.statSync(targetPath);
        if (stats.isDirectory()) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(targetPath);
        }
        console.log(`✓ Removed: ${targetPath}`);
        return true;
    }
    return false;
}

// Show initial size
console.log('📊 Calculating initial size...');
const initialSize = getDirectorySize(CHROME_DIR);
console.log(`Initial size: ${formatBytes(initialSize)}`);
console.log('');

let removedCount = 0;

// Clean up Windows-specific files
if (platform === 'win' || platform === 'all') {
    console.log('🧹 Cleaning up Windows Chrome files...');
    removedCount += safeRemove(path.join(CHROME_DIR, 'chrome_proxy.exe')) ? 1 : 0;
    removedCount += safeRemove(path.join(CHROME_DIR, 'chrome_pwa_launcher.exe')) ? 1 : 0;
    removedCount += safeRemove(path.join(CHROME_DIR, 'elevation_service.exe')) ? 1 : 0;
    removedCount += safeRemove(path.join(CHROME_DIR, 'notification_helper.exe')) ? 1 : 0;
    removedCount += safeRemove(path.join(CHROME_DIR, 'setup.exe')) ? 1 : 0;
    removedCount += safeRemove(path.join(CHROME_DIR, 'Installer')) ? 1 : 0;
    console.log('');
}

// Clean up Mac-specific files
if (platform === 'mac' || platform === 'all') {
    console.log('🧹 Cleaning up Mac Chrome files...');
    const macChrome = path.join(CHROME_DIR, 'Google Chrome for Testing.app');
    if (fs.existsSync(macChrome)) {
        removedCount += safeRemove(
            path.join(macChrome, 'Contents/Frameworks/Google Chrome Framework.framework/Helpers/chrome_crashpad_handler')
        ) ? 1 : 0;
        removedCount += safeRemove(
            path.join(macChrome, 'Contents/Frameworks/Google Chrome Framework.framework/XPCServices')
        ) ? 1 : 0;
        removedCount += safeRemove(
            path.join(macChrome, 'Contents/Frameworks/Google Chrome Framework.framework/Helpers/chrome_notification_helper.app')
        ) ? 1 : 0;
    }
    console.log('');
}

// Clean up common files
console.log('🧹 Cleaning up common files...');
removedCount += safeRemove(path.join(CHROME_DIR, 'default_apps')) ? 1 : 0;
removedCount += safeRemove(path.join(CHROME_DIR, 'extensions')) ? 1 : 0;
removedCount += safeRemove(path.join(CHROME_DIR, 'README')) ? 1 : 0;
removedCount += safeRemove(path.join(CHROME_DIR, 'LICENSE')) ? 1 : 0;
removedCount += safeRemove(path.join(CHROME_DIR, 'EULA')) ? 1 : 0;
console.log('');

// Clean up Windows locales
const windowsLocalesPath = path.join(CHROME_DIR, 'locales');
if (fs.existsSync(windowsLocalesPath)) {
    console.log('🌍 Cleaning up locale files (keeping en-US only)...');
    const localeFiles = fs.readdirSync(windowsLocalesPath);
    console.log(`Found ${localeFiles.length} locale files`);

    let localeRemoved = 0;
    localeFiles.forEach(file => {
        if (file !== 'en-US.pak') {
            fs.unlinkSync(path.join(windowsLocalesPath, file));
            localeRemoved++;
        }
    });
    console.log(`✓ Kept en-US.pak, removed ${localeRemoved} others`);
    console.log('');
}

// Clean up Mac locales
const macChrome = path.join(CHROME_DIR, 'Google Chrome for Testing.app');
const macResourcesDir = path.join(
    macChrome,
    'Contents/Frameworks/Google Chrome Framework.framework/Resources'
);

if (fs.existsSync(macResourcesDir)) {
    console.log('🌍 Cleaning up Mac locale files (keeping en.lproj only)...');

    function findLprojFolders(dir) {
        const results = [];
        const items = fs.readdirSync(dir);

        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
                if (item.endsWith('.lproj')) {
                    results.push(fullPath);
                } else {
                    results.push(...findLprojFolders(fullPath));
                }
            }
        });

        return results;
    }

    const lprojFolders = findLprojFolders(macResourcesDir);
    console.log(`Found ${lprojFolders.length} locale folders`);

    let macLocaleRemoved = 0;
    lprojFolders.forEach(folder => {
        if (!folder.endsWith('en.lproj')) {
            fs.rmSync(folder, { recursive: true, force: true });
            macLocaleRemoved++;
        }
    });
    console.log(`✓ Kept en.lproj, removed ${macLocaleRemoved} others`);
    console.log('');
}

console.log('✅ Cleanup complete!');
console.log('');

// Show final size
console.log('📊 Calculating final size...');
const finalSize = getDirectorySize(CHROME_DIR);
console.log(`Final size: ${formatBytes(finalSize)}`);
console.log('');

// Calculate savings
const savings = initialSize - finalSize;
const savingsPercent = ((savings / initialSize) * 100).toFixed(1);

console.log('==========================================');
console.log('Summary:');
console.log(`  Initial:  ${formatBytes(initialSize)}`);
console.log(`  Final:    ${formatBytes(finalSize)}`);
console.log(`  Saved:    ${formatBytes(savings)} (${savingsPercent}%)`);
console.log('==========================================');
console.log('');
console.log('✨ Chrome browser is now optimized for packaging!');
