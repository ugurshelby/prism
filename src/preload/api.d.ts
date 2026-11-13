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
    /** The main process validates the fields; an unknown field or an invalid value is rejected with an error. */
    set(patch: SettingsPatch): Promise<SettingsView>
    test(): Promise<{ ok: boolean; ms: number; message?: string; engine?: EngineRef }>
    openKnowledge(): Promise<string>
    /** When the main process changes settings itself (e.g. when key verification finishes at launch). */
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
    /** Orb dragging (orb window only). */
    dragStart(): void
    dragMove(): void
    /** animate: false (reduced motion) means the orb settles on the edge without the spring. */
    dragEnd(animate: boolean): void
    /** Panel shown: the cursor goes to the text field, the content animation starts from the corner it leans into. */
    onShown(cb: (anchor: PanelAnchor) => void): () => void
    /** State of the orb window (working, badge). */
    onPillState(cb: (state: PillState) => void): () => void
    onPinned(cb: (on: boolean) => void): () => void
  }
  clipboard: {
    write(text: string): Promise<void>
  }
  ui: {
    /** When "History…" / "Settings…" is chosen from the tray menu. */
    onOpen(cb: (target: 'settings' | 'history') => void): () => void
  }
  update: {
    get(): Promise<UpdateView>
    /** Check now (even if the setting is off); a network or format error is rejected. */
    check(): Promise<UpdateView>
    /** Opens the page of the latest known release in the system browser. */
    openRelease(): Promise<void>
    /** When the automatic check finds a new result. */
    onChanged(cb: () => void): () => void
  }
  data: {
    /**
     * The main process asks for confirmation with a system dialog; if confirmed it deletes keys, history, settings and caches, removes the login
     * entry and restarts the app. If cancelled it returns false; a partial wipe is rejected with an error.
     */
    deleteAll(): Promise<boolean>
  }
  platform: string
}

declare global {
  interface Window {
    prism: PrismApi
  }
}
