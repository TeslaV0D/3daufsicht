import { useCallback, useEffect, useRef, useState } from 'react'
import type { Vector3Tuple } from 'three'
import {
  ASSET_TEMPLATES,
  createDefaultDemoLayout,
  createCustomModelTemplate,
} from '../AssetFactory'
import type { Asset, AssetTemplate } from '../types/asset'
import { cloneAsset, cloneAssets, sanitizeAsset } from '../types/asset'

export const STORAGE_KEY = 'factory-layout'
export const STORAGE_SLOTS_KEY = 'factory-layout-slots'
export const STORAGE_VERSION = 2
const MAX_HISTORY = 80

interface StoredPayload {
  version: number
  assets: Asset[]
  customTemplates?: AssetTemplate[]
}

export interface LayoutSlot {
  id: string
  name: string
  savedAt: number
  assetCount: number
  payload: StoredPayload
}

interface HistorySnapshot {
  assets: Asset[]
  selectedIds: string[]
}

export interface AssetsStore {
  assets: Asset[]
  templates: AssetTemplate[]
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
  addAsset: (asset: Asset, selectAfter?: boolean) => void
  addAssets: (assets: Asset[], selectAfter?: boolean) => void
  removeAssets: (ids: string[]) => void
  updateAsset: (id: string, patch: Partial<Asset>) => void
  updateAssets: (
    updates: Array<{ id: string; patch: Partial<Asset> }>,
  ) => void
  addTemplate: (template: AssetTemplate) => void
  addCustomModelTemplate: (name: string, modelUrl: string) => AssetTemplate
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  copy: () => void
  paste: () => void
  canPaste: boolean
  save: () => void
  load: () => boolean
  reset: () => void
  slots: LayoutSlot[]
  saveSlot: (name: string) => LayoutSlot
  loadSlot: (id: string) => boolean
  deleteSlot: (id: string) => void
  renameSlot: (id: string, name: string) => void
  exportLayout: (suggestedName?: string) => void
  importLayoutFromFile: (file: File) => Promise<boolean>
  importLayoutFromData: (data: unknown) => boolean
}

function parseStoredPayload(raw: string | null): StoredPayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      const assets = parsed
        .map((value) => sanitizeAsset(value))
        .filter((a): a is Asset => a !== null)
      return { version: 1, assets }
    }
    if (!parsed || typeof parsed !== 'object') return null
    const entry = parsed as Record<string, unknown>
    const rawAssets = Array.isArray(entry.assets) ? entry.assets : []
    const assets = rawAssets
      .map((value) => sanitizeAsset(value))
      .filter((a): a is Asset => a !== null)

    let customTemplates: AssetTemplate[] | undefined
    if (Array.isArray(entry.customTemplates)) {
      customTemplates = entry.customTemplates.filter(
        (value): value is AssetTemplate =>
          !!value &&
          typeof value === 'object' &&
          typeof (value as AssetTemplate).type === 'string' &&
          typeof (value as AssetTemplate).label === 'string',
      )
    }

    return {
      version: typeof entry.version === 'number' ? entry.version : STORAGE_VERSION,
      assets,
      customTemplates,
    }
  } catch {
    return null
  }
}

function loadSlots(): LayoutSlot[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_SLOTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((entry): LayoutSlot | null => {
        if (!entry || typeof entry !== 'object') return null
        const e = entry as Record<string, unknown>
        if (typeof e.id !== 'string' || typeof e.name !== 'string') return null
        if (!e.payload || typeof e.payload !== 'object') return null
        const payloadEntry = e.payload as Record<string, unknown>
        const rawAssets = Array.isArray(payloadEntry.assets) ? payloadEntry.assets : []
        const sanitizedAssets = rawAssets
          .map((a) => sanitizeAsset(a))
          .filter((a): a is Asset => a !== null)
        const customTemplates = Array.isArray(payloadEntry.customTemplates)
          ? (payloadEntry.customTemplates as AssetTemplate[])
          : undefined
        const payload: StoredPayload = {
          version: typeof payloadEntry.version === 'number' ? payloadEntry.version : STORAGE_VERSION,
          assets: sanitizedAssets,
          customTemplates,
        }
        return {
          id: e.id,
          name: e.name,
          savedAt: typeof e.savedAt === 'number' ? e.savedAt : Date.now(),
          assetCount:
            typeof e.assetCount === 'number' ? e.assetCount : sanitizedAssets.length,
          payload,
        }
      })
      .filter((s): s is LayoutSlot => s !== null)
  } catch {
    return []
  }
}

