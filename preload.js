const { contextBridge, ipcRenderer } = require("electron");

console.log("Preload script is now commencing...");

contextBridge.exposeInMainWorld("electronAPI", {
  accessOsData: () => ipcRenderer.invoke("access-os-data"),
  cancelAudit: () => ipcRenderer.invoke("cancel-audit"),
  clearAllSizedAuditsFolder: () =>
    ipcRenderer.invoke("clear-all-sized-audits-folder"),
  getAllSizedAudit: (filename) => ipcRenderer.invoke("get-all-sized-audit", filename),
  getAuditComparisons: () => ipcRenderer.invoke("read-comparison-folder"),
  getAuditResults: () => ipcRenderer.invoke("read-audit-folder"),
  getAuditMetadata: (fileFolder, auditPath) =>
    ipcRenderer.invoke("get-audit-metadata", fileFolder, auditPath),
  getCurrentFile: () => ipcRenderer.invoke("get-current-filename"),
  getCustomAudits: () => ipcRenderer.invoke("read-custom-audits"),
  getEditableFiles: () => ipcRenderer.invoke("read-options-folder"),
  getFile: (filename) => ipcRenderer.invoke("get-file", filename),
  getPLimit: () => ipcRenderer.invoke("get-p-limit"),
  getSpawn: (
    urlPath,
    outputDirPath,
    outputFilePath,
    testing_method,
    user_agent,
    viewport,
    processId,
    isUsingUserAgent,
    isViewingAudit,
    loadingTime
  ) =>
    ipcRenderer.invoke(
      "get-spawn",
      urlPath,
      outputDirPath,
      outputFilePath,
      testing_method,
      user_agent,
      viewport,
      processId,
      isUsingUserAgent,
      isViewingAudit,
      loadingTime
    ),
    getWikiPathsData: () => ipcRenderer.invoke("get-wiki-paths"),
  getOldAudits: () => ipcRenderer.invoke("read-old-audit-folder"),
  moveAuditFiles: () => ipcRenderer.invoke("move-audit-files"),
  openResultsFile: (filename, folder) =>
    ipcRenderer.invoke("open-results-file", filename, folder),
  replaceFile: (newData, newPath, isWikiPaths = false) =>
    ipcRenderer.invoke("replace-file", newData, newPath, isWikiPaths),
  saveFile: (filePath, fileContent) =>
    ipcRenderer.invoke("save-file", filePath, fileContent),
  onLighthouseLog: (callback) =>
    ipcRenderer.on("lighthouse-log", (event, message) => callback(message)),
});

console.log("preload script loaded.");
console.log(`Executable path: ${process.env.PUPPETEER_EXECUTABLE_PATH}`)
