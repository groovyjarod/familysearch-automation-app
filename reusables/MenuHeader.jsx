import React from "react";
import { VStack, HStack, Text } from "@chakra-ui/react";
import LinkButton from "./LinkButton";

const MenuHeader = ({ title, subTitle, headerText, handleBackButton }) => {
  return (
    <VStack width="100%">
        <HStack
        width="90%"
        maxW="800px"
        margin="16px 16px 0 16px"
        justifyContent="space-between"
        >
        <LinkButton
            destination="../"
            buttonClass="btn"
            buttonText="< Go Back"
            handleBackButton={handleBackButton}
        />
        <h1>{title}</h1>
        <h4>{subTitle}</h4>
        </HStack>
        <Text>{headerText}</Text>
    </VStack>
  );
};

export default MenuHeader;
