import React, { useState, useEffect } from 'react'
import { VStack, HStack } from '@chakra-ui/react'
import CenteredVstackCss from '../reusables/CenteredVstackCss'
import CenteredHstackCss from '../reusables/CenteredHstackCss'
import MenuHeader from '../reusables/MenuHeader'
import LinkButton from '../reusables/LinkButton'

const AuditMenu = () => {
  const [version, setVersion] = useState('')
  useEffect(() => {
    window.electronAPI.getVersion().then(setVersion)
  }, [])
  return (
    <VStack {...CenteredVstackCss}>
      <MenuHeader title="Conduct an Audit" subTitle={`Version ${version}`} headerText="Choose from the options below which type of audit you would like to conduct." />
      <div className="page-spacer"></div>
      <h2>Audit Options</h2>
      <HStack {...CenteredHstackCss}>
        <LinkButton destination="./test-all" buttonText="Test All" buttonClass="btn btn-menu btn-audit" />
        <LinkButton destination="./test-single" buttonText="Test One" buttonClass="btn btn-menu btn-audit" />
        <LinkButton destination="./test-transfer" buttonText="Transfer Audits" buttonClass="btn btn-menu btn-audit" />
      </HStack>

    </VStack>
  )
}

export default AuditMenu