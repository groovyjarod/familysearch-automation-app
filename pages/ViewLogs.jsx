import React, { useEffect, useState } from "react";
import { VStack, HStack, Text } from "@chakra-ui/react";
import CenteredHstackCss from "../reusables/CenteredHstackCss";
import CenteredVstackCss from "../reusables/CenteredVstackCss";
import MenuHeader from "../reusables/MenuHeader";
import BodyVstackCss from "../reusables/BodyVstackCss";
import BodyHstackCss from "../reusables/BodyHstackCss";

const ViewLogs = () => {
  const [logContent, setLogContent] = useState("Loading logs...");
  const [logFiles, setLogFiles] = useState([]);
  const [selectedLogFile, setSelectedLogFile] = useState("");
  const [logFilePath, setLogFilePath] = useState("");
  const logDisplayRef = React.useRef(null);
  const hasScrolledRef = React.useRef(false);

  const loadCurrentLog = async () => {
    try {
      const result = await window.electronAPI.readLogFile();
      if (result.success) {
        setLogContent(result.content || "No logs yet.");
      } else {
        setLogContent(`Error loading logs: ${result.error}`);
      }
    } catch (err) {
      setLogContent(`Failed to load logs: ${err.message}`);
    }
  };

  const loadSpecificLog = async (filename) => {
    try {
      const result = await window.electronAPI.readSpecificLogFile(filename);
      if (result.success) {
        setLogContent(result.content || "No logs in this file.");
      } else {
        setLogContent(`Error loading log file: ${result.error}`);
      }
    } catch (err) {
      setLogContent(`Failed to load log file: ${err.message}`);
    }
  };

  const loadAvailableLogFiles = async () => {
    try {
      const result = await window.electronAPI.getAllLogFiles();
      if (result.success) {
        setLogFiles(result.files || []);
        if (result.files && result.files.length > 0) {
          setSelectedLogFile(result.files[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load log files:", err);
    }
  };

  const handleLogFileChange = (e) => {
    const filename = e.target.value;
    setSelectedLogFile(filename);
    if (filename) {
      loadSpecificLog(filename);
    }
  };

  const handleRefresh = () => {
    if (selectedLogFile) {
      loadSpecificLog(selectedLogFile);
    } else {
      loadCurrentLog();
    }
  };

  useEffect(() => {
    window.electronAPI.getLogFilePath().then(setLogFilePath);
    loadAvailableLogFiles();
    loadCurrentLog();
  }, []);

  useEffect(() => {
    if (
      logDisplayRef.current &&
      !hasScrolledRef.current &&
      logContent !== "Loading logs..."
    ) {
      logDisplayRef.current.scrollTop = logDisplayRef.current.scrollHeight;
      hasScrolledRef.current = true;
    }
  }, [logContent]);

  return (
    <VStack {...CenteredVstackCss}>
      <MenuHeader title="Application Logs" subTitle="View console output" />
      <HStack {...CenteredHstackCss}>
        <VStack {...BodyVstackCss} width="90%">
          <div
            ref={logDisplayRef}
            className="logs"
          >
            {logContent}
          </div>
          <Text>File location: {logFilePath}</Text>
          <HStack {...BodyHstackCss} alignItems="center">
            <select
              value={selectedLogFile}
              onChange={handleLogFileChange}
              className="input"
              style={{ margin: "0" }}
            >
              {logFiles.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </select>
            <button className="btn btn-small" onClick={handleRefresh}>
              Refresh
            </button>
            <p style={{ fontSize: "11px", color: "#888" }}>
              Files are rotated weekly and last 5 weeks are kept.
            </p>
          </HStack>
        </VStack>
      </HStack>
    </VStack>
  );
};

export default ViewLogs;
