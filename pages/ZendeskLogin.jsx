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
    loginId,
    setLoginId,
    password,
    setPassword,
    isViewingAudit,
    setIsViewingAudit,
    loadingTime,
    setLoadingTime,
    handleLogin,
  }) => {
    return (
      <VStack {...BodyVstackCss}>
        <h2>Zendesk Site Crawler & Auditor</h2>
        <p>
          This will log into articles.familysearch.com, then automatically crawl the entire English site
          (up to 5 levels deep) and run Lighthouse accessibility audits on every page discovered.
        </p>
        <p style={{ fontSize: '14px', color: '#7f8c8d' }}>
          Only English pages (/hc/en-us) will be audited. Other languages will be ignored.
        </p>
        <p style={{ fontSize: '14px', color: '#7f8c8d' }}>
          You will manually enter the 2FA code during the login process.
        </p>

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
          onClick={handleLogin}
          disabled={
            !loginId.trim() ||
            !password.trim() ||
            !loadingTime ||
            !Number.isInteger(parseFloat(loadingTime)) ||
            parseInt(loadingTime) <= 0
          }
        >
          Start Zendesk Login
        </button>
        <div className="page-spacer"></div>
      </VStack>
    );
  }
);
ReadyScreen.displayName = 'ReadyScreen';

