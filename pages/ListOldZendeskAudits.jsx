import React from 'react'
import { VStack } from '@chakra-ui/react'
import CenteredVstackCss from '../reusables/CenteredVstackCss'
import MenuHeader from '../reusables/MenuHeader'
import BodyVstackCss from '../reusables/BodyVstackCss'
import DisplayOldZendeskAudits from '../Page_Logic/DisplayOldZendeskAudits'

const ListOldZendeskAudits = () => {
    return (
        <VStack {...CenteredVstackCss}>
            <MenuHeader title="Old Zendesk Audit Results" />
            <VStack {...CenteredVstackCss}>
                <VStack {...BodyVstackCss}>
                    <DisplayOldZendeskAudits />
                </VStack>
            </VStack>
        </VStack>
    )
}

export default ListOldZendeskAudits