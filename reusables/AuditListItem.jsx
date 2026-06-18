import React from "react";
import { HStack } from "@chakra-ui/react";

const AuditListItem = ({ file, folderName, columns, onClick }) => {
  return (
    <div
      className="list-item"
      onClick={() => onClick(file.name, folderName)}
    >
      <HStack width="95%" justifyContent="space-between">
        <p className="scroll-hidden list-name">{file.name}</p>
        <HStack
          maxW="50%"
          width={columns.length > 2 ? "49%" : "auto"}
          justifyContent="space-between"
        >
          {columns.map((column, idx) => (
            <p key={idx}>{column.value}</p>
          ))}
        </HStack>
      </HStack>
    </div>
  );
};

export default AuditListItem;
