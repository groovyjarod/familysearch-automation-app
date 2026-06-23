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
      <MenuHeader title="Conduct an Audit" subTitle={`Version ${version}`} />
      <div className="page-spacer"></div>
      <h2>Choose which type of audit process to commence:</h2>
      <div className="page-spacer"></div>
      <HStack {...CenteredHstackCss}>
        <LinkButton destination="./test-all" buttonText="Audit All Listed Pages" buttonClass="btn btn-menu btn-audit" />
        <LinkButton destination="./test-single" buttonText="Audit One Webpage" buttonClass="btn btn-menu btn-audit" />
      </HStack>
      <HStack {...CenteredHstackCss}>
        <LinkButton destination="./zendesk-menu" buttonText="Audit Zendesk Pages" buttonClass="btn btn-menu btn-audit" />
        <LinkButton destination="./test-transfer" buttonText="Transfer Old Audits" buttonClass="btn btn-menu btn-audit" />
      </HStack>

    </VStack>
  )
}

export default AuditMenu