const ZendeskLogin = () => {
  const [runningStatus, setRunningStatus] = useState("ready");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [titleHeader, setTitleHeader] = useState("Zendesk Login");
  const [isViewingError, setIsViewingError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isViewingAudit, setIsViewingAudit] = useState('yes');
  const [loadingTime, setLoadingTime] = useState("30");
  const [resultMessage, setResultMessage] = useState("");

  const handleCancelLogin = async () => {
    try {
      await window.electronAPI.cancelAudit();
      setRunningStatus("cancelled");
      setTitleHeader("Login Cancelled");
      setErrorMessage("Login process was cancelled by the user.");
    } catch (err) {
      console.error("Cancel login failed:", err);
    }
  };

  const handleLogin = async () => {
    setRunningStatus("running");
    setTitleHeader("Logging into Zendesk...");

    try {
      const result = await window.electronAPI.zendeskLogin(
        loginId,
        password,
        isViewingAudit,
        loadingTime
      );

      if (result && result.success) {
        const message = result.message || "Login completed successfully";
        const pagesInfo = result.totalPagesAudited
          ? `\n\nTotal pages audited: ${result.totalPagesAudited}\nAll audit results saved to: audits/custom-audit-results/`
          : "";
        setResultMessage(message + pagesInfo);
        setRunningStatus("finished");
        setTitleHeader("Login and Crawl Successful");
      } else if (result && result.error) {
        throw new Error(result.error);
      } else {
        throw new Error("Unknown error occurred during login");
      }
    } catch (err) {
      console.error("handleLogin failed:", err);

      if (err.message === "Login cancelled by user") {
        setRunningStatus("cancelled");
        setTitleHeader("Login Cancelled");
        setErrorMessage("Login was cancelled by the user.");
      } else {
        setRunningStatus("error");
        setTitleHeader("Login Error");
        setErrorMessage(err.errorDetails || {
          error: err.message,
          errorLocation: 'ZendeskLogin.jsx - handleLogin',
          stack: err.stack,
          friendlyMessage: 'Failed to complete Zendesk login',
          suggestion: 'Check your credentials and timeout settings, then try again'
        });
      }
    }
  };

  const handleRunAgain = () => {
    setTitleHeader("Zendesk Login");
    setIsViewingError(false);
    setRunningStatus("ready");
    setLoginId("");
    setPassword("");
    setErrorMessage("");
    setResultMessage("");
  };

  const RunningScreen = () => (
    <VStack {...BodyVstackCss}>
      <h2>Logging into Zendesk and Crawling Site...</h2>
      <p>
        The login credentials are being entered. After clicking "Sign in", you will have
        <strong> up to 20 seconds to manually enter your two-factor authentication code</strong> in
        the browser window.
      </p>
      <p>
        Once logged in, the system will automatically:
      </p>
      <ul style={{ textAlign: 'left', maxWidth: '600px', margin: '0 auto' }}>
        <li>Run a Lighthouse accessibility audit on the initial page</li>
        <li>Discover all English links within articles.familysearch.com/hc/en-us</li>
        <li>Navigate to each discovered English page (up to 5 levels deep)</li>
        <li>Run accessibility audits on each page</li>
        <li>Save all results to audits/custom-audit-results/</li>
      </ul>
      <p style={{ color: '#e67e22', fontWeight: 'bold' }}>
        This process may take several minutes depending on site size. Please be patient and do not close the browser window.
      </p>
      <button
        className="btn btn-main"
        onClick={handleCancelLogin}
      >
        Cancel Process
      </button>
    </VStack>
  );

  const FinishedScreen = () => (
    <VStack {...BodyVstackCss}>
      <div>
        <h2 className="auditOne-finished">
          Successfully Logged Into Zendesk and Completed Site Crawl
        </h2>
        <h3 className="auditOne-finished">articles.familysearch.com</h3>
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
      <p style={{ color: '#27ae60', fontWeight: 'bold' }}>
        All accessibility audits have been saved to: audits/custom-audit-results/
      </p>
      <HStack {...BodyHstackCss}>
        <LinkButton
          destination="../../lists-menu/view-custom-audits"
          buttonText="View Audit Results"
          buttonClass="btn btn-main"
        />
        <button className="btn btn-main" onClick={handleRunAgain}>
          Run Another Crawl
        </button>
      </HStack>
    </VStack>
  );

  const ErrorScreen = () => {
    // Parse error object if it's a JSON string
    let errorObj = errorMessage;
    if (typeof errorMessage === 'string') {
      try {
        errorObj = JSON.parse(errorMessage);
      } catch {
        errorObj = { error: errorMessage };
      }
    }

    const friendlyMessage = errorObj.friendlyMessage || "Login failed to complete";
    const suggestion = errorObj.suggestion || "Please try again";
    const errorLocation = errorObj.errorLocation || errorObj.previousLocation || "Unknown location";
    const technicalError = errorObj.error || errorMessage;
    const stackTrace = errorObj.stack || "No stack trace available";

    const detailedError = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

URL: articles.familysearch.com
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
        <h3>Login failed for articles.familysearch.com</h3>
        <h4 style={{ color: '#e53e3e', fontWeight: 'bold' }}>{friendlyMessage}</h4>
        <p style={{ maxWidth: '600px', textAlign: 'center' }}>{suggestion}</p>
        <button
          className="btn btn-small"
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
      <h3 className="auditOne-finished">Login Cancelled for articles.familysearch.com</h3>
      <h4 className="auditOne-finished">{errorMessage}</h4>
      <button className="btn btn-main" onClick={handleRunAgain}>
        Try Again
      </button>
    </VStack>
  );

  return (
    <VStack {...CenteredVstackCss}>
      <MenuHeader title={titleHeader} handleBackButton={handleCancelLogin} />
      {runningStatus === "ready" && (
        <ReadyScreen
          loginId={loginId}
          setLoginId={setLoginId}
          password={password}
          setPassword={setPassword}
          isViewingAudit={isViewingAudit}
          setIsViewingAudit={setIsViewingAudit}
          loadingTime={loadingTime}
          setLoadingTime={setLoadingTime}
          handleLogin={handleLogin}
        />
      )}
      {runningStatus === "running" && <RunningScreen />}
      {runningStatus === "finished" && <FinishedScreen />}
      {runningStatus === "error" && <ErrorScreen />}
      {runningStatus === "cancelled" && <CancelledScreen />}
    </VStack>
  );
};

export default ZendeskLogin;
