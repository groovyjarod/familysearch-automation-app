import React from 'react'
import { VStack, HStack, Menu } from '@chakra-ui/react'
import CenteredHstackCss from '../reusables/CenteredHstackCss'
import CenteredVstackCss from '../reusables/CenteredVstackCss'
import MenuHeader from '../reusables/MenuHeader'
import LinkButton from '../reusables/LinkButton'
import BodyVstackCss from '../reusables/BodyVstackCss'
import DisplayOldAuditResults from '../Page_Logic/DisplayOldAuditResults'

const ListOldAudits = () => {
  return (
    <VStack {...CenteredVstackCss}>
        <MenuHeader title="Old Audits" />
        <VStack {...CenteredVstackCss}>
          <VStack {...BodyVstackCss}>
            <DisplayOldAuditResults />
          </VStack>
        </VStack>
    </VStack>
  )
}

export default ListOldAudits