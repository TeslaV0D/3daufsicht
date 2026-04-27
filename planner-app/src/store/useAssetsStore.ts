import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { Vector3Tuple } from 'three'
import {
  ASSET_TEMPLATES,
  createDefaultDemoLayout,
  createCustomModelTemplate,
  createTemplateFromSceneAsset,
  type SaveSceneAssetTemplateOptions,
} from '../AssetFactory'
import type { Asset, AssetTemplate, ModelFormat } from '../types/asset'
import { cloneAsset, cloneAssets, mergeAssetMetadata, sanitizeAsset } from '../types/asset'
import {
  cloneFloor,
  DEFAULT_FLOOR,
  sanitizeFloor,
  type FloorSettings,
} from '../types/floor'
import { LAYOUT_FORMAT_SEMVER } from '../config/layoutFormat'
import {
  type AxisViewCamerasState,
  type CameraViewPreset,
  cloneAxisViewCameras,
  normalizeCameraViewPreset,
  type PerformanceSettings,
  type PerspectiveCameraSettings,
  type PlannerShellMode,
  sanitizeAxisViewCameras,
  sanitizePerformanceSettings,
  sanitizePerspectiveCamera,
} from '../types/plannerUi'
import {
  cloneLighting,
  DEFAULT_LIGHTING,
  sanitizeLighting,
  type LightingSettings,
} from '../types/lighting'
import { sanitizeLayoutSession, type LayoutSessionState } from '../types/layoutSession'
import {
  applyTemplateDisplayOverrides,
  cloneLibraryOrganization,
  DEFAULT_LIBRARY_ORGANIZATION,
  EIGENE_ASSETS_USER_GROUP_ID,
  EIGENE_ASSETS_USER_GROUP_LABEL,
  ensureEigeneAssetsUserGroup,
  mergeLibraryOrgWithUserTemplates,
  removeTypeFromRecents,
  sanitizeLibraryOrganization,
  pushRecentTemplateType,
  type LibraryOrganizationState,
  type TemplateDisplayOverride,
} from '../types/libraryOrganization'

export const STORAGE_KEY = 'factory-layout'
export const STORAGE_SLOTS_KEY = 'factory-layout-slots'
export const STORAGE_VERSION = 9
const MAX_HISTORY = 50

export type LayoutExportKind = 'workspace' | 'complete'

export interface StoredPayload {
  version: number
  /** Semantische Version für Migrationen (z. B. „1.2.0“) */
  layoutFormatSemver?: string
  assets: Asset[]
  customTemplates?: AssetTemplate[]
  floor?: FloorSettings
  cameraView?: CameraViewPreset
  uiMode?: PlannerShellMode
  lighting?: LightingSettings
  libraryOrganization?: LibraryOrganizationState
  perspectiveCamera?: PerspectiveCameraSettings
  axisViewCameras?: AxisViewCamerasState
  performanceSettings?: PerformanceSettings
  /** Gesetzt bei Datei-Export: Workspace nur Szene, complete = volles Projekt */
  exportKind?: LayoutExportKind
  /** Bearbeiten vs. Präsentation (nur bei `complete`) */
  shellMode?: PlannerShellMode
  /** Ausgeklappte Bibliotheks-Sektionen (`true` = offen) */
  librarySectionExpanded?: Record<string, boolean>
  /** Shell-UI (Modus, Auswahl, Panels) – wird bei Refresh wiederhergestellt */
  layoutSession?: LayoutSessionState
}

export interface LayoutImportResult {
  ok: boolean
  librarySectionExpanded?: Record<string, boolean>
  shellMode?: PlannerShellMode
}

function mergeCustomTemplatesForImport(
  existing: AssetTemplate[],
  incoming: AssetTemplate[] | undefined,
): AssetTemplate[] {
  if (!incoming?.length) return existing
  const byType = new Map(existing.map((t) => [t.type, t]))
  for (const t of incoming) {
    byType.set(t.type, t)
  }
  return Array.from(byType.values())
}

function clonePerspective(s: PerspectiveCameraSettings): PerspectiveCameraSettings {
  return {
    ...s,
    target: [s.target[0], s.target[1], s.target[2]],
  }
}

/** Fehlende Felder ergänzen, Schema auf STORAGE_VERSION heben (Backward Compatibility). */
export function finalizeImportedPayload(p: StoredPayload): StoredPayload {
  return {
    ...p,
    version: STORAGE_VERSION,
    layoutFormatSemver: LAYOUT_FORMAT_SEMVER,
    perspectiveCamera: clonePerspective(sanitizePerspectiveCamera(p.perspectiveCamera)),
    performanceSettings: sanitizePerformanceSettings(p.performanceSettings),
    axisViewCameras: cloneAxisViewCameras(sanitizeAxisViewCameras(p.axisViewCameras)),
    ...(p.layoutSession != null
      ? { layoutSession: sanitizeLayoutSession(p.layoutSession) }
      : {}),
  }
}

function duplicateLibraryTemplate(
  source: AssetTemplate,
  newType: string,
  copyLabel: string,
): AssetTemplate {
  const next: AssetTemplate = {
    ...source,
    type: newType,
    label: copyLabel,
    scale: [...source.scale] as Vector3Tuple,
    geometry: {
      kind: source.geometry.kind,
      params: { ...source.geometry.params },
    },
    metadata: source.metadata
      ? {
          ...source.metadata,
          name: copyLabel,
          customData: source.metadata.customData
            ? { ...source.metadata.customData }
            : undefined,
        }
      : { name: copyLabel },
    visual: source.visual ? { ...source.visual } : undefined,
  }
  if (source.isUserAsset) next.isUserAsset = true
  if (source.createdAt != null) next.createdAt = source.createdAt
  return next
}

function sanitizeCameraView(value: unknown): CameraViewPreset {
  return normalizeCameraViewPreset(value)
}

function sanitizeUiMode(value: unknown): PlannerShellMode | undefined {
  if (value === 'edit' || value === 'view') return value
  return undefined
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
  libraryOrganization: LibraryOrganizationState
  customTemplates: AssetTemplate[]
  floor: FloorSettings
  lighting: LightingSettings
}

