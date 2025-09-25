import React, { useEffect, useState } from 'react'
import { VStack, HStack, Menu } from '@chakra-ui/react'
import CenteredHstackCss from '../reusables/CenteredHstackCss'
import CenteredVstackCss from '../reusables/CenteredVstackCss'
import MenuHeader from '../reusables/MenuHeader'
import BodyVstackCss from '../reusables/BodyVstackCss'

const SettingsMenu = () => {

  const [wikiPaths, setWikiPaths] = useState([])
  const [userKey, setUserKey] = useState('')
  const [initialUrl, setInitialUrl] = useState('')

  const [wikiButtonText, setWikiButtonText] = useState('Save Changes')
  const [urlButtonText, setUrlButtonText] = useState('Save Changes')
  const [keyButtonText, setKeyButtonText] = useState('Save Changes')

  const handleChangeFile = async (newData, filePath, setButtonText) => {
    await window.electronAPI.replaceFile(newData, filePath)
    setButtonText('Saved!')
    setTimeout(() => {
      setButtonText('Save Changes')
    }, 500);
  }

  useEffect(() => {
    window.electronAPI.getWikiPathsData().then(setWikiPaths).catch(console.error)
    window.electronAPI.getFile('./settings/secretUserAgent.txt').then(setUserKey).catch(console.error)
    window.electronAPI.getFile('./settings/initialUrl.txt').then(setInitialUrl).catch(console.error)
  }, [])

  return (
    <VStack {...CenteredVstackCss}>
        <MenuHeader title="Settings" subTitle="Version 1.1.2" />
        <HStack {...CenteredHstackCss}>
          <VStack {...BodyVstackCss}>
            <h2>Change Paths</h2>
            <textarea className='input input-wiki-paths' type="text" value={wikiPaths.join("\n")} onChange={(e) => setWikiPaths(e.target.value.split("\n"))} />
            <button className='btn btn-small' onClick={() => handleChangeFile(wikiPaths, './settings/wikiPaths.txt', setWikiButtonText)}>{wikiButtonText}</button>
          </VStack>
          <VStack {...BodyVstackCss}>
              <h2>Change Initial URL</h2>
              <input className='input' type="text" value={initialUrl} onChange={(e) => setInitialUrl(e.target.value)} />
              <button className='btn btn-small' onClick={() => handleChangeFile(initialUrl, './settings/initialUrl.txt', setUrlButtonText)}>{urlButtonText}</button>
              <h2>Change Access Key</h2>
              <input className='input' type="text" value={userKey} onChange={(e) => setUserKey(e.target.value)} />
              <button className='btn btn-small' onClick={() => handleChangeFile(userKey, './settings/secretUserAgent.txt', setKeyButtonText)}>{keyButtonText}</button>
          </VStack>
        </HStack>
    </VStack>
  )
}

export default SettingsMenu