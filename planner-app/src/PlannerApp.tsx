import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls, TransformControls } from '@react-three/drei'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  Euler,
  Group,
  Quaternion,
  Vector3,
  type Vector3Tuple,
} from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import './App.css'
import AnimatedCameraRig, { CAMERA_PRESETS } from './components/AnimatedCameraRig'
import AssetInfoModal from './components/AssetInfoModal'
import AssetRenderer, { GhostAssetRenderer } from './components/AssetRenderer'
import ColorPickerPopover from './components/ColorPickerPopover'
import FactoryFloor from './components/FactoryFloor'
import Lighting from './components/Lighting'
import LoadLayoutModal from './components/LoadLayoutModal'
import ScenePlacementRaycast from './components/ScenePlacementRaycast'
import ShortcutsModal from './components/ShortcutsModal'
import ViewModeOverlay from './components/ViewModeOverlay'

import {
  CATEGORY_WALLS,
  getTemplatesByCategory,
  createAssetFromTemplate,
  geometryKindSupports2D,
} from './AssetFactory'
import { useAssetsStore } from './store/useAssetsStore'
import type { Asset, AssetTemplate, MaterialMode } from './types/asset'
import { resolveAssetOpacity, sanitizeColor } from './types/asset'
import type { CameraViewPreset } from './types/plannerUi'

type PlannerTool = 'select' | 'place'
type PlannerMode = 'edit' | 'view'
type TransformMode = 'translate' | 'rotate' | 'scale'

const SNAP_UNIT = 1
const FALLBACK_ASSET_COLOR = '#8ca0b6'
const TEMPLATE_GROUP_EXPANDED_STORAGE_KEY = 'factory-template-group-expanded'
const HOVER_POINTER_OUT_DEBOUNCE_MS = 50

function readTemplateGroupExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(TEMPLATE_GROUP_EXPANDED_STORAGE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return {}
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (typeof v === 'boolean') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

const round2 = (value: number) => Number(value.toFixed(2))
const formatNumber = (value: number) => String(round2(value))
const radToDeg = (value: number) => round2((value * 180) / Math.PI)
const degToRad = (value: number) => round2((value * Math.PI) / 180)
const isFiniteNumber = (value: number) => Number.isFinite(value)
const parseFiniteInput = (rawValue: string): number | null => {
  const parsed = Number(rawValue)
  return isFiniteNumber(parsed) ? parsed : null
}

function isEditableTarget(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable
}

function resolvePlacementPosition(
  point: Vector3Tuple,
  freePlacement: boolean,
  template: AssetTemplate,
): Vector3Tuple {
  const x = freePlacement ? point[0] : Math.round(point[0] / SNAP_UNIT) * SNAP_UNIT
  const z = freePlacement ? point[2] : Math.round(point[2] / SNAP_UNIT) * SNAP_UNIT
  const isFlat = geometryKindSupports2D(template.geometry.kind)
  const y = isFlat ? 0.02 : template.scale[1] / 2
  return [round2(x), round2(y), round2(z)]
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'))
    reader.readAsDataURL(file)
  })
}

const ALLOWED_MODEL_EXTENSIONS = ['glb', 'gltf', 'stl'] as const
type AllowedModelExtension = (typeof ALLOWED_MODEL_EXTENSIONS)[number]
const MAX_MODEL_SIZE_BYTES = 20 * 1024 * 1024

function getExtension(filename: string): string {
  const match = /\.([^./\\]+)$/.exec(filename)
  return match ? match[1].toLowerCase() : ''
}

function isAllowedModelExtension(ext: string): ext is AllowedModelExtension {
  return (ALLOWED_MODEL_EXTENSIONS as readonly string[]).includes(ext)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ButtonGroup({ children }: { children: ReactNode }) {
  return <div className="toolbar-button-group">{children}</div>
}

function ToolbarSeparator() {
  return <span className="toolbar-separator" aria-hidden="true" />
}

// --- Inputs

interface NumericInputProps {
  label: string
  value: number
  step?: string
  onCommit: (value: number) => void
  disabled?: boolean
}

function NumericInput({ label, value, onCommit, disabled }: NumericInputProps) {
  const [draft, setDraft] = useState(formatNumber(value))
  const [editing, setEditing] = useState(false)

  const commitDraft = useCallback(() => {
    const parsed = parseFiniteInput(draft)
    if (parsed === null) {
      setDraft(formatNumber(value))
      setEditing(false)
      return
    }
    const normalized = round2(parsed)
    onCommit(normalized)
    setDraft(formatNumber(normalized))
    setEditing(false)
  }, [draft, onCommit, value])

  return (
    <label className={disabled ? 'input-disabled' : undefined}>
      {label}
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={editing ? draft : formatNumber(value)}
        onFocus={() => {
          setDraft(formatNumber(value))
          setEditing(true)
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commitDraft()
          if (event.key === 'Escape') {
            setDraft(formatNumber(value))
            setEditing(false)
          }
        }}
      />
    </label>
  )
}

// --- Transform gizmos

interface SingleTransformGizmoProps {
  asset: Asset
  mode: TransformMode
  isCtrlPressed: boolean
  orbitRef: RefObject<OrbitControlsImpl | null>
  onCommit: (id: string, patch: Partial<Asset>) => void
  children?: React.ReactNode
}

function SingleTransformGizmo({
  asset,
  mode,
  isCtrlPressed,
  orbitRef,
  onCommit,
  children,
}: SingleTransformGizmoProps) {
  const groupRef = useRef<Group>(null!)
  const draggingRef = useRef(false)

  useEffect(() => {
    const group = groupRef.current
    if (!group || draggingRef.current) return
    group.position.set(...asset.position)
    group.rotation.set(asset.rotation[0], asset.rotation[1], asset.rotation[2])
    group.scale.set(asset.scale[0], asset.scale[1], asset.scale[2])
  }, [asset.position, asset.rotation, asset.scale])

  const finishDrag = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (orbitRef.current) orbitRef.current.enabled = true

    const group = groupRef.current
    if (!group) return
    const nextPosition: Vector3Tuple = [
      round2(group.position.x),
      round2(group.position.y),
      round2(group.position.z),
    ]
    const nextRotation: Vector3Tuple = [
      round2(group.rotation.x),
      round2(group.rotation.y),
      round2(group.rotation.z),
    ]
    const nextScale: Vector3Tuple = [
      Math.max(round2(group.scale.x), 0.02),
      Math.max(round2(group.scale.y), 0.02),
      Math.max(round2(group.scale.z), 0.02),
    ]
    onCommit(asset.id, { position: nextPosition, rotation: nextRotation, scale: nextScale })
  }, [asset.id, onCommit, orbitRef])

  useEffect(() => {
    const onPointerUp = () => finishDrag()
    const onWindowBlur = () => finishDrag()
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [finishDrag])

  return (
    <group>
      <group
        ref={groupRef}
        position={asset.position}
        rotation={asset.rotation}
        scale={asset.scale}
      >
        {children}
      </group>
      <TransformControls
        object={groupRef}
        mode={mode}
        translationSnap={mode === 'translate' && !isCtrlPressed ? SNAP_UNIT : undefined}
        rotationSnap={mode === 'rotate' && !isCtrlPressed ? Math.PI / 8 : undefined}
        onMouseDown={() => {
          draggingRef.current = true
          if (orbitRef.current) orbitRef.current.enabled = false
        }}
        onMouseUp={finishDrag}
      />
    </group>
  )
}

