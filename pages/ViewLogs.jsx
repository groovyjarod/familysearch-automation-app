import React, { useEffect, useState } from 'react'
import { VStack, HStack, Select } from '@chakra-ui/react'
import CenteredHstackCss from '../reusables/CenteredHstackCss'
import CenteredVstackCss from '../reusables/CenteredVstackCss'
import MenuHeader from '../reusables/MenuHeader'
import BodyVstackCss from '../reusables/BodyVstackCss'

const ViewLogs = () => {
  const [logContent, setLogContent] = useState('Loading logs...')
  const [logFiles, setLogFiles] = useState([])
  const [selectedLogFile, setSelectedLogFile] = useState('')
  const [logFilePath, setLogFilePath] = useState('')
  const [isAutoScroll, setIsAutoScroll] = useState(true)
  const logDisplayRef = React.useRef(null)

  const loadCurrentLog = async () => {
    try {
      const result = await window.electronAPI.readLogFile()
      if (result.success) {
        setLogContent(result.content || 'No logs yet.')
        if (isAutoScroll && logDisplayRef.current) {
          logDisplayRef.current.scrollTop = logDisplayRef.current.scrollHeight
        }
      } else {
        setLogContent(`Error loading logs: ${result.error}`)
      }
    } catch (err) {
      setLogContent(`Failed to load logs: ${err.message}`)
    }
  }

  const loadSpecificLog = async (filename) => {
    try {
      const result = await window.electronAPI.readSpecificLogFile(filename)
      if (result.success) {
        setLogContent(result.content || 'No logs in this file.')
        if (isAutoScroll && logDisplayRef.current) {
          logDisplayRef.current.scrollTop = logDisplayRef.current.scrollHeight
        }
      } else {
        setLogContent(`Error loading log file: ${result.error}`)
      }
    } catch (err) {
      setLogContent(`Failed to load log file: ${err.message}`)
    }
  }

  const loadAvailableLogFiles = async () => {
    try {
      const result = await window.electronAPI.getAllLogFiles()
      if (result.success) {
        setLogFiles(result.files || [])
        if (result.files && result.files.length > 0) {
          setSelectedLogFile(result.files[0]) // Select most recent by default
        }
      }
    } catch (err) {
      console.error('Failed to load log files:', err)
    }
  }

  const handleRefresh = () => {
    if (selectedLogFile) {
      loadSpecificLog(selectedLogFile)
    } else {
      loadCurrentLog()
    }
  }

  const handleLogFileChange = (e) => {
    const filename = e.target.value
    setSelectedLogFile(filename)
    if (filename) {
      loadSpecificLog(filename)
    }
  }

  useEffect(() => {
    // Load current log path and available files on mount
    window.electronAPI.getLogFilePath().then(setLogFilePath)
    loadAvailableLogFiles()
    loadCurrentLog()

    // Auto-refresh every 5 seconds when viewing current log
    const interval = setInterval(() => {
      if (!selectedLogFile || selectedLogFile === logFiles[0]) {
        loadCurrentLog()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [selectedLogFile, logFiles])

  return (
    <VStack {...CenteredVstackCss}>
      <MenuHeader title="Application Logs" subTitle="View console output" />
      <HStack {...CenteredHstackCss}>
        <VStack {...BodyVstackCss} width="90%">
          <HStack width="100%" justifyContent="space-between" marginBottom="10px">
            <VStack alignItems="flex-start" gap="5px">
              <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Select Log File:</label>
              <Select
                value={selectedLogFile}
                onChange={handleLogFileChange}
                size="sm"
                width="300px"
              >
                {logFiles.map((file) => (
                  <option key={file} value={file}>
                    {file}
                  </option>
                ))}
              </Select>
            </VStack>
            <VStack alignItems="flex-end" gap="5px">
              <label style={{ fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={isAutoScroll}
                  onChange={(e) => setIsAutoScroll(e.target.checked)}
                  style={{ marginRight: '5px' }}
                />
                Auto-scroll to bottom
              </label>
              <button className='btn btn-small' onClick={handleRefresh}>
                Refresh Logs
              </button>
            </VStack>
          </HStack>

          <div
            ref={logDisplayRef}
            style={{
              width: '100%',
              height: '500px',
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '12px',
              padding: '15px',
              overflowY: 'auto',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              border: '1px solid #444',
              borderRadius: '4px',
            }}
          >
            {logContent}
          </div>

          <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
            Log file location: {logFilePath || 'Not initialized'}
          </p>
          <p style={{ fontSize: '11px', color: '#888' }}>
            Logs auto-refresh every 5 seconds. Files are rotated weekly and last 5 weeks are kept.
          </p>
        </VStack>
      </HStack>
    </VStack>
  )
}

export default ViewLogs
