import React, { useEffect, useState } from "react";
import AuditListView from "../reusables/AuditListView";

const DisplayZendeskPaths = () => {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    window.electronAPI
      .getZendeskPaths()
      .then(async (files) => {
        const withLineCount = await Promise.all(
          files.map(async (file) => {
            try {
              const lineData = await window.electronAPI.getZendeskPathLineCount(
                file.name
              );
              return { ...file, lineCount: lineData.lineCount };
            } catch (err) {
              console.warn(`Failed to get line count for ${file.name}:`, err);
              return { ...file, lineCount: 0 };
            }
          })
        );
        setFiles(withLineCount);
      })
      .catch((err) => {
        console.error('Failed to fetch zendesk paths:', err);
        setFiles([]);
      });
  }, []);

  return (
    <AuditListView
      title="Zendesk Scraped Paths"
      files={files}
      columnHeaders={["Name", "Total Lines"]}
      folderName="zendesk-paths"
      emptyMessage="No paths found in this folder."
      getColumns={(file) => [
        { value: file.lineCount }
      ]}
    />
  );
};

export default DisplayZendeskPaths;
