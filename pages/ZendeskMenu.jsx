import React, { useState, memo } from "react";
import { VStack, HStack, Input } from "@chakra-ui/react";
import CenteredHstackCss from "../reusables/CenteredHstackCss";
import CenteredVstackCss from "../reusables/CenteredVstackCss";
import MenuHeader from "../reusables/MenuHeader";
import LinkButton from "../reusables/LinkButton";
import BodyVstackCss from "../reusables/BodyVstackCss";
import BodyHstackCss from "../reusables/BodyHstackCss";

const TextInput = memo(({ label, value, setValue, type = "text", placeholder = "" }) => (
  <>
    <h3>{label}</h3>
    <Input
      className="input"
      type={type}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      required
    />
  </>
));
TextInput.displayName = 'TextInput';

const NumberInput = memo(({ valueVariable, setValueVariable, disabled }) => {
  return (
    <Input
      className="input"
      type="text"
      value={valueVariable}
      onChange={(e) => setValueVariable(e.target.value)}
      disabled={disabled}
    />
  );
});
NumberInput.displayName = 'NumberInput';

const ReadyScreen = memo(
  ({
    taskType,
    setTaskType,
    loginId,
    setLoginId,
    password,
    setPassword,
    zendeskUrl,
    setZendeskUrl,
    concurrency,
    setConcurrency,
    isViewingAudit,
    setIsViewingAudit,
    loadingTime,
    setLoadingTime,
    handleStart,
  }) => {
    return (
      <VStack {...BodyVstackCss}>
        <h1>Zendesk Tasks</h1>
        <p>This functionality serves to audit FamilySearch's Zendesk site for accessibility purposes. Choose from scraping the site's availble articles to obtain a full list, or audit the set of URL/path combinations determined in settings.</p>
        <hr />
        <h3>Select the task you want to perform</h3>

        {/* Task Selection */}
        <HStack {...CenteredHstackCss}>
          <HStack {...BodyHstackCss}>
            <input
              type="radio"
              name="taskType"
              value="scrape"
              checked={taskType === "scrape"}
              onChange={() => setTaskType("scrape")}
            />
            <label>Scrape Site for Articles</label>
          </HStack>
          <HStack {...BodyHstackCss}>
            <input
              type="radio"
              name="taskType"
              value="audit"
              checked={taskType === "audit"}
              onChange={() => setTaskType("audit")}
            />
            <label>Audit Zendesk Articles</label>
          </HStack>
        </HStack>
        <VStack display={ taskType === "audit" ? "inline" : "none" } flexDirection="column">
          <HStack width="100%" justifyContent="space-between">
            <h2>Pulling paths from wikiPaths.txt</h2>
            <LinkButton
              destination="../../files-menu"
              buttonText="Edit Wiki Paths"
              buttonClass="btn btn-small"
            />
          </HStack>
          <p>Ensure that your initial URL is set to <i><strong>https://articles.familysearch.com/hc/en-us/</strong></i> before beginning. You may edit the initial URL by clicking 'Edit Wiki Paths'.</p>
        </VStack>

        {/* Common Fields */}
        <TextInput
          label="Login ID"
          value={loginId}
          setValue={setLoginId}
          placeholder="Enter your Zendesk login ID"
        />

        <TextInput
          label="Password"
          value={password}
          setValue={setPassword}
          type="password"
          placeholder="Enter your password"
        />

        {/* Scrape-specific field */}
        {taskType === "scrape" && (
          <>
            <TextInput
              label="Zendesk URL"
              value={zendeskUrl}
              setValue={setZendeskUrl}
              placeholder="e.g., https://articles.familysearch.com/hc/en-us"
            />
          </>
        )}

        {/* Audit-specific field */}
        {taskType === "audit" && (
          <>
            <h2>Concurrency</h2>
            <p>Number of concurrent audits to run (1-10):</p>
            <NumberInput
              valueVariable={concurrency}
              setValueVariable={setConcurrency}
              disabled={false}
            />
          </>
        )}

        <p style={{ color: '#e67e22', fontWeight: 'bold', marginTop: '10px' }}>
          Note: After clicking Sign In, you will have 15 seconds to manually enter your two-factor authentication code.
        </p>

        <h2>Want To See The Login Happen?</h2>
        <p>Use for debugging purposes to verify that login is working correctly.</p>
        <HStack {...CenteredHstackCss}>
          <HStack {...BodyHstackCss}>
            <input
              type="radio"
              name="isViewingAudit"
              value="yes"
              checked={isViewingAudit === "yes"}
              onChange={() => setIsViewingAudit("yes")}
            />
            <label htmlFor="isViewingAudit">View Login</label>
          </HStack>
          <HStack {...BodyHstackCss}>
            <input
              type="radio"
              name="isNotViewingAudit"
              value="no"
              checked={isViewingAudit === "no"}
              onChange={() => setIsViewingAudit("no")}
            />
            <label htmlFor="isNotViewingAudit">Don't View Login</label>
          </HStack>
        </HStack>

        <h2>Timeout for Login Process?</h2>
        <p>Determine how many seconds the login process will be allotted to complete. Aim for about 30 seconds.</p>
        <NumberInput
          valueVariable={loadingTime}
          setValueVariable={setLoadingTime}
          disabled={false}
        />

        <div className="page-spacer"></div>
        <button
          className="btn btn-main"
          onClick={handleStart}
          disabled={
            !loginId.trim() ||
            !password.trim() ||
            !loadingTime ||
            !Number.isInteger(parseFloat(loadingTime)) ||
            parseInt(loadingTime) <= 0 ||
            (taskType === "scrape" && !zendeskUrl.trim()) ||
            (taskType === "audit" && (!concurrency || parseInt(concurrency) < 1 || parseInt(concurrency) > 10))
          }
        >
          {taskType === "scrape" ? "Start Scraping" : "Start Auditing"}
        </button>
        <div className="page-spacer"></div>
      </VStack>
    );
  }
);
ReadyScreen.displayName = 'ReadyScreen';

