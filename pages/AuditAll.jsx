import React, { useEffect, useState, useRef, memo } from "react";
import { VStack, HStack, Text, Input } from "@chakra-ui/react";
import CenteredHstackCss from "../reusables/CenteredHstackCss";
import CenteredVstackCss from "../reusables/CenteredVstackCss";
import BodyHstackCss from "../reusables/BodyHstackCss";
import BodyVstackCss from "../reusables/BodyVstackCss";
import AuditVstackCss from "../reusables/AuditVstackCss";
import MenuHeader from "../reusables/MenuHeader";
import LinkButton from "../reusables/LinkButton";
import pLimit from "p-limit";
import runAllTypesAudit from "../reusables/RunAllTypesAudit";
import getLastPathSegment from "../reusables/getLastPathSegment";

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

const ReadyScreen = memo(({
  inputNumber,
  setInputNumber,
  recommendedAudits,
  testingMethod,
  setTestingMethod,
  isUsingUserAgent,
  setIsUsingUserAgent,
  loadingTime,
  setLoadingTime,
  commenceAllAudits,
  wikiPaths
}) => {

  return (
    <VStack {...BodyVstackCss}>
      <HStack width="100%" justifyContent="space-between">
        <h2>Pulling paths from wikiPaths.txt</h2>
        <LinkButton
          destination="../../files-menu"
          buttonText="Edit Wiki Paths"
          buttonClass="btn btn-small"
        />
      </HStack>
      <Text maxW="80%">
        Based on your computer's available memory, the recommended limit for
        concurrent tests is:
      </Text>
      <h1>{recommendedAudits}.</h1>
      <Text>How many tests would you like to run concurrently?</Text>
      <NumberInput valueVariable={testingMethod === 'all' ? 1 : inputNumber} setValueVariable={setInputNumber} disabled={testingMethod === 'all'} />
      <h2>Choose Testing Method</h2>
      <p>Choose which format the page will load to accommodate your auditing needs. All Sizes will render 4 instances of the webpage with 4 different width sizes.</p>
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
              setInputNumber(1)
            }}
          />
          <label htmlFor="mobile">All Sizes</label>
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
            <label htmlFor="desktop">Use Key</label>
          </HStack>
          <HStack {...BodyHstackCss}>
            <input
              type="radio"
              name="isUsingUserAgent"
              value="no"
              checked={isUsingUserAgent === "no"}
              onChange={() => setIsUsingUserAgent("no")}
            />
            <label htmlFor="mobile">Don't Use Key</label>
          </HStack>
        </HStack>
      <h2>Timeout for Tests?</h2>
      <p>Determine how many seconds each audit will be allotted to complete. Aim for about 15 to 25 seconds for best results.</p>
      <NumberInput valueVariable={loadingTime} setValueVariable={setLoadingTime} disabled={false} />
      <div className="page-spacer"></div>
      <button
        className="btn btn-main"
        onClick={commenceAllAudits}
        disabled={
          !wikiPaths.length ||
          !inputNumber ||
          !loadingTime ||
          parseInt(inputNumber) <= 0 ||
          parseInt(loadingTime) <= 0 ||
          !Number.isInteger(parseFloat(inputNumber)) ||
          !Number.isInteger(parseFloat(loadingTime))
        }
      >
        Start All Audits
      </button>
      <div className="page-spacer"></div>
    </VStack>
  );
});

