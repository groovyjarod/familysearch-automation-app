import React from 'react'
import { VStack } from '@chakra-ui/react'
import CenteredVstackCss from '../reusables/CenteredVstackCss'
import MenuHeader from '../reusables/MenuHeader'
import BodyVstackCss from '../reusables/BodyVstackCss'
import DisplayZendeskAudits from '../Page_Logic/DisplayZendeskAudits'

const ListZendeskAudits = () => {
    return (
        <VStack {...CenteredVstackCss}>
            <MenuHeader title="Zendesk Audit Results" />
            <VStack {...CenteredVstackCss}>
                <VStack {...BodyVstackCss}>
                    <DisplayZendeskAudits />
                </VStack>
            </VStack>
        </VStack>
    )
}

export default ListZendeskAudits