function persistSlots(slots: LayoutSlot[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_SLOTS_KEY, JSON.stringify(slots))
  } catch (error) {
    console.error('Failed to persist slots', error)
  }
}

function newSlotId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `slot-${globalThis.crypto.randomUUID()}`
  }
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadInitialAssets(): { assets: Asset[]; customTemplates: AssetTemplate[] } {
  if (typeof localStorage === 'undefined') {
    return { assets: createDefaultDemoLayout(), customTemplates: [] }
  }
  const stored = parseStoredPayload(localStorage.getItem(STORAGE_KEY))
  if (stored && stored.assets.length > 0) {
    return {
      assets: stored.assets,
      customTemplates: stored.customTemplates ?? [],
    }
  }
  return { assets: createDefaultDemoLayout(), customTemplates: [] }
}

export function useAssetsStore(): AssetsStore {
  const [initial] = useState(() => loadInitialAssets())
  const [assets, setAssetsState] = useState<Asset[]>(initial.assets)
  const [customTemplates, setCustomTemplates] = useState<AssetTemplate[]>(
    initial.customTemplates,
  )
  const [selectedIds, setSelectedIdsState] = useState<string[]>([])
  const [historyPast, setHistoryPast] = useState<HistorySnapshot[]>([])
  const [historyFuture, setHistoryFuture] = useState<HistorySnapshot[]>([])
  const [clipboard, setClipboard] = useState<Asset[]>([])
  const [slots, setSlots] = useState<LayoutSlot[]>(() => loadSlots())

  const assetsRef = useRef(assets)
  const selectedIdsRef = useRef(selectedIds)
  const historyPastRef = useRef(historyPast)
  const historyFutureRef = useRef(historyFuture)
  const pasteOffsetRef = useRef(0)

  useEffect(() => {
    assetsRef.current = assets
  }, [assets])
  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])
  useEffect(() => {
    historyPastRef.current = historyPast
  }, [historyPast])
  useEffect(() => {
    historyFutureRef.current = historyFuture
  }, [historyFuture])

  const templates: AssetTemplate[] = [...ASSET_TEMPLATES, ...customTemplates]

  const takeSnapshot = useCallback((): HistorySnapshot => {
    return {
      assets: cloneAssets(assetsRef.current),
      selectedIds: [...selectedIdsRef.current],
    }
  }, [])

  const applyChange = useCallback(
    (nextAssets: Asset[], nextSelectedIds: string[], recordHistory: boolean) => {
      if (recordHistory) {
        const snapshot = takeSnapshot()
        setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), snapshot])
        setHistoryFuture([])
      }
      setAssetsState(nextAssets)
      setSelectedIdsState(nextSelectedIds)
    },
    [takeSnapshot],
  )

  const setSelectedIds = useCallback((ids: string[]) => {
    setSelectedIdsState(ids)
  }, [])

  const addAsset = useCallback(
    (asset: Asset, selectAfter = true) => {
      const nextAssets = [...assetsRef.current, cloneAsset(asset)]
      applyChange(nextAssets, selectAfter ? [asset.id] : selectedIdsRef.current, true)
    },
    [applyChange],
  )

  const addAssets = useCallback(
    (newAssets: Asset[], selectAfter = true) => {
      if (newAssets.length === 0) return
      const cloned = cloneAssets(newAssets)
      const nextAssets = [...assetsRef.current, ...cloned]
      applyChange(
        nextAssets,
        selectAfter ? cloned.map((a) => a.id) : selectedIdsRef.current,
        true,
      )
    },
    [applyChange],
  )

  const removeAssets = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      const nextAssets = assetsRef.current.filter((asset) => !ids.includes(asset.id))
      const nextSelected = selectedIdsRef.current.filter((id) => !ids.includes(id))
      applyChange(nextAssets, nextSelected, true)
    },
    [applyChange],
  )

  const updateAsset = useCallback(
    (id: string, patch: Partial<Asset>) => {
      const nextAssets = assetsRef.current.map((asset) =>
        asset.id === id
          ? cloneAsset({
              ...asset,
              ...patch,
              metadata: {
                ...asset.metadata,
                ...(patch.metadata ?? {}),
                customData: {
                  ...(asset.metadata.customData ?? {}),
                  ...(patch.metadata?.customData ?? {}),
                },
              },
              geometry: patch.geometry
                ? {
                    kind: patch.geometry.kind,
                    params: { ...patch.geometry.params },
                  }
                : asset.geometry,
              visual: patch.visual ? { ...asset.visual, ...patch.visual } : asset.visual,
            })
          : asset,
      )
      applyChange(nextAssets, selectedIdsRef.current, true)
    },
    [applyChange],
  )

  const updateAssets = useCallback(
    (updates: Array<{ id: string; patch: Partial<Asset> }>) => {
      if (updates.length === 0) return
      const byId = new Map(updates.map((u) => [u.id, u.patch]))
      const nextAssets = assetsRef.current.map((asset) => {
        const patch = byId.get(asset.id)
        if (!patch) return asset
        return cloneAsset({
          ...asset,
          ...patch,
        })
      })
      applyChange(nextAssets, selectedIdsRef.current, true)
    },
    [applyChange],
  )

  const addTemplate = useCallback((template: AssetTemplate) => {
    setCustomTemplates((current) => [...current, template])
  }, [])

  const addCustomModelTemplate = useCallback((name: string, modelUrl: string) => {
    const template = createCustomModelTemplate(name, modelUrl)
    setCustomTemplates((current) => [...current, template])
    return template
  }, [])

  const undo = useCallback(() => {
    const past = historyPastRef.current
    if (past.length === 0) return
    const previous = past[past.length - 1]
    const snapshot = takeSnapshot()
    setHistoryPast(past.slice(0, -1))
    setHistoryFuture((future) => [snapshot, ...future].slice(0, MAX_HISTORY))
    setAssetsState(cloneAssets(previous.assets))
    setSelectedIdsState([...previous.selectedIds])
  }, [takeSnapshot])

  const redo = useCallback(() => {
    const future = historyFutureRef.current
    if (future.length === 0) return
    const [next, ...remaining] = future
    const snapshot = takeSnapshot()
    setHistoryFuture(remaining)
    setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), snapshot])
    setAssetsState(cloneAssets(next.assets))
    setSelectedIdsState([...next.selectedIds])
  }, [takeSnapshot])

  const copy = useCallback(() => {
    if (selectedIdsRef.current.length === 0) return
    const copied = assetsRef.current.filter((asset) =>
      selectedIdsRef.current.includes(asset.id),
    )
    setClipboard(cloneAssets(copied))
    pasteOffsetRef.current = 0
  }, [])

  const paste = useCallback(() => {
    if (clipboard.length === 0) return
    pasteOffsetRef.current += 1
    const offset = pasteOffsetRef.current
    const pasted: Asset[] = clipboard.map((asset) => {
      const copy = cloneAsset(asset)
      return {
        ...copy,
        id: `${asset.type}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(
          36,
        )}`,
        position: [
          asset.position[0] + offset,
          asset.position[1],
          asset.position[2] + offset,
        ] as Vector3Tuple,
      }
    })
    const nextAssets = [...assetsRef.current, ...pasted]
    applyChange(nextAssets, pasted.map((a) => a.id), true)
  }, [applyChange, clipboard])

  const save = useCallback(() => {
    try {
      const payload: StoredPayload = {
        version: STORAGE_VERSION,
        assets: assetsRef.current,
        customTemplates,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      console.error('Failed to save layout', error)
    }
  }, [customTemplates])

  const load = useCallback((): boolean => {
    try {
      const parsed = parseStoredPayload(localStorage.getItem(STORAGE_KEY))
      if (!parsed) return false
      setAssetsState(parsed.assets)
      setSelectedIdsState([])
      setHistoryPast([])
      setHistoryFuture([])
      if (parsed.customTemplates && parsed.customTemplates.length > 0) {
        setCustomTemplates(parsed.customTemplates)
      }
      return true
    } catch (error) {
      console.error('Failed to load layout', error)
      return false
    }
  }, [])

  const reset = useCallback(() => {
    applyChange(createDefaultDemoLayout(), [], true)
  }, [applyChange])

  const buildPayload = useCallback((): StoredPayload => {
    return {
      version: STORAGE_VERSION,
      assets: cloneAssets(assetsRef.current),
      customTemplates: customTemplates.map((template) => ({
        ...template,
        scale: [...template.scale] as Vector3Tuple,
        geometry: {
          kind: template.geometry.kind,
          params: { ...template.geometry.params },
        },
        metadata: template.metadata
          ? {
              ...template.metadata,
              customData: { ...(template.metadata.customData ?? {}) },
            }
          : undefined,
        visual: template.visual ? { ...template.visual } : undefined,
      })),
    }
  }, [customTemplates])

  const applyPayload = useCallback((payload: StoredPayload) => {
    setAssetsState(payload.assets)
    setSelectedIdsState([])
    setHistoryPast([])
    setHistoryFuture([])
    if (payload.customTemplates && payload.customTemplates.length > 0) {
      setCustomTemplates(payload.customTemplates)
    }
  }, [])

  const saveSlot = useCallback(
    (name: string): LayoutSlot => {
      const trimmed = name.trim() || `Layout ${new Date().toLocaleString()}`
      const payload = buildPayload()
      const slot: LayoutSlot = {
        id: newSlotId(),
        name: trimmed,
        savedAt: Date.now(),
        assetCount: payload.assets.length,
        payload,
      }
      setSlots((current) => {
        const next = [slot, ...current].slice(0, 50)
        persistSlots(next)
        return next
      })
      return slot
    },
    [buildPayload],
  )

  const loadSlot = useCallback(
    (id: string): boolean => {
      const slot = slots.find((s) => s.id === id)
      if (!slot) return false
      applyPayload(slot.payload)
      return true
    },
    [applyPayload, slots],
  )

  const deleteSlot = useCallback((id: string) => {
    setSlots((current) => {
      const next = current.filter((slot) => slot.id !== id)
      persistSlots(next)
      return next
    })
  }, [])

  const renameSlot = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSlots((current) => {
      const next = current.map((slot) =>
        slot.id === id ? { ...slot, name: trimmed } : slot,
      )
      persistSlots(next)
      return next
    })
  }, [])

  const exportLayout = useCallback(
    (suggestedName?: string) => {
      try {
        const payload = buildPayload()
        const data = JSON.stringify(payload, null, 2)
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const filename = `${(suggestedName ?? 'factory-layout').replace(
          /[^a-z0-9_-]+/gi,
          '-',
        )}.json`
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error('Failed to export layout', error)
      }
    },
    [buildPayload],
  )

  const importLayoutFromData = useCallback(
    (data: unknown): boolean => {
      try {
        let payload: StoredPayload | null = null
        if (Array.isArray(data)) {
          const assets = data
            .map((a) => sanitizeAsset(a))
            .filter((a): a is Asset => a !== null)
          payload = { version: 1, assets }
        } else if (data && typeof data === 'object') {
          const entry = data as Record<string, unknown>
          const rawAssets = Array.isArray(entry.assets) ? entry.assets : []
          const assets = rawAssets
            .map((a) => sanitizeAsset(a))
            .filter((a): a is Asset => a !== null)
          const customTemplates = Array.isArray(entry.customTemplates)
            ? (entry.customTemplates as AssetTemplate[])
            : undefined
          payload = {
            version: typeof entry.version === 'number' ? entry.version : STORAGE_VERSION,
            assets,
            customTemplates,
          }
        }
        if (!payload || payload.assets.length === 0) return false
        applyPayload(payload)
        return true
      } catch (error) {
        console.error('Failed to import layout', error)
        return false
      }
    },
    [applyPayload],
  )

  const importLayoutFromFile = useCallback(
    (file: File): Promise<boolean> => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          try {
            const text = String(reader.result ?? '')
            const data = JSON.parse(text) as unknown
            resolve(importLayoutFromData(data))
          } catch (error) {
            console.error('Failed to parse imported layout', error)
            resolve(false)
          }
        }
        reader.onerror = () => resolve(false)
        reader.readAsText(file)
      })
    },
    [importLayoutFromData],
  )

  return {
    assets,
    templates,
    selectedIds,
    setSelectedIds,
    addAsset,
    addAssets,
    removeAssets,
    updateAsset,
    updateAssets,
    addTemplate,
    addCustomModelTemplate,
    undo,
    redo,
    canUndo: historyPast.length > 0,
    canRedo: historyFuture.length > 0,
    copy,
    paste,
    canPaste: clipboard.length > 0,
    save,
    load,
    reset,
    slots,
    saveSlot,
    loadSlot,
    deleteSlot,
    renameSlot,
    exportLayout,
    importLayoutFromFile,
    importLayoutFromData,
  }
}
