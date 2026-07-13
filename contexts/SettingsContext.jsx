import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

const SettingsContext = createContext(null)

const DEFAULT_SETTINGS = { initialUrl: '', secretUserAgent: '', wikiPaths: [] }

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    window.electronAPI.getSettings()
      .then((result) => {
        if (cancelled) return
        if (result?.success) {
          setSettings(result.settings)
        } else {
          console.error('Failed to load settings:', result?.error)
        }
      })
      .catch((err) => console.error('Failed to load settings:', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const updateSettings = useCallback(async (partial) => {
    const result = await window.electronAPI.saveSettings(partial)
    if (result?.success) {
      setSettings(result.settings)
      return { success: true }
    }
    console.error('Failed to save settings:', result?.error)
    return { success: false, error: result?.error }
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}
