// "Tüm verilerimi sil" yalnızca Prism'in kendi yazdığı dosyaları siler: ayarlar ve yedekleri, geçmiş ve
// şifreli yedekleri, key'ler, model önbelleği, pencere ve güncelleme durumu, yarım kalmış geçici dosyalar,
// kenara alınmış bozuk dosyalar. Chromium'un önbellek klasörleri ve kullanıcının koyduğu başka dosyalar listede yoksa
// dokunulmaz. Saf modül: dosya işi main/wipe.ts'te. Yeni bir userData dosyası (config.ts UserFileName) eklenince
// buraya da eklenir.
import { PROVIDERS } from './catalog'

const BASES: ReadonlySet<string> = new Set([
  // Eski sürümler key'leri userData/.env'de düz metin tutabiliyordu (env.ts leftoverEnvNames); o da silinir.
  '.env',
  'settings.json',
  'history.json',
  'history.v1.json',
  'history.enc',
  'history.legacy.enc',
  'models.json',
  'window-state.json',
  'update-state.json',
  ...PROVIDERS.map((p) => `${p}.key`)
])
const SETTINGS_BACKUP = /^settings\.v\d+\.json$/
// Taban adın ardından gelebilecek ekler: atomik yazımın geçici dosyası (.<hex>.tmp), history.json.tmp, şifreli
// yedekler (.<n>.bak), okunamayınca kenara alınan kopya (.bozuk-<zaman>) ve bu sistemde çözülemeyen şifreli geçmiş
// (.unreadable-<zaman>).
const SUFFIXES = [/\.[0-9a-f]{12}\.tmp$/, /\.tmp$/, /\.\d+\.bak$/, /\.bozuk-\d+$/, /\.unreadable-\d+$/]

const isBase = (name: string) => BASES.has(name) || SETTINGS_BACKUP.test(name)

export function isOwnDataFile(name: string): boolean {
  if (isBase(name)) return true
  return SUFFIXES.some((suffix) => {
    const m = suffix.exec(name)
    return !!m && isBase(name.slice(0, m.index))
  })
}
