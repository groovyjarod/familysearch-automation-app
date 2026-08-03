const { BrowserWindow, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");

/**
 * Configure the auto-updater and register its event handlers
 * Does not trigger a check itself — checks are only triggered manually
 * via checkForUpdatesManual (wired to the Settings "Check For Updates" button)
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
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No update available.');
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
        if (result.response === 0) {
          // quitAndInstall parameters: isSilent, isForceRunAfter
          // On Windows, use isForceRunAfter=true to ensure installer runs even if processes linger
          autoUpdater.quitAndInstall(false, true);
        }
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err);
  });
}

/**
 * Manually trigger an update check and resolve once the outcome is known.
 * Backs the Settings "Check For Updates" button — the caller awaits this
 * to know when to stop the loading spinner and what to tell the user.
 */
function checkForUpdatesManual() {
  const UPDATE_CHECK_TIMEOUT = 15000; // 15 seconds

  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeoutId);
      autoUpdater.removeListener('update-available', onAvailable);
      autoUpdater.removeListener('update-not-available', onNotAvailable);
      autoUpdater.removeListener('error', onError);
    };

    const settle = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onAvailable = (info) => settle({ status: 'available', version: info.version });
    const onNotAvailable = () => settle({ status: 'not-available' });
    const onError = (err) => settle({ status: 'error', message: err.message });

    const timeoutId = setTimeout(() => {
      console.warn('[UPDATE] Update check timed out after 15 seconds.');
      settle({ status: 'error', message: 'Update check timed out.' });
    }, UPDATE_CHECK_TIMEOUT);

    autoUpdater.once('update-available', onAvailable);
    autoUpdater.once('update-not-available', onNotAvailable);
    autoUpdater.once('error', onError);

    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('[UPDATE] Update check failed:', err.message);
      settle({ status: 'error', message: err.message });
    });
  });
}

module.exports = {
  setupAutoUpdater,
  checkForUpdatesManual
};
