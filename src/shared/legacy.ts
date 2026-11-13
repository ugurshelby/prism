// Pure matchers for the Prism 2.x artifacts that Spectrum replaces (D6); file work is in main/legacy-files.ts.

export const LEGACY_OFFER_MARKER = 'legacy-app.json' as const

// The exact file 2.x wrote (v2.2.0 src/main/index.ts linuxAutostart) for its deb (/opt/Prism/prism) or an AppImage;
// a hand-edited entry or another app named Prism does not match.
const LEGACY_AUTOSTART =
  /^\[Desktop Entry\]\nType=Application\nName=Prism\nExec="(?:\/opt\/Prism\/prism|[^"\n]*\.AppImage)" --hidden\nX-GNOME-Autostart-enabled=true\n$/

export const isLegacyAutostart = (text: string): boolean => LEGACY_AUTOSTART.test(text)

// Info.plist of a 2.x bundle: CFBundleIdentifier followed by the old appId.
export const isLegacyBundle = (plist: string): boolean =>
  /<key>CFBundleIdentifier<\/key>\s*<string>com\.prompter\.app<\/string>/.test(plist)
