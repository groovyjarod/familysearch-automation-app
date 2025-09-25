import React, { useRef, useState, useEffect, memo } from "react";
import { VStack, HStack, Input } from "@chakra-ui/react";
import CenteredHstackCss from "../reusables/CenteredHstackCss";
import CenteredVstackCss from "../reusables/CenteredVstackCss";
import MenuHeader from "../reusables/MenuHeader";
import LinkButton from "../reusables/LinkButton";
import BodyVstackCss from "../reusables/BodyVstackCss";
import BodyHstackCss from "../reusables/BodyHstackCss";
import pLimit from "p-limit";
import getLastPathSegment from "../reusables/getLastPathSegment";
import runAllTypesAudit from "../reusables/RunAllTypesAudit";

const UrlInput = memo(({ fullUrl, setFullUrl, className }) => (
  <Input
    className={className}
    type="text"
    name="audit-link"
    value={fullUrl}
    onChange={(e) => setFullUrl(e.target.value.trim())}
    required
  />
));

const NumberInput = memo(({ valueVariable, setValueVariable, disabled }) => {

  valueVariable == !disabled ? valueVariable : 1

  return (
    <Input
      className="input"
      type="text" // Use text to allow controlled validation
      name="number-link"
      value={valueVariable}
      onChange={(e) => setValueVariable(e.target.value)}
      disabled={disabled}
    />
  );
});

const ReadyScreen = memo(
  ({
    fullUrl,
    setFullUrl,
    testingMethod,
    setTestingMethod,
    isUsingUserAgent,
    setIsUsingUserAgent,
    isViewingAudit,
    setIsViewingAudit,
    loadingTime,
    setLoadingTime,
    handleAudit,
    handleAllSizesAudit,
    handleCheck
  }) => {
    return (
      <VStack {...BodyVstackCss}>
        <h2>Paste Full Webpage URL Here:</h2>
        <UrlInput fullUrl={fullUrl} setFullUrl={setFullUrl} className="input input-main" />
        <h2>Choose Testing Method:</h2>
        <HStack {...CenteredHstackCss}>
          <HStack {...BodyHstackCss}>
            <input
              type="radio"
              name="testingMethod"
              value="desktop"
              checked={testingMethod === "desktop"}
              onChange={(e) => setTestingMethod(e.target.value)}
            />
            <label htmlFor="desktop">Desktop</label>
          </HStack>
          <HStack {...BodyHstackCss}>
            <input
              type="radio"
              name="testingMethod"
              value="mobile"
              checked={testingMethod === "mobile"}
              onChange={(e) => setTestingMethod(e.target.value)}
            />
            <label htmlFor="mobile">Mobile</label>
          </HStack>
          <HStack {...BodyHstackCss}>
            <input
              type="radio"
              name="testingMethod"
              value="all"
              checked={testingMethod === "all"}
              onChange={(e) => {
                setTestingMethod(e.target.value)
                setIsViewingAudit("no");
              }}
            />
            <label htmlFor="all">All sizes</label>
          </HStack>
        </HStack>
        <h2>Using User Agent Key?</h2>
        <p>Use this when auditing sites that use Inverna blockers. Only use for sites you're authorized to.</p>
        <HStack {...CenteredHstackCss}>
          <HStack {...BodyHstackCss}>
            <input
              type="radio"
              name="isUsingUserAgent"
              value="yes"
              checked={isUsingUserAgent === "yes"}
              onChange={() => setIsUsingUserAgent("yes")}
            />
            <label htmlFor="isUsingUserAgent">Use Key</label>
          </HStack>
          <HStack {...BodyHstackCss}>
            <input
              type="radio"
              name="isNotUsingUserAgent"
              value="no"
              checked={isUsingUserAgent === "no"}
              onChange={() => setIsUsingUserAgent("no")}
            />
            <label htmlFor="isNotUsingUserAgent">Don't Use Key</label>
          </HStack>
        </HStack>
        <h2>Want To See The Audit Happen?</h2>
        <p>Use for debugging purposes to verify that you successfully connected to the page.\n If you're conducting an all-sizes audit, you will not be able to view the page.</p>
        <HStack {...CenteredHstackCss}>
          <HStack {...BodyHstackCss}>
            <input
              disabled={testingMethod === "all"}
              type="radio"
              name="isViewingAudit"
              value="yes"
              checked={isViewingAudit === "yes"}
              onChange={() => setIsViewingAudit(testingMethod === "all" ? "no" : "yes")}
            />
            <label htmlFor="isViewingAudit">View Audit</label>
          </HStack>
          <HStack {...BodyHstackCss}>
            <input
              disabled={testingMethod === "all"}
              type="radio"
              name="isNotViewingAudit"
              value={false}
              checked={isViewingAudit === "no"}
              onChange={() => setIsViewingAudit("no")}
            />
            <label htmlFor="isNotViewingAudit">Don't View Audit</label>
          </HStack>
        </HStack>
      <h2>Timeout for this Test?</h2>
      <p>Determine how many seconds each audit will be allotted to complete. Aim for about 15 to 25 seconds for best results.</p>
      <NumberInput valueVariable={loadingTime} setValueVariable={setLoadingTime} disabled={false} />
      <div className="page-spacer"></div>
        <button
          className="btn btn-main"
          onClick={testingMethod === "all" ? handleAllSizesAudit : handleAudit}
          // onClick={LighthouseTest}
          // onClick={handleCheck}
          disabled={
            fullUrl.length < 8 ||
            !testingMethod ||
            !loadingTime ||
            !Number.isInteger(parseFloat(loadingTime)) ||
            parseInt(loadingTime) <= 0
          }
        >
          Start Audit
        </button>
        <div className="page-spacer"></div>
      </VStack>
    );
  }
);

