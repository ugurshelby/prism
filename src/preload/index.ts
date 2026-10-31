import { contextBridge, ipcRenderer } from 'electron'
import type { PrompterApi } from './api'

const api: PrompterApi = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
    test: () => ipcRenderer.invoke('settings:test'),
    openKnowledge: () => ipcRenderer.invoke('settings:openKnowledge'),
    onChanged: (cb) => {
      const listener = () => cb()
      ipcRenderer.on('settings:changed', listener)
      return () => ipcRenderer.off('settings:changed', listener)
    }
  },
  providers: {
    saveKey: (id, key) => ipcRenderer.invoke('providers:saveKey', id, key),
    clearKey: (id) => ipcRenderer.invoke('providers:clearKey', id),
    verify: (id) => ipcRenderer.invoke('providers:verify', id)
  },
  engine: {
    analyze: (req) => ipcRenderer.invoke('engine:analyze', req),
    generate: (req) => ipcRenderer.invoke('engine:generate', req),
    cancel: (id) => ipcRenderer.invoke('engine:cancel', id),
    onStream: (cb) => {
      const listener = (_e: unknown, ev: Parameters<typeof cb>[0]) => cb(ev)
      ipcRenderer.on('engine:stream', listener)
      return () => ipcRenderer.off('engine:stream', listener)
    }
  },
  history: {
    list: () => ipcRenderer.invoke('history:list'),
    remove: (id) => ipcRenderer.invoke('history:delete', id),
    clear: () => ipcRenderer.invoke('history:clear')
  },
  window: {
    getState: () => ipcRenderer.invoke('window:getState'),
    setMode: (mode) => ipcRenderer.invoke('window:setMode', mode),
    togglePin: () => ipcRenderer.invoke('window:togglePin'),
    hide: () => ipcRenderer.invoke('window:hide'),
    quit: () => ipcRenderer.invoke('window:quit'),
    dragStart: (kind) => ipcRenderer.send('window:dragStart', kind),
    dragMove: () => ipcRenderer.send('window:dragMove'),
    dragEnd: () => ipcRenderer.send('window:dragEnd'),
    onMode: (cb) => {
      const listener = (_e: unknown, mode: Parameters<typeof cb>[0]) => cb(mode)
      ipcRenderer.on('window:mode', listener)
      return () => ipcRenderer.off('window:mode', listener)
    },
    onPinned: (cb) => {
      const listener = (_e: unknown, on: boolean) => cb(on)
      ipcRenderer.on('window:pinned', listener)
      return () => ipcRenderer.off('window:pinned', listener)
    }
  },
  clipboard: {
    write: (text) => ipcRenderer.invoke('clipboard:write', text)
  },
  ui: {
    onOpen: (cb) => {
      const listener = (_e: unknown, target: Parameters<typeof cb>[0]) => cb(target)
      ipcRenderer.on('ui:open', listener)
      return () => ipcRenderer.off('ui:open', listener)
    }
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('prompter', api)
