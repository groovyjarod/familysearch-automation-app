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
  isConcise,
  setIsConcise,
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
      <Text maxW="80%" fontStyle='italic'>
        Note: Audits per each url path may fail at a higher rate if this is the first session of running audits.<br/>
        If the result shows that audits failed during the run, it is recommended to first reduce the concurrency number for audits, then increase the concurrency number once audits start passing.
      </Text>
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
        <p>Grants access to sites that use Inverna blockers. Only use for sites you're authorized to.</p>
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
        <h2>How detailed would you like your Report?</h2>
        <p>Choose between a detailed JSON report that shows coordinates for every instance of an issue, or a consolidated report that just shows the overall problems.</p>
        <HStack {...CenteredHstackCss}>
          <HStack {...BodyHstackCss}>
            <input
              type="radio"
              name="isConcise"
              value="no"
              checked={isConcise === "no"}
              onChange={() => setIsConcise("no")}
            />
            <label htmlFor="desktop">Full JSON Report</label>
          </HStack>
          <HStack {...BodyHstackCss}>
            <input
              type="radio"
              name="isConcise"
              value="yes"
              checked={isConcise === "yes"}
              onChange={() => setIsConcise("yes")}
            />
            <label htmlFor="mobile">Concise JSON Report</label>
          </HStack>
        </HStack>
      <div className="page-spacer"></div>
      <button
        className="btn btn-main"
        onClick={() => commenceAllAudits(wikiPaths)}
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
  const [isConcise, setIsConcise] = useState("no");
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
    const pathsToUse = failedAudits.length > 0 ? failedAudits : wikiPaths
    setFailedAudits([])
    const tasks = pathsToUse.map((wikiPath) => {
      const fullUrl = `${initialUrl}${wikiPath}`
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth'})
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
            isUsingUserAgent,
            isConcise
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

  const commenceAllAudits = async (pathList) => {
    const numberOfConcurrentAudits = pLimit(parseInt(inputNumber) || 1);
    setRunningStatus("running");
    setIsCancelled(false)
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    setFailedAudits([])
    const tasks = pathList.map((wikiPath, index) => {
      const conciseTag = isConcise === "yes" ? "concise" : "full"
      const fullUrl = `${initialUrl}${wikiPath}`;
      const outputDirPath = 'audit-results'
      const outputFilePath = `${index + 1}-${testingMethod}-${conciseTag}-${wikiPath}.json`;
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
              loadingTime,
              isConcise
            );
            if (typeof result === "object" && result.accessibilityScore > 0) {
              setSuccessfulAudits((prev) => [...prev, fullUrl])
              return
            } else if (typeof result === "object" && Object.values(result).every(r => r && r.accessibilityScore > 0)) {
              setSuccessfulAudits((prev) => [...prev, fullUrl])
              return
            } else {
              const score = result?.accessibilityScore ?? 'unknown';
              const errorMsg = result?.error || 'Unknown error';
              throw new Error(`Audit failed for ${fullUrl}: score=${score}, error=${errorMsg}`);
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
    window.electronAPI.getWikiPathsData().then(setWikiPaths).catch(console.error);
  }

  const handleUpdateConcurrency = () => {
    setSuccessfulAudits(() => [])
    setFailedAudits(() => [])
    const newAudits = []
    for (const audit of failedAudits) newAudits.push(getLastPathSegment(audit))
    setWikiPaths(newAudits)
    setRunningStatus("ready")
  }

  const handleRunFailedTests = (commenceRerunByType) => {
    const newAudits = []
    for (const audit of failedAudits) newAudits.push(getLastPathSegment(audit))
    setSuccessfulAudits(() => [])
    commenceRerunByType(newAudits)
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

  const FinishedScreen = ({ commenceRerunByType }) => (
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
      {failedAudits.length >= 3 && (
        <Text maxW='80%' fontWeight='650' fontStyle='italic'>
          To reduce fail rates of these audits, consider decreasing the concurrency number, 
          increasing the timeout timer, and check your paths to ensure they match the 
          correct url.
        </Text>
      )}
      <HStack {...BodyHstackCss}>
        {failedAudits.length > 0 && <button className="btn btn-main" onClick={() => handleRunFailedTests(commenceRerunByType)}> Run All Failed Tests</button>}
        <button className="btn btn-main" onClick={() => handleReset()}>
          Configure New Audit Set
        </button>
      </HStack>
      <HStack {...BodyHstackCss}>
        {failedAudits.length > 0 && <button className="btn btn-main" onClick={() => handleUpdateConcurrency()}>Update Concurrency</button>}
        <LinkButton
          buttonClass="btn btn-main"
          buttonText="Go To File"
          destination="../../lists-menu/view-audits"
        />
      </HStack>
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
      <h4 className="auditOne-finished">{errorMessage}</h4>
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
          isConcise={isConcise}
          setIsConcise={setIsConcise}
          loadingTime={loadingTime}
          setLoadingTime={setLoadingTime}
          commenceAllAudits={testingMethod === 'all' ? (pathList) => commenceEachAllTypeAudit(pathList) : (pathList) => commenceAllAudits(pathList)}
          wikiPaths={wikiPaths}
        />
      )}
      {runningStatus === "running" && <RunningScreen />}
      {runningStatus === "finished" && <FinishedScreen
        commenceRerunByType={testingMethod === 'all' ? (newPaths) => commenceEachAllTypeAudit(newPaths) : (newPaths) => commenceAllAudits(newPaths)}
      />}
      {runningStatus === "warning" && <WarningScreen />}
      {runningStatus === "cancelled" && <CancelledScreen />}
      {runningStatus === "error" && <ErrorScreen />}
    </VStack>
  );
};

export default AuditAll;