function cloneCustomTemplatesForHistory(templates: AssetTemplate[]): AssetTemplate[] {
  return templates.map((template) => ({
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
  }))
}

export interface AssetsStore {
  assets: Asset[]
  templates: AssetTemplate[]
  customTemplates: AssetTemplate[]
  floor: FloorSettings
  setFloor: (patch: Partial<FloorSettings>) => void
  cameraView: CameraViewPreset
  setCameraView: (preset: CameraViewPreset) => void
  perspectiveCamera: PerspectiveCameraSettings
  setPerspectiveCamera: (patch: Partial<PerspectiveCameraSettings>) => void
  axisViewCameras: AxisViewCamerasState
  setAxisViewCamera: <K extends keyof AxisViewCamerasState>(
    view: K,
    patch: Partial<AxisViewCamerasState[K]>,
  ) => void
  performanceSettings: PerformanceSettings
  setPerformanceSettings: (patch: Partial<PerformanceSettings>) => void
  lighting: LightingSettings
  setLighting: (patch: Partial<LightingSettings>) => void
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
  addCustomModelTemplate: (
    name: string,
    modelUrl: string,
    options?: { modelFormat?: ModelFormat; category?: string },
  ) => AssetTemplate
  importCustomModelTemplatesBatch: (
    items: { name: string; modelUrl: string; modelFormat: ModelFormat }[],
    options?: { category?: string },
  ) => AssetTemplate[]
  /** Aus platziertem Asset ein neues Template in „Eigene Assets“. */
  saveSceneAssetAsTemplate: (
    asset: Asset,
    options: SaveSceneAssetTemplateOptions,
  ) => AssetTemplate
  removeCustomTemplate: (type: string) => void
  libraryOrganization: LibraryOrganizationState
  addUserLibraryGroup: (label: string) => string | null
  removeUserLibraryGroup: (groupId: string) => void
  assignTemplateToUserGroup: (templateType: string, userGroupId: string | null) => void
  /** Kopiert die Vorlage in die Ziel-Gruppe; Original-Zuordnung bleibt unverändert. */
  cloneTemplateToUserGroup: (templateType: string, userGroupId: string) => void
  toggleFavoriteTemplateType: (templateType: string) => void
  updateTemplateLibraryMeta: (
    templateType: string,
    patch: { label?: string; description?: string; tags?: string[] | null },
  ) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  copy: () => void
  paste: () => void
  canPaste: boolean
  save: () => void
  load: () =>
    | {
        ok: true
        layoutSession: LayoutSessionState | null
        restorableSelectedIds: string[]
        assets: Asset[]
      }
    | { ok: false }
  reset: () => void
  slots: LayoutSlot[]
  saveSlot: (name: string) => LayoutSlot
  loadSlot: (id: string) => boolean
  deleteSlot: (id: string) => void
  renameSlot: (id: string, name: string) => void
  exportLayout: (options?: {
    suggestedName?: string
    kind?: LayoutExportKind
    shellMode?: PlannerShellMode
    librarySectionExpanded?: Record<string, boolean>
  }) => void
  importLayoutFromFile: (file: File) => Promise<LayoutImportResult>
  importLayoutFromData: (data: unknown) => LayoutImportResult
  recordRecentTemplatePlacement: (templateType: string) => void
  initialLayoutSession?: LayoutSessionState
  /** Synchronisiere Shell-UI in den Auto-Save; aus PlannerApp nach jedem relevanten SetState aufrufen */
  setLayoutSessionSnapshot: (s: LayoutSessionState | null) => void
}

function parseStoredPayload(raw: string | null): StoredPayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      const assets = parsed
        .map((value) => sanitizeAsset(value))
        .filter((a): a is Asset => a !== null)
      return finalizeImportedPayload({
        version: 1,
        assets,
        floor: { ...DEFAULT_FLOOR },
        cameraView: undefined,
        uiMode: undefined,
        lighting: cloneLighting(DEFAULT_LIGHTING),
        libraryOrganization: cloneLibraryOrganization(DEFAULT_LIBRARY_ORGANIZATION),
      })
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

    let exportKind: LayoutExportKind | undefined
    if (entry.exportKind === 'workspace' || entry.exportKind === 'complete') {
      exportKind = entry.exportKind
    }
    let librarySectionExpanded: Record<string, boolean> | undefined
    if (
      entry.librarySectionExpanded &&
      typeof entry.librarySectionExpanded === 'object' &&
      !Array.isArray(entry.librarySectionExpanded)
    ) {
      const o: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(
        entry.librarySectionExpanded as Record<string, unknown>,
      )) {
        if (v === true) o[k] = true
      }
      if (Object.keys(o).length > 0) librarySectionExpanded = o
    }

    const rawPerspective = entry.perspectiveCamera
    const rawPerf = entry.performanceSettings
    const rawAxis = entry.axisViewCameras
    return finalizeImportedPayload({
      version: typeof entry.version === 'number' ? entry.version : 1,
      assets,
      customTemplates,
      floor: sanitizeFloor(entry.floor),
      cameraView: sanitizeCameraView(entry.cameraView),
      uiMode: sanitizeUiMode(entry.uiMode),
      lighting: sanitizeLighting(entry.lighting),
      libraryOrganization: sanitizeLibraryOrganization(entry.libraryOrganization),
      exportKind,
      shellMode: sanitizeUiMode(entry.shellMode),
      librarySectionExpanded,
      ...(entry.layoutSession && typeof entry.layoutSession === 'object'
        ? { layoutSession: entry.layoutSession as LayoutSessionState }
        : {}),
      ...(rawPerspective && typeof rawPerspective === 'object'
        ? { perspectiveCamera: rawPerspective as PerspectiveCameraSettings }
        : {}),
      ...(rawAxis && typeof rawAxis === 'object'
        ? { axisViewCameras: rawAxis as AxisViewCamerasState }
        : {}),
      ...(rawPerf && typeof rawPerf === 'object'
        ? { performanceSettings: rawPerf as PerformanceSettings }
        : {}),
    })
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
        const rawPerspective = payloadEntry.perspectiveCamera
        const rawPerf = payloadEntry.performanceSettings
        const rawAxis = payloadEntry.axisViewCameras
        const payload = finalizeImportedPayload({
          version: typeof payloadEntry.version === 'number' ? payloadEntry.version : 1,
          assets: sanitizedAssets,
          customTemplates,
          floor: sanitizeFloor(payloadEntry.floor),
          cameraView: sanitizeCameraView(payloadEntry.cameraView),
          uiMode: sanitizeUiMode(payloadEntry.uiMode),
          lighting: sanitizeLighting(payloadEntry.lighting),
          libraryOrganization: sanitizeLibraryOrganization(payloadEntry.libraryOrganization),
          ...(rawPerspective && typeof rawPerspective === 'object'
            ? { perspectiveCamera: rawPerspective as PerspectiveCameraSettings }
            : {}),
          ...(rawAxis && typeof rawAxis === 'object'
            ? { axisViewCameras: rawAxis as AxisViewCamerasState }
            : {}),
          ...(rawPerf && typeof rawPerf === 'object'
            ? { performanceSettings: rawPerf as PerformanceSettings }
            : {}),
        })
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

