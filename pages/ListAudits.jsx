import React from 'react'
import { VStack, HStack, Menu } from '@chakra-ui/react'
import CenteredHstackCss from '../reusables/CenteredHstackCss'
import CenteredVstackCss from '../reusables/CenteredVstackCss'
import BodyVstackCss from '../reusables/BodyVstackCss'
import MenuHeader from '../reusables/MenuHeader'
import LinkButton from '../reusables/LinkButton'

import DisplayAuditResults from '../Page_Logic/DisplayAuditResults'

const ListAudits = () => {
  return (
    <VStack {...CenteredVstackCss} alignItems="start">
        <MenuHeader title="Current Audits" />
        <VStack {...CenteredVstackCss}>
          <VStack {...BodyVstackCss}>
            <DisplayAuditResults />
          </VStack>
        </VStack>
    </VStack>
  )
}

export default ListAudits