interface MultiTransformGizmoProps {
  selectedAssets: Asset[]
  mode: TransformMode
  isCtrlPressed: boolean
  orbitRef: RefObject<OrbitControlsImpl | null>
  onCommit: (updates: Array<{ id: string; patch: Partial<Asset> }>) => void
}

function MultiTransformGizmo({
  selectedAssets,
  mode,
  isCtrlPressed,
  orbitRef,
  onCommit,
}: MultiTransformGizmoProps) {
  const pivotRef = useRef<Group>(null!)
  const draggingRef = useRef(false)
  const dragStartRef = useRef<{
    pivotPosition: Vector3
    pivotQuaternion: Quaternion
    pivotScale: Vector3
    assets: Array<{
      id: string
      position: Vector3
      quaternion: Quaternion
      scale: Vector3
    }>
  } | null>(null)

  const center = useMemo(() => {
    if (selectedAssets.length === 0) return [0, 0, 0] as Vector3Tuple
    const sum = selectedAssets.reduce<Vector3Tuple>(
      (acc, asset) => [
        acc[0] + asset.position[0],
        acc[1] + asset.position[1],
        acc[2] + asset.position[2],
      ],
      [0, 0, 0],
    )
    return [
      round2(sum[0] / selectedAssets.length),
      round2(sum[1] / selectedAssets.length),
      round2(sum[2] / selectedAssets.length),
    ] as Vector3Tuple
  }, [selectedAssets])

  useEffect(() => {
    const pivot = pivotRef.current
    if (!pivot || draggingRef.current) return
    pivot.position.set(...center)
    pivot.rotation.set(0, 0, 0)
    pivot.scale.set(1, 1, 1)
  }, [center])

  const finishDrag = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (orbitRef.current) orbitRef.current.enabled = true

    const pivot = pivotRef.current
    const start = dragStartRef.current
    if (!pivot || !start) return

    const deltaPosition = pivot.position.clone().sub(start.pivotPosition)
    const deltaQuaternion = pivot.quaternion.clone().multiply(start.pivotQuaternion.clone().invert())
    const scaleRatio = new Vector3(
      pivot.scale.x / start.pivotScale.x,
      pivot.scale.y / start.pivotScale.y,
      pivot.scale.z / start.pivotScale.z,
    )

    const updates = start.assets.map((assetStart) => {
      const rotatedOffset = assetStart.position
        .clone()
        .sub(start.pivotPosition)
        .applyQuaternion(deltaQuaternion)
      const nextPos = start.pivotPosition.clone().add(rotatedOffset).add(deltaPosition)
      const nextQuat = deltaQuaternion.clone().multiply(assetStart.quaternion)
      const nextEuler = new Euler().setFromQuaternion(nextQuat, 'XYZ')
      const nextScale = new Vector3(
        assetStart.scale.x * scaleRatio.x,
        assetStart.scale.y * scaleRatio.y,
        assetStart.scale.z * scaleRatio.z,
      )
      return {
        id: assetStart.id,
        patch: {
          position: [round2(nextPos.x), round2(nextPos.y), round2(nextPos.z)] as Vector3Tuple,
          rotation: [round2(nextEuler.x), round2(nextEuler.y), round2(nextEuler.z)] as Vector3Tuple,
          scale: [
            Math.max(round2(nextScale.x), 0.02),
            Math.max(round2(nextScale.y), 0.02),
            Math.max(round2(nextScale.z), 0.02),
          ] as Vector3Tuple,
        } satisfies Partial<Asset>,
      }
    })

    onCommit(updates)
    dragStartRef.current = null
  }, [onCommit, orbitRef])

  useEffect(() => {
    const onPointerUp = () => finishDrag()
    const onBlur = () => finishDrag()
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [finishDrag])

  return (
    <group>
      <group ref={pivotRef} position={center} />
      <TransformControls
        object={pivotRef}
        mode={mode}
        translationSnap={mode === 'translate' && !isCtrlPressed ? SNAP_UNIT : undefined}
        rotationSnap={mode === 'rotate' && !isCtrlPressed ? Math.PI / 8 : undefined}
        onMouseDown={() => {
          const pivot = pivotRef.current
          draggingRef.current = true
          if (orbitRef.current) orbitRef.current.enabled = false
          dragStartRef.current = {
            pivotPosition: pivot.position.clone(),
            pivotQuaternion: pivot.quaternion.clone(),
            pivotScale: pivot.scale.clone(),
            assets: selectedAssets.map((asset) => ({
              id: asset.id,
              position: new Vector3(...asset.position),
              quaternion: new Quaternion().setFromEuler(new Euler(...asset.rotation, 'XYZ')),
              scale: new Vector3(...asset.scale),
            })),
          }
        }}
        onMouseUp={finishDrag}
      />
    </group>
  )
}

