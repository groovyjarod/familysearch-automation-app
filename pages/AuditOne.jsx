import React, { useRef, useState, useEffect, memo } from "react";
import { VStack, HStack, Input, Text } from "@chakra-ui/react";
import CenteredHstackCss from "../reusables/CenteredHstackCss";
import CenteredVstackCss from "../reusables/CenteredVstackCss";
import MenuHeader from "../reusables/MenuHeader";
import LinkButton from "../reusables/LinkButton";
import BodyVstackCss from "../reusables/BodyVstackCss";
import BodyHstackCss from "../reusables/BodyHstackCss";
import SegmentedControl from "../reusables/SegmentedControl";
import pLimit from "p-limit";
import getLastPathSegment from "../reusables/getLastPathSegment";
import runAllTypesAudit from "../reusables/RunAllTypesAudit";
import handleAuditResult from "../reusables/HandleAuditResult";
import generateFinalResultMessage from "../reusables/generateFinalResultMessage";
import { useSettings } from "../contexts/SettingsContext";

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
    isConcise,
    setIsConcise,
    handleAudit,
    handleAllSizesAudit,
    // handleCheck
  }) => {
    return (
      <VStack {...BodyVstackCss}>
        <h1>Audit One Webpage</h1>
        <Text>Conduct a single audit on your chosen webpage and watch the audit happen.</Text>
        <h2>Paste full webpage URL here:</h2>
        <UrlInput fullUrl={fullUrl} setFullUrl={setFullUrl} className="input input-main" />
        <h2>Which testing method will you use?</h2>
        <SegmentedControl
          options={[
            { label: 'Desktop', value: 'desktop' },
            { label: 'Mobile', value: 'mobile' },
            { label: 'All Sizes', value: 'all' }
          ]}
          value={testingMethod}
          onChange={(value) => {
            setTestingMethod(value);
            if (value === 'all') {
              setIsViewingAudit('no');
            }
          }}
          width="100%"
        />
        <h2>Will you use a User Agent Key?</h2>
        <p>This is required for websites that use Inverna blockers. Leave this off if you don't intend to use it for this audit.</p>
        <SegmentedControl
          options={[
            { label: 'Use Key', value: 'yes' },
            { label: "Don't Use Key", value: 'no' }
          ]}
          value={isUsingUserAgent}
          onChange={setIsUsingUserAgent}
          width="100%"
        />
        <h2>Want to see the Audit happen?</h2>
        <p>Use for debugging purposes to verify that you successfully connected to the page.<br/> If you're conducting an all-sizes audit, you will not be able to view the page.</p>
        <SegmentedControl
          options={[
            { label: 'View Audit', value: 'yes', disabled: testingMethod === 'all' },
            { label: "Don't View Audit", value: 'no' }
          ]}
          value={isViewingAudit}
          onChange={setIsViewingAudit}
          disabled={testingMethod === 'all'}
          width="100%"
        />
      <h2>Timeout for this Test?</h2>
      <p>Determine how many seconds each audit will be allotted to complete. Aim for about 15 to 25 seconds for best results.</p>
      <NumberInput valueVariable={loadingTime} setValueVariable={setLoadingTime} disabled={false} />
      <h2>How detailed would you like your Report?</h2>
      <p>Choose between a detailed JSON report that shows coordinates for every instance of an issue, or a consolidated report that just shows the overall problems.</p>
      <SegmentedControl
        options={[
          { label: 'Full JSON Report', value: 'no' },
          { label: 'Concise JSON Report', value: 'yes' }
        ]}
        value={isConcise}
        onChange={setIsConcise}
        width="100%"
      />
      <hr />
        <button
          className="btn btn-main"
          onClick={testingMethod === "all" ? handleAllSizesAudit : handleAudit}
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
  const { settings } = useSettings();
  const [runningStatus, setRunningStatus] = useState("ready");
  const [fullUrl, setFullUrl] = useState("");
  const [pathName, setPathName] = useState("");
  const [testingMethod, setTestingMethod] = useState("desktop");
  const [titleHeader, setTitleHeader] = useState("Configuration");
  const [isCancelled, setIsCancelled] = useState(false);
  const [isViewingError, setIsViewingError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("");
  const [isUsingUserAgent, setIsUsingUserAgent] = useState("yes");
  const [isViewingAudit, setIsViewingAudit] = useState('yes');
  const [isConcise, setIsConcise] = useState("no")
  const [loadingTime, setLoadingTime] = useState("15")
  const [resultContents, setResultContents] = useState("")
  const isCancelledRef = useRef(isCancelled)

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
      await retryAudit(async () => {
        const result = await runAllTypesAudit(
          fullUrl,
          settings.secretUserAgent,
          pLimit,
          getLastPathSegment,
          'custom-audit-results',
          isCancelledRef.current,
          setRunningStatus,
          isUsingUserAgent,
          isConcise,
          loadingTime
        );
        console.log(`runAllTypesAudit result:`, result);
        if (typeof result === "object" && Object.values(result).every(r => r.accessibilityScore > 0)) {
          setResultContents(handleAuditResult(result))
          return
        } else if (typeof result === "object" && result.error) {
          // Preserve full error object
          const error = new Error(result.error);
          error.errorDetails = result;
          throw error;
        }
        const unknownError = new Error('Audit failed for all sizes');
        unknownError.errorDetails = {
          error: 'All sizes audit failed',
          errorLocation: 'AuditOne.jsx - handleAllSizesAudit',
          friendlyMessage: 'All sizes audit did not complete successfully',
          suggestion: 'Try running individual audits (Desktop or Mobile) instead of All Sizes',
          result: result
        };
        throw unknownError;
      });
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
        // Store full error object or details
        setErrorMessage(err.errorDetails || {
          error: err.message,
          errorLocation: 'AuditOne.jsx - handleAllSizesAudit',
          stack: err.stack,
          friendlyMessage: 'Failed to complete all sizes audit',
          suggestion: 'Check your connection and timeout settings, then try again'
        });
      }
    }
  };

  const handleAudit = async () => {
    setRunningStatus("running");
    setPathName(getLastPathSegment(fullUrl));
    setTitleHeader("Auditing...");
    setIsCancelled(false);
    try {
      const conciseTag = isConcise === "yes" ? "concise" : "full"
      const outputDirPath = 'custom-audit-results'
      const outputFilePath = `${testingMethod}-${conciseTag}-${getLastPathSegment(fullUrl)}.json`;
      const processId = `${testingMethod}-${Date.now()}`;
      // console.log(`Starting audit for ${fullUrl}, ${isConcise}`);
      await retryAudit(async () => {
        const result = await window.electronAPI.getSpawn(
          fullUrl,
          outputDirPath,
          outputFilePath,
          testingMethod,
          settings.secretUserAgent,
          testingMethod === "desktop" ? 1920 : 500,
          processId,
          isUsingUserAgent,
          isViewingAudit,
          loadingTime,
          isConcise
        );
        if (typeof result === "object" && result.accessibilityScore > 0) {
          setResultContents(handleAuditResult(result))
          return
        } else if (typeof result === "object" && result.error) {
          // Preserve full error object
          const error = new Error(result.error);
          error.errorDetails = result;
          throw error;
        } else if (typeof result === "object" && result.accessibilityScore === 0) {
          // Create detailed error object
          const zeroScoreError = new Error('Audit completed but returned score of 0');
          zeroScoreError.errorDetails = {
            error: 'Audit returned accessibility score of 0',
            errorLocation: 'AuditOne.jsx - handleAudit (result validation)',
            friendlyMessage: 'Audit did not complete successfully',
            suggestion: 'The page may have failed to load or timed out. Try increasing the timeout or checking your connection.',
            testingMethod: testingMethod,
            url: fullUrl,
            result: result
          };
          throw zeroScoreError;
        }
        // Unknown result format
        const unknownError = new Error('Audit returned unexpected result format');
        unknownError.errorDetails = {
          error: 'Unexpected audit result format',
          errorLocation: 'AuditOne.jsx - handleAudit (unknown result)',
          friendlyMessage: 'Audit produced an unexpected result',
          suggestion: 'This is an internal error. Please try again or report this issue.',
          testingMethod: testingMethod,
          url: fullUrl,
          result: JSON.stringify(result)
        };
        throw unknownError;
      });
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
        // Store full error object or details
        setErrorMessage(err.errorDetails || {
          error: err.message,
          errorLocation: 'AuditOne.jsx - handleAudit',
          stack: err.stack,
          friendlyMessage: 'Failed to complete audit',
          suggestion: 'Check the error details and try again with different settings'
        });
      }
    }
  };

  const handleCheck = async () => {
    const result = await window.electronAPI.checkNode()
    console.log("Generating result...")
    console.log(result)
  }

  const handleRunAgain = () => {
    setTitleHeader("Configuration")
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
        <h2 className="auditOne-finished">
          Completed {testingMethod} {testingMethod === "all" ? "sized " : ""}{" "}
          Audit for
        </h2>
        <h3 className="auditOne-finished">{fullUrl}.</h3>
      </div>
      <HStack {...BodyHstackCss}>
        <LinkButton
          destination="../../lists-menu/view-custom-audits"
          buttonText="Go To Audit File"
          buttonClass="btn btn-main"
        />
        <button className="btn btn-main" onClick={handleRunAgain}>
          Run Another Audit
        </button>
      </HStack>
      <span className="final-message">{generateFinalResultMessage(resultContents)}</span>
    </VStack>
  );

  const ErrorScreen = () => {
    // Parse error object if it's a JSON string
    let errorObj = errorMessage;
    if (typeof errorMessage === 'string') {
      try {
        errorObj = JSON.parse(errorMessage);
      } catch {
        // If not JSON, treat as simple string
        errorObj = { error: errorMessage };
      }
    }

    // Extract error details with fallbacks
    const friendlyMessage = errorObj.friendlyMessage || "Audit failed to complete";
    const suggestion = errorObj.suggestion || "Please try again";
    const errorLocation = errorObj.errorLocation || errorObj.previousLocation || "Unknown location";
    const technicalError = errorObj.error || errorMessage;
    const stackTrace = errorObj.stack || "No stack trace available";
    const url = errorObj.url || fullUrl;

    // Build detailed error view
    const detailedError = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

URL: ${url}
Testing Method: ${testingMethod}
Timestamp: ${errorObj.timestamp || new Date().toISOString()}

ERROR MESSAGE:
${technicalError}

ERROR LOCATION:
${errorLocation}
${errorObj.previousLocation ? `Previous Location: ${errorObj.previousLocation}` : ''}

${errorObj.exitCode ? `Exit Code: ${errorObj.exitCode}` : ''}
${errorObj.timeoutLimit ? `Timeout Limit: ${errorObj.timeoutLimit}` : ''}

STACK TRACE:
${stackTrace}

${errorObj.lastErrorOutput ? `
PROCESS OUTPUT (last 1000 chars):
${errorObj.lastErrorOutput}
` : ''}
${errorObj.rawOutput ? `
RAW OUTPUT (first 500 chars):
${errorObj.rawOutput}
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    return (
      <VStack {...BodyVstackCss}>
        <h3>Audit failed for {fullUrl}</h3>
        <h4 style={{ color: '#e53e3e', fontWeight: 'bold' }}>{friendlyMessage}</h4>
        <p style={{ maxWidth: '600px', textAlign: 'center' }}>{suggestion}</p>
        <button
          className="btn btn-small"
          onClick={() => setIsViewingError(isViewingError ? false : true)}
        >
          {isViewingError ? "Hide Error Details" : "View Error Details"}
        </button>
        <pre style={
          isViewingError
            ? {
                display: 'block',
                textAlign: 'left',
                background: '#1a1a1a',
                color: '#00ff00',
                padding: '15px',
                borderRadius: '5px',
                maxWidth: '90vw',
                overflow: 'auto',
                fontSize: '11px',
                lineHeight: '1.4',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }
            : { display: 'none' }
        }>
          {detailedError}
        </pre>
        <button className="btn btn-main" onClick={handleRunAgain}>
          Run Another Audit
        </button>
        <div className="page-spacer"></div>
      </VStack>
    );
  };

  const CancelledScreen = () => (
    <VStack {...BodyVstackCss}>
      <h3 className="auditOne-finished">Audit Cancelled for {fullUrl}</h3>
      <h4 className="auditOne-finished">{errorMessage}</h4>
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
          isConcise={isConcise}
          setIsConcise={setIsConcise}
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