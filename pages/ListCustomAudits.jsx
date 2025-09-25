import React from 'react'
import { VStack } from '@chakra-ui/react'
import CenteredVstackCss from '../reusables/CenteredVstackCss'
import MenuHeader from '../reusables/MenuHeader'
import BodyVstackCss from '../reusables/BodyVstackCss'
import DisplayCustomAudits from '../Page_Logic/DisplayCustomAudits'

const ListCustomAudits = () => {
    return (
        <VStack {...CenteredVstackCss}>
            <MenuHeader title="Custom Audits" />
            <VStack {...CenteredVstackCss}>
                <VStack {...BodyVstackCss}>
                    <DisplayCustomAudits />
                </VStack>
            </VStack>
        </VStack>
    )
}

export default ListCustomAudits