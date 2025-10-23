import React, { useState, useEffect } from 'react'
import { Button, Menu, VStack, HStack } from '@chakra-ui/react'
import BodyVstackCss from '../reusables/BodyVstackCss'
import BodyHstackCss from '../reusables/BodyHstackCss'
import MenuHeader from '../reusables/MenuHeader'

const ExtensionInfo = () => {
    const [version, setVersion] = useState("")
    useEffect(() => {
        window.electronAPI.getVersion().then(setVersion)
    }, [])
    return (
        <VStack {...BodyVstackCss}>
            <MenuHeader title="Download Extension" subTitle={`Version ${version}`} />
            <HStack {...BodyHstackCss}>
                <h1>Chrome Extension Tool</h1>
                <button className='btn btn-small btn-files' onClick={() => window.electronAPI.openChromeUrl('https://github.com/groovyjarod/Audit-Extension')}>Go to site →</button>
            </HStack>
            <h2>Visualize your audits' results on the webpage you audited.</h2>
            <h3>This extension takes the data generated from the .json files created from your audits, and displays the locations of Accessibility errors throughout the page.</h3>
            <h3>Refer to the README.md towards the bottom of the webpage for full instructions on installation and usage.</h3>
        </VStack>
    )
}

export default ExtensionInfo