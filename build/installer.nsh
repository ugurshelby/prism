; Kaldırıcı eklentisi (electron-builder nsis.include). İki ürün aynı dosyayı kullanır; ürün adı ve appId
; electron-builder'ın tanımlarından gelir (PRODUCT_NAME = userData klasörü, APP_ID = açılış kaydının adı).
;
; - Açılış kaydı (Run ve StartupApproved\Run) kaldırılır; güncelleme sırasında dokunulmaz.
; - "Verilerimi de sil" sorusu varsayılan olarak Hayır'dır; sessiz kaldırmada (/S) ve güncellemede sorulmaz, veri kalır.
;   Evet denirse yalnızca bu ürünün klasörü (%APPDATA%\<ürün>) silinir; eski adlarla kurulmuş klasörlere
;   (Prism 2.x, Prompter) dokunulmaz (2.x hâlâ kurulu olabilir). Pencere metni bunu açıkça söyler; onlar
;   uygulamadaki "Tüm verilerimi sil" ile silinir.

!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_ID}"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${APP_ID}"
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
      "Also delete the ${PRODUCT_NAME} data folder (saved API keys, prompt history and settings)?$\r$\n$\r$\nThis cannot be undone. Folders of older versions (Prism, Prompter) are not touched here; use Delete all my data in the app for those." \
      /SD IDNO IDNO prism_keep_data
      ; Tüm kullanıcılar için kurulumda kaldırıcı yönetici bağlamında çalışır; veri kullanıcının kendi klasöründedir.
      ${if} $installMode == "all"
        SetShellVarContext current
      ${endif}
      RMDir /r "$APPDATA\${PRODUCT_NAME}"
      ${if} $installMode == "all"
        SetShellVarContext all
      ${endif}
    prism_keep_data:
  ${endIf}
!macroend