export interface InitialPlannerState {
  assets: Asset[]
  customTemplates: AssetTemplate[]
  floor: FloorSettings
  cameraView: CameraViewPreset
  uiMode: PlannerShellMode
  lighting: LightingSettings
  libraryOrganization: LibraryOrganizationState
  perspectiveCamera: PerspectiveCameraSettings
  axisViewCameras: AxisViewCamerasState
  performanceSettings: PerformanceSettings
  layoutSession?: LayoutSessionState
}

export function loadInitialPlannerState(): InitialPlannerState {
  const fallback: InitialPlannerState = {
    assets: createDefaultDemoLayout(),
    customTemplates: [],
    floor: { ...DEFAULT_FLOOR },
    cameraView: 'perspective',
    uiMode: 'edit',
    lighting: cloneLighting(DEFAULT_LIGHTING),
    libraryOrganization: ensureEigeneAssetsUserGroup(
      cloneLibraryOrganization(DEFAULT_LIBRARY_ORGANIZATION),
    ),
    perspectiveCamera: clonePerspective(sanitizePerspectiveCamera(undefined)),
    axisViewCameras: cloneAxisViewCameras(sanitizeAxisViewCameras(undefined)),
    performanceSettings: sanitizePerformanceSettings(undefined),
  }
  if (typeof localStorage === 'undefined') {
    return fallback
  }
  const stored = parseStoredPayload(localStorage.getItem(STORAGE_KEY))
  if (stored && stored.assets.length > 0) {
    const customTemplates = stored.customTemplates ?? []
    return {
      assets: stored.assets,
      customTemplates,
      floor: stored.floor ? cloneFloor(stored.floor) : { ...DEFAULT_FLOOR },
      cameraView: normalizeCameraViewPreset(stored.cameraView),
      uiMode: stored.uiMode ?? 'edit',
      lighting: stored.lighting ? cloneLighting(stored.lighting) : cloneLighting(DEFAULT_LIGHTING),
      libraryOrganization: ensureEigeneAssetsUserGroup(
        mergeLibraryOrgWithUserTemplates(stored.libraryOrganization, customTemplates),
      ),
      perspectiveCamera: clonePerspective(sanitizePerspectiveCamera(stored.perspectiveCamera)),
      axisViewCameras: cloneAxisViewCameras(sanitizeAxisViewCameras(stored.axisViewCameras)),
      performanceSettings: sanitizePerformanceSettings(stored.performanceSettings),
      layoutSession: stored.layoutSession
        ? sanitizeLayoutSession(stored.layoutSession)
        : undefined,
    }
  }
  return fallback
}

/** @deprecated use loadInitialPlannerState */
export function loadInitialAssets(): { assets: Asset[]; customTemplates: AssetTemplate[] } {
  const s = loadInitialPlannerState()
  return { assets: s.assets, customTemplates: s.customTemplates }
}