const ZendeskMenu = () => {
  const [runningStatus, setRunningStatus] = useState("ready");
  const [taskType, setTaskType] = useState("scrape");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [zendeskUrl, setZendeskUrl] = useState("https://articles.familysearch.com/hc/en-us");
  const [concurrency, setConcurrency] = useState("3");
  const [titleHeader, setTitleHeader] = useState("Zendesk Tasks");
  const [isViewingError, setIsViewingError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isViewingAudit, setIsViewingAudit] = useState('yes');
  const [loadingTime, setLoadingTime] = useState("30");
  const [resultMessage, setResultMessage] = useState("");
  const [failedAudits, setFailedAudits] = useState([]);

  const handleCancel = async () => {
    try {
      await window.electronAPI.cancelAudit();
      setRunningStatus("cancelled");
      setTitleHeader("Task Cancelled");
      setErrorMessage("Task was cancelled by the user.");
    } catch (err) {
      console.error("Cancel task failed:", err);
    }
  };

  const handleStart = async () => {
    setRunningStatus("running");

    if (taskType === "scrape") {
      setTitleHeader("Scraping Zendesk for Articles...");

      try {
        const result = await window.electronAPI.zendeskScrape(
          loginId,
          password,
          zendeskUrl,
          isViewingAudit,
          loadingTime
        );

        if (result && result.success) {
          setResultMessage(result.message + `\n\nTotal URLs scraped: ${result.totalUrlsScraped}\n\nFull URLs saved to:\n${result.outputFilePathFullUrls}\n\nRelative paths saved to:\n${result.outputFilePathPaths}`);
          setRunningStatus("finished");
          setTitleHeader("Scraping Complete");
        } else if (result && result.error) {
          throw new Error(result.error);
        } else {
          throw new Error("Unknown error occurred during scraping");
        }
      } catch (err) {
        console.error("handleStart (scrape) failed:", err);
        setRunningStatus("error");
        setTitleHeader("Scraping Error");
        setErrorMessage(err.message || "Failed to scrape Zendesk");
      }
    } else {
      // Audit task
      setTitleHeader("Auditing Zendesk Articles...");

      try {
        const result = await window.electronAPI.zendeskConcurrentAudit(
          loginId,
          password,
          zendeskUrl,
          isViewingAudit,
          loadingTime,
          concurrency
        );

        if (result && result.success) {
          setResultMessage(result.message + `\n\nTotal audits: ${result.totalAudits}\nSuccessful: ${result.successfulAudits}\nFailed: ${result.failedAudits?.length || 0}`);
          setFailedAudits(result.failedAudits || []);
          setRunningStatus("finished");
          setTitleHeader("Auditing Complete");
        } else if (result && result.error) {
          throw new Error(result.error);
        } else {
          throw new Error("Unknown error occurred during auditing");
        }
      } catch (err) {
        console.error("handleStart (audit) failed:", err);
        setRunningStatus("error");
        setTitleHeader("Auditing Error");
        setErrorMessage(err.message || "Failed to audit Zendesk articles");
      }
    }
  };

  const handleRetryFailed = async () => {
    if (failedAudits.length === 0) return;

    setRunningStatus("running");
    setTitleHeader("Retrying Failed Audits...");

    try {
      const result = await window.electronAPI.zendeskRetryFailedAudits(
        loginId,
        password,
        zendeskUrl,
        failedAudits.map(f => f.url),
        isViewingAudit,
        loadingTime,
        concurrency
      );

      if (result && result.success) {
        setResultMessage(result.message + `\n\nTotal audits: ${result.totalAudits}\nSuccessful: ${result.successfulAudits}\nFailed: ${result.failedAudits?.length || 0}`);
        setFailedAudits(result.failedAudits || []);
        setRunningStatus("finished");
        setTitleHeader("Retry Complete");
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (err) {
      console.error("handleRetryFailed failed:", err);
      setRunningStatus("error");
      setTitleHeader("Retry Error");
      setErrorMessage(err.message || "Failed to retry audits");
    }
  };

  const handleRunAgain = () => {
    setTitleHeader("Zendesk Tasks");
    setIsViewingError(false);
    setRunningStatus("ready");
    setLoginId("");
    setPassword("");
    setErrorMessage("");
    setResultMessage("");
    setFailedAudits([]);
  };

  const RunningScreen = () => (
    <VStack {...BodyVstackCss}>
      <h2>{taskType === "scrape" ? "Scraping Zendesk Site..." : "Auditing Zendesk Articles..."}</h2>
      <p>
        The login credentials are being entered. After clicking "Sign in", you will have
        <strong> up to 20 seconds to manually enter your two-factor authentication code</strong> in
        the browser window.
      </p>
      {taskType === "scrape" ? (
        <>
          <p>Once logged in, the system will:</p>
          <ul style={{ textAlign: 'left', maxWidth: '600px', margin: '0 auto' }}>
            <li>Discover all English links within the specified Zendesk URL</li>
            <li>Navigate up to 5 levels deep</li>
            <li>Save all discovered URLs to a timestamped .txt file</li>
          </ul>
        </>
      ) : (
        <>
          <p>Once logged in, the system will:</p>
          <ul style={{ textAlign: 'left', maxWidth: '600px', margin: '0 auto' }}>
            <li>Read paths from wikiPaths.txt</li>
            <li>Run concurrent Lighthouse accessibility audits</li>
            <li>Save results to audits/zendesk-audit-results/</li>
          </ul>
        </>
      )}
      <p style={{ color: '#e67e22', fontWeight: 'bold' }}>
        This process may take several minutes. Please be patient.
      </p>
      <button
        className="btn btn-main"
        onClick={handleCancel}
      >
        Cancel Process
      </button>
    </VStack>
  );

  const FinishedScreen = () => (
    <VStack {...BodyVstackCss}>
      <div>
        <h2 className="auditOne-finished">
          {taskType === "scrape" ? "Scraping Complete" : "Auditing Complete"}
        </h2>
      </div>
      <div style={{
        maxWidth: '600px',
        margin: '20px auto',
        padding: '15px',
        backgroundColor: '#333',
        borderRadius: '5px',
        whiteSpace: 'pre-wrap',
        textAlign: 'left'
      }}>
        {resultMessage}
      </div>
      {failedAudits.length > 0 && (
        <>
          <p style={{ color: '#e67e22', fontWeight: 'bold' }}>
            {failedAudits.length} audit(s) failed. Would you like to retry them?
          </p>
          <button className="btn btn-main" onClick={handleRetryFailed}>
            Retry Failed Audits
          </button>
        </>
      )}
      <HStack {...BodyHstackCss}>
        {taskType === "audit" && (
          <LinkButton
            destination="../../lists-menu/view-zendesk-audits"
            buttonText="View Audit Results"
            buttonClass="btn btn-main"
          />
        )}
        <button className="btn btn-main" onClick={handleRunAgain}>
          Run Another Task
        </button>
      </HStack>
    </VStack>
  );

  const ErrorScreen = () => {
    let errorObj = errorMessage;
    if (typeof errorMessage === 'string') {
      try {
        errorObj = JSON.parse(errorMessage);
      } catch {
        errorObj = { error: errorMessage };
      }
    }

    const friendlyMessage = errorObj.friendlyMessage || "Task failed to complete";
    const suggestion = errorObj.suggestion || "Please try again";
    const errorLocation = errorObj.errorLocation || errorObj.previousLocation || "Unknown location";
    const technicalError = errorObj.error || errorMessage;
    const stackTrace = errorObj.stack || "No stack trace available";

    const detailedError = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Timestamp: ${errorObj.timestamp || new Date().toISOString()}

ERROR MESSAGE:
${technicalError}

ERROR LOCATION:
${errorLocation}

${errorObj.exitCode ? `Exit Code: ${errorObj.exitCode}` : ''}
${errorObj.timeoutLimit ? `Timeout Limit: ${errorObj.timeoutLimit}` : ''}

STACK TRACE:
${stackTrace}

${errorObj.lastErrorOutput ? `
PROCESS OUTPUT (last 1000 chars):
${errorObj.lastErrorOutput}
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    return (
      <VStack {...BodyVstackCss}>
        <h3>Task failed</h3>
        <h4 style={{ color: '#e53e3e', fontWeight: 'bold' }}>{friendlyMessage}</h4>
        <p style={{ maxWidth: '600px', textAlign: 'center' }}>{suggestion}</p>
        <button
          className="btn btn-medium"
          onClick={() => setIsViewingError(!isViewingError)}
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
          Try Again
        </button>
        <div className="page-spacer"></div>
      </VStack>
    );
  };

  const CancelledScreen = () => (
    <VStack {...BodyVstackCss}>
      <h3 className="auditOne-finished">Task Cancelled</h3>
      <h4 className="auditOne-finished">{errorMessage}</h4>
      <button className="btn btn-main" onClick={handleRunAgain}>
        Try Again
      </button>
    </VStack>
  );

  return (
    <VStack {...CenteredVstackCss}>
      <MenuHeader title={titleHeader} handleBackButton={handleCancel} />
      {runningStatus === "ready" && (
        <ReadyScreen
          taskType={taskType}
          setTaskType={setTaskType}
          loginId={loginId}
          setLoginId={setLoginId}
          password={password}
          setPassword={setPassword}
          zendeskUrl={zendeskUrl}
          setZendeskUrl={setZendeskUrl}
          concurrency={concurrency}
          setConcurrency={setConcurrency}
          isViewingAudit={isViewingAudit}
          setIsViewingAudit={setIsViewingAudit}
          loadingTime={loadingTime}
          setLoadingTime={setLoadingTime}
          handleStart={handleStart}
        />
      )}
      {runningStatus === "running" && <RunningScreen />}
      {runningStatus === "finished" && <FinishedScreen />}
      {runningStatus === "error" && <ErrorScreen />}
      {runningStatus === "cancelled" && <CancelledScreen />}
    </VStack>
  );
};

export default ZendeskMenu;
