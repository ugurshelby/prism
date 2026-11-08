import { contextBridge, ipcRenderer } from 'electron'
import type { PrismApi } from './api'

const api: PrismApi = {
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
    dragStart: () => ipcRenderer.send('window:dragStart'),
    dragMove: () => ipcRenderer.send('window:dragMove'),
    dragEnd: (animate) => ipcRenderer.send('window:dragEnd', animate),
    onShown: (cb) => {
      const listener = (_e: unknown, anchor: Parameters<typeof cb>[0]) => cb(anchor)
      ipcRenderer.on('window:shown', listener)
      return () => ipcRenderer.off('window:shown', listener)
    },
    onPillState: (cb) => {
      const listener = (_e: unknown, st: Parameters<typeof cb>[0]) => cb(st)
      ipcRenderer.on('pill:state', listener)
      return () => ipcRenderer.off('pill:state', listener)
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

contextBridge.exposeInMainWorld('prism', api)
