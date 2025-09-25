import React, { useState, useEffect } from 'react'
import { VStack, HStack, Menu } from '@chakra-ui/react'
import CenteredHstackCss from '../reusables/CenteredHstackCss'
import CenteredVstackCss from '../reusables/CenteredVstackCss'
import MenuHeader from '../reusables/MenuHeader'
import LinkButton from '../reusables/LinkButton'
import BodyVstackCss from '../reusables/BodyVstackCss'

const AuditTransfer = () => {
  const [pageStatus, setPageStatus] = useState('ready')
  const [statusMessage, setStatusMessage] = useState('')

  const handleTransfer = async () => {
    try {
      const result = await window.electronAPI.moveAuditFiles()
      setPageStatus(result.success ? 'finished' : 'error')
      setStatusMessage(result.message)
    } catch (err) {
      console.error('In AuditTransfer: failed to transfer audits', err.message)
    }
  }

  const handleReset = () => {
    setPageStatus('ready')
    setStatusMessage('')
  }

  return (
    <VStack {...CenteredVstackCss}>
      <MenuHeader title="Transfer All Current Audits" />
      <VStack {...BodyVstackCss}
        display={pageStatus === "ready" ? "inherit" : "none"}
      >
        <h3>Move all audits from current audit results folder to old audit results?</h3>
        <h4><strong>This will delete all old audits and move all of your current audits to the Old Audits folder.</strong> Save your work if you need to before continuing.</h4>
        <h4>Please note that even if you have no current audits, clicking this button will still delete all old audits.</h4>
        <button className="btn btn-small" onClick={handleTransfer}>Transfer Audits</button>
      </VStack>
      <VStack {...BodyVstackCss}
        display={pageStatus === "finished" ? "inherit" : "none"}
      >
        <h3>{statusMessage}</h3>
        <LinkButton destination="../" buttonClass="btn btn-small" buttonText="Go Back" />
      </VStack>
      <VStack {...BodyVstackCss}
        display={pageStatus === "error" ? "inherit" : "none"}
      >
        <h3>An error has occurred with transferring files. Please try again.</h3>
        <LinkButton destination="../" buttonClass="btn btn-small" buttonText="Go Back" />
        <button className='btn btn-small' onClick={handleReset}>Try Again</button>
      </VStack>
    </VStack>
  )
}

export default AuditTransfer