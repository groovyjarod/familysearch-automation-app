import React from 'react'
import { VStack } from '@chakra-ui/react'
import CenteredVstackCss from '../reusables/CenteredVstackCss'
import MenuHeader from '../reusables/MenuHeader'
import BodyVstackCss from '../reusables/BodyVstackCss'
import DisplayZendeskPaths from '../Page_Logic/DisplayZendeskPaths'

const ListZendeskPaths = () => {
    return (
        <VStack {...CenteredVstackCss}>
            <MenuHeader title="Zendesk Scraped Paths" />
            <VStack {...CenteredVstackCss}>
                <VStack {...BodyVstackCss}>
                    <DisplayZendeskPaths />
                </VStack>
            </VStack>
        </VStack>
    )
}

export default ListZendeskPaths