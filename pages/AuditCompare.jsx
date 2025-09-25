import React from 'react'
import { VStack, HStack, Menu } from '@chakra-ui/react'
import CenteredHstackCss from '../reusables/CenteredHstackCss'
import CenteredVstackCss from '../reusables/CenteredVstackCss'
import MenuHeader from '../reusables/MenuHeader'
import LinkButton from '../reusables/LinkButton'

const AuditCompare = () => {
  return (
    <VStack {...CenteredVstackCss}>
        <MenuHeader title="Compare Audits" />
    </VStack>
  )
}

export default AuditCompare