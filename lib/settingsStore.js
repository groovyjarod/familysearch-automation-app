const fsPromise = require("fs").promises;
const path = require("path");
const { getSettingsPath } = require("./paths");

const SETTINGS_FILENAME = "settings.json";
const LEGACY_FILES = {
  initialUrl: "initialUrl.txt",
  secretUserAgent: "secretUserAgent.txt",
  wikiPaths: "wikiPaths.txt",
};

const DEFAULT_SETTINGS = { initialUrl: "", secretUserAgent: "", wikiPaths: [] };

function getSettingsFilePath() {
  return path.join(getSettingsPath(), SETTINGS_FILENAME);
}

async function readLegacySettings() {
  const dir = getSettingsPath();
  let found = false;
  const result = { ...DEFAULT_SETTINGS };

  try {
    result.initialUrl = (await fsPromise.readFile(path.join(dir, LEGACY_FILES.initialUrl), "utf8")).trim();
    found = true;
  } catch {
    // legacy file not present, leave default
  }

  try {
    result.secretUserAgent = (await fsPromise.readFile(path.join(dir, LEGACY_FILES.secretUserAgent), "utf8")).trim();
    found = true;
  } catch {
    // legacy file not present, leave default
  }

  try {
    const raw = await fsPromise.readFile(path.join(dir, LEGACY_FILES.wikiPaths), "utf8");
    result.wikiPaths = raw.split("\n").map((s) => s.trim()).filter(Boolean);
    found = true;
  } catch {
    // legacy file not present, leave default
  }

  return found ? result : null;
}

async function migrateLegacySettingsIfNeeded() {
  const settingsFile = getSettingsFilePath();
  try {
    await fsPromise.access(settingsFile);
    return;
  } catch {
    // settings.json doesn't exist yet, proceed with migration check
  }

  const legacy = await readLegacySettings();
  if (!legacy) return;

  await fsPromise.mkdir(path.dirname(settingsFile), { recursive: true });
  await fsPromise.writeFile(settingsFile, JSON.stringify(legacy, null, 2), "utf8");
  console.log(`[settingsStore] Migrated legacy .txt settings to ${settingsFile}`);
}

async function getSettings() {
  const settingsFile = getSettingsFilePath();
  try {
    const raw = await fsPromise.readFile(settingsFile, "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    if (err.code === "ENOENT") {
      await fsPromise.mkdir(path.dirname(settingsFile), { recursive: true });
      await fsPromise.writeFile(settingsFile, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf8");
      return { ...DEFAULT_SETTINGS };
    }
    throw err;
  }
}

async function saveSettings(partial) {
  try {
    const current = await getSettings();
    const merged = { ...current, ...partial };
    const settingsFile = getSettingsFilePath();
    await fsPromise.mkdir(path.dirname(settingsFile), { recursive: true });
    await fsPromise.writeFile(settingsFile, JSON.stringify(merged, null, 2), "utf8");
    return { success: true, settings: merged };
  } catch (err) {
    console.error("[settingsStore] saveSettings failed:", err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getSettings,
  saveSettings,
  migrateLegacySettingsIfNeeded,
  getSettingsFilePath,
};
