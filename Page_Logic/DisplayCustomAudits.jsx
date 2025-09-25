import React, { useEffect, useState } from "react";
import { VStack, HStack } from "@chakra-ui/react";
import BodyVstackCss from "../reusables/BodyVstackCss";
import CenteredVstackCss from "../reusables/CenteredVstackCss";

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
    <VStack {...CenteredVstackCss}>
      <h2>Custom Audit Results</h2>
      <HStack width="95%" justifyContent="space-between">
        <h3>Name</h3>
        <HStack minW="50%" width="50%" justifyContent="space-between">
          <h3>Items</h3>
          <h3>SubItems</h3>
          <h3>Score</h3>
          <h3>length</h3>
        </HStack>
      </HStack>
      <VStack {...BodyVstackCss}>
        {files.map((file, index) => {
          const metadata = file.metadata;
          return (
            <div
              className="list-item"
              key={index}
              onClick={() =>
                window.electronAPI.openResultsFile(
                  file.name,
                  "custom-audit-results"
                )
              }
            >
              <HStack width="95%" justifyContent="space-between">
                <p className="scroll-hidden list-name">{file.name}</p>
                <HStack maxW="50%" width="49%" justifyContent="space-between">
                  <p>{metadata.itemCount}</p>
                  <p>{metadata.subItemCount}</p>
                  <p>{metadata.score}</p>
                  <p>{metadata.length}</p>
                </HStack>
              </HStack>
            </div>
          );
        })}
        <div className="page-spacer"></div>
      </VStack>
    </VStack>
  );
};

export default DisplayCustomAudits;
