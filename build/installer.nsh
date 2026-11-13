; Uninstaller extension (electron-builder nsis.include). Both products use the same file; the product name and appId
; come from electron-builder's definitions (PRODUCT_NAME = userData folder, APP_ID = name of the startup entry).
;
; - The startup entry (Run and StartupApproved\Run) is removed; it is left alone during an update.
; - The "delete my data too" question defaults to No; it is not asked on silent uninstall (/S) or update, and the data stays.
;   If Yes is chosen, only this product's folder (%APPDATA%\<product>) is deleted; folders installed under older names
;   (Prism 2.x, Prompter) are left alone (2.x may still be installed). The dialog text says this explicitly; those
;   are deleted with "Delete all my data" in the app.

!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_ID}"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${APP_ID}"
    ${if} $installMode == "all"
      MessageBox MB_OK|MB_ICONINFORMATION \
        "Your ${PRODUCT_NAME} data (saved API keys, prompt history and settings) stays in your user profile:$\r$\n%APPDATA%\${PRODUCT_NAME}$\r$\n$\r$\nTo remove it, use Delete all my data in the app before uninstalling, or delete that folder." \
        /SD IDOK
      Goto prism_keep_data
    ${endif}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
      "Also delete the ${PRODUCT_NAME} data folder (saved API keys, prompt history and settings)?$\r$\n$\r$\nThis cannot be undone. Folders of older versions (Prism, Prompter) are not touched here; use Delete all my data in the app for those." \
      /SD IDNO IDNO prism_keep_data
      RMDir /r "$APPDATA\${PRODUCT_NAME}"
    prism_keep_data:
  ${endIf}
!macroend
