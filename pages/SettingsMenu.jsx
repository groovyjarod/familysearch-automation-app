import React, { useEffect, useState } from 'react'
import { VStack, HStack, Menu } from '@chakra-ui/react'
import CenteredHstackCss from '../reusables/CenteredHstackCss'
import CenteredVstackCss from '../reusables/CenteredVstackCss'
import MenuHeader from '../reusables/MenuHeader'
import BodyVstackCss from '../reusables/BodyVstackCss'
import LinkButton from '../reusables/LinkButton'
import { useSettings } from '../contexts/SettingsContext'

const SettingsMenu = () => {

  const { settings, loading, updateSettings } = useSettings()

  const [wikiPaths, setWikiPaths] = useState([])
  const [userKey, setUserKey] = useState('')
  const [initialUrl, setInitialUrl] = useState('')
  const [version, setVersion] = useState('')
  const [wikiButtonText, setWikiButtonText] = useState('Save Changes')
  const [urlButtonText, setUrlButtonText] = useState('Save Changes')
  const [keyButtonText, setKeyButtonText] = useState('Save Changes')

  const handleSave = async (key, value, setButtonText) => {
    const result = await updateSettings({ [key]: value })
    setButtonText(result.success ? 'Saved!' : 'Failed to save')
    setTimeout(() => {
      setButtonText('Save Changes')
    }, result.success ? 500 : 2000);
  }

  useEffect(() => {
    window.electronAPI.getVersion().then(setVersion)
  }, [])

  useEffect(() => {
    if (!loading) {
      setWikiPaths(settings.wikiPaths)
      setUserKey(settings.secretUserAgent)
      setInitialUrl(settings.initialUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return (
    <VStack {...CenteredVstackCss}>
        <MenuHeader title="Configuration" subTitle={`Version ${version}`} />
        <LinkButton
          destination="/view-logs"
          buttonText="View Application Logs"
          buttonClass="btn btn-extension btn-files"
        />
        <HStack {...CenteredHstackCss}>
          <VStack {...BodyVstackCss}>
              <h2>Base URL</h2>
              <input className='input' type="text" value={initialUrl} onChange={(e) => setInitialUrl(e.target.value)} />
              <button className='btn btn-small btn-files' onClick={() => handleSave('initialUrl', initialUrl, setUrlButtonText)}>{urlButtonText}</button>
              <h2>User Access Key</h2>
              <input className='input' type="text" value={userKey} onChange={(e) => setUserKey(e.target.value)} />
              <button className='btn btn-small btn-files' onClick={() => handleSave('secretUserAgent', userKey, setKeyButtonText)}>{keyButtonText}</button>
          </VStack>
          <VStack {...BodyVstackCss}>
            <h2>Page Paths</h2>
            <textarea className='input input-wiki-paths' type="text" value={wikiPaths.join("\n")} onChange={(e) => setWikiPaths(e.target.value.split("\n"))} />
            <button className='btn btn-small btn-files' onClick={() => handleSave('wikiPaths', wikiPaths.filter(Boolean), setWikiButtonText)}>{wikiButtonText}</button>
          </VStack>
        </HStack>
    </VStack>
  )
}

export default SettingsMenu
