import type { ProviderId } from '../shared/catalog'
import type {
  Analysis,
  AnalyzeRequest,
  EngineRef,
  GenerateRequest,
  HistoryEntry,
  Settings,
  SettingsView,
  StreamEvent,
  WindowMode
} from '../shared/types'

export interface PrompterApi {
  settings: {
    get(): Promise<SettingsView>
    set(patch: Partial<Settings>): Promise<SettingsView>
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
    list(): Promise<HistoryEntry[]>
    remove(id: string): Promise<void>
    clear(): Promise<void>
  }
  window: {
    getState(): Promise<{ mode: WindowMode; pinned: boolean }>
    setMode(mode: WindowMode): Promise<void>
    togglePin(): Promise<boolean>
    hide(): Promise<void>
    quit(): Promise<void>
    dragStart(kind: 'move' | 'resize'): void
    dragMove(): void
    dragEnd(): void
    onMode(cb: (mode: WindowMode) => void): () => void
    onPinned(cb: (on: boolean) => void): () => void
  }
  clipboard: {
    write(text: string): Promise<void>
  }
  ui: {
    /** Tray menüsünden "Geçmiş…" / "Ayarlar…" seçilince. */
    onOpen(cb: (target: 'settings' | 'history') => void): () => void
  }
  platform: string
}

declare global {
  interface Window {
    prompter: PrompterApi
  }
}
