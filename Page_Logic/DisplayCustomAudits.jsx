import React, { useEffect, useState } from "react";
import AuditListView from "../reusables/AuditListView";

const DisplayCustomAudits = () => {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    window.electronAPI
      .getCustomAudits()
      .then(async (files) => {
        const withMetadata = await Promise.all(
          files.map(async (file) => {
            try {
              const metadata = await window.electronAPI.getAuditMetadata(
                "custom-audit-results",
                file.name
              );
              return { ...file, metadata };
            } catch (err) {
              console.warn(`Failed to get metadata for ${file.name}:`, err)
              return { ...file, metadata: { error: err.message }}
            }
          })
        );
        setFiles(withMetadata);
      })
      .catch((err) => {
        console.error('Failed to fetch custom audits:', err)
        setFiles([])
      });
  }, []);

  return (
    <AuditListView
      title="Custom Audit Results"
      files={files}
      columnHeaders={["Name", "Items", "SubItems", "Score", "length"]}
      folderName="custom-audit-results"
      getColumns={(file) => [
        { value: file.metadata.itemCount },
        { value: file.metadata.subItemCount },
        { value: file.metadata.score },
        { value: file.metadata.length }
      ]}
    />
  );
};

export default DisplayCustomAudits;
