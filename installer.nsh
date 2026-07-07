; Custom NSIS script for FamilySearch Automation App
; Forcefully kills processes before installation and uninstallation
; This prevents "application cannot be closed" errors during updates

!macro customInstall
  ; Kill any running instances before installation begins
  DetailPrint "Closing application processes..."
  nsExec::Exec 'taskkill /F /IM "FamilySearch Automation App.exe" /T'
  nsExec::Exec 'taskkill /F /IM chrome.exe /T'
  nsExec::Exec 'taskkill /F /IM node.exe /T'
  Sleep 2000
!macroend

!macro customInit
  ; Kill processes at the very start of the installer
  nsExec::Exec 'taskkill /F /IM "FamilySearch Automation App.exe" /T'
  nsExec::Exec 'taskkill /F /IM chrome.exe /T'
  nsExec::Exec 'taskkill /F /IM node.exe /T'
  Sleep 2000
!macroend

!macro customUnInit
  ; Kill any running instances before uninstallation
  DetailPrint "Closing application processes..."
  nsExec::Exec 'taskkill /F /IM "FamilySearch Automation App.exe" /T'
  nsExec::Exec 'taskkill /F /IM chrome.exe /T'
  nsExec::Exec 'taskkill /F /IM node.exe /T'
  Sleep 2000
!macroend
