import React, { useEffect, useState } from "react";
import AuditListView from "../reusables/AuditListView";

const DisplayZendeskAudits = () => {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    window.electronAPI
      .getZendeskAuditResults()
      .then(async (files) => {
        const withMetadata = await Promise.all(
          files.map(async (file) => {
            try {
              const metadata = await window.electronAPI.getAuditMetadata(
                "zendesk-audit-results",
                file.name
              );
              return { ...file, metadata };
            } catch (err) {
              console.warn(`Failed to get metadata for ${file.name}:`, err);
              return { ...file, metadata: { error: err.message } };
            }
          })
        );
        setFiles(withMetadata);
      })
      .catch((err) => {
        console.error('Failed to fetch zendesk audit results:', err);
        setFiles([]);
      });
  }, []);

  return (
    <AuditListView
      title="Zendesk Audit Results"
      files={files}
      columnHeaders={["Name", "Items", "SubItems", "Score", "length"]}
      folderName="zendesk-audit-results"
      getColumns={(file) => [
        { value: file.metadata.itemCount },
        { value: file.metadata.subItemCount },
        { value: file.metadata.score },
        { value: file.metadata.length }
      ]}
    />
  );
};

export default DisplayZendeskAudits;