const AuditAll = () => {
  const [recommendedAudits, setRecommendedAudits] = useState(0);
  const [userAgent, setUserAgent] = useState("");
  const [initialUrl, setInitialUrl] = useState("");
  const [wikiPaths, setWikiPaths] = useState([]);
  const [inputNumber, setInputNumber] = useState(0);
  const [testingMethod, setTestingMethod] = useState("desktop");
  const [runningStatus, setRunningStatus] = useState("ready");
  const [isUsingUserAgent, setIsUsingUserAgent] = useState("yes");
  const [activePaths, setActivePaths] = useState([]);
  const [successfulAudits, setSuccessfulAudits] = useState([]);
  const [failedAudits, setFailedAudits] = useState([]);
  const [isCancelled, setIsCancelled] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [loadingTime, setLoadingTime] = useState("15")
  const isCancelledRef = useRef(isCancelled)

  useEffect(() => {
    window.electronAPI.accessOsData().then(setRecommendedAudits).catch(console.error);
    window.electronAPI.getWikiPathsData().then(setWikiPaths).catch(console.error);
    window.electronAPI.getFile('./settings/secretUserAgent.txt').then(setUserAgent).catch(console.error);
    window.electronAPI.getFile('./settings/initialUrl.txt').then(setInitialUrl).catch(console.error);
  }, []);

  useEffect(() => {
    isCancelledRef.current = isCancelled
  }, [isCancelled])

  const addItem = (newItem) => setActivePaths((prev) => prev.includes(newItem) ? prev : [...prev, newItem]);
  const removeItem = (itemToRemove) => setActivePaths((prev) => prev.filter((item) => item !== itemToRemove));

  const retryAudit = async (fn, retries = 2) => {
    for (let i = 0; i < retries; i++) {
      if (isCancelledRef.current) throw new Error("Audit cancelled by user.");
      try {
        setRunningStatus("running")
        const result = await fn();
        return result;
      } catch (err) {
        if (isCancelledRef.current) throw new Error("Audit cancelled by user.");
        setRunningStatus("warning")
        console.warn(`Retry ${i + 1} failed. Trying again...`, err);
        if (i < retries - 1) {
          if (!isCancelledRef.current) {
            setRunningStatus("warning");
          } else {
            console.log('Retry skipped due to cancellation.');
            setRunningStatus("cancelled")
            throw new Error("Audit cancelled by user.");
          }
        } else {
          console.log('Retries exhausted.');
          throw err;
        }
      }
    }
  };

  const handleCancelAudit = async () => {
    setIsCancelled(true);
    setRunningStatus("cancelled");
    setErrorMessage("Audits were cancelled by the user.");
    await window.electronAPI.cancelAudit().catch((err) => {
      console.error('Failed to cancel audits:', err);
    });
    await window.electronAPI.clearAllSizedAuditsFolder().catch((err) => {
      console.warn('Failed to clean up temporary files:', err);
    });
  };

  const commenceEachAllTypeAudit = async () => {
    const numberOfConcurrentAudits = pLimit(1)
    setRunningStatus("running")
    setIsCancelled(false)
    const tasks = wikiPaths.map((wikiPath) => {
      const fullUrl = `${initialUrl}${wikiPath}`
      window.scrollTo(0, 0)

      return numberOfConcurrentAudits(async () => {
        if (isCancelledRef.current) {
          console.log(`commenceEachAllTypeAudit: isCancelled check worked.`)
          throw new Error("Audit cancelled by user.")
        }
        try {
          addItem(fullUrl)
          const result = await runAllTypesAudit(
            fullUrl,
            userAgent,
            pLimit,
            getLastPathSegment,
            'audit-results',
            isCancelledRef.current,
            setRunningStatus,
            isUsingUserAgent
          )
          console.log(result)
          setSuccessfulAudits((prev) => [...prev, fullUrl])
        } catch (err) {
          if (err.message === "Audit cancelled by user.") {
            console.log('Cancellation caught.')
          } else {
            console.error(`Concurrent all type audit failed: ${err}`)
            setFailedAudits((prev) => [...prev, fullUrl])
          }
        } finally {
          removeItem(fullUrl)
        }
      })
    })

    await Promise.all(tasks)
    if (!isCancelledRef.current) setRunningStatus("finished")
  }

  const commenceAllAudits = async () => {
    const numberOfConcurrentAudits = pLimit(parseInt(inputNumber) || 1);
    setRunningStatus("running");
    setIsCancelled(false)
    const tasks = wikiPaths.map((wikiPath, index) => {
      const fullUrl = `${initialUrl}${wikiPath}`;
      const outputType = testingMethod === "desktop" ? "desk" : "mobile";
      const outputDirPath = 'audit-results'
      const outputFilePath = `${index + 1}-${outputType}-${wikiPath}.json`;
      const processId = `audit-${Date.now()}-${index}`
      const isViewingAudit = "no";
      return numberOfConcurrentAudits(() =>
        retryAudit(async () => {
          if (isCancelledRef.current) {
            console.log('In commenceAllAudits: isCancelled check worked.')
            throw new Error("Audit cancelled by user.")
          }
          setIsCancelled(false)
          try {
            addItem(fullUrl);
            const result = await window.electronAPI.getSpawn(
              fullUrl,
              outputDirPath,
              outputFilePath,
              testingMethod,
              userAgent,
              testingMethod === 'desktop' ? 1920 : 500,
              processId,
              isUsingUserAgent,
              isViewingAudit,
              loadingTime
            );
            console.log(result)
            if (typeof result === "string" && result.includes("Audit complete, report written successfully")) {
              setSuccessfulAudits((prev) => [...prev, fullUrl])
            } else if (typeof result === "string" && result.includes("Audit incomplete")) {
              setFailedAudits((prev) => [...prev, fullUrl]);
            } else if (typeof result === "object" && Object.values(result).every(r => r.accessibilityScore > 0)) {
              setSuccessfulAudits((prev) => [...prev, fullUrl])
            } else {
              setFailedAudits((prev) => [...prev, fullUrl]);
            }
          } catch (err) {
            if (err.message === "Audit cancelled by user.") {
              console.log('Cancellation caught in commenceAllAudits.')
            } else {
              console.error(`Audit for ${fullUrl} failed:`, err);
              setFailedAudits((prev) => [...prev, fullUrl])
            }
            throw err;
          } finally {
            removeItem(fullUrl);
          }
        })
      );
    });

    await Promise.all(tasks);
    if (!isCancelledRef.current) {
      console.log("AuditAll.jsx: All Audits complete!");
      setRunningStatus("finished");
    }
  };

  const handleReset = () => {
    setSuccessfulAudits([])
    setFailedAudits([])
    setRunningStatus("ready")
  }

  const RunningScreen = () => (
    <VStack {...BodyVstackCss}>
      {activePaths.map((path, index) => (
        <VStack
          key={index}
          {...AuditVstackCss}
          gap="0px"
          className="scroll-hidden"
        >
          <h3 style={{ margin: "0px" }}>Now auditing:</h3>
          <p style={{ margin: "0px" }}>{path}</p>
        </VStack>
      ))}
      <button className="btn btn-main" onClick={handleCancelAudit}>Cancel Audits</button>
      <div className="page-spacer"></div>
    </VStack>
  );

  const FinishedScreen = () => (
    <VStack {...BodyVstackCss}>
      <h2>All audits finished.</h2>
      <h3>{successfulAudits.length} audits successfully written, {failedAudits.length} audits failed:</h3>
      {failedAudits.map((audit, index) => (
        <VStack
          key={index}
          {...BodyVstackCss}
          gap="0px"
          className="scroll-hidden"
        >
          <p>{audit}</p>
        </VStack>
      ))}
      <button className="btn btn-main" onClick={() => handleReset()}>
        Run Again
      </button>
      <LinkButton
        buttonClass="btn btn-main"
        buttonText="Go To File"
        destination="../../lists-menu/view-audits"
      />
      <div className="page-spacer"></div>
    </VStack>
  );

  const WarningScreen = () => (
    <VStack {...BodyVstackCss}>
      <h2>Continuing audit...</h2>
      <p>Attempting to reconnect to webpage after previous attempt failed.</p>
      <p>Trying again...</p>
      <button
        className="btn btn-main"
        onClick={handleCancelAudit}
      >
        Cancel Audit
      </button>
    </VStack>
  )

  const CancelledScreen = () => (
    <VStack {...BodyVstackCss}>
      <h3>Audits cancelled.</h3>
      <h4>{errorMessage}</h4>
      <button className="btn btn-main" onClick={() => handleReset()}>Run Again</button>
    </VStack>
  )

  const ErrorScreen = () => (
    <VStack {...BodyVstackCss}>
      <p>Error</p>
      <button className="btn btn-main" onClick={() => setRunningStatus("ready")}>
        Reset
      </button>
    </VStack>
  );

  return (
    <VStack {...CenteredVstackCss}>
      <MenuHeader title="Audit All Pages" handleBackButton={handleCancelAudit} />
      {runningStatus === "ready" && (
        <ReadyScreen
          inputNumber={inputNumber}
          setInputNumber={setInputNumber}
          recommendedAudits={recommendedAudits}
          testingMethod={testingMethod}
          setTestingMethod={setTestingMethod}
          isUsingUserAgent={isUsingUserAgent}
          setIsUsingUserAgent={setIsUsingUserAgent}
          loadingTime={loadingTime}
          setLoadingTime={setLoadingTime}
          commenceAllAudits={testingMethod === 'all' ? commenceEachAllTypeAudit : commenceAllAudits}
          wikiPaths={wikiPaths}
        />
      )}
      {runningStatus === "running" && <RunningScreen />}
      {runningStatus === "finished" && <FinishedScreen />}
      {runningStatus === "warning" && <WarningScreen />}
      {runningStatus === "cancelled" && <CancelledScreen />}
      {runningStatus === "error" && <ErrorScreen />}
    </VStack>
  );
};

export default AuditAll;