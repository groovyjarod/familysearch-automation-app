import React from "react";
import { VStack, HStack } from "@chakra-ui/react";
import BodyVstackCss from "./BodyVstackCss";
import CenteredVstackCss from "./CenteredVstackCss";
import AuditListItem from "./AuditListItem";

const AuditListView = ({
  title,
  files,
  columnHeaders,
  folderName,
  emptyMessage = "No audits found in this folder.",
  getColumns,
  onFileClick = (fileName, folder) => window.electronAPI.openResultsFile(fileName, folder)
}) => {
  return (
    <VStack {...CenteredVstackCss}>
      <h2>{title}</h2>
      <HStack
        width="95%"
        justifyContent="space-between"
        display={files.length === 0 ? 'none' : 'flex'}
      >
        <h3>{columnHeaders[0]}</h3>
        {columnHeaders.length > 2 ? (
          <HStack minW="50%" width="50%" justifyContent="space-between">
            {columnHeaders.slice(1).map((header, idx) => (
              <h3 key={idx}>{header}</h3>
            ))}
          </HStack>
        ) : (
          <h3>{columnHeaders[1]}</h3>
        )}
      </HStack>
      <VStack {...BodyVstackCss}>
        {files.length === 0 ? (
          <p style={{ marginTop: '32px', color: 'var(--color-text-secondary)' }}>
            {emptyMessage}
          </p>
        ) : (
          files.map((file, index) => (
            <AuditListItem
              key={index}
              file={file}
              folderName={folderName}
              columns={getColumns(file)}
              onClick={onFileClick}
            />
          ))
        )}
        <div className="page-spacer"></div>
      </VStack>
    </VStack>
  );
};

export default AuditListView;