const AuditOne = () => {
  const [runningStatus, setRunningStatus] = useState("ready");
  const [fullUrl, setFullUrl] = useState("");
  const [pathName, setPathName] = useState("");
  const [testingMethod, setTestingMethod] = useState("desktop");
  const [userAgent, setUserAgent] = useState("");
  const [titleHeader, setTitleHeader] = useState("Audit One Webpage");
  const [isCancelled, setIsCancelled] = useState(false);
  const [isViewingError, setIsViewingError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("");
  const [isUsingUserAgent, setIsUsingUserAgent] = useState("yes");
  const [isViewingAudit, setIsViewingAudit] = useState('yes');
  const [loadingTime, setLoadingTime] = useState("15")
  const isCancelledRef = useRef(isCancelled)

  useEffect(() => {
    window.electronAPI
      .getFile("./settings/secretUserAgent.txt")
      .then(setUserAgent)
      .catch(console.error);
  }, []);

  useEffect(() => {
    isCancelledRef.current = isCancelled
  }, [isCancelled])

  const retryAudit = async (fn, retries = 2) => {
    for (let i = 0; i < retries; i++) {
      if (isCancelledRef.current) {
        console.log('initial check for isCancelled worked.');
        throw new Error("Audit cancelled by user");
      }
      try {
        const result = await fn();
        if (isCancelledRef.current) {
          console.log('Post-fn isCancelledRef check worked.');
          throw new Error("Audit cancelled by user");
        }
        return result;
      } catch (err) {
        if (isCancelledRef.current) {
          console.log('Error isCancelledRef check worked.');
          throw new Error("Audit cancelled by user");
        }
        console.warn(`Retry ${i + 1} failed. Trying again...`, err);
        if (i < retries - 1) {
          if (!isCancelledRef.current) setRunningStatus("warning");
          else {
            console.log('Retry skipped due to cancellation.');
            throw new Error('Audit cancelled by user');
          }
        } else {
          console.log('All retries exhausted.');
          throw err;
        }
      }
    }
  };

  const handleCancelAudit = async () => {
    setIsCancelled(true);
    try {
      await window.electronAPI.cancelAudit()
      setRunningStatus("cancelled")
      setTitleHeader("Audit Cancelled")
      setErrorMessage("Audit was cancelled by the user.")
    } catch (err) {
      console.error("Cancel audit failed:", err)
    }
  };

  const handleAllSizesAudit = async () => {
    setRunningStatus("running");
    setTitleHeader("Auditing All Sizes...");
    setPathName(getLastPathSegment(fullUrl));
    setIsCancelled(false);
    try {
      const result = await retryAudit(async () => {
        const result = await runAllTypesAudit(
          fullUrl,
          userAgent,
          pLimit,
          getLastPathSegment,
          'custom-audit-results',
          isCancelledRef.current,
          setRunningStatus,
          isUsingUserAgent
        );
        console.log(`runAllTypesAudit result:`, result);
        if (typeof result === "string" && result.includes("Audit complete.")) {
          return "Audit complete.";
        } else if (typeof result === "string" && result.includes("Audit incomplete.")) {
          throw new Error(`In AuditOne handleAllSizesAudit: Audit incomplete for all: ${result}`);
        } else if (typeof result === "object" && Object.values(result).every(r => r.accessibilityScore > 0)) {
          return "Audit complete.";
        }
        throw new Error(`In AuditOne handleAllSizesAudit: Audit failed for all: ${JSON.stringify(result)}`);
      });
      console.log(`All sizes audit completed: ${result}`);
      setRunningStatus("finished");
      setTitleHeader("Finished Auditing All Sizes");
    } catch (err) {
      console.error("handleAllSizesAudit in AuditOne.jsx failed:", err);
      if (err.message === "Audit cancelled by user") {
        setRunningStatus("cancelled");
        setTitleHeader("Audit Cancelled");
        setErrorMessage("Audit was cancelled by the user.");
      } else {
        setRunningStatus("error");
        setTitleHeader("Audit Error");
        setErrorMessage(err.message || "Failed to complete all sizes audit.");
      }
    }
  };

  const handleAudit = async () => {
    setRunningStatus("running");
    setPathName(getLastPathSegment(fullUrl));
    setTitleHeader("Auditing...");
    try {
      const outputDirPath = 'custom-audit-results'
      const outputFilePath = `${testingMethod}-${getLastPathSegment(fullUrl)}.json`;
      const processId = `${testingMethod}-${Date.now()}`;
      // console.log(`Starting audit for ${fullUrl}, method: ${testingMethod}, output: ${outputPath}, isUsingUserAgent: ${isUsingUserAgent}, isViewingAudit: ${isViewingAudit}`);
      const result = await retryAudit(async () => {
        const result = await window.electronAPI.getSpawn(
          fullUrl,
          outputDirPath,
          outputFilePath,
          testingMethod,
          userAgent,
          testingMethod === "desktop" ? 1920 : 500,
          processId,
          isUsingUserAgent,
          isViewingAudit,
          loadingTime
        );
        console.log(`get-spawn result:`, result);
        console.log(typeof result)
        const resultCheck = result.includes("Audit complete, report written successfully");
        if (resultCheck) {
          return "Audit complete.";
        } else if (typeof result === "string" && result.includes("Audit incomplete.")) {
          throw new Error(`AuditOne handleAudit: Audit failed for ${testingMethod}: ${result}`);
        } else if (typeof result === "object" && result.accessibilityScore > 0) {
          return "Audit complete.";
        }
        throw new Error(`AuditOne handleAudit: Audit failed for ${testingMethod}: ${JSON.stringify(result)}`);
      });
      console.log(`Audit completed: ${result}`);
      setRunningStatus("finished");
      setTitleHeader("Audit Result");
    } catch (err) {
      console.error("handleAudit in AuditOne.jsx failed:", err);
      if (err.message === "Audit cancelled by user") {
        setRunningStatus("cancelled");
        setTitleHeader("Audit Cancelled");
        setErrorMessage("Audit was cancelled by the user.");
      } else {
        setRunningStatus("error");
        setTitleHeader("Audit Error");
        setErrorMessage(err.message || `Failed to audit ${fullUrl}.`);
      }
    }
  };

  const handleCheck = async () => {
    const result = await window.electronAPI.checkNode()
    console.log("Generating result...")
    console.log(result)
  }

  const handleRunAgain = () => {
    setTitleHeader("Audit One Webpage")
    setIsViewingError(false)
    setRunningStatus("ready");
    setFullUrl("");
    setErrorMessage("");
    setIsCancelled(false);
  };

  const RunningScreen = () => (
    <VStack {...BodyVstackCss}>
      <h2>
        Auditing {pathName} through {testingMethod}{" "}
        {testingMethod === "all" ? "sizes" : ""}...
      </h2>
      <p>
        {testingMethod !== "all"
          ? "Lighthouse is currently conducting an audit in the background. It will take some time to load the page and complete this audit, expect up to at least 30 seconds for this audit to complete. If your connection is too slow, or if the timeout trigger is too short, the audit will time out and try again."
          : "Currently conducting 4 simultaneous tests with a width of 500, 900, 1280, and 1920. This test will take at least a minute to complete and may fail to initially connect."}
      </p>
      <p>
        {testingMethod !== "all" &&
          "If this page hangs for longer than 45 seconds, please check your internet connection or try again."}
      </p>
      <button
        className="btn btn-main"
        onClick={handleCancelAudit}
      >
        Cancel Audit
      </button>
    </VStack>
  );

  const WarningScreen = () => (
    <VStack {...BodyVstackCss}>
      <h2>
        Auditing {pathName} through {testingMethod}{" "}
        {testingMethod === "all" ? "sizes" : ""}...
      </h2>
      <p>Attempting to reconnect to webpage after previous attempt failed.</p>
      <p>Trying again...</p>
      <button
        className="btn btn-main"
        onClick={handleCancelAudit}
      >
        Cancel Audit
      </button>
    </VStack>
  );

  const FinishedScreen = () => (
    <VStack {...BodyVstackCss}>
      <div>
        <h2>
          Completed {testingMethod} {testingMethod === "all" ? "sized " : ""}{" "}
          Audit for
        </h2>
        <h3 style={{ maxWidth: "80%", overflow: "scroll" }}>{fullUrl}.</h3>
      </div>
      <LinkButton
        destination="../../lists-menu/view-custom-audits"
        buttonText="Go To Audit File"
        buttonClass="btn btn-main"
      />
      <button className="btn btn-main" onClick={handleRunAgain}>
        Run Another Audit
      </button>
    </VStack>
  );

  const ErrorScreen = () => {
    const errorMessages = [
      "Audit did not resolve due to timeout. Check to ensure you're using the correct user agent key, the url, and your connection, and try again.",
      "The website you are trying to audit may require a User Agent Key. Please try again with User Agent Key set to 'Use Key', and ensure that your User Agent Key value is compatible with the website you're attempting to audit.",
      "Lighthouse was not able to complete this audit in its allotted time. Check your timeout value, and try again.",
      "Lighthouse was not able to complete this audit during this run. Please try again."
    ]
    let customErrorMessage
    if (errorMessage.includes("did not resolve due to timeout")) customErrorMessage = errorMessages[0]
    else if (errorMessage.includes("403")) customErrorMessage = errorMessages[1]
    else if (errorMessage.includes("Invalid Lighthouse result")) customErrorMessage = errorMessages[2]
    else customErrorMessage = errorMessages[3]
    return (
      <VStack {...BodyVstackCss}>
        <h3>Audit failed for {fullUrl}.</h3>
        <h4>{customErrorMessage}</h4>
        <button className="btn btn-small" onClick={() => setIsViewingError(isViewingError ? false : true)}>{isViewingError ? "Hide Error" : "View Error"}</button>
        <p style={isViewingError ? { display: 'inline' } : { display: 'none' }}>{errorMessage}</p>
        <button className="btn btn-main" onClick={handleRunAgain}>
          Run Another Audit
        </button>
        <div className="page-spacer"></div>
      </VStack>
  )};

  const CancelledScreen = () => (
    <VStack {...BodyVstackCss}>
      <h3 style={{ maxWidth: "100%", overflow: "scroll" }}>Audit Cancelled for {fullUrl}</h3>
      <h4>{errorMessage}</h4>
      <button className="btn btn-main" onClick={handleRunAgain}>
        Run Another Audit
      </button>
    </VStack>
  );

  return (
    <VStack {...CenteredVstackCss}>
      <MenuHeader title={titleHeader} handleBackButton={handleCancelAudit} />
      {runningStatus === "ready" && (
        <ReadyScreen
          fullUrl={fullUrl}
          setFullUrl={setFullUrl}
          testingMethod={testingMethod}
          setTestingMethod={setTestingMethod}
          isUsingUserAgent={isUsingUserAgent}
          setIsUsingUserAgent={setIsUsingUserAgent}
          isViewingAudit={isViewingAudit}
          setIsViewingAudit={setIsViewingAudit}
          loadingTime={loadingTime}
          setLoadingTime={setLoadingTime}
          handleAudit={handleAudit}
          handleAllSizesAudit={handleAllSizesAudit}
          handleCheck={handleCheck}
        />
      )}
      {runningStatus === "running" && <RunningScreen />}
      {runningStatus === "warning" && <WarningScreen />}
      {runningStatus === "finished" && <FinishedScreen />}
      {runningStatus === "error" && <ErrorScreen />}
      {runningStatus === "cancelled" && <CancelledScreen />}
    </VStack>
  );
};

export default AuditOne;