// --- Main PlannerApp

export default function PlannerApp() {
  const orbitRef = useRef<OrbitControlsImpl | null>(null)
  const store = useAssetsStore()

  const [mode, setMode] = useState<PlannerMode>('edit')
  const [tool, setTool] = useState<PlannerTool>('select')
  const [transformMode, setTransformMode] = useState<TransformMode>('translate')
  const [selectedTemplateType, setSelectedTemplateType] = useState<string | null>(null)
  const [previewPosition, setPreviewPosition] = useState<Vector3Tuple | null>(null)
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [infoAssetId, setInfoAssetId] = useState<string | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false)
  const [floorInspectorOpen, setFloorInspectorOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [uploadAsWall, setUploadAsWall] = useState(false)

  const {
    assets,
    templates,
    floor,
    setFloor,
    cameraView,
    setCameraView,
    selectedIds,
    setSelectedIds,
    addAsset,
    removeAssets,
    updateAsset,
    updateAssets,
    addCustomModelTemplate,
    undo,
    redo,
    canUndo,
    canRedo,
    copy,
    paste,
    canPaste,
    save,
    load,
    slots,
    saveSlot,
    loadSlot,
    deleteSlot,
    renameSlot,
    exportLayout,
    importLayoutFromFile,
  } = store

  const activeTemplateType = selectedTemplateType ?? templates[0]?.type ?? null
  const activeTemplate = useMemo(
    () => templates.find((template) => template.type === activeTemplateType) ?? null,
    [activeTemplateType, templates],
  )

  const groupedTemplates = useMemo(() => getTemplatesByCategory(templates), [templates])

  const [templateGroupExpanded, setTemplateGroupExpanded] = useState<Record<string, boolean>>(
    readTemplateGroupExpanded,
  )

  useEffect(() => {
    setTemplateGroupExpanded((prev) => {
      let changed = false
      const next = { ...prev }
      for (const cat of Object.keys(groupedTemplates)) {
        if (!(cat in next)) {
          next[cat] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [groupedTemplates])

  const toggleTemplateGroup = useCallback((category: string) => {
    setTemplateGroupExpanded((prev) => {
      const currentlyOpen = prev[category] !== false
      const next = { ...prev, [category]: !currentlyOpen }
      try {
        localStorage.setItem(TEMPLATE_GROUP_EXPANDED_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore quota / private mode */
      }
      return next
    })
  }, [])

  useEffect(
    () => () => {
      if (hoverLeaveTimerRef.current) {
        clearTimeout(hoverLeaveTimerRef.current)
      }
    },
    [],
  )

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.includes(asset.id)),
    [assets, selectedIds],
  )
  const singleSelected = selectedAssets.length === 1 ? selectedAssets[0] : null
  const transformableSelected = useMemo(
    () => selectedAssets.filter((asset) => !asset.isLocked),
    [selectedAssets],
  )
  const canUseTransform = useMemo(() => {
    if (selectedAssets.length === 0) return false
    if (selectedAssets.length === 1) return !selectedAssets[0].isLocked
    return transformableSelected.length > 1
  }, [selectedAssets, transformableSelected])

  const infoAsset = useMemo(
    () => (infoAssetId ? assets.find((asset) => asset.id === infoAssetId) ?? null : null),
    [assets, infoAssetId],
  )

  const changeMode = useCallback((nextMode: PlannerMode) => {
    setMode(nextMode)
    if (nextMode === 'view') {
      setTool('select')
      setPreviewPosition(null)
    }
    setHoveredId(null)
    setInfoAssetId(null)
    setFloorInspectorOpen(false)
  }, [])

  const changeTool = useCallback((nextTool: PlannerTool) => {
    setTool(nextTool)
    setHoveredId(null)
    setFloorInspectorOpen(false)
    if (nextTool !== 'place') {
      setPreviewPosition(null)
    }
  }, [])

  const onAssetClick = useCallback(
    (event: ThreeEvent<MouseEvent>, asset: Asset) => {
      event.stopPropagation()
      if (mode === 'view') {
        setInfoAssetId(asset.id)
        return
      }
      if (tool === 'place') return
      if (event.ctrlKey || event.metaKey) return
      setFloorInspectorOpen(false)
      if (event.shiftKey) {
        setSelectedIds(
          selectedIds.includes(asset.id)
            ? selectedIds.filter((id) => id !== asset.id)
            : [...selectedIds, asset.id],
        )
        return
      }
      setSelectedIds([asset.id])
    },
    [mode, selectedIds, setSelectedIds, tool],
  )

  const onAssetPointerOver = useCallback(
    (_event: ThreeEvent<PointerEvent>, asset: Asset) => {
      if (hoverLeaveTimerRef.current) {
        clearTimeout(hoverLeaveTimerRef.current)
        hoverLeaveTimerRef.current = null
      }
      setHoveredId(asset.id)
    },
    [],
  )
  const onAssetPointerOut = useCallback((_event: ThreeEvent<PointerEvent>, asset: Asset) => {
    const id = asset.id
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current)
    }
    hoverLeaveTimerRef.current = setTimeout(() => {
      hoverLeaveTimerRef.current = null
      setHoveredId((current) => (current === id ? null : current))
    }, HOVER_POINTER_OUT_DEBOUNCE_MS)
  }, [])

  const onFloorHover = useCallback(
    (point: Vector3Tuple) => {
      if (mode !== 'edit' || tool !== 'place' || !activeTemplate) return
      const position = resolvePlacementPosition(point, isCtrlPressed, activeTemplate)
      setPreviewPosition(position)
    },
    [activeTemplate, isCtrlPressed, mode, tool],
  )

  const onFloorAction = useCallback(
    (point: Vector3Tuple) => {
      if (mode !== 'edit') {
        return
      }
      if (tool === 'place' && activeTemplate) {
        const position = resolvePlacementPosition(point, isCtrlPressed, activeTemplate)
        const asset = createAssetFromTemplate(activeTemplate, { position })
        addAsset(asset)
        return
      }
      setSelectedIds([])
      setFloorInspectorOpen(true)
    },
    [activeTemplate, addAsset, isCtrlPressed, mode, setSelectedIds, tool],
  )

  const onRemoveSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    removeAssets(selectedIds)
  }, [removeAssets, selectedIds])

  const flashFeedback = useCallback((message: string) => {
    setSaveFeedback(message)
    window.setTimeout(() => setSaveFeedback(null), 2200)
  }, [])

  const onSaveLayout = useCallback(() => {
    save()
    flashFeedback('Gespeichert (Auto-Slot)')
  }, [flashFeedback, save])

  const onSaveSlot = useCallback(() => {
    const suggested = `Layout ${new Date().toLocaleString()}`
    const name = window.prompt('Name fuer den Layout-Slot:', suggested)
    if (name === null) return
    const slot = saveSlot(name)
    flashFeedback(`Slot "${slot.name}" gespeichert`)
  }, [flashFeedback, saveSlot])

  const onExportLayout = useCallback(() => {
    const suggested = `factory-layout-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`
    exportLayout(suggested)
    flashFeedback('Export gestartet')
  }, [exportLayout, flashFeedback])

  const onOpenLoadModal = useCallback(() => {
    setIsLoadModalOpen(true)
  }, [])

  const onCloseLoadModal = useCallback(() => {
    setIsLoadModalOpen(false)
  }, [])

  const handleLoadCurrentAutoSlot = useCallback((): boolean => {
    return load()
  }, [load])

  const onUploadAsset = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      try {
        if (!file) return

        const ext = getExtension(file.name)
        if (!isAllowedModelExtension(ext)) {
          flashFeedback(
            `Format nicht unterstuetzt (${ext || 'unbekannt'}). Erlaubt: ${ALLOWED_MODEL_EXTENSIONS.join(', ')}`,
          )
          return
        }
        if (file.size > MAX_MODEL_SIZE_BYTES) {
          flashFeedback(
            `Datei zu gross (${formatBytes(file.size)}). Limit: ${formatBytes(MAX_MODEL_SIZE_BYTES)}`,
          )
          return
        }

        const modelUrl = await readFileAsDataUrl(file)
        const label = file.name.replace(/\.[^/.]+$/, '') || 'Custom Asset'
        const template = addCustomModelTemplate(label, modelUrl, {
          modelFormat: ext,
          category: uploadAsWall ? CATEGORY_WALLS : undefined,
        })
        setSelectedTemplateType(template.type)
        changeTool('place')
        flashFeedback(`${ext.toUpperCase()} importiert: ${label}`)
      } catch (error) {
        console.error('Upload failed', error)
        flashFeedback('Upload fehlgeschlagen')
      } finally {
        event.target.value = ''
      }
    },
    [addCustomModelTemplate, changeTool, flashFeedback, uploadAsWall],
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const editable = isEditableTarget(event.target)
      const hasModifier = event.ctrlKey || event.metaKey

      if (event.key === 'Control' || event.key === 'Meta') {
        setIsCtrlPressed(true)
      }

      if (mode === 'view') {
        if (!editable && event.key === 'Escape') {
          setInfoAssetId(null)
        }
        return
      }

      if (hasModifier && !editable && key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
        return
      }
      if (hasModifier && !editable && ((key === 'z' && event.shiftKey) || key === 'y')) {
        event.preventDefault()
        redo()
        return
      }
      if (hasModifier && !editable && key === 'c') {
        event.preventDefault()
        copy()
        return
      }
      if (hasModifier && !editable && key === 'v') {
        event.preventDefault()
        paste()
        return
      }

      if (editable) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        onRemoveSelected()
      }
      if (event.key === 'Escape') {
        changeTool('select')
        setInfoAssetId(null)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control' || event.key === 'Meta') {
        setIsCtrlPressed(false)
      }
    }

    const handleBlur = () => setIsCtrlPressed(false)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [changeTool, copy, mode, onRemoveSelected, paste, redo, undo])

  const updateSingleMetadata = useCallback(
    (
      key: string,
      value: string,
      kind: 'name' | 'description' | 'zoneType' | 'text' | 'custom',
    ) => {
      if (!singleSelected) return
      if (kind === 'custom') {
        updateAsset(singleSelected.id, {
          metadata: {
            customData: {
              ...(singleSelected.metadata.customData ?? {}),
              [key]: value,
            },
          },
        })
      } else {
        updateAsset(singleSelected.id, {
          metadata: {
            ...singleSelected.metadata,
            [kind]: value,
          },
        })
      }
    },
    [singleSelected, updateAsset],
  )

  const removeCustomMetadataKey = useCallback(
    (key: string) => {
      if (!singleSelected) return
      const nextCustom = { ...(singleSelected.metadata.customData ?? {}) }
      delete nextCustom[key]
      updateAsset(singleSelected.id, {
        metadata: {
          ...singleSelected.metadata,
          customData: nextCustom,
        },
      })
    },
    [singleSelected, updateAsset],
  )

  const addCustomMetadataField = useCallback(() => {
    if (!singleSelected) return
    const base = 'Feld'
    const existing = Object.keys(singleSelected.metadata.customData ?? {})
    let counter = existing.length + 1
    let newKey = `${base} ${counter}`
    while (existing.includes(newKey)) {
      counter += 1
      newKey = `${base} ${counter}`
    }
    updateAsset(singleSelected.id, {
      metadata: {
        ...singleSelected.metadata,
        customData: {
          ...(singleSelected.metadata.customData ?? {}),
          [newKey]: '',
        },
      },
    })
  }, [singleSelected, updateAsset])

  // Preview template for ghost placement
  const ghostAsset: Asset | null = useMemo(() => {
    if (mode !== 'edit' || tool !== 'place' || !activeTemplate || !previewPosition) return null
    return createAssetFromTemplate(activeTemplate, { position: previewPosition })
  }, [activeTemplate, mode, previewPosition, tool])

  return (
    <div className={`planner-shell mode-${mode}`}>
      {isLoadModalOpen && (
        <LoadLayoutModal
          slots={slots}
          onClose={onCloseLoadModal}
          onLoadSlot={loadSlot}
          onDeleteSlot={deleteSlot}
          onRenameSlot={renameSlot}
          onLoadFile={importLayoutFromFile}
          onLoadCurrent={handleLoadCurrentAutoSlot}
        />
      )}
      <header className="top-bar top-bar-grouped">
        <span className="toolbar-title">Factory Planning Studio</span>

        <div className={`mode-switch mode-${mode}`}>
          <span className="mode-badge" data-mode={mode} aria-live="polite">
            {mode === 'edit' ? 'EDIT MODE' : 'VIEW MODE'}
          </span>
          <button
            type="button"
            className={mode === 'edit' ? 'active' : ''}
            onClick={() => changeMode('edit')}
          >
            Bearbeiten
          </button>
          <button
            type="button"
            className={mode === 'view' ? 'active' : ''}
            onClick={() => changeMode('view')}
          >
            Praesentation
          </button>
        </div>

        <ToolbarSeparator />

        {mode === 'edit' && (
          <>
            <ButtonGroup>
              <button
                type="button"
                className={tool === 'select' ? 'active' : ''}
                onClick={() => changeTool('select')}
              >
                Auswahl
              </button>
              <button
                type="button"
                className={tool === 'place' ? 'active' : ''}
                onClick={() => changeTool('place')}
              >
                Platzieren
              </button>
            </ButtonGroup>
            <ToolbarSeparator />
            <ButtonGroup>
              <button
                type="button"
                className={transformMode === 'translate' ? 'active' : ''}
                onClick={() => setTransformMode('translate')}
                disabled={!canUseTransform}
                title={
                  !canUseTransform && selectedAssets.some((a) => a.isLocked)
                    ? 'Asset ist gesperrt'
                    : undefined
                }
              >
                Bewegen
              </button>
              <button
                type="button"
                className={transformMode === 'rotate' ? 'active' : ''}
                onClick={() => setTransformMode('rotate')}
                disabled={!canUseTransform}
                title={
                  !canUseTransform && selectedAssets.some((a) => a.isLocked)
                    ? 'Asset ist gesperrt'
                    : undefined
                }
              >
                Drehen
              </button>
              <button
                type="button"
                className={transformMode === 'scale' ? 'active' : ''}
                onClick={() => setTransformMode('scale')}
                disabled={!canUseTransform}
                title={
                  !canUseTransform && selectedAssets.some((a) => a.isLocked)
                    ? 'Asset ist gesperrt'
                    : undefined
                }
              >
                Skalieren
              </button>
            </ButtonGroup>
            <ToolbarSeparator />
            <ButtonGroup>
              <button type="button" onClick={undo} disabled={!canUndo}>
                Undo
              </button>
              <button type="button" onClick={redo} disabled={!canRedo}>
                Redo
              </button>
              <button type="button" onClick={copy} disabled={selectedIds.length === 0}>
                Copy
              </button>
              <button type="button" onClick={paste} disabled={!canPaste}>
                Paste
              </button>
            </ButtonGroup>
          </>
        )}

        <ToolbarSeparator />

        <ButtonGroup>
          {(['perspective', 'top', 'front', 'side', 'cabinet'] as CameraViewPreset[]).map(
            (preset) => (
              <button
                type="button"
                key={preset}
                className={cameraView === preset ? 'active' : ''}
                onClick={() => setCameraView(preset)}
              >
                {preset === 'perspective'
                  ? 'Perspektive'
                  : preset === 'top'
                    ? 'Top'
                    : preset === 'front'
                      ? 'Front'
                      : preset === 'side'
                        ? 'Seite'
                        : 'Cabinet'}
              </button>
            ),
          )}
        </ButtonGroup>

        <ToolbarSeparator />

        <ButtonGroup>
          <button type="button" onClick={onSaveLayout}>
            Speichern
          </button>
          {mode === 'edit' && (
            <button type="button" onClick={onSaveSlot}>
              Als Slot
            </button>
          )}
          <button type="button" onClick={onExportLayout}>
            Export
          </button>
          <button type="button" onClick={onOpenLoadModal}>
            Laden
          </button>
        </ButtonGroup>

        <ToolbarSeparator />

        {mode === 'edit' && (
          <ButtonGroup>
            <button
              type="button"
              className="toolbar-delete"
              onClick={onRemoveSelected}
              disabled={selectedIds.length === 0}
            >
              Loeschen
            </button>
          </ButtonGroup>
        )}
      </header>

      <div className={`workspace${mode === 'view' ? ' view-mode' : ''}`}>
        <aside className="panel left" aria-hidden={mode === 'view'}>
          <h2>Asset-Bibliothek</h2>
          <p className="panel-hint">Kategorie waehlen und per Klick in der Szene platzieren.</p>
          <label className="upload-field">
            Eigene Assets hochladen (GLB/GLTF/STL, max. 20 MB)
            <input
              type="file"
              accept=".glb,.gltf,.stl,model/gltf-binary,model/gltf+json,model/stl"
              onChange={onUploadAsset}
            />
          </label>
          <label className="checkbox-field upload-wall-flag">
            <input
              type="checkbox"
              checked={uploadAsWall}
              onChange={(e) => setUploadAsWall(e.target.checked)}
            />
            <span>Import unter &quot;Wände&quot; kategorisieren</span>
          </label>
          {Object.entries(groupedTemplates).map(([category, list]) => {
            const expanded = templateGroupExpanded[category] !== false
            return (
              <div key={category} className="asset-group">
                <button
                  type="button"
                  className="asset-group-header"
                  onClick={() => toggleTemplateGroup(category)}
                  aria-expanded={expanded}
                >
                  <span
                    className={`asset-group-chevron${expanded ? ' asset-group-chevron--open' : ''}`}
                    aria-hidden
                  >
                    ▶
                  </span>
                  <span className="asset-group-title">{category}</span>
                </button>
                <div
                  className={`asset-group-items${expanded ? ' asset-group-items--expanded' : ' asset-group-items--collapsed'}`}
                  aria-hidden={!expanded}
                >
                  {list.map((template) => (
                    <button
                      type="button"
                      key={template.type}
                      className={
                        tool === 'place' && activeTemplateType === template.type ? 'active' : ''
                      }
                      onClick={() => {
                        setFloorInspectorOpen(false)
                        setSelectedTemplateType(template.type)
                        changeTool('place')
                      }}
                    >
                      <span>{template.label}</span>
                      <small>
                        {template.geometry.kind} |{' '}
                        {template.scale.map((v) => v.toFixed(1)).join(' x ')} m
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </aside>

        <main className="scene-wrapper">
          {mode === 'view' && infoAsset && (
            <AssetInfoModal asset={infoAsset} onClose={() => setInfoAssetId(null)} />
          )}

          <Canvas
            shadows
            camera={{ position: CAMERA_PRESETS[cameraView].position, fov: 48 }}
          >
            <color attach="background" args={[mode === 'view' ? '#0f1b29' : '#d2dae3']} />
            <fog
              attach="fog"
              args={[mode === 'view' ? '#0f1b29' : '#d2dae3', 55, 145]}
            />
            {mode === 'edit' ? <Lighting /> : <ViewModeOverlay mode="view" />}
            <AnimatedCameraRig preset={cameraView} orbitRef={orbitRef} />
            <FactoryFloor
              floor={floor}
              isPresentation={mode === 'view'}
              deferPointerToSceneRaycast={mode === 'edit' && tool === 'place'}
              onHover={onFloorHover}
              onAction={onFloorAction}
            />
            {mode === 'edit' && tool === 'place' && (
              <ScenePlacementRaycast
                active
                onHover={onFloorHover}
                onPlace={onFloorAction}
              />
            )}

            {assets.map((asset) => {
              const isOnlySingleEditSelection =
                mode === 'edit' && singleSelected?.id === asset.id && !singleSelected.isLocked
              if (isOnlySingleEditSelection) {
                return null
              }
              return (
                <AssetRenderer
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedIds.includes(asset.id)}
                  isHovered={hoveredId === asset.id}
                  isEditMode={mode === 'edit'}
                  onClick={onAssetClick}
                  onPointerOver={onAssetPointerOver}
                  onPointerOut={onAssetPointerOut}
                />
              )
            })}

            {mode === 'edit' && singleSelected && !singleSelected.isLocked && (
              <SingleTransformGizmo
                asset={singleSelected}
                mode={transformMode}
                isCtrlPressed={isCtrlPressed}
                orbitRef={orbitRef}
                onCommit={(id, patch) => updateAsset(id, patch)}
              >
                <AssetRenderer
                  asset={singleSelected}
                  isSelected
                  isHovered={hoveredId === singleSelected.id}
                  isEditMode
                  skipTransform
                  onClick={onAssetClick}
                  onPointerOver={onAssetPointerOver}
                  onPointerOut={onAssetPointerOut}
                />
              </SingleTransformGizmo>
            )}

            {mode === 'edit' && transformableSelected.length > 1 && (
              <MultiTransformGizmo
                selectedAssets={transformableSelected}
                mode={transformMode}
                isCtrlPressed={isCtrlPressed}
                orbitRef={orbitRef}
                onCommit={(updates) => updateAssets(updates)}
              />
            )}

            {ghostAsset && activeTemplate && (
              <group>
                <GhostAssetRenderer asset={ghostAsset} />
                <Html
                  position={[
                    ghostAsset.position[0],
                    ghostAsset.position[1] + Math.max(activeTemplate.scale[1], 0.2) / 2 + 0.75,
                    ghostAsset.position[2],
                  ]}
                  center
                >
                  <div className="preview-badge">{activeTemplate.label}</div>
                </Html>
              </group>
            )}

            <OrbitControls
              key={`orbit-${mode}`}
              ref={orbitRef}
              makeDefault
              enablePan
              enableZoom
              enableRotate
              enableDamping
              dampingFactor={mode === 'view' ? 0.1 : 0.08}
              screenSpacePanning
              zoomToCursor
              minDistance={mode === 'view' ? 4 : 6}
              maxDistance={mode === 'view' ? 120 : 85}
              minPolarAngle={0.2}
              maxPolarAngle={Math.PI / 2 - 0.03}
              rotateSpeed={mode === 'view' ? 0.85 : 1}
              zoomSpeed={mode === 'view' ? 0.9 : 1}
            />
          </Canvas>

          {saveFeedback ? (
            <div className="save-feedback-toast" role="status">
              {saveFeedback}
            </div>
          ) : null}

          {mode === 'view' && (
            <div className="view-hint-bar">
              <span>Praesentationsmodus: Klicke ein Asset fuer Details.</span>
            </div>
          )}
        </main>

        <aside className="panel right" aria-hidden={mode === 'view'}>
          <h2>Inspector</h2>
            {singleSelected ? (
              <div
                className={`inspector-content${singleSelected.isLocked ? ' inspector-asset-locked' : ''}`}
              >
                <p className="selected-title">
                  {singleSelected.metadata.name ?? singleSelected.type}
                  {singleSelected.isLocked ? (
                    <span className="lock-indicator" title="Gesperrt">
                      {' '}
                      &#128274; Locked
                    </span>
                  ) : null}
                </p>
                <p className="panel-hint">
                  Form: {singleSelected.geometry.kind} | Kategorie: {singleSelected.category}
                </p>
                <p className="panel-hint">ID: {singleSelected.id.slice(0, 20)}...</p>

                <h3>Sperre</h3>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={singleSelected.isLocked ?? false}
                    onChange={(event) =>
                      updateAsset(singleSelected.id, { isLocked: event.target.checked })
                    }
                  />
                  <span>Asset sperren (keine Auswahl / kein Gizmo in der Szene)</span>
                </label>
                {singleSelected.isLocked ? (
                  <p className="panel-hint">
                    Gesperrt: Transform nur im Inspector eingeschraenkt; Farbe/Lock hier
                    weiterhin aenderbar. In der Szene ohne Transform-Gizmo.
                  </p>
                ) : null}

                <h3 title={singleSelected.isLocked ? 'Asset ist gesperrt' : undefined}>
                  Transform
                </h3>
                <h4 className="inspector-subheading">Position</h4>
                <div className="vector-grid" key={`${singleSelected.id}-pos`}>
                  <NumericInput
                    label="X"
                    value={singleSelected.position[0]}
                    disabled={singleSelected.isLocked}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        position: [value, singleSelected.position[1], singleSelected.position[2]],
                      })
                    }
                  />
                  <NumericInput
                    label="Y"
                    value={singleSelected.position[1]}
                    disabled={singleSelected.isLocked}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        position: [singleSelected.position[0], value, singleSelected.position[2]],
                      })
                    }
                  />
                  <NumericInput
                    label="Z"
                    value={singleSelected.position[2]}
                    disabled={singleSelected.isLocked}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        position: [singleSelected.position[0], singleSelected.position[1], value],
                      })
                    }
                  />
                </div>

                <h4 className="inspector-subheading">Rotation (Grad)</h4>
                <div className="vector-grid" key={`${singleSelected.id}-rot`}>
                  <NumericInput
                    label="X"
                    value={radToDeg(singleSelected.rotation[0])}
                    disabled={singleSelected.isLocked}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        rotation: [
                          degToRad(value),
                          singleSelected.rotation[1],
                          singleSelected.rotation[2],
                        ],
                      })
                    }
                  />
                  <NumericInput
                    label="Y"
                    value={radToDeg(singleSelected.rotation[1])}
                    disabled={singleSelected.isLocked}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        rotation: [
                          singleSelected.rotation[0],
                          degToRad(value),
                          singleSelected.rotation[2],
                        ],
                      })
                    }
                  />
                  <NumericInput
                    label="Z"
                    value={radToDeg(singleSelected.rotation[2])}
                    disabled={singleSelected.isLocked}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        rotation: [
                          singleSelected.rotation[0],
                          singleSelected.rotation[1],
                          degToRad(value),
                        ],
                      })
                    }
                  />
                </div>

                <h4 className="inspector-subheading">Skalierung</h4>
                <div className="vector-grid" key={`${singleSelected.id}-scale`}>
                  <NumericInput
                    label="Breite (X)"
                    value={singleSelected.scale[0]}
                    disabled={singleSelected.isLocked}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        scale: [
                          Math.max(value, 0.05),
                          singleSelected.scale[1],
                          singleSelected.scale[2],
                        ],
                      })
                    }
                  />
                  <NumericInput
                    label="Hoehe (Y)"
                    value={singleSelected.scale[1]}
                    disabled={singleSelected.isLocked}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        scale: [
                          singleSelected.scale[0],
                          Math.max(value, 0.05),
                          singleSelected.scale[2],
                        ],
                      })
                    }
                  />
                  <NumericInput
                    label="Laenge (Z)"
                    value={singleSelected.scale[2]}
                    disabled={singleSelected.isLocked}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        scale: [
                          singleSelected.scale[0],
                          singleSelected.scale[1],
                          Math.max(value, 0.05),
                        ],
                      })
                    }
                  />
                </div>

                <h3>Material</h3>
                {singleSelected.geometry.kind === 'custom' &&
                (singleSelected.geometry.params.modelFormat === 'glb' ||
                  singleSelected.geometry.params.modelFormat === 'gltf') ? (
                  <>
                    <p className="panel-hint material-mode-hint">
                      Modus:{' '}
                      <strong>{singleSelected.materialMode ?? 'original'}</strong> — Original nutzt
                      GLTF-Materialien; Override faerbt alle Meshes mit der gewaehlten Farbe.
                    </p>
                    <div className="segmented-toggle" role="group" aria-label="Materialmodus">
                      <button
                        type="button"
                        className={
                          (singleSelected.materialMode ?? 'original') === 'original' ? 'active' : ''
                        }
                        onClick={() =>
                          updateAsset(singleSelected.id, { materialMode: 'original' as MaterialMode })
                        }
                      >
                        Original
                      </button>
                      <button
                        type="button"
                        className={singleSelected.materialMode === 'override' ? 'active' : ''}
                        onClick={() =>
                          updateAsset(singleSelected.id, { materialMode: 'override' as MaterialMode })
                        }
                      >
                        Override
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="panel-hint">
                    Farbe und Deckkraft gelten fuer Primitive und STL; GLB/GLTF zusaetzlich mit
                    Modus Original/Override.
                  </p>
                )}

                <ColorPickerPopover
                  value={singleSelected.color}
                  onCommit={(nextColor) =>
                    updateAsset(singleSelected.id, { color: sanitizeColor(nextColor) })
                  }
                />

                <label className="opacity-slider-field">
                  Deckkraft ({Math.round(resolveAssetOpacity(singleSelected) * 100)}%)
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(resolveAssetOpacity(singleSelected) * 100)}
                    onChange={(event) =>
                      updateAsset(singleSelected.id, {
                        opacity: Number(event.target.value) / 100,
                      })
                    }
                  />
                </label>
                <div
                  className="material-preview-swatch"
                  style={{
                    backgroundColor: singleSelected.color,
                    opacity: resolveAssetOpacity(singleSelected),
                  }}
                  title="Vorschau Farbe + Deckkraft"
                />

                <h3>Info</h3>
                {singleSelected.geometry.kind === 'text' && (
                  <label className="metadata-field">
                    Textinhalt
                    <input
                      maxLength={160}
                      value={singleSelected.metadata.text ?? ''}
                      placeholder="Label"
                      onChange={(event) =>
                        updateSingleMetadata('text', event.target.value, 'text')
                      }
                    />
                  </label>
                )}
                <label className="metadata-field">
                  Name
                  <input
                    value={singleSelected.metadata.name ?? ''}
                    onChange={(event) =>
                      updateSingleMetadata('name', event.target.value, 'name')
                    }
                  />
                </label>
                <label className="metadata-field">
                  Beschreibung
                  <textarea
                    rows={2}
                    value={singleSelected.metadata.description ?? ''}
                    onChange={(event) =>
                      updateSingleMetadata('description', event.target.value, 'description')
                    }
                  />
                </label>
                <label className="metadata-field">
                  Zonen-/Typ-Hinweis
                  <input
                    value={singleSelected.metadata.zoneType ?? ''}
                    onChange={(event) =>
                      updateSingleMetadata('zoneType', event.target.value, 'zoneType')
                    }
                  />
                </label>

                {singleSelected.geometry.kind === 'custom' && (
                  <>
                    <h3>Modell-Optik</h3>
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={singleSelected.visual?.wireframe ?? false}
                        onChange={(event) =>
                          updateAsset(singleSelected.id, {
                            visual: {
                              ...(singleSelected.visual ?? {}),
                              wireframe: event.target.checked,
                            },
                          })
                        }
                      />
                      <span>Wireframe</span>
                    </label>
                    {singleSelected.geometry.params.modelFormat === 'stl' && (
                      <label className="checkbox-field">
                        <input
                          type="checkbox"
                          checked={singleSelected.visual?.flatShading ?? true}
                          onChange={(event) =>
                            updateAsset(singleSelected.id, {
                              visual: {
                                ...(singleSelected.visual ?? {}),
                                flatShading: event.target.checked,
                              },
                            })
                          }
                        />
                        <span>Flat Shading (CAD-Look)</span>
                      </label>
                    )}
                  </>
                )}

                <h3>Custom Metadata</h3>
                {Object.entries(singleSelected.metadata.customData ?? {}).map(([key, value]) => (
                  <div key={key} className="custom-field-row">
                    <label className="metadata-field">
                      {key}
                      <input
                        value={value}
                        onChange={(event) =>
                          updateSingleMetadata(key, event.target.value, 'custom')
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="subtle-delete"
                      onClick={() => removeCustomMetadataKey(key)}
                      aria-label={`${key} entfernen`}
                    >
                      -
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="add-field-button"
                  onClick={addCustomMetadataField}
                >
                  + Feld hinzufuegen
                </button>
              </div>
            ) : selectedAssets.length > 1 ? (
              <div className="inspector-content">
                <p className="selected-title">{selectedAssets.length} Assets ausgewaehlt</p>
                <p className="panel-hint">
                  Mehrfachauswahl: Transform nur wenn mindestens zwei nicht gesperrte Assets
                  ausgewaehlt sind. Gesperrte Assets werden nicht mitbewegt.
                </p>
                <div className="batch-lock-actions">
                  <button
                    type="button"
                    onClick={() =>
                      updateAssets(selectedAssets.map((a) => ({ id: a.id, patch: { isLocked: true } })))
                    }
                  >
                    Alle sperren
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateAssets(
                        selectedAssets.map((a) => ({ id: a.id, patch: { isLocked: false } })),
                      )
                    }
                  >
                    Alle entsperren
                  </button>
                </div>
              </div>
            ) : floorInspectorOpen ? (
              <div className="inspector-content inspector-floor">
                <p className="selected-title">Boden</p>
                <p className="panel-hint">Raster im Praesentationsmodus aus; Bodenfarbe bleibt.</p>
                <ColorPickerPopover
                  label="Bodenfarbe"
                  value={floor.color}
                  onCommit={(c) => setFloor({ color: sanitizeColor(c) })}
                />
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={floor.gridVisible}
                    onChange={(e) => setFloor({ gridVisible: e.target.checked })}
                  />
                  <span>Raster anzeigen (nur Bearbeiten)</span>
                </label>
                <ColorPickerPopover
                  label="Rasterfarbe"
                  value={floor.gridColor}
                  onCommit={(c) => setFloor({ gridColor: sanitizeColor(c) })}
                />
                <label className="opacity-slider-field">
                  Raster-Zellenabstand ({floor.gridSize.toFixed(2)} m)
                  <input
                    type="range"
                    min={10}
                    max={200}
                    step={5}
                    value={Math.round(floor.gridSize * 100)}
                    onChange={(e) => setFloor({ gridSize: Number(e.target.value) / 100 })}
                  />
                </label>
                <label className="opacity-slider-field">
                  Bodengroesse ({floor.size.toFixed(0)} m)
                  <input
                    type="range"
                    min={40}
                    max={200}
                    step={5}
                    value={floor.size}
                    onChange={(e) => setFloor({ size: Number(e.target.value) })}
                  />
                </label>
              </div>
            ) : (
              <div className="inspector-content">
                <p className="panel-hint">
                  Klicke ein platziertes Asset an, um Informationen und Position zu bearbeiten.
                </p>
                <p className="panel-hint">Oder den Boden (kein Asset gewaehlt), um den Boden zu bearbeiten.</p>
              </div>
            )}
        </aside>
      </div>
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <button
        type="button"
        className="shortcuts-fab"
        onClick={() => setShortcutsOpen(true)}
        aria-label="Tastenkuerzel oeffnen"
      >
        ?
      </button>
    </div>
  )
}

export { FALLBACK_ASSET_COLOR }
