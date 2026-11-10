import type { ProviderId } from '../shared/catalog'
import type {
  Analysis,
  AnalyzeRequest,
  EngineRef,
  GenerateRequest,
  HistoryList,
  SettingsPatch,
  SettingsView,
  PanelAnchor,
  PillState,
  StreamEvent,
  UpdateView,
  WindowMode
} from '../shared/types'

export interface PrismApi {
  settings: {
    get(): Promise<SettingsView>
    /** Ana süreç alanları doğrular; bilinmeyen alan ya da geçersiz değer hata ile reddedilir. */
    set(patch: SettingsPatch): Promise<SettingsView>
    test(): Promise<{ ok: boolean; ms: number; message?: string; engine?: EngineRef }>
    openKnowledge(): Promise<string>
    /** Ana süreç ayarları kendisi değiştirdiğinde (ör. açılışta key doğrulaması bitince). */
    onChanged(cb: () => void): () => void
  }
  providers: {
    saveKey(id: ProviderId, key: string): Promise<SettingsView>
    clearKey(id: ProviderId): Promise<SettingsView>
    verify(id: ProviderId): Promise<SettingsView>
  }
  engine: {
    analyze(req: AnalyzeRequest): Promise<Analysis>
    generate(req: GenerateRequest): Promise<void>
    cancel(id: string): Promise<void>
    onStream(cb: (ev: StreamEvent) => void): () => void
  }
  history: {
    list(): Promise<HistoryList>
    remove(id: string): Promise<void>
    clear(): Promise<void>
  }
  window: {
    getState(): Promise<{ mode: WindowMode; pinned: boolean }>
    setMode(mode: WindowMode): Promise<void>
    togglePin(): Promise<boolean>
    hide(): Promise<void>
    quit(): Promise<void>
    /** Küre sürükleme (yalnızca küre penceresi). */
    dragStart(): void
    dragMove(): void
    /** animate: false ise (azaltılmış hareket) küre kenara yaysız yerleşir. */
    dragEnd(animate: boolean): void
    /** Panel gösterildi: imleç metin alanına, içerik animasyonu yaslandığı köşeden. */
    onShown(cb: (anchor: PanelAnchor) => void): () => void
    /** Küre penceresinin durumu (çalışıyor, rozet). */
    onPillState(cb: (state: PillState) => void): () => void
    onPinned(cb: (on: boolean) => void): () => void
  }
  clipboard: {
    write(text: string): Promise<void>
  }
  ui: {
    /** Tray menüsünden "Geçmiş…" / "Ayarlar…" seçilince. */
    onOpen(cb: (target: 'settings' | 'history') => void): () => void
  }
  update: {
    get(): Promise<UpdateView>
    /** Şimdi denetle (ayar kapalı olsa da); ağ ya da biçim hatası reddedilir. */
    check(): Promise<UpdateView>
    /** Bilinen en yeni yayının sayfasını sistem tarayıcısında açar. */
    openRelease(): Promise<void>
    /** Otomatik denetim yeni bir sonuç bulduğunda. */
    onChanged(cb: () => void): () => void
  }
  data: {
    /** Key'leri, geçmişi, ayarları ve önbellekleri siler, açılış kaydını kaldırır ve uygulamayı yeniden başlatır. Kısmi silme hata ile reddedilir. */
    deleteAll(): Promise<void>
  }
  platform: string
}

declare global {
  interface Window {
    prism: PrismApi
  }
}