export function useAssetsStore(): AssetsStore {
  const [initial] = useState(() => loadInitialPlannerState())
  const [assets, setAssetsState] = useState<Asset[]>(initial.assets)
  const [customTemplates, setCustomTemplates] = useState<AssetTemplate[]>(
    initial.customTemplates,
  )
  const [floor, setFloorState] = useState<FloorSettings>(() => cloneFloor(initial.floor))
  const [cameraView, setCameraViewState] = useState<CameraViewPreset>(initial.cameraView)
  const [perspectiveCamera, setPerspectiveCameraState] = useState<PerspectiveCameraSettings>(
    () => clonePerspective(initial.perspectiveCamera),
  )
  const [axisViewCameras, setAxisViewCamerasState] = useState<AxisViewCamerasState>(() =>
    cloneAxisViewCameras(initial.axisViewCameras),
  )
  const [performanceSettings, setPerformanceSettingsState] = useState<PerformanceSettings>(
    () => ({ ...initial.performanceSettings }),
  )
  const [lighting, setLightingState] = useState<LightingSettings>(() =>
    cloneLighting(initial.lighting),
  )
  const [libraryOrganization, setLibraryOrganizationState] = useState<LibraryOrganizationState>(
    () => cloneLibraryOrganization(initial.libraryOrganization),
  )
  const [selectedIds, setSelectedIdsState] = useState<string[]>(() => {
    const s = initial.layoutSession
    if (!s?.selectedIds?.length) return []
    const byId = new Set(initial.assets.map((a) => a.id))
    return s.selectedIds.filter((id) => byId.has(id))
  })
  const [historyPast, setHistoryPast] = useState<HistorySnapshot[]>([])
  const [historyFuture, setHistoryFuture] = useState<HistorySnapshot[]>([])
  const [clipboard, setClipboard] = useState<Asset[]>([])
  const [slots, setSlots] = useState<LayoutSlot[]>(() => loadSlots())
  const layoutSessionSnapshotRef = useRef<LayoutSessionState | null>(null)
  const setLayoutSessionSnapshot = useCallback((s: LayoutSessionState | null) => {
    layoutSessionSnapshotRef.current = s
  }, [])

  const assetsRef = useRef(assets)
  const selectedIdsRef = useRef(selectedIds)
  const historyPastRef = useRef(historyPast)
  const historyFutureRef = useRef(historyFuture)
  const libraryOrganizationRef = useRef(libraryOrganization)
  const customTemplatesRef = useRef(customTemplates)
  const floorRef = useRef(floor)
  const lightingRef = useRef(lighting)
  const pasteOffsetRef = useRef(0)

  useLayoutEffect(() => {
    assetsRef.current = assets
    selectedIdsRef.current = selectedIds
    historyPastRef.current = historyPast
    historyFutureRef.current = historyFuture
    libraryOrganizationRef.current = libraryOrganization
    customTemplatesRef.current = customTemplates
    floorRef.current = floor
    lightingRef.current = lighting
  }, [
    assets,
    selectedIds,
    historyPast,
    historyFuture,
    libraryOrganization,
    customTemplates,
    floor,
    lighting,
  ])

  const templates: AssetTemplate[] = [...ASSET_TEMPLATES, ...customTemplates]

  const takeSnapshot = useCallback((): HistorySnapshot => {
    return {
      assets: cloneAssets(assetsRef.current),
      selectedIds: [...selectedIdsRef.current],
      libraryOrganization: cloneLibraryOrganization(libraryOrganizationRef.current),
      customTemplates: cloneCustomTemplatesForHistory(customTemplatesRef.current),
      floor: cloneFloor(floorRef.current),
      lighting: cloneLighting(lightingRef.current),
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

  const setFloor = useCallback(
    (patch: Partial<FloorSettings>) => {
      const snapshot = takeSnapshot()
      setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), snapshot])
      setHistoryFuture([])
      setFloorState((f) => sanitizeFloor({ ...f, ...patch }))
    },
    [takeSnapshot],
  )

  const setCameraView = useCallback((preset: CameraViewPreset) => {
    setCameraViewState(preset)
  }, [])

  const setPerspectiveCamera = useCallback((patch: Partial<PerspectiveCameraSettings>) => {
    setPerspectiveCameraState((prev) => {
      const next = { ...prev, ...patch }
      if (patch.target) {
        next.target = [patch.target[0], patch.target[1], patch.target[2]]
      }
      return next
    })
  }, [])

  const setAxisViewCamera = useCallback(
    <K extends keyof AxisViewCamerasState>(view: K, patch: Partial<AxisViewCamerasState[K]>) => {
      setAxisViewCamerasState((prev) =>
        sanitizeAxisViewCameras({ ...prev, [view]: { ...prev[view], ...patch } }),
      )
    },
    [],
  )

  const setPerformanceSettings = useCallback((patch: Partial<PerformanceSettings>) => {
    setPerformanceSettingsState((p) => ({ ...p, ...patch }))
  }, [])

  const setLighting = useCallback(
    (patch: Partial<LightingSettings>) => {
      const snapshot = takeSnapshot()
      setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), snapshot])
      setHistoryFuture([])
      setLightingState((s) => sanitizeLighting({ ...s, ...patch }))
    },
    [takeSnapshot],
  )

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
      const removed = assetsRef.current.filter((a) => ids.includes(a.id))
      const removedTypes = new Set(removed.map((r) => r.type))
      const nextAssets = assetsRef.current.filter((asset) => !ids.includes(asset.id))
      const nextSelected = selectedIdsRef.current.filter((id) => !ids.includes(id))
      let nextLib = cloneLibraryOrganization(libraryOrganizationRef.current)
      for (const t of removedTypes) {
        if (!nextAssets.some((a) => a.type === t)) {
          nextLib = removeTypeFromRecents(nextLib, t)
        }
      }
      const snapshot = takeSnapshot()
      setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), snapshot])
      setHistoryFuture([])
      setAssetsState(nextAssets)
      setSelectedIdsState(nextSelected)
      setLibraryOrganizationState(nextLib)
    },
    [takeSnapshot],
  )

  const updateAsset = useCallback(
    (id: string, patch: Partial<Asset>) => {
      const nextAssets = assetsRef.current.map((asset) =>
        asset.id === id
          ? cloneAsset({
              ...asset,
              ...patch,
              metadata: patch.metadata
                ? mergeAssetMetadata(asset.metadata, patch.metadata)
                : asset.metadata,
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
          metadata: patch.metadata
            ? mergeAssetMetadata(asset.metadata, patch.metadata)
            : asset.metadata,
          geometry: patch.geometry
            ? {
                kind: patch.geometry.kind,
                params: { ...patch.geometry.params },
              }
            : asset.geometry,
          visual: patch.visual ? { ...asset.visual, ...patch.visual } : asset.visual,
        })
      })
      applyChange(nextAssets, selectedIdsRef.current, true)
    },
    [applyChange],
  )

  const addTemplate = useCallback((template: AssetTemplate) => {
    setCustomTemplates((current) => [...current, template])
  }, [])

  const addCustomModelTemplate = useCallback(
    (
      name: string,
      modelUrl: string,
      options?: { modelFormat?: ModelFormat; category?: string },
    ) => {
      const template = createCustomModelTemplate(name, modelUrl, options)
      setCustomTemplates((current) => [...current, template])
      return template
    },
    [],
  )

  const importCustomModelTemplatesBatch = useCallback(
    (
      items: { name: string; modelUrl: string; modelFormat: ModelFormat }[],
      options?: { category?: string },
    ) => {
      if (items.length === 0) return []
      const snapshot = takeSnapshot()
      setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), snapshot])
      setHistoryFuture([])
      const ts = Date.now()
      const created: AssetTemplate[] = items.map((item, i) =>
        createCustomModelTemplate(item.name, item.modelUrl, {
          modelFormat: item.modelFormat,
          isUserAsset: true,
          createdAt: ts + i,
          category: options?.category,
        }),
      )
      setCustomTemplates((current) => [...current, ...created])
      setLibraryOrganizationState((prev) => {
        const withGroup = ensureEigeneAssetsUserGroup(prev)
        const next = cloneLibraryOrganization(withGroup)
        const map = { ...next.templateTypeToUserGroup }
        for (const t of created) {
          map[t.type] = EIGENE_ASSETS_USER_GROUP_ID
        }
        next.templateTypeToUserGroup = map
        return next
      })
      return created
    },
    [takeSnapshot],
  )

  const saveSceneAssetAsTemplate = useCallback(
    (asset: Asset, options: SaveSceneAssetTemplateOptions) => {
      const snapshot = takeSnapshot()
      setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), snapshot])
      setHistoryFuture([])
      const template = createTemplateFromSceneAsset(asset, options)
      setCustomTemplates((current) => [...current, template])
      setLibraryOrganizationState((prev) => {
        const withGroup = ensureEigeneAssetsUserGroup(prev)
        const next = cloneLibraryOrganization(withGroup)
        next.templateTypeToUserGroup = {
          ...next.templateTypeToUserGroup,
          [template.type]: EIGENE_ASSETS_USER_GROUP_ID,
        }
        return next
      })
      return template
    },
    [takeSnapshot],
  )

  const removeCustomTemplate = useCallback(
    (type: string) => {
      if (ASSET_TEMPLATES.some((t) => t.type === type)) return
      const snapshot = takeSnapshot()
      setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), snapshot])
      setHistoryFuture([])
      setCustomTemplates((current) => current.filter((t) => t.type !== type))
      setLibraryOrganizationState((prev) => {
        let next = removeTypeFromRecents(prev, type)
        next = cloneLibraryOrganization(next)
        delete next.templateTypeToUserGroup[type]
        next.favoriteTemplateTypes = next.favoriteTemplateTypes.filter((t) => t !== type)
        if (next.templateDisplayOverrides?.[type]) {
          next.templateDisplayOverrides = { ...next.templateDisplayOverrides }
          delete next.templateDisplayOverrides[type]
        }
        return next
      })
      const nextAssets = assetsRef.current.filter((a) => a.type !== type)
      const nextSelected = selectedIdsRef.current.filter((id) =>
        nextAssets.some((a) => a.id === id),
      )
      setAssetsState(nextAssets)
      setSelectedIdsState(nextSelected)
    },
    [takeSnapshot],
  )

  const addUserLibraryGroup = useCallback(
    (label: string): string | null => {
      const trimmed = label.trim()
      if (!trimmed) return null
      if (trimmed === EIGENE_ASSETS_USER_GROUP_LABEL) return null
      const snapshot = takeSnapshot()
      setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), snapshot])
      setHistoryFuture([])
      const id =
        typeof globalThis.crypto?.randomUUID === 'function'
          ? `ug-${globalThis.crypto.randomUUID()}`
          : `ug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      setLibraryOrganizationState((prev) => {
        const next = cloneLibraryOrganization(prev)
        next.userGroups = [...next.userGroups, { id, label: trimmed }]
        return next
      })
      return id
    },
    [takeSnapshot],
  )

  const removeUserLibraryGroup = useCallback(
    (groupId: string) => {
      if (groupId === EIGENE_ASSETS_USER_GROUP_ID) return
      const victim = libraryOrganizationRef.current.userGroups.find((g) => g.id === groupId)
      if (victim?.isSpecial) return
      const snapshot = takeSnapshot()
      setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), snapshot])
      setHistoryFuture([])
      setLibraryOrganizationState((prev) => {
        const next = cloneLibraryOrganization(prev)
        next.userGroups = next.userGroups.filter((g) => g.id !== groupId)
        for (const [t, gid] of Object.entries(next.templateTypeToUserGroup)) {
          if (gid === groupId) delete next.templateTypeToUserGroup[t]
        }
        return next
      })
    },
    [takeSnapshot],
  )

  const assignTemplateToUserGroup = useCallback(
    (templateType: string, userGroupId: string | null) => {
      const prev = libraryOrganizationRef.current
      if (
        userGroupId &&
        userGroupId !== EIGENE_ASSETS_USER_GROUP_ID &&
        !prev.userGroups.some((g) => g.id === userGroupId)
      ) {
        return
      }
      const snapshot = takeSnapshot()
      setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), snapshot])
      setHistoryFuture([])
      setLibraryOrganizationState((p) => {
        if (!userGroupId) {
          const next = cloneLibraryOrganization(p)
          delete next.templateTypeToUserGroup[templateType]
          return next
        }
        let base = cloneLibraryOrganization(p)
        if (userGroupId === EIGENE_ASSETS_USER_GROUP_ID) {
          base = ensureEigeneAssetsUserGroup(base)
        }
        const next = cloneLibraryOrganization(base)
        next.templateTypeToUserGroup[templateType] = userGroupId
        return next
      })
    },
    [takeSnapshot],
  )

  const cloneTemplateToUserGroup = useCallback(
    (templateType: string, userGroupId: string) => {
      const prevOrg = libraryOrganizationRef.current
      const customs = customTemplatesRef.current
      const source = [...ASSET_TEMPLATES, ...customs].find((t) => t.type === templateType)
      if (!source) return
      if (
        userGroupId !== EIGENE_ASSETS_USER_GROUP_ID &&
        !prevOrg.userGroups.some((g) => g.id === userGroupId)
      ) {
        return
      }
      if (prevOrg.templateTypeToUserGroup[templateType] === userGroupId) return

      const snapshot = takeSnapshot()
      setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), snapshot])
      setHistoryFuture([])

      const newType =
        typeof globalThis.crypto?.randomUUID === 'function'
          ? `tpl-${globalThis.crypto.randomUUID()}`
          : `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

      const displaySource = applyTemplateDisplayOverrides(source, prevOrg)
      const copyLabel = `${displaySource.label} (Kopie)`
      const cloned = duplicateLibraryTemplate(source, newType, copyLabel)

      setCustomTemplates((c) => [...c, cloned])
      setLibraryOrganizationState((p) => {
        let base = cloneLibraryOrganization(p)
        if (userGroupId === EIGENE_ASSETS_USER_GROUP_ID) {
          base = ensureEigeneAssetsUserGroup(base)
        }
        const next = cloneLibraryOrganization(base)
        next.templateTypeToUserGroup[newType] = userGroupId

        const ov = prevOrg.templateDisplayOverrides?.[templateType]
        if (ov) {
          const rest: TemplateDisplayOverride = {}
          if (ov.description !== undefined) rest.description = ov.description
          if (ov.tags?.length) rest.tags = [...ov.tags]
          if (Object.keys(rest).length > 0) {
            const map = { ...(next.templateDisplayOverrides ?? {}) }
            map[newType] = rest
            next.templateDisplayOverrides = map
          }
        }
        return next
      })
    },
    [takeSnapshot],
  )

  const toggleFavoriteTemplateType = useCallback(
    (templateType: string) => {
      const snapshot = takeSnapshot()
      setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), snapshot])
      setHistoryFuture([])
      setLibraryOrganizationState((prev) => {
        const next = cloneLibraryOrganization(prev)
        const i = next.favoriteTemplateTypes.indexOf(templateType)
        if (i >= 0) {
          next.favoriteTemplateTypes = next.favoriteTemplateTypes.filter((t) => t !== templateType)
        } else {
          next.favoriteTemplateTypes = [...next.favoriteTemplateTypes, templateType]
        }
        return next
      })
    },
    [takeSnapshot],
  )

  const updateTemplateLibraryMeta = useCallback(
    (
      templateType: string,
      patch: { label?: string; description?: string; tags?: string[] | null },
    ) => {
      const snapshot = takeSnapshot()
      setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), snapshot])
      setHistoryFuture([])
      const isCustom = customTemplates.some((t) => t.type === templateType)
      if (isCustom) {
        setCustomTemplates((current) =>
          current.map((t) => {
            if (t.type !== templateType) return t
            const nextLabel =
              patch.label !== undefined ? patch.label.trim() || t.label : t.label
            const nextDesc =
              patch.description !== undefined ? patch.description : t.metadata?.description
            const nextCustom = { ...(t.metadata?.customData ?? {}) }
            if (patch.tags !== undefined) {
              if (patch.tags === null || patch.tags.length === 0) {
                delete nextCustom.Tags
              } else {
                nextCustom.Tags = patch.tags.join(', ')
              }
            }
            return {
              ...t,
              label: nextLabel,
              metadata: {
                ...t.metadata,
                name: nextLabel,
                description: nextDesc,
                customData: nextCustom,
              },
            }
          }),
        )
        return
      }
      setLibraryOrganizationState((prev) => {
        const next = cloneLibraryOrganization(prev)
        const map = { ...(next.templateDisplayOverrides ?? {}) }
        const prevEntry = map[templateType] ?? {}
        const cur: TemplateDisplayOverride = {
          ...(prevEntry.label !== undefined ? { label: prevEntry.label } : {}),
          ...(prevEntry.description !== undefined ? { description: prevEntry.description } : {}),
          ...(prevEntry.tags ? { tags: [...prevEntry.tags] } : {}),
        }
        if (patch.label !== undefined) {
          const tr = patch.label.trim()
          if (tr) cur.label = tr
          else delete cur.label
        }
        if (patch.description !== undefined) {
          if (patch.description === '') delete cur.description
          else cur.description = patch.description
        }
        if (patch.tags !== undefined) {
          if (patch.tags === null || patch.tags.length === 0) delete cur.tags
          else cur.tags = [...patch.tags]
        }
        if (Object.keys(cur).length === 0) {
          delete map[templateType]
        } else {
          map[templateType] = cur
        }
        next.templateDisplayOverrides = map
        return next
      })
    },
    [customTemplates, takeSnapshot],
  )

  const recordRecentTemplatePlacement = useCallback((templateType: string) => {
    setLibraryOrganizationState((prev) => pushRecentTemplateType(prev, templateType))
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
    setLibraryOrganizationState(cloneLibraryOrganization(previous.libraryOrganization))
    setCustomTemplates(cloneCustomTemplatesForHistory(previous.customTemplates))
    setFloorState(cloneFloor(previous.floor))
    setLightingState(cloneLighting(previous.lighting))
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
    setLibraryOrganizationState(cloneLibraryOrganization(next.libraryOrganization))
    setCustomTemplates(cloneCustomTemplatesForHistory(next.customTemplates))
    setFloorState(cloneFloor(next.floor))
    setLightingState(cloneLighting(next.lighting))
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
      const snap = layoutSessionSnapshotRef.current
      const payload: StoredPayload = {
        version: STORAGE_VERSION,
        layoutFormatSemver: LAYOUT_FORMAT_SEMVER,
        assets: assetsRef.current,
        customTemplates,
        floor: cloneFloor(floor),
        cameraView,
        lighting: cloneLighting(lighting),
        libraryOrganization: cloneLibraryOrganization(libraryOrganization),
        perspectiveCamera: clonePerspective(perspectiveCamera),
        axisViewCameras: cloneAxisViewCameras(axisViewCameras),
        performanceSettings: { ...performanceSettings },
        ...(snap != null
          ? { layoutSession: sanitizeLayoutSession(snap) }
          : {}),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      console.error('Failed to save layout', error)
    }
  }, [
    axisViewCameras,
    cameraView,
    customTemplates,
    floor,
    lighting,
    libraryOrganization,
    perspectiveCamera,
    performanceSettings,
  ])

  const load = useCallback(():
    | { ok: true; layoutSession: LayoutSessionState | null; restorableSelectedIds: string[]; assets: Asset[] }
    | { ok: false } => {
    try {
      const parsed = parseStoredPayload(localStorage.getItem(STORAGE_KEY))
      if (!parsed) return { ok: false }
      setAssetsState(parsed.assets)
      setSelectedIdsState([])
      setHistoryPast([])
      setHistoryFuture([])
      setFloorState(cloneFloor(parsed.floor ? parsed.floor : DEFAULT_FLOOR))
      setCameraViewState(normalizeCameraViewPreset(parsed.cameraView))
      setLightingState(
        cloneLighting(parsed.lighting ? sanitizeLighting(parsed.lighting) : DEFAULT_LIGHTING),
      )
      setPerspectiveCameraState(clonePerspective(sanitizePerspectiveCamera(parsed.perspectiveCamera)))
      setAxisViewCamerasState(cloneAxisViewCameras(sanitizeAxisViewCameras(parsed.axisViewCameras)))
      setPerformanceSettingsState(sanitizePerformanceSettings(parsed.performanceSettings))
      const ct = parsed.customTemplates ?? []
      setCustomTemplates(ct)
      setLibraryOrganizationState(
        ensureEigeneAssetsUserGroup(
          mergeLibraryOrgWithUserTemplates(parsed.libraryOrganization, ct),
        ),
      )
      const session = parsed.layoutSession
        ? sanitizeLayoutSession(parsed.layoutSession)
        : null
      const byId = new Set(parsed.assets.map((a) => a.id))
      const restorableSelectedIds =
        session != null
          ? session.selectedIds.filter((id) => byId.has(id))
          : []
      return {
        ok: true,
        layoutSession: session,
        restorableSelectedIds,
        assets: parsed.assets,
      }
    } catch (error) {
      console.error('Failed to load layout', error)
      return { ok: false }
    }
  }, [])

  const reset = useCallback(() => {
    setFloorState({ ...DEFAULT_FLOOR })
    setCameraViewState('perspective')
    setPerspectiveCameraState(clonePerspective(sanitizePerspectiveCamera(undefined)))
    setAxisViewCamerasState(cloneAxisViewCameras(sanitizeAxisViewCameras(undefined)))
    setPerformanceSettingsState(sanitizePerformanceSettings(undefined))
    setLightingState(cloneLighting(DEFAULT_LIGHTING))
    setLibraryOrganizationState(
      ensureEigeneAssetsUserGroup(cloneLibraryOrganization(DEFAULT_LIBRARY_ORGANIZATION)),
    )
    applyChange(createDefaultDemoLayout(), [], true)
  }, [applyChange])

  const buildPayload = useCallback((): StoredPayload => {
    const snap = layoutSessionSnapshotRef.current
    return {
      version: STORAGE_VERSION,
      layoutFormatSemver: LAYOUT_FORMAT_SEMVER,
      assets: cloneAssets(assetsRef.current),
      floor: cloneFloor(floor),
      cameraView,
      lighting: cloneLighting(lighting),
      libraryOrganization: cloneLibraryOrganization(libraryOrganization),
      perspectiveCamera: clonePerspective(perspectiveCamera),
      axisViewCameras: cloneAxisViewCameras(axisViewCameras),
      performanceSettings: { ...performanceSettings },
      ...(snap != null ? { layoutSession: sanitizeLayoutSession(snap) } : {}),
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
  }, [
    axisViewCameras,
    cameraView,
    customTemplates,
    floor,
    lighting,
    libraryOrganization,
    perspectiveCamera,
    performanceSettings,
  ])

  const buildWorkspacePayload = useCallback((): StoredPayload => {
    const scene = assetsRef.current
    const usedTypes = new Set(scene.map((a) => a.type))
    const neededCustom = customTemplates
      .filter((t) => usedTypes.has(t.type))
      .map((template) => ({
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
      }))
    const snap = layoutSessionSnapshotRef.current
    return {
      version: STORAGE_VERSION,
      layoutFormatSemver: LAYOUT_FORMAT_SEMVER,
      exportKind: 'workspace',
      assets: cloneAssets(scene),
      floor: cloneFloor(floor),
      cameraView,
      lighting: cloneLighting(lighting),
      perspectiveCamera: clonePerspective(perspectiveCamera),
      axisViewCameras: cloneAxisViewCameras(axisViewCameras),
      performanceSettings: { ...performanceSettings },
      ...(snap != null ? { layoutSession: sanitizeLayoutSession(snap) } : {}),
      ...(neededCustom.length > 0 ? { customTemplates: neededCustom } : {}),
    }
  }, [
    axisViewCameras,
    cameraView,
    customTemplates,
    floor,
    lighting,
    perspectiveCamera,
    performanceSettings,
  ])

  const applyPayload = useCallback((payload: StoredPayload) => {
    const ct = payload.customTemplates ?? []
    setAssetsState(payload.assets)
    setSelectedIdsState([])
    setHistoryPast([])
    setHistoryFuture([])
    setFloorState(cloneFloor(payload.floor ? payload.floor : DEFAULT_FLOOR))
    setCameraViewState(normalizeCameraViewPreset(payload.cameraView))
    setLightingState(
      cloneLighting(payload.lighting ? sanitizeLighting(payload.lighting) : DEFAULT_LIGHTING),
    )
    setPerspectiveCameraState(clonePerspective(sanitizePerspectiveCamera(payload.perspectiveCamera)))
    setAxisViewCamerasState(cloneAxisViewCameras(sanitizeAxisViewCameras(payload.axisViewCameras)))
    setPerformanceSettingsState(sanitizePerformanceSettings(payload.performanceSettings))
    setCustomTemplates(ct)
    setLibraryOrganizationState(
      ensureEigeneAssetsUserGroup(
        mergeLibraryOrgWithUserTemplates(payload.libraryOrganization, ct),
      ),
    )
  }, [])

  const applyWorkspacePayload = useCallback((payload: StoredPayload) => {
    setCustomTemplates((current) =>
      mergeCustomTemplatesForImport(current, payload.customTemplates),
    )
    setLibraryOrganizationState((prev) => {
      const nextBase = ensureEigeneAssetsUserGroup(cloneLibraryOrganization(prev))
      const map = { ...nextBase.templateTypeToUserGroup }
      for (const t of payload.customTemplates ?? []) {
        if (t.isUserAsset && !map[t.type]) {
          map[t.type] = EIGENE_ASSETS_USER_GROUP_ID
        }
      }
      return { ...nextBase, templateTypeToUserGroup: map }
    })
    setAssetsState(cloneAssets(payload.assets))
    setSelectedIdsState([])
    setHistoryPast([])
    setHistoryFuture([])
    setFloorState(cloneFloor(payload.floor ? payload.floor : DEFAULT_FLOOR))
    setCameraViewState(normalizeCameraViewPreset(payload.cameraView))
    setLightingState(
      cloneLighting(payload.lighting ? sanitizeLighting(payload.lighting) : DEFAULT_LIGHTING),
    )
    setPerspectiveCameraState(clonePerspective(sanitizePerspectiveCamera(payload.perspectiveCamera)))
    setAxisViewCamerasState(cloneAxisViewCameras(sanitizeAxisViewCameras(payload.axisViewCameras)))
    setPerformanceSettingsState(sanitizePerformanceSettings(payload.performanceSettings))
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
    (options?: {
      suggestedName?: string
      kind?: LayoutExportKind
      shellMode?: PlannerShellMode
      librarySectionExpanded?: Record<string, boolean>
    }) => {
      try {
        const kind = options?.kind ?? 'complete'
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
        const defaultStem =
          kind === 'workspace' ? `layout_${stamp}` : `factory_layout_complete_${stamp}`
        const payload: StoredPayload =
          kind === 'workspace'
            ? buildWorkspacePayload()
            : {
                ...buildPayload(),
                exportKind: 'complete',
                ...(options?.shellMode ? { shellMode: options.shellMode } : {}),
                ...(options?.librarySectionExpanded &&
                Object.keys(options.librarySectionExpanded).length > 0
                  ? { librarySectionExpanded: options.librarySectionExpanded }
                  : {}),
              }
        const data = JSON.stringify(payload, null, 2)
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const stem = (options?.suggestedName ?? defaultStem).replace(/[^a-z0-9_-]+/gi, '-')
        const filename = `${stem}.json`
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
    [buildPayload, buildWorkspacePayload],
  )

  const importLayoutFromData = useCallback(
    (data: unknown): LayoutImportResult => {
      try {
        let payload: StoredPayload | null = null
        if (Array.isArray(data)) {
          const assets = data
            .map((a) => sanitizeAsset(a))
            .filter((a): a is Asset => a !== null)
          if (assets.length === 0) return { ok: false }
          payload = finalizeImportedPayload({
            version: 1,
            assets,
            floor: { ...DEFAULT_FLOOR },
            cameraView: normalizeCameraViewPreset(undefined),
            lighting: cloneLighting(DEFAULT_LIGHTING),
            libraryOrganization: cloneLibraryOrganization(DEFAULT_LIBRARY_ORGANIZATION),
          })
        } else if (data && typeof data === 'object') {
          const entry = data as Record<string, unknown>
          const rawAssets = Array.isArray(entry.assets) ? entry.assets : []
          const assets = rawAssets
            .map((a) => sanitizeAsset(a))
            .filter((a): a is Asset => a !== null)
          const customTemplates = Array.isArray(entry.customTemplates)
            ? (entry.customTemplates as AssetTemplate[])
            : undefined
          let exportKind: LayoutExportKind | undefined
          if (entry.exportKind === 'workspace' || entry.exportKind === 'complete') {
            exportKind = entry.exportKind
          }
          let librarySectionExpanded: Record<string, boolean> | undefined
          if (
            entry.librarySectionExpanded &&
            typeof entry.librarySectionExpanded === 'object' &&
            !Array.isArray(entry.librarySectionExpanded)
          ) {
            const o: Record<string, boolean> = {}
            for (const [k, v] of Object.entries(
              entry.librarySectionExpanded as Record<string, unknown>,
            )) {
              if (v === true) o[k] = true
            }
            if (Object.keys(o).length > 0) librarySectionExpanded = o
          }
          const rawPerspective = entry.perspectiveCamera
          const rawPerf = entry.performanceSettings
          const rawAxis = entry.axisViewCameras
          payload = finalizeImportedPayload({
            version: typeof entry.version === 'number' ? entry.version : 1,
            assets,
            customTemplates,
            floor: sanitizeFloor(entry.floor),
            cameraView: sanitizeCameraView(entry.cameraView),
            uiMode: sanitizeUiMode(entry.uiMode),
            lighting: sanitizeLighting(entry.lighting),
            libraryOrganization: sanitizeLibraryOrganization(entry.libraryOrganization),
            exportKind,
            shellMode:
              sanitizeUiMode(entry.shellMode) ?? sanitizeUiMode(entry.uiMode),
            librarySectionExpanded,
            ...(rawPerspective && typeof rawPerspective === 'object'
              ? { perspectiveCamera: rawPerspective as PerspectiveCameraSettings }
              : {}),
            ...(rawAxis && typeof rawAxis === 'object'
              ? { axisViewCameras: rawAxis as AxisViewCamerasState }
              : {}),
            ...(rawPerf && typeof rawPerf === 'object'
              ? { performanceSettings: rawPerf as PerformanceSettings }
              : {}),
          })
        }
        if (!payload) return { ok: false }
        if (payload.exportKind === 'workspace') {
          applyWorkspacePayload(payload)
          return { ok: true }
        }
        if (payload.assets.length === 0) return { ok: false }
        applyPayload(payload)
        return {
          ok: true,
          librarySectionExpanded: payload.librarySectionExpanded,
          shellMode: payload.shellMode,
        }
      } catch (error) {
        console.error('Failed to import layout', error)
        return { ok: false }
      }
    },
    [applyPayload, applyWorkspacePayload],
  )

  const importLayoutFromFile = useCallback(
    (file: File): Promise<LayoutImportResult> => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          try {
            const text = String(reader.result ?? '')
            const data = JSON.parse(text) as unknown
            resolve(importLayoutFromData(data))
          } catch (error) {
            console.error('Failed to parse imported layout', error)
            resolve({ ok: false })
          }
        }
        reader.onerror = () => resolve({ ok: false })
        reader.readAsText(file)
      })
    },
    [importLayoutFromData],
  )

  return {
    assets,
    templates,
    customTemplates,
    floor,
    setFloor,
    cameraView,
    setCameraView,
    perspectiveCamera,
    setPerspectiveCamera,
    axisViewCameras,
    setAxisViewCamera,
    performanceSettings,
    setPerformanceSettings,
    lighting,
    setLighting,
    selectedIds,
    setSelectedIds,
    addAsset,
    addAssets,
    removeAssets,
    updateAsset,
    updateAssets,
    addTemplate,
    addCustomModelTemplate,
    importCustomModelTemplatesBatch,
    saveSceneAssetAsTemplate,
    removeCustomTemplate,
    libraryOrganization,
    addUserLibraryGroup,
    removeUserLibraryGroup,
    assignTemplateToUserGroup,
    cloneTemplateToUserGroup,
    toggleFavoriteTemplateType,
    updateTemplateLibraryMeta,
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
    recordRecentTemplatePlacement,
    initialLayoutSession: initial.layoutSession,
    setLayoutSessionSnapshot,
  }
}
