import React from 'react'
import { VStack, HStack } from '@chakra-ui/react'
import CenteredHstackCss from '../reusables/CenteredHstackCss'
import CenteredVstackCss from '../reusables/CenteredVstackCss'
import MenuHeader from '../reusables/MenuHeader'
import LinkButton from '../reusables/LinkButton'

const ListMenu = () => {
  return (
    <VStack {...CenteredVstackCss}>
        <MenuHeader title="View Lists" subTitle="Created for FamilySearch" />
        <div className="page-spacer"></div>
        <h2>List Options</h2>
        <HStack {...CenteredHstackCss}>
            <LinkButton destination="./view-audits" buttonText="View Audits" buttonClass="btn btn-menu btn-view" />
            <LinkButton destination="./view-old-audits" buttonText="View Old Audits" buttonClass="btn btn-menu btn-view" />
            <LinkButton destination="./view-custom-audits" buttonText="View Custom Audits" buttonClass="btn btn-menu btn-view" />
        </HStack>
    </VStack>
  )
}

export default ListMenu