import React from 'react'
import { VStack, HStack } from '@chakra-ui/react'
import CenteredHstackCss from '../reusables/CenteredHstackCss'
import CenteredVstackCss from '../reusables/CenteredVstackCss'
import MenuHeader from '../reusables/MenuHeader'
import LinkButton from '../reusables/LinkButton'

const ListMenu = () => {
  return (
    <VStack {...CenteredVstackCss}>
        <MenuHeader title="View Audit Folders" subTitle="Created for FamilySearch" />
        <div className="page-spacer"></div>
        <h2>Choose a folder to view your Audits:</h2>
        <HStack {...CenteredHstackCss}>
            <LinkButton destination="./view-audits" buttonText="Listed Audits" buttonClass="btn btn-menu btn-view" />
            <LinkButton destination="./view-old-audits" buttonText="Old Audits" buttonClass="btn btn-menu btn-view" />
            <LinkButton destination="./view-custom-audits" buttonText="Single Audits" buttonClass="btn btn-menu btn-view" />
        </HStack>
    </VStack>
  )
}

export default ListMenu