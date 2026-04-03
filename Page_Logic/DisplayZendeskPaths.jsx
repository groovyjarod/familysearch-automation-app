import React, { useEffect, useState } from "react";
import { VStack, HStack } from "@chakra-ui/react";
import BodyVstackCss from "../reusables/BodyVstackCss";
import CenteredVstackCss from "../reusables/CenteredVstackCss";

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
    <VStack {...CenteredVstackCss}>
      <h2>Zendesk Scraped Paths</h2>
      <HStack width="95%" justifyContent="space-between">
        <h3>Name</h3>
        <h3>Total Lines</h3>
      </HStack>
      <VStack {...BodyVstackCss}>
        {files.map((file, index) => {
          return (
            <div
              className="list-item"
              key={index}
              onClick={() =>
                window.electronAPI.openResultsFile(
                  file.name,
                  "zendesk-paths"
                )
              }
            >
              <HStack width="95%" justifyContent="space-between">
                <p className="scroll-hidden list-name">{file.name}</p>
                <p>{file.lineCount}</p>
              </HStack>
            </div>
          );
        })}
        <div className="page-spacer"></div>
      </VStack>
    </VStack>
  );
};

export default DisplayZendeskPaths;
