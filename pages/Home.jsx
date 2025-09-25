import React from "react";
import { VStack, Button } from "@chakra-ui/react";
import CenteredVstackCss from "../reusables/CenteredVstackCss";
import LinkButton from "../reusables/LinkButton";

const Home = () => {
  return (
    <>
      <VStack {...CenteredVstackCss}>
        <h1>Lighthouse Automation Tool</h1>
        <h3>Version 1.1.2</h3>
        <h2>Created for FamilySearch</h2>
        <VStack width="100%" gap="16px">
          <LinkButton
            destination="/test-menu"
            buttonText="Run a Test"
            buttonClass="btn btn-main btn-audit"
          />
          <LinkButton
            destination="/lists-menu"
            buttonText="View Test Results"
            buttonClass="btn btn-main btn-view"
          />
          <LinkButton
            destination="/files-menu"
            buttonText="View/Change Files"
            buttonClass="btn btn-main btn-files"
          />
        </VStack>
      </VStack>
    </>
  );
};

export default Home;
