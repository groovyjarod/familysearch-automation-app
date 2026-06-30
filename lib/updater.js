const { BrowserWindow, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");

/**
 * Configure and set up the auto-updater
 * Checks for updates from GitHub releases on app startup
 */
function setupAutoUpdater() {
  autoUpdater.logger = require('electron-log');
  autoUpdater.logger.transports.file.level = 'info';

  console.log('Updater provider:', autoUpdater.currentProvider?.constructor?.name || 'unknown');
  console.log('Update feed URL:', autoUpdater.getFeedURL());

  autoUpdater.setFeedURL({
    provider: "github",
    owner: "groovyjarod",
    repo: "familysearch-automation-app",
    releaseType: "release"
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
    BrowserWindow.getAllWindows()[0]?.webContents.send('update-status', 'Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    BrowserWindow.getAllWindows()[0].webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No update available.');
    BrowserWindow.getAllWindows()[0]?.webContents.send('update-not-available');
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);

    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} is downloaded and ready to install. Do you want to restart now to install?`,
        buttons: ['Restart Now', 'Later']
      }).then(result => {
        if (result.response === 0) autoUpdater.quitAndInstall();
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err);
    BrowserWindow.getAllWindows()[0].webContents.send('update-error', err.message);
  });
}

/**
 * Trigger the update check
 * Called after the app window is ready
 */
function checkForUpdates() {
  autoUpdater.checkForUpdatesAndNotify();
}

module.exports = {
  setupAutoUpdater,
  checkForUpdates
};
