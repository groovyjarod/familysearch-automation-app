const { ipcMain } = require("electron");

function registerSettingsHandlers(getSettings, saveSettings) {
  ipcMain.handle("get-settings", async () => {
    try {
      const settings = await getSettings();
      return { success: true, settings };
    } catch (err) {
      console.error("get-settings failed:", err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("save-settings", async (_event, partial) => {
    return await saveSettings(partial);
  });
}

module.exports = { registerSettingsHandlers };
