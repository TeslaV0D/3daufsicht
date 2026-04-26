import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls, TransformControls } from '@react-three/drei'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
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
import ExportLayoutModal from './components/ExportLayoutModal'
import FactoryFloor from './components/FactoryFloor'
import InspectorHint from './components/InspectorHint'
import Lighting from './components/Lighting'
import LightingToolbarPanel from './components/LightingToolbarPanel'
import LoadLayoutModal from './components/LoadLayoutModal'
import ScenePlacementRaycast from './components/ScenePlacementRaycast'
import ShortcutsModal from './components/ShortcutsModal'
import TemplatePreviewDialog from './components/TemplatePreviewDialog'

import { dismissTopColorPickerEscape } from './colorPickerEscapeStack'
import { createAssetFromTemplate, geometryKindSupports2D } from './AssetFactory'
import { useAssetsStore, type LayoutExportKind } from './store/useAssetsStore'
import type { Asset, AssetDecal, AssetDecalSide, AssetTemplate, MaterialMode, ModelFormat } from './types/asset'
import { getCustomRows, newCustomFieldId, resolveAssetOpacity, sanitizeColor } from './types/asset'
import type { CameraViewPreset } from './types/plannerUi'
import {
  alignAssetsXZ,
  distributeCentersX,
  distributeCentersZ,
  snapAssetsToGrid,
} from './scene/assetAlignment'
import {
  applyTemplateDisplayOverrides,
  buildLibrarySections,
  EIGENE_ASSETS_USER_GROUP_ID,
  EIGENE_ASSETS_USER_GROUP_LABEL,
  RECENTS_SECTION_ID,
  type LibraryOrganizationState,
  type LibrarySection,
} from './types/libraryOrganization'
import { libraryAccentForSectionTitle } from './types/libraryCategoryAccent'
import { type FloorSettings, sanitizePlacementSnapStep } from './types/floor'

type PlannerTool = 'select' | 'place'
type PlannerMode = 'edit' | 'view'
type TransformMode = 'translate' | 'rotate' | 'scale'

const FALLBACK_ASSET_COLOR = '#8ca0b6'
const LIBRARY_SECTION_EXPANDED_STORAGE_KEY = 'factory-library-section-expanded-v2'
const TEMPLATE_DRAG_MIME = 'application/x-factory-template-type'
const HOVER_POINTER_OUT_DEBOUNCE_MS = 50
const TOOLBAR_POPOVER_GAP = 8
const TOOLBAR_POPOVER_MAX_H = 480
const MAX_DECAL_IMAGE_BYTES = 5 * 1024 * 1024

const DECAL_SIDE_OPTIONS: { id: AssetDecalSide; label: string }[] = [
  { id: 'top', label: 'Oben' },
  { id: 'bottom', label: 'Unten' },
  { id: 'front', label: 'Vorne' },
  { id: 'back', label: 'Hinten' },
  { id: 'left', label: 'Links' },
  { id: 'right', label: 'Rechts' },
  { id: 'all', label: 'Alle Seiten' },
]

function computeToolbarPopoverPosition(
  anchor: DOMRect,
  floating: HTMLElement,
  preferredWidth: number,
): { top: number; left: number; width: number; maxHeight: number } {
  const margin = TOOLBAR_POPOVER_GAP
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(preferredWidth, vw * 0.8, vw - 2 * margin)
  floating.style.width = `${width}px`
  void floating.offsetHeight
  let ph = floating.getBoundingClientRect().height
  if (ph < 1) ph = floating.scrollHeight
  let left = anchor.right - width
  if (left < margin) left = margin
  const maxLeft = vw - margin - width
  if (left > maxLeft) left = Math.max(margin, maxLeft)
  let top = anchor.bottom + margin
  let maxHeight = TOOLBAR_POPOVER_MAX_H
  if (top + ph > vh - margin) {
    const aboveTop = anchor.top - margin - ph
    if (aboveTop >= margin) {
      top = aboveTop
    } else {
      top = margin
      maxHeight = Math.min(TOOLBAR_POPOVER_MAX_H, vh - top - margin)
    }
  }
  return { top, left, width, maxHeight }
}

function applyToolbarPopoverLayout(
  buttonEl: HTMLButtonElement | null,
  popEl: HTMLDivElement | null,
  preferredWidth: number,
): boolean {
  if (!buttonEl || !popEl) return false
  const pos = computeToolbarPopoverPosition(buttonEl.getBoundingClientRect(), popEl, preferredWidth)
  popEl.style.top = `${pos.top}px`
  popEl.style.left = `${pos.left}px`
  popEl.style.maxHeight = `${pos.maxHeight}px`
  return true
}

function getTagsFromTemplate(template: AssetTemplate, org: LibraryOrganizationState): string[] {
  const fromOverride = org.templateDisplayOverrides?.[template.type]?.tags
  if (fromOverride?.length) return fromOverride
  const raw = template.metadata?.customData?.Tags
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

function formatTemplateDimensions(template: AssetTemplate): string {
  const sx = template.scale[0]
  const sy = template.scale[1]
  const sz = template.scale[2]
  const p = template.geometry.params
  switch (template.geometry.kind) {
    case 'box':
      return `${((p.width ?? 1) * sx).toFixed(2)} × ${((p.height ?? 1) * sy).toFixed(2)} × ${((p.depth ?? 1) * sz).toFixed(2)} m`
    case 'sphere':
      return `R ≈ ${((p.radius ?? 0.5) * Math.max(sx, sy, sz)).toFixed(2)} m`
    case 'cylinder':
    case 'cone':
      return `R ${((p.radiusBottom ?? p.radius ?? 0.5) * Math.max(sx, sz)).toFixed(2)} m, H ${((p.height ?? 1) * sy).toFixed(2)} m`
    case 'torus':
      return `R ${((p.radius ?? 0.5) * sx).toFixed(2)} m, Tube ${((p.tube ?? 0.15) * sy).toFixed(2)} m`
    case 'plane':
      return `${((p.width ?? 1) * sx).toFixed(2)} × ${((p.height ?? 1) * sz).toFixed(2)} m`
    case 'circle':
    case 'ring':
      return `R ${((p.radius ?? 0.5) * Math.max(sx, sz)).toFixed(2)} m`
    case 'text':
      return `Schrift ${(p.fontSize ?? 1) * sy} m`
    case 'custom':
      return `Skalierung ${sx.toFixed(1)} × ${sy.toFixed(1)} × ${sz.toFixed(1)}`
    default:
      return `${sx.toFixed(1)} × ${sy.toFixed(1)} × ${sz.toFixed(1)}`
  }
}

function formatTemplateDimensionsMm(template: AssetTemplate): string {
  const sx = template.scale[0]
  const sy = template.scale[1]
  const sz = template.scale[2]
  const p = template.geometry.params
  switch (template.geometry.kind) {
    case 'box':
      return `${Math.round((p.width ?? 1) * sx * 1000)} × ${Math.round((p.height ?? 1) * sy * 1000)} × ${Math.round((p.depth ?? 1) * sz * 1000)} mm`
    case 'sphere':
      return `R ≈ ${Math.round((p.radius ?? 0.5) * Math.max(sx, sy, sz) * 1000)} mm`
    case 'cylinder':
    case 'cone':
      return `R ${Math.round((p.radiusBottom ?? p.radius ?? 0.5) * Math.max(sx, sz) * 1000)} mm · H ${Math.round((p.height ?? 1) * sy * 1000)} mm`
    case 'torus':
      return `R ${Math.round((p.radius ?? 0.5) * sx * 1000)} mm · Tube ${Math.round((p.tube ?? 0.15) * sy * 1000)} mm`
    case 'plane':
      return `${Math.round((p.width ?? 1) * sx * 1000)} × ${Math.round((p.height ?? 1) * sz * 1000)} mm`
    case 'circle':
    case 'ring':
      return `R ${Math.round((p.radius ?? 0.5) * Math.max(sx, sz) * 1000)} mm`
    case 'text':
      return `Schrift ${Math.round((p.fontSize ?? 1) * sy * 1000)} mm`
    case 'custom':
      return `Skalierung ${sx.toFixed(2)} × ${sy.toFixed(2)} × ${sz.toFixed(2)} (Template)`
    default:
      return `${Math.round(sx * 1000)} × ${Math.round(sy * 1000)} × ${Math.round(sz * 1000)} mm`
  }
}

/** Nur explizit `true` = Gruppe ausgeklappt; fehlender Key = zugeklappt. „Zuletzt“ standardmäßig offen. */
function readLibrarySectionExpandedMap(): Record<string, boolean> {
  const defaults: Record<string, boolean> = { [RECENTS_SECTION_ID]: true }
  try {
    const raw = localStorage.getItem(LIBRARY_SECTION_EXPANDED_STORAGE_KEY)
    if (!raw) return { ...defaults }
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return { ...defaults }
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (v === true) out[k] = true
    }
    return { ...defaults, ...out }
  } catch {
    return { ...defaults }
  }
}

const round2 = (value: number) => Number(value.toFixed(2))
const formatNumber = (value: number) => String(round2(value))

function roundToDecimals(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0
  const m = 10 ** digits
  return Math.round(value * m) / m
}

function formatNumeric(value: number, digits: number): string {
  return String(roundToDecimals(value, digits))
}

/** Skalierung: feinere Auflösung als round2 */
const roundScaleVal = (value: number) => roundToDecimals(value, 4)
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
  floorSnap: Pick<FloorSettings, 'placementSnapEnabled' | 'placementSnapStep'>,
): Vector3Tuple {
  const step = freePlacement
    ? null
    : floorSnap.placementSnapEnabled
      ? floorSnap.placementSnapStep
      : null
  const x =
    step != null && step > 0 ? Math.round(point[0] / step) * step : round2(point[0])
  const z =
    step != null && step > 0 ? Math.round(point[2] / step) * step : round2(point[2])
  const isFlat = geometryKindSupports2D(template.geometry.kind)
  const y = isFlat ? 0.02 : template.scale[1] / 2
  return [round2(x), round2(y), round2(z)]
}

function templateMatchesSearch(
  template: AssetTemplate,
  org: LibraryOrganizationState,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (template.label.toLowerCase().includes(q)) return true
  if (template.metadata?.description?.toLowerCase().includes(q)) return true
  const tags = getTagsFromTemplate(template, org)
  if (tags.some((t) => t.toLowerCase().includes(q))) return true
  return false
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'))
    reader.readAsDataURL(file)
  })
}

const ALLOWED_MODEL_EXTENSIONS = ['glb', 'gltf', 'stl', 'obj', 'fbx'] as const
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
  /** Nachkommastellen bei Anzeige/Commit (Skalierung z. B. 4) */
  fractionDigits?: number
  onCommit: (value: number) => void
  disabled?: boolean
}

function NumericInput({
  label,
  value,
  fractionDigits = 2,
  onCommit,
  disabled,
}: NumericInputProps) {
  const [draft, setDraft] = useState(formatNumeric(value, fractionDigits))
  const [editing, setEditing] = useState(false)

  const commitDraft = useCallback(() => {
    const parsed = parseFiniteInput(draft)
    if (parsed === null) {
      setDraft(formatNumeric(value, fractionDigits))
      setEditing(false)
      return
    }
    const normalized = roundToDecimals(parsed, fractionDigits)
    onCommit(normalized)
    setDraft(formatNumeric(normalized, fractionDigits))
    setEditing(false)
  }, [draft, fractionDigits, onCommit, value])

  return (
    <label className={disabled ? 'input-disabled' : undefined}>
      {label}
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={editing ? draft : formatNumeric(value, fractionDigits)}
        onFocus={() => {
          setDraft(formatNumeric(value, fractionDigits))
          setEditing(true)
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commitDraft()
          if (event.key === 'Escape') {
            setDraft(formatNumeric(value, fractionDigits))
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
  translationSnap?: number
  orbitRef: RefObject<OrbitControlsImpl | null>
  onCommit: (id: string, patch: Partial<Asset>) => void
  children?: React.ReactNode
}

function SingleTransformGizmo({
  asset,
  mode,
  isCtrlPressed,
  translationSnap,
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
    let nx = round2(group.position.x)
    let nz = round2(group.position.z)
    if (translationSnap != null && translationSnap > 0 && mode === 'translate') {
      nx = round2(Math.round(nx / translationSnap) * translationSnap)
      nz = round2(Math.round(nz / translationSnap) * translationSnap)
    }
    const nextPosition: Vector3Tuple = [nx, round2(group.position.y), nz]
    const nextRotation: Vector3Tuple = [
      round2(group.rotation.x),
      round2(group.rotation.y),
      round2(group.rotation.z),
    ]
    const nextScale: Vector3Tuple = [
      Math.max(roundScaleVal(group.scale.x), 0.01),
      Math.max(roundScaleVal(group.scale.y), 0.01),
      Math.max(roundScaleVal(group.scale.z), 0.01),
    ]
    onCommit(asset.id, { position: nextPosition, rotation: nextRotation, scale: nextScale })
  }, [asset.id, mode, onCommit, orbitRef, translationSnap])

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
        translationSnap={
          mode === 'translate' && !isCtrlPressed && translationSnap != null
            ? translationSnap
            : undefined
        }
        rotationSnap={mode === 'rotate' && !isCtrlPressed ? Math.PI / 8 : undefined}
        scaleSnap={null}
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
  translationSnap?: number
  orbitRef: RefObject<OrbitControlsImpl | null>
  onCommit: (updates: Array<{ id: string; patch: Partial<Asset> }>) => void
}

function MultiTransformGizmo({
  selectedAssets,
  mode,
  isCtrlPressed,
  translationSnap,
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
            Math.max(roundScaleVal(nextScale.x), 0.01),
            Math.max(roundScaleVal(nextScale.y), 0.01),
            Math.max(roundScaleVal(nextScale.z), 0.01),
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
        translationSnap={
          mode === 'translate' && !isCtrlPressed && translationSnap != null
            ? translationSnap
            : undefined
        }
        rotationSnap={mode === 'rotate' && !isCtrlPressed ? Math.PI / 8 : undefined}
        scaleSnap={null}
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
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportModalKey, setExportModalKey] = useState(0)
  const [lightingPanelOpen, setLightingPanelOpen] = useState(false)
  const lightingBarRef = useRef<HTMLDivElement>(null)
  const lightingButtonRef = useRef<HTMLButtonElement>(null)
  const lightingPopoverRef = useRef<HTMLDivElement>(null)
  const toolsMenuRef = useRef<HTMLDivElement>(null)
  const toolsMenuButtonRef = useRef<HTMLButtonElement>(null)
  const toolsPopoverRef = useRef<HTMLDivElement>(null)
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false)
  const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false)
  const [newGroupNameDraft, setNewGroupNameDraft] = useState('')
  const [libraryDropTargetKey, setLibraryDropTargetKey] = useState<string | null>(null)
  const [libraryMenu, setLibraryMenu] = useState<{
    templateType: string
    left: number
    top: number
  } | null>(null)
  const libraryMenuRef = useRef<HTMLDivElement | null>(null)
  const [templateMetaDialog, setTemplateMetaDialog] = useState<AssetTemplate | null>(null)
  const [templateMetaDraft, setTemplateMetaDraft] = useState({
    name: '',
    description: '',
    tags: '',
  })
  const [templateGroupDialog, setTemplateGroupDialog] = useState<AssetTemplate | null>(null)
  const [templateDetailsDialog, setTemplateDetailsDialog] = useState<AssetTemplate | null>(null)
  const [templatePreview, setTemplatePreview] = useState<AssetTemplate | null>(null)
  const [importLibraryBusy, setImportLibraryBusy] = useState(false)
  const eigeneAssetsImportInputRef = useRef<HTMLInputElement | null>(null)
  const decalImportInputRef = useRef<HTMLInputElement | null>(null)
  const [metadataNameEdit, setMetadataNameEdit] = useState<{
    assetId: string
    rowId: string
  } | null>(null)

  const {
    assets,
    templates,
    customTemplates,
    floor,
    setFloor,
    cameraView,
    setCameraView,
    lighting,
    setLighting,
    selectedIds,
    setSelectedIds,
    addAsset,
    removeAssets,
    updateAsset,
    updateAssets,
    importCustomModelTemplatesBatch,
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
    recordRecentTemplatePlacement,
  } = store

  const resolvedTemplates = useMemo(
    () => templates.map((t) => applyTemplateDisplayOverrides(t, libraryOrganization)),
    [templates, libraryOrganization],
  )

  const activeTemplateType = selectedTemplateType ?? resolvedTemplates[0]?.type ?? null
  const activeTemplate = useMemo(
    () => resolvedTemplates.find((template) => template.type === activeTemplateType) ?? null,
    [activeTemplateType, resolvedTemplates],
  )

  const customTemplateTypeSet = useMemo(
    () => new Set(customTemplates.map((t) => t.type)),
    [customTemplates],
  )

  useEffect(() => {
    if (!lightingPanelOpen) return
    const onDown = (e: PointerEvent) => {
      const el = lightingBarRef.current
      if (el && !el.contains(e.target as Node)) setLightingPanelOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [lightingPanelOpen])

  useEffect(() => {
    if (!toolsMenuOpen) return
    const onDown = (e: PointerEvent) => {
      const el = toolsMenuRef.current
      if (el && !el.contains(e.target as Node)) setToolsMenuOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [toolsMenuOpen])

  useLayoutEffect(() => {
    if (!toolsMenuOpen) return
    const pop = toolsPopoverRef.current
    if (!pop) return

    pop.style.opacity = '0'
    pop.style.pointerEvents = 'none'
    pop.style.transition = 'none'

    const update = () => {
      applyToolbarPopoverLayout(toolsMenuButtonRef.current, toolsPopoverRef.current, 320)
    }
    update()
    update()

    const fadeRaf = requestAnimationFrame(() => {
      pop.style.transition = 'opacity 0.15s ease-out'
      pop.style.opacity = '1'
      pop.style.pointerEvents = 'auto'
    })

    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(fadeRaf)
      window.removeEventListener('resize', update)
      pop.style.transition = ''
      pop.style.opacity = ''
      pop.style.pointerEvents = ''
    }
  }, [toolsMenuOpen])

  useLayoutEffect(() => {
    if (!lightingPanelOpen) return
    const pop = lightingPopoverRef.current
    if (!pop) return

    pop.style.opacity = '0'
    pop.style.pointerEvents = 'none'
    pop.style.transition = 'none'

    const update = () => {
      applyToolbarPopoverLayout(lightingButtonRef.current, lightingPopoverRef.current, 380)
    }
    update()
    update()

    const fadeRaf = requestAnimationFrame(() => {
      pop.style.transition = 'opacity 0.15s ease-out'
      pop.style.opacity = '1'
      pop.style.pointerEvents = 'auto'
    })

    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(fadeRaf)
      window.removeEventListener('resize', update)
      pop.style.transition = ''
      pop.style.opacity = ''
      pop.style.pointerEvents = ''
    }
  }, [lightingPanelOpen])

  const librarySections = useMemo(
    () => buildLibrarySections(resolvedTemplates, libraryOrganization),
    [resolvedTemplates, libraryOrganization],
  )

  const [librarySearchInput, setLibrarySearchInput] = useState('')
  const [librarySearch, setLibrarySearch] = useState('')
  const [colorPickerKick, setColorPickerKick] = useState(0)
  useEffect(() => {
    const t = window.setTimeout(() => setLibrarySearch(librarySearchInput.trim()), 200)
    return () => clearTimeout(t)
  }, [librarySearchInput])

  const filteredLibrarySections = useMemo(() => {
    if (!librarySearch) return librarySections
    return librarySections
      .map((section) => ({
        ...section,
        templates: section.templates.filter((tm) =>
          templateMatchesSearch(tm, libraryOrganization, librarySearch),
        ),
      }))
      .filter((section) => section.templates.length > 0)
  }, [librarySections, libraryOrganization, librarySearch])

  const templateByType = useMemo(() => new Map(templates.map((t) => [t.type, t])), [templates])

  const gizmoTranslateSnap = useMemo(() => {
    if (floor.placementSnapEnabled && floor.placementSnapStep > 0) {
      return floor.placementSnapStep
    }
    return undefined
  }, [floor.placementSnapEnabled, floor.placementSnapStep])

  const [leftPanelHidden, setLeftPanelHidden] = useState(false)
  const [rightPanelHidden, setRightPanelHidden] = useState(false)

  const favoriteTypeSet = useMemo(
    () => new Set(libraryOrganization.favoriteTemplateTypes),
    [libraryOrganization.favoriteTemplateTypes],
  )

  const [librarySectionExpanded, setLibrarySectionExpanded] = useState<Record<string, boolean>>(
    readLibrarySectionExpandedMap,
  )

  const toggleTemplateGroup = useCallback((sectionKey: string) => {
    setLibrarySectionExpanded((prev) => {
      const next = { ...prev }
      if (prev[sectionKey]) {
        delete next[sectionKey]
      } else {
        next[sectionKey] = true
      }
      try {
        localStorage.setItem(LIBRARY_SECTION_EXPANDED_STORAGE_KEY, JSON.stringify(next))
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
  const inspectorPrimaryDecal = singleSelected?.visual?.decals?.[0]
  const metadataNameEditId =
    metadataNameEdit != null &&
    singleSelected != null &&
    metadataNameEdit.assetId === singleSelected.id
      ? metadataNameEdit.rowId
      : null

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
    setLightingPanelOpen(false)
    setToolsMenuOpen(false)
    setLibraryMenu(null)
  }, [])

  useEffect(() => {
    if (!libraryMenu) return
    const onDocPointer = (e: MouseEvent) => {
      if (libraryMenuRef.current?.contains(e.target as Node)) return
      setLibraryMenu(null)
    }
    document.addEventListener('mousedown', onDocPointer)
    return () => document.removeEventListener('mousedown', onDocPointer)
  }, [libraryMenu])

  const changeTool = useCallback((nextTool: PlannerTool) => {
    setTool(nextTool)
    setHoveredId(null)
    setFloorInspectorOpen(false)
    setLightingPanelOpen(false)
    setToolsMenuOpen(false)
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
      setFloorInspectorOpen(false)
      const multi = event.ctrlKey || event.metaKey
      if (multi) {
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
      const position = resolvePlacementPosition(point, isCtrlPressed, activeTemplate, floor)
      setPreviewPosition(position)
    },
    [activeTemplate, floor, isCtrlPressed, mode, tool],
  )

  const onFloorAction = useCallback(
    (point: Vector3Tuple) => {
      if (mode !== 'edit') {
        return
      }
      if (tool === 'place' && activeTemplate) {
        const position = resolvePlacementPosition(point, isCtrlPressed, activeTemplate, floor)
        const asset = createAssetFromTemplate(activeTemplate, { position })
        addAsset(asset)
        recordRecentTemplatePlacement(activeTemplate.type)
        return
      }
      setSelectedIds([])
      setFloorInspectorOpen(true)
    },
    [
      activeTemplate,
      addAsset,
      floor,
      isCtrlPressed,
      mode,
      recordRecentTemplatePlacement,
      setSelectedIds,
      tool,
    ],
  )

  const onRemoveSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    if (
      selectedIds.length > 1 &&
      !window.confirm(`${selectedIds.length} Assets wirklich löschen?`)
    ) {
      return
    }
    removeAssets(selectedIds)
  }, [removeAssets, selectedIds])

  const onRemoveCustomTemplate = useCallback(
    (template: AssetTemplate) => {
      if (
        !window.confirm(
          `Vorlage „${template.label}“ wirklich entfernen? Alle Instanzen in der Szene werden gelöscht.`,
        )
      ) {
        return
      }
      removeCustomTemplate(template.type)
      if (selectedTemplateType === template.type) {
        setSelectedTemplateType(null)
      }
    },
    [removeCustomTemplate, selectedTemplateType],
  )

  const onRemoveLibrarySection = useCallback(
    (section: LibrarySection) => {
      if (!section.userGroupId) return
      const n = section.templates.length
      const msg =
        n > 0
          ? `Gruppe „${section.title}“ mit ${n} Vorlage(n) löschen? Die Vorlagen erscheinen wieder unter ihrer Kategorie.`
          : `Leere Gruppe „${section.title}“ wirklich löschen?`
      if (!window.confirm(msg)) return
      removeUserLibraryGroup(section.userGroupId)
    },
    [removeUserLibraryGroup],
  )

  const onLibrarySectionDrop = useCallback(
    (section: LibrarySection, e: DragEvent) => {
      e.preventDefault()
      setLibraryDropTargetKey(null)
      const type = e.dataTransfer.getData(TEMPLATE_DRAG_MIME)
      if (!type) return
      if (section.kind === 'favorites' || section.kind === 'recents') return
      if (section.kind === 'user' && section.userGroupId) {
        if (libraryOrganization.templateTypeToUserGroup[type] === section.userGroupId) return
        cloneTemplateToUserGroup(type, section.userGroupId)
      } else if (section.kind === 'builtin') {
        assignTemplateToUserGroup(type, null)
      }
    },
    [assignTemplateToUserGroup, cloneTemplateToUserGroup, libraryOrganization.templateTypeToUserGroup],
  )

  const flashFeedback = useCallback((message: string) => {
    setSaveFeedback(message)
    window.setTimeout(() => setSaveFeedback(null), 2200)
  }, [])

  const onConfirmCreateGroup = useCallback(() => {
    const id = addUserLibraryGroup(newGroupNameDraft)
    if (id) {
      setNewGroupDialogOpen(false)
      setNewGroupNameDraft('')
    } else if (newGroupNameDraft.trim()) {
      flashFeedback('Dieser Gruppenname ist reserviert oder ungültig.')
    }
  }, [addUserLibraryGroup, flashFeedback, newGroupNameDraft])

  const duplicateTemplateToWorkspace = useCallback(
    (template: AssetTemplate) => {
      const position = resolvePlacementPosition([2, 0, 2], true, template, floor)
      const asset = createAssetFromTemplate(template, { position })
      addAsset(asset, true)
      recordRecentTemplatePlacement(template.type)
      changeTool('select')
      flashFeedback(`„${template.label}“ in Szene eingefügt`)
    },
    [addAsset, changeTool, flashFeedback, floor, recordRecentTemplatePlacement],
  )

  const runAlign = useCallback(
    (mode: Parameters<typeof alignAssetsXZ>[2]) => {
      if (selectedAssets.length < 2) return
      const updates = alignAssetsXZ(selectedAssets, templateByType, mode)
      if (updates.length) updateAssets(updates)
    },
    [selectedAssets, templateByType, updateAssets],
  )

  const runDistributeH = useCallback(() => {
    if (selectedAssets.length < 3) return
    const updates = distributeCentersX(selectedAssets)
    if (updates.length) updateAssets(updates)
  }, [selectedAssets, updateAssets])

  const runDistributeZ = useCallback(() => {
    if (selectedAssets.length < 3) return
    const updates = distributeCentersZ(selectedAssets)
    if (updates.length) updateAssets(updates)
  }, [selectedAssets, updateAssets])

  const runSnapSelectionToGrid = useCallback(() => {
    if (selectedAssets.length < 2 || !floor.placementSnapEnabled) return
    const updates = snapAssetsToGrid(selectedAssets, floor.placementSnapStep)
    if (updates.length) updateAssets(updates)
  }, [floor.placementSnapEnabled, floor.placementSnapStep, selectedAssets, updateAssets])

  const batchToggleLock = useCallback(
    (locked: boolean) => {
      if (selectedAssets.length === 0) return
      updateAssets(selectedAssets.map((a) => ({ id: a.id, patch: { isLocked: locked } })))
    },
    [selectedAssets, updateAssets],
  )

  const batchAddFavorites = useCallback(() => {
    const types = [...new Set(selectedAssets.map((a) => a.type))]
    types.forEach((t) => {
      if (!favoriteTypeSet.has(t)) toggleFavoriteTemplateType(t)
    })
  }, [favoriteTypeSet, selectedAssets, toggleFavoriteTemplateType])

  const batchDeleteSelection = useCallback(() => {
    if (selectedAssets.length === 0) return
    if (
      !window.confirm(
        selectedAssets.length === 1
          ? 'Dieses Asset wirklich löschen?'
          : `${selectedAssets.length} Assets wirklich löschen?`,
      )
    ) {
      return
    }
    removeAssets(selectedAssets.map((a) => a.id))
  }, [removeAssets, selectedAssets])

  const openLibraryTemplateMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, templateType: string) => {
      event.preventDefault()
      event.stopPropagation()
      const r = event.currentTarget.getBoundingClientRect()
      setLibraryMenu({ templateType, left: r.left, top: r.bottom + 6 })
    },
    [],
  )

  const onSaveLayout = useCallback(() => {
    save()
    flashFeedback('Gespeichert (Auto-Slot)')
  }, [flashFeedback, save])

  const onSaveSlot = useCallback(() => {
    const suggested = `Layout ${new Date().toLocaleString()}`
    const name = window.prompt('Name für den Layout-Slot:', suggested)
    if (name === null) return
    const slot = saveSlot(name)
    flashFeedback(`Slot "${slot.name}" gespeichert`)
  }, [flashFeedback, saveSlot])

  const onExportLayout = useCallback(() => {
    setExportModalKey((k) => k + 1)
    setExportDialogOpen(true)
  }, [])

  const onConfirmExport = useCallback(
    (kind: LayoutExportKind) => {
      exportLayout({
        kind,
        shellMode: mode === 'view' ? 'view' : 'edit',
        librarySectionExpanded,
      })
      flashFeedback('Export gestartet')
    },
    [exportLayout, flashFeedback, librarySectionExpanded, mode],
  )

  const onLoadLayoutFile = useCallback(
    async (file: File) => {
      const r = await importLayoutFromFile(file)
      if (r.ok) {
        if (r.librarySectionExpanded) {
          setLibrarySectionExpanded(r.librarySectionExpanded)
          try {
            localStorage.setItem(
              LIBRARY_SECTION_EXPANDED_STORAGE_KEY,
              JSON.stringify(r.librarySectionExpanded),
            )
          } catch {
            /* ignore */
          }
        }
        if (r.shellMode === 'view' || r.shellMode === 'edit') {
          setMode(r.shellMode)
        }
      }
      return r.ok
    },
    [importLayoutFromFile],
  )

  const onOpenLoadModal = useCallback(() => {
    setIsLoadModalOpen(true)
  }, [])

  const onCloseLoadModal = useCallback(() => {
    setIsLoadModalOpen(false)
  }, [])

  const handleLoadCurrentAutoSlot = useCallback((): boolean => {
    return load()
  }, [load])

  const onLibraryBatchImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      try {
        if (!files?.length) return
        setImportLibraryBusy(true)
        const items: { name: string; modelUrl: string; modelFormat: ModelFormat }[] = []
        let skipped = 0
        for (const file of Array.from(files)) {
          const ext = getExtension(file.name)
          if (!isAllowedModelExtension(ext)) {
            skipped += 1
            continue
          }
          if (file.size > MAX_MODEL_SIZE_BYTES) {
            skipped += 1
            continue
          }
          const modelUrl = await readFileAsDataUrl(file)
          const name = file.name.replace(/\.[^/.]+$/, '') || 'Asset'
          items.push({ name, modelUrl, modelFormat: ext })
        }
        if (items.length === 0) {
          flashFeedback(
            skipped > 0
              ? 'Datei konnte nicht importiert werden (Format oder Größe).'
              : 'Keine gültigen Dateien ausgewählt.',
          )
          return
        }
        const created = importCustomModelTemplatesBatch(items)
        setSelectedTemplateType(created[created.length - 1]!.type)
        changeTool('place')
        if (skipped > 0) {
          flashFeedback(
            created.length === 1
              ? `„${created[0]!.label}“ importiert · ${skipped} übersprungen`
              : `${created.length} Assets importiert · ${skipped} übersprungen`,
          )
        } else if (created.length === 1) {
          flashFeedback(`„${created[0]!.label}“ importiert`)
        } else {
          flashFeedback(`${created.length} Assets importiert`)
        }
      } catch (error) {
        console.error('Import failed', error)
        flashFeedback('Datei konnte nicht importiert werden')
      } finally {
        setImportLibraryBusy(false)
        event.target.value = ''
      }
    },
    [
      changeTool,
      flashFeedback,
      importCustomModelTemplatesBatch,
      setSelectedTemplateType,
    ],
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

      if (event.key === 'Escape') {
        if (dismissTopColorPickerEscape()) {
          event.preventDefault()
          return
        }
        if (templatePreview !== null) {
          event.preventDefault()
          setTemplatePreview(null)
          return
        }
        if (isLoadModalOpen) {
          event.preventDefault()
          setIsLoadModalOpen(false)
          return
        }
        if (exportDialogOpen) {
          event.preventDefault()
          setExportDialogOpen(false)
          return
        }
        if (newGroupDialogOpen) {
          event.preventDefault()
          setNewGroupDialogOpen(false)
          return
        }
        if (templateMetaDialog) {
          event.preventDefault()
          setTemplateMetaDialog(null)
          return
        }
        if (templateGroupDialog) {
          event.preventDefault()
          setTemplateGroupDialog(null)
          return
        }
        if (templateDetailsDialog) {
          event.preventDefault()
          setTemplateDetailsDialog(null)
          return
        }
        if (shortcutsOpen) {
          event.preventDefault()
          setShortcutsOpen(false)
          return
        }
        if (mode === 'view' && infoAssetId) {
          event.preventDefault()
          setInfoAssetId(null)
          return
        }
        if (libraryMenu) {
          event.preventDefault()
          setLibraryMenu(null)
          return
        }
        if (toolsMenuOpen) {
          event.preventDefault()
          setToolsMenuOpen(false)
          return
        }
        if (lightingPanelOpen) {
          event.preventDefault()
          setLightingPanelOpen(false)
          return
        }
        if (floorInspectorOpen) {
          event.preventDefault()
          setFloorInspectorOpen(false)
          return
        }
        if (librarySearchInput.trim()) {
          setLibrarySearchInput('')
          setLibrarySearch('')
          event.preventDefault()
          return
        }
        if (mode === 'view') {
          event.preventDefault()
          changeMode('edit')
          return
        }
        event.preventDefault()
        changeTool('select')
        setInfoAssetId(null)
        return
      }

      if (mode === 'view') {
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

      if (tool === 'select' && !hasModifier && key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
        return
      }
      if (tool === 'select' && !hasModifier && key === 'z' && event.shiftKey) {
        event.preventDefault()
        redo()
        return
      }

      if (!hasModifier && event.shiftKey && key === 'c') {
        event.preventDefault()
        copy()
        return
      }
      if (!hasModifier && event.shiftKey && key === 'v') {
        event.preventDefault()
        paste()
        return
      }

      if (!hasModifier && key === 'e') {
        event.preventDefault()
        changeMode(mode === 'edit' ? 'view' : 'edit')
        return
      }

      if (!hasModifier && key === 'h') {
        event.preventDefault()
        setRightPanelHidden((v) => !v)
        return
      }
      if (!hasModifier && key === 'm') {
        event.preventDefault()
        setLeftPanelHidden((v) => !v)
        return
      }

      if (!hasModifier && ['1', '2', '3', '4'].includes(event.key)) {
        const presetMap: Record<string, CameraViewPreset> = {
          '1': 'perspective',
          '2': 'top',
          '3': 'front',
          '4': 'side',
        }
        const preset = presetMap[event.key]
        if (preset) {
          event.preventDefault()
          setCameraView(preset)
        }
        return
      }

      const selectOnly = tool === 'select'

      if (selectOnly && key === 'g') {
        event.preventDefault()
        if (canUseTransform) setTransformMode('translate')
        return
      }
      if (selectOnly && key === 'r') {
        event.preventDefault()
        if (canUseTransform) setTransformMode('rotate')
        return
      }
      if (selectOnly && key === 's' && !event.shiftKey) {
        event.preventDefault()
        if (canUseTransform) setTransformMode('scale')
        return
      }

      if (selectOnly && key === 'd') {
        event.preventDefault()
        onRemoveSelected()
        return
      }

      if (selectOnly && key === 'l' && selectedAssets.length > 0) {
        event.preventDefault()
        const anyUnlocked = selectedAssets.some((a) => !a.isLocked)
        updateAssets(
          selectedAssets.map((a) => ({ id: a.id, patch: { isLocked: anyUnlocked } })),
        )
        return
      }

      if (selectOnly && key === 'f' && selectedAssets.length > 0) {
        event.preventDefault()
        const types = [...new Set(selectedAssets.map((a) => a.type))]
        const allFav = types.every((t) => favoriteTypeSet.has(t))
        types.forEach((t) => {
          const fav = favoriteTypeSet.has(t)
          if (allFav && fav) toggleFavoriteTemplateType(t)
          if (!allFav && !fav) toggleFavoriteTemplateType(t)
        })
        return
      }

      if (selectOnly && key === 'c' && !event.shiftKey && selectedAssets.length > 0) {
        event.preventDefault()
        setColorPickerKick((k) => k + 1)
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        onRemoveSelected()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control' || event.key === 'Meta') {
        setIsCtrlPressed(false)
      }
    }

    const handleBlur = () => setIsCtrlPressed(false)

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [
    canUseTransform,
    changeMode,
    changeTool,
    copy,
    exportDialogOpen,
    favoriteTypeSet,
    floorInspectorOpen,
    infoAssetId,
    isLoadModalOpen,
    libraryMenu,
    librarySearchInput,
    lightingPanelOpen,
    mode,
    newGroupDialogOpen,
    onRemoveSelected,
    paste,
    redo,
    selectedAssets,
    setCameraView,
    shortcutsOpen,
    templateDetailsDialog,
    templateGroupDialog,
    templateMetaDialog,
    templatePreview,
    toggleFavoriteTemplateType,
    tool,
    toolsMenuOpen,
    undo,
    updateAssets,
  ])

  const patchSimpleMetadata = useCallback(
    (kind: 'name' | 'description' | 'zoneType' | 'text', value: string) => {
      if (!singleSelected) return
      updateAsset(singleSelected.id, { metadata: { [kind]: value } })
    },
    [singleSelected, updateAsset],
  )

  const updateCustomRowValue = useCallback(
    (rowId: string, value: string) => {
      if (!singleSelected) return
      const rows = getCustomRows(singleSelected.metadata).map((r) =>
        r.id === rowId ? { ...r, value } : r,
      )
      updateAsset(singleSelected.id, { metadata: { customRows: rows } })
    },
    [singleSelected, updateAsset],
  )

  const renameCustomRow = useCallback(
    (rowId: string, newName: string) => {
      if (!singleSelected) return
      const name = newName.trim().slice(0, 200)
      if (!name) return
      const rows = getCustomRows(singleSelected.metadata).map((r) =>
        r.id === rowId ? { ...r, name } : r,
      )
      updateAsset(singleSelected.id, { metadata: { customRows: rows } })
    },
    [singleSelected, updateAsset],
  )

  const removeCustomRow = useCallback(
    (rowId: string) => {
      if (!singleSelected) return
      const rows = getCustomRows(singleSelected.metadata).filter((r) => r.id !== rowId)
      updateAsset(singleSelected.id, { metadata: { customRows: rows } })
    },
    [singleSelected, updateAsset],
  )

  const addCustomMetadataField = useCallback(() => {
    if (!singleSelected) return
    const rows = [...getCustomRows(singleSelected.metadata)]
    let n = rows.length + 1
    let name = `Feld ${n}`
    while (rows.some((r) => r.name === name)) {
      n += 1
      name = `Feld ${n}`
    }
    rows.push({ id: newCustomFieldId(), name, value: '' })
    updateAsset(singleSelected.id, { metadata: { customRows: rows } })
  }, [singleSelected, updateAsset])

  const patchPrimaryDecal = useCallback(
    (partial: Partial<AssetDecal>) => {
      if (!singleSelected) return
      const cur = singleSelected.visual?.decals?.[0]
      const base: AssetDecal = cur ?? {
        id: newCustomFieldId(),
        imageUrl: '',
        imageName: '',
        size: 1,
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        side: 'front',
      }
      const merged: AssetDecal = { ...base, ...partial }
      const decals = merged.imageUrl ? [merged] : []
      updateAsset(singleSelected.id, {
        visual: { ...(singleSelected.visual ?? {}), decals },
      })
    },
    [singleSelected, updateAsset],
  )

  // Preview template for ghost placement
  const ghostAsset: Asset | null = useMemo(() => {
    if (mode !== 'edit' || tool !== 'place' || !activeTemplate || !previewPosition) return null
    return createAssetFromTemplate(activeTemplate, { position: previewPosition })
  }, [activeTemplate, mode, previewPosition, tool])

  const libraryMenuTemplate = useMemo(() => {
    if (!libraryMenu) return null
    return resolvedTemplates.find((t) => t.type === libraryMenu.templateType) ?? null
  }, [libraryMenu, resolvedTemplates])

  return (
    <div className={`planner-shell mode-${mode}`}>
      {isLoadModalOpen && (
        <LoadLayoutModal
          slots={slots}
          onClose={onCloseLoadModal}
          onLoadSlot={loadSlot}
          onDeleteSlot={deleteSlot}
          onRenameSlot={renameSlot}
          onLoadFile={onLoadLayoutFile}
          onLoadCurrent={handleLoadCurrentAutoSlot}
        />
      )}
      <ExportLayoutModal
        key={exportModalKey}
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onConfirm={onConfirmExport}
      />
      <header className="top-bar top-bar-grouped">
        <span className="toolbar-title">Factory Planning Studio</span>

        {mode === 'edit' ? (
          <>
            <div className={`mode-switch mode-${mode}`}>
              <span className="mode-badge" data-mode={mode} aria-live="polite">
                EDIT MODE
              </span>
              <button type="button" className="active" onClick={() => changeMode('edit')}>
                Bearbeiten
              </button>
              <button type="button" onClick={() => changeMode('view')}>
                Präsentation
              </button>
            </div>

            <ToolbarSeparator />

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

            <ToolbarSeparator />

            <div className="toolbar-dropdown-wrap toolbar-more-wrap" ref={toolsMenuRef}>
              <button
                ref={toolsMenuButtonRef}
                type="button"
                className={toolsMenuOpen ? 'active' : ''}
                aria-expanded={toolsMenuOpen}
                aria-haspopup="true"
                onClick={() => {
                  setToolsMenuOpen((o) => !o)
                  setLightingPanelOpen(false)
                }}
              >
                ⋮ Werkzeuge
              </button>
              {toolsMenuOpen ? (
                <div
                  ref={toolsPopoverRef}
                  className="toolbar-popover toolbar-more-menu toolbar-popover--anchored"
                  role="menu"
                  aria-label="Ausrichten und Verteilen"
                >
                  <div className="toolbar-more-menu-heading">Ausrichten (mind. 2 Assets)</div>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={selectedAssets.length < 2}
                    onClick={() => {
                      runAlign('left')
                      setToolsMenuOpen(false)
                    }}
                  >
                    Linksbündig
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={selectedAssets.length < 2}
                    onClick={() => {
                      runAlign('right')
                      setToolsMenuOpen(false)
                    }}
                  >
                    Rechtsbündig
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={selectedAssets.length < 2}
                    onClick={() => {
                      runAlign('centerX')
                      setToolsMenuOpen(false)
                    }}
                  >
                    Mitte X
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={selectedAssets.length < 2}
                    onClick={() => {
                      runAlign('top')
                      setToolsMenuOpen(false)
                    }}
                  >
                    Oben (Z+)
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={selectedAssets.length < 2}
                    onClick={() => {
                      runAlign('bottom')
                      setToolsMenuOpen(false)
                    }}
                  >
                    Unten (Z−)
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={selectedAssets.length < 2}
                    onClick={() => {
                      runAlign('centerZ')
                      setToolsMenuOpen(false)
                    }}
                  >
                    Mitte Z
                  </button>
                  <div className="toolbar-more-menu-heading">Verteilen</div>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={selectedAssets.length < 3}
                    onClick={() => {
                      runDistributeH()
                      setToolsMenuOpen(false)
                    }}
                  >
                    Gleichmäßig auf X
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={selectedAssets.length < 3}
                    onClick={() => {
                      runDistributeZ()
                      setToolsMenuOpen(false)
                    }}
                  >
                    Gleichmäßig auf Z
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={selectedAssets.length < 2 || !floor.placementSnapEnabled}
                    onClick={() => {
                      runSnapSelectionToGrid()
                      setToolsMenuOpen(false)
                    }}
                  >
                    An Platzierungs-Raster ausrichten
                  </button>
                </div>
              ) : null}
            </div>

            <ToolbarSeparator />

            <ButtonGroup>
              {(['perspective', 'top', 'front', 'side'] as const).map((preset) => (
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
                        : 'Seite'}
                </button>
              ))}
            </ButtonGroup>

            <ToolbarSeparator />

            <div className="toolbar-dropdown-wrap toolbar-lighting-wrap" ref={lightingBarRef}>
              <button
                ref={lightingButtonRef}
                type="button"
                className={lightingPanelOpen ? 'active' : ''}
                onClick={() => {
                  setLightingPanelOpen((o) => !o)
                  setFloorInspectorOpen(false)
                  setToolsMenuOpen(false)
                }}
              >
                Beleuchtung
              </button>
              {lightingPanelOpen ? (
                <div
                  ref={lightingPopoverRef}
                  className="toolbar-popover lighting-popover toolbar-popover--anchored"
                >
                  <LightingToolbarPanel lighting={lighting} setLighting={setLighting} />
                </div>
              ) : null}
            </div>

            <ToolbarSeparator />

            <ButtonGroup>
              <button type="button" onClick={onSaveLayout}>
                Speichern
              </button>
              <button type="button" onClick={onSaveSlot}>
                Als Slot
              </button>
              <button type="button" onClick={onExportLayout}>
                Export
              </button>
              <button type="button" onClick={onOpenLoadModal}>
                Laden
              </button>
            </ButtonGroup>

            <ToolbarSeparator />

            <ButtonGroup>
              <button
                type="button"
                className="toolbar-delete"
                onClick={onRemoveSelected}
                disabled={selectedIds.length === 0}
              >
                Löschen
              </button>
            </ButtonGroup>
          </>
        ) : (
          <>
            <span className="mode-badge" data-mode={mode} aria-live="polite">
              VIEW MODE
            </span>
            <button type="button" onClick={() => changeMode('edit')}>
              Präsentation beenden (ESC)
            </button>
            <ToolbarSeparator />
            <ButtonGroup>
              {(['perspective', 'top', 'front', 'side'] as CameraViewPreset[]).map((preset) => (
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
                        : 'Seite'}
                </button>
              ))}
            </ButtonGroup>
          </>
        )}
      </header>

      <div
        className={`workspace${mode === 'view' ? ' view-mode' : ''}${leftPanelHidden ? ' workspace--hide-library' : ''}${rightPanelHidden ? ' workspace--hide-inspector' : ''}`}
      >
        <aside className="panel left" aria-hidden={mode === 'view'}>
          <h2>Asset-Bibliothek</h2>
          <p className="panel-hint">
            Vorlage wählen und auf den Boden klicken. Eigene Modelle: Plus neben „{EIGENE_ASSETS_USER_GROUP_LABEL}“
            — GLB, GLTF, STL, OBJ, FBX (max. {formatBytes(MAX_MODEL_SIZE_BYTES)} pro Datei, mehrere Dateien
            möglich).
          </p>
          <div className="library-search-row">
            <span className="library-search-icon" aria-hidden>
              🔍
            </span>
            <input
              type="search"
              className="library-search-input"
              placeholder="Assets suchen…"
              value={librarySearchInput}
              onChange={(e) => setLibrarySearchInput(e.target.value)}
              aria-label="Assets suchen"
            />
            {librarySearchInput ? (
              <button
                type="button"
                className="library-search-clear"
                aria-label="Suche zurücksetzen"
                onClick={() => {
                  setLibrarySearchInput('')
                  setLibrarySearch('')
                }}
              >
                ×
              </button>
            ) : null}
          </div>
          <div className="library-toolbar-row library-toolbar-row--import">
            <button
              type="button"
              className="library-new-group-btn"
              onClick={() => {
                setNewGroupNameDraft('')
                setNewGroupDialogOpen(true)
              }}
            >
              + Neue Gruppe
            </button>
          </div>

          {filteredLibrarySections.map((section) => {
            const expanded = librarySectionExpanded[section.sectionKey] === true
            const sectionAccent = libraryAccentForSectionTitle(section.title)
            return (
              <div
                key={section.sectionKey}
                className={`asset-group${libraryDropTargetKey === section.sectionKey ? ' library-drop-active' : ''}`}
                onDragOver={(e) => {
                  if (section.kind === 'favorites' || section.kind === 'recents') {
                    e.dataTransfer.dropEffect = 'none'
                    return
                  }
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setLibraryDropTargetKey(section.sectionKey)
                }}
                onDrop={(e) => onLibrarySectionDrop(section, e)}
              >
                <div className="asset-group-header-row">
                  <button
                    type="button"
                    className="asset-group-header"
                    onClick={() => toggleTemplateGroup(section.sectionKey)}
                    aria-expanded={expanded}
                  >
                    <span
                      className={`asset-group-chevron${expanded ? ' asset-group-chevron--open' : ''}`}
                      aria-hidden
                    >
                      ▶
                    </span>
                    <span className="asset-group-title">
                      {section.title}
                      {section.kind === 'user' && section.templates.length === 0 ? ' (leer)' : ''}
                    </span>
                  </button>
                  {section.userGroupId === EIGENE_ASSETS_USER_GROUP_ID ? (
                    <>
                      <input
                        ref={eigeneAssetsImportInputRef}
                        type="file"
                        className="library-import-input-hidden"
                        accept=".glb,.gltf,.stl,.obj,.fbx,model/gltf-binary,model/gltf+json,model/stl"
                        multiple
                        onChange={onLibraryBatchImport}
                      />
                      <button
                        type="button"
                        className="asset-group-import-header"
                        title="Asset importieren"
                        aria-label="Asset importieren"
                        disabled={importLibraryBusy}
                        onClick={(e) => {
                          e.stopPropagation()
                          eigeneAssetsImportInputRef.current?.click()
                        }}
                      >
                        +
                      </button>
                    </>
                  ) : null}
                  {section.deletable ? (
                    <button
                      type="button"
                      className="asset-group-delete-header"
                      title="Gruppe löschen"
                      aria-label={`Gruppe ${section.title} löschen`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveLibrarySection(section)
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <div
                  className={`asset-group-items${expanded ? ' asset-group-items--expanded' : ' asset-group-items--collapsed'}`}
                  aria-hidden={!expanded}
                >
                  {section.kind === 'favorites' && section.templates.length === 0 ? (
                    <p className="panel-hint library-fav-empty">
                      Über das Menü (⋮) bei einer Vorlage „Zu Favoriten hinzufügen“ wählen.
                    </p>
                  ) : null}
                  {section.kind === 'recents' && section.templates.length === 0 ? (
                    <p className="panel-hint library-fav-empty">
                      Erscheint automatisch, sobald Sie Assets platzieren.
                    </p>
                  ) : null}
                  {section.templates.map((template) => (
                    <div
                      key={`${section.sectionKey}-${template.type}`}
                      className="asset-template-block"
                      style={{ borderLeft: `4px solid ${sectionAccent}` }}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(TEMPLATE_DRAG_MIME, template.type)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => setLibraryDropTargetKey(null)}
                    >
                      <div className="asset-template-row">
                        <button
                          type="button"
                          className={`asset-template-select${
                            tool === 'place' && activeTemplateType === template.type ? ' active' : ''
                          }`}
                          onClick={() => {
                            setFloorInspectorOpen(false)
                            setSelectedTemplateType(template.type)
                            changeTool('place')
                          }}
                        >
                          <span>{template.label}</span>
                        </button>
                        <button
                          type="button"
                          className="library-template-menu-btn"
                          title="Optionen"
                          aria-label={`Optionen für ${template.label}`}
                          onClick={(e) => openLibraryTemplateMenu(e, template.type)}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          ⋮
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {newGroupDialogOpen ? (
            <div
              className="library-dialog-backdrop"
              role="presentation"
              onClick={() => setNewGroupDialogOpen(false)}
              onKeyDown={(e) => e.key === 'Escape' && setNewGroupDialogOpen(false)}
            >
              <div
                className="library-dialog"
                role="dialog"
                aria-labelledby="new-group-title"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="new-group-title">Neue Gruppe</h3>
                <input
                  className="library-dialog-input"
                  placeholder="Gruppenname eingeben"
                  value={newGroupNameDraft}
                  autoFocus
                  onChange={(e) => setNewGroupNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onConfirmCreateGroup()
                  }}
                />
                <div className="library-dialog-actions">
                  <button type="button" onClick={onConfirmCreateGroup}>
                    Erstellen
                  </button>
                  <button type="button" onClick={() => setNewGroupDialogOpen(false)}>
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {libraryMenu && libraryMenuTemplate ? (
            <div
              ref={libraryMenuRef}
              className="library-context-menu"
              style={{
                position: 'fixed',
                left: libraryMenu.left,
                top: libraryMenu.top,
                zIndex: 1000,
              }}
              role="menu"
            >
              <button
                type="button"
                className="library-context-menu-item"
                role="menuitem"
                onClick={() => {
                  toggleFavoriteTemplateType(libraryMenuTemplate.type)
                  setLibraryMenu(null)
                }}
              >
                <span className="library-context-menu-icon" aria-hidden>
                  {favoriteTypeSet.has(libraryMenuTemplate.type) ? '☆' : '★'}
                </span>
                <span className="library-context-menu-label">
                  {favoriteTypeSet.has(libraryMenuTemplate.type)
                    ? 'Aus Favoriten entfernen'
                    : 'Zu Favoriten hinzufügen'}
                </span>
              </button>
              <div className="library-context-menu-divider" role="separator" />
              <button
                type="button"
                className="library-context-menu-item"
                role="menuitem"
                onClick={() => {
                  const t = libraryMenuTemplate
                  const tags = getTagsFromTemplate(t, libraryOrganization)
                  setTemplateMetaDraft({
                    name: t.label,
                    description: t.metadata?.description ?? '',
                    tags: tags.join(', '),
                  })
                  setTemplateMetaDialog(t)
                  setLibraryMenu(null)
                }}
              >
                <span className="library-context-menu-icon" aria-hidden>
                  ℹ
                </span>
                <span className="library-context-menu-label">Name & Beschreibung bearbeiten</span>
              </button>
              <button
                type="button"
                className="library-context-menu-item"
                role="menuitem"
                onClick={() => {
                  setTemplateGroupDialog(libraryMenuTemplate)
                  setLibraryMenu(null)
                }}
              >
                <span className="library-context-menu-icon" aria-hidden>
                  📁
                </span>
                <span className="library-context-menu-label">In Gruppe verschieben</span>
              </button>
              <div className="library-context-menu-divider" role="separator" />
              <button
                type="button"
                className="library-context-menu-item"
                role="menuitem"
                onClick={() => {
                  setTemplatePreview(libraryMenuTemplate)
                  setLibraryMenu(null)
                }}
              >
                <span className="library-context-menu-icon" aria-hidden>
                  👁
                </span>
                <span className="library-context-menu-label">Vorschau</span>
              </button>
              <button
                type="button"
                className="library-context-menu-item"
                role="menuitem"
                onClick={() => {
                  duplicateTemplateToWorkspace(libraryMenuTemplate)
                  setLibraryMenu(null)
                }}
              >
                <span className="library-context-menu-icon" aria-hidden>
                  📋
                </span>
                <span className="library-context-menu-label">In Workspace duplizieren</span>
              </button>
              <button
                type="button"
                className="library-context-menu-item"
                role="menuitem"
                onClick={() => {
                  setTemplateDetailsDialog(libraryMenuTemplate)
                  setLibraryMenu(null)
                }}
              >
                <span className="library-context-menu-icon" aria-hidden>
                  📊
                </span>
                <span className="library-context-menu-label">Details anzeigen</span>
              </button>
              <div className="library-context-menu-divider" role="separator" />
              <button
                type="button"
                className="library-context-menu-item library-context-menu-item--danger"
                role="menuitem"
                disabled={!customTemplateTypeSet.has(libraryMenuTemplate.type)}
                title={
                  customTemplateTypeSet.has(libraryMenuTemplate.type)
                    ? undefined
                    : 'Nur eigene Uploads können aus der Bibliothek gelöscht werden'
                }
                onClick={() => {
                  if (!customTemplateTypeSet.has(libraryMenuTemplate.type)) return
                  onRemoveCustomTemplate(libraryMenuTemplate)
                  setLibraryMenu(null)
                }}
              >
                <span className="library-context-menu-icon" aria-hidden>
                  🗑
                </span>
                <span className="library-context-menu-label">Löschen</span>
              </button>
            </div>
          ) : null}

          {templateMetaDialog ? (
            <div
              className="library-dialog-backdrop"
              role="presentation"
              onClick={() => setTemplateMetaDialog(null)}
              onKeyDown={(e) => e.key === 'Escape' && setTemplateMetaDialog(null)}
            >
              <div
                className="library-dialog"
                role="dialog"
                aria-labelledby="template-meta-title"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="template-meta-title">Vorlage bearbeiten</h3>
                <label className="library-dialog-field">
                  <span>Name</span>
                  <input
                    className="library-dialog-input"
                    value={templateMetaDraft.name}
                    onChange={(e) =>
                      setTemplateMetaDraft((d) => ({ ...d, name: e.target.value }))
                    }
                  />
                </label>
                <label className="library-dialog-field">
                  <span>Beschreibung</span>
                  <textarea
                    className="library-dialog-textarea"
                    rows={3}
                    value={templateMetaDraft.description}
                    onChange={(e) =>
                      setTemplateMetaDraft((d) => ({ ...d, description: e.target.value }))
                    }
                  />
                </label>
                <label className="library-dialog-field">
                  <span>Tags (kommagetrennt)</span>
                  <input
                    className="library-dialog-input"
                    value={templateMetaDraft.tags}
                    onChange={(e) =>
                      setTemplateMetaDraft((d) => ({ ...d, tags: e.target.value }))
                    }
                  />
                </label>
                <div className="library-dialog-actions">
                  <button
                    type="button"
                    onClick={() => {
                      const tags = templateMetaDraft.tags
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                      updateTemplateLibraryMeta(templateMetaDialog.type, {
                        label: templateMetaDraft.name,
                        description: templateMetaDraft.description,
                        tags: tags.length > 0 ? tags : null,
                      })
                      setTemplateMetaDialog(null)
                    }}
                  >
                    Speichern
                  </button>
                  <button type="button" onClick={() => setTemplateMetaDialog(null)}>
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {templateGroupDialog ? (
            <div
              className="library-dialog-backdrop"
              role="presentation"
              onClick={() => setTemplateGroupDialog(null)}
              onKeyDown={(e) => e.key === 'Escape' && setTemplateGroupDialog(null)}
            >
              <div
                className="library-dialog"
                role="dialog"
                aria-labelledby="template-group-title"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="template-group-title">Bibliotheks-Gruppe</h3>
                <label className="library-dialog-field">
                  <span>Zuordnung</span>
                  <select
                    className="library-dialog-input template-group-select"
                    value={
                      libraryOrganization.templateTypeToUserGroup[templateGroupDialog.type] ?? ''
                    }
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') {
                        assignTemplateToUserGroup(templateGroupDialog.type, null)
                        return
                      }
                      cloneTemplateToUserGroup(templateGroupDialog.type, v)
                    }}
                  >
                    <option value="">Kategorie (Standard)</option>
                    <option value={EIGENE_ASSETS_USER_GROUP_ID}>{EIGENE_ASSETS_USER_GROUP_LABEL}</option>
                    {libraryOrganization.userGroups
                      .filter((g) => g.id !== EIGENE_ASSETS_USER_GROUP_ID)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.label}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="library-dialog-actions">
                  <button type="button" onClick={() => setTemplateGroupDialog(null)}>
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {templateDetailsDialog ? (
            <div
              className="library-dialog-backdrop"
              role="presentation"
              onClick={() => setTemplateDetailsDialog(null)}
              onKeyDown={(e) => e.key === 'Escape' && setTemplateDetailsDialog(null)}
            >
              <div
                className="library-dialog library-details-dialog"
                role="dialog"
                aria-labelledby="template-details-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="details-dialog-header">
                  <div>
                    <h3 id="template-details-title">{templateDetailsDialog.label}</h3>
                    <p className="details-dialog-subtitle">{templateDetailsDialog.category}</p>
                  </div>
                  <button
                    type="button"
                    className="details-dialog-close"
                    onClick={() => setTemplateDetailsDialog(null)}
                    aria-label="Schließen"
                  >
                    ×
                  </button>
                </div>
                <div className="details-dialog-body">
                  <section className="details-section">
                    <h4>Basis-Informationen</h4>
                    <dl className="details-dl">
                      <dt>Name</dt>
                      <dd>{templateDetailsDialog.label}</dd>
                      <dt>Beschreibung</dt>
                      <dd>{templateDetailsDialog.metadata?.description?.trim() || '—'}</dd>
                      <dt className="details-dt-muted">Typ-ID</dt>
                      <dd className="details-dd-muted">
                        <code>{templateDetailsDialog.type}</code>
                      </dd>
                    </dl>
                  </section>
                  <section className="details-section">
                    <h4>Geometrie</h4>
                    <dl className="details-dl">
                      <dt>Art</dt>
                      <dd>{templateDetailsDialog.geometry.kind}</dd>
                      <dt>Abmessungen (ca.)</dt>
                      <dd>{formatTemplateDimensions(templateDetailsDialog)}</dd>
                      <dt>In Millimetern</dt>
                      <dd>{formatTemplateDimensionsMm(templateDetailsDialog)}</dd>
                      <dt>Template-Skalierung</dt>
                      <dd>
                        {templateDetailsDialog.scale[0].toFixed(4)} ×{' '}
                        {templateDetailsDialog.scale[1].toFixed(4)} ×{' '}
                        {templateDetailsDialog.scale[2].toFixed(4)}
                      </dd>
                    </dl>
                  </section>
                  <section className="details-section">
                    <h4>Material</h4>
                    <dl className="details-dl">
                      <dt>Farbe</dt>
                      <dd className="details-color-row">
                        <span
                          className="details-color-swatch"
                          style={{ backgroundColor: templateDetailsDialog.color }}
                          aria-hidden
                        />
                        <span>{templateDetailsDialog.color}</span>
                      </dd>
                    </dl>
                  </section>
                  <section className="details-section">
                    <h4>Status</h4>
                    <dl className="details-dl">
                      <dt>Favorit</dt>
                      <dd>
                        {libraryOrganization.favoriteTemplateTypes.includes(
                          templateDetailsDialog.type,
                        )
                          ? '★ Ja'
                          : '☆ Nein'}
                      </dd>
                      <dt>Bibliotheks-Gruppe</dt>
                      <dd>
                        {(() => {
                          const gid =
                            libraryOrganization.templateTypeToUserGroup[templateDetailsDialog.type]
                          if (!gid) return `Standard (${templateDetailsDialog.category})`
                          const g = libraryOrganization.userGroups.find((u) => u.id === gid)
                          return g?.label ?? gid
                        })()}
                      </dd>
                    </dl>
                  </section>
                  <section className="details-section">
                    <h4>Metadaten</h4>
                    <dl className="details-dl">
                      <dt>Tags</dt>
                      <dd>
                        {getTagsFromTemplate(templateDetailsDialog, libraryOrganization).join(', ') ||
                          '—'}
                      </dd>
                      {templateDetailsDialog.createdAt ? (
                        <>
                          <dt>Importiert am</dt>
                          <dd>
                            {new Date(templateDetailsDialog.createdAt).toLocaleString('de-DE')}
                          </dd>
                        </>
                      ) : (
                        <>
                          <dt>Import</dt>
                          <dd>Nein (eingebaute Vorlage)</dd>
                        </>
                      )}
                      {templateDetailsDialog.geometry.kind === 'custom' ? (
                        <>
                          <dt>Modell-Format</dt>
                          <dd>{templateDetailsDialog.geometry.params.modelFormat ?? '—'}</dd>
                          <dt>Modell-URL</dt>
                          <dd className="library-details-mono">
                            {templateDetailsDialog.geometry.params.modelUrl
                              ? `${String(templateDetailsDialog.geometry.params.modelUrl).slice(0, 64)}…`
                              : '—'}
                          </dd>
                        </>
                      ) : null}
                    </dl>
                  </section>
                </div>
                <div className="library-dialog-actions">
                  <button type="button" onClick={() => setTemplateDetailsDialog(null)}>
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          ) : null}
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
            <Lighting settings={lighting} presentation={mode === 'view'} />
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
                  selectionAccent={libraryAccentForSectionTitle(asset.category)}
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
                translationSnap={gizmoTranslateSnap}
                onCommit={(id, patch) => updateAsset(id, patch)}
              >
                <AssetRenderer
                  asset={singleSelected}
                  isSelected
                  isHovered={hoveredId === singleSelected.id}
                  isEditMode
                  skipTransform
                  selectionAccent={libraryAccentForSectionTitle(singleSelected.category)}
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
                translationSnap={gizmoTranslateSnap}
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
              <span>Präsentationsmodus: Klicke ein Asset für Details.</span>
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
                <p className="panel-hint">
                  Maße (ca.):{' '}
                  {templateByType.has(singleSelected.type)
                    ? formatTemplateDimensions(templateByType.get(singleSelected.type)!)
                    : '—'}
                </p>
                <p className="panel-hint">
                  Position (m): X {formatNumber(singleSelected.position[0])}, Y{' '}
                  {formatNumber(singleSelected.position[1])}, Z{' '}
                  {formatNumber(singleSelected.position[2])}
                </p>
                <p className="panel-hint">ID: {singleSelected.id.slice(0, 20)}...</p>

                <h3>
                  <span className="inspector-inline-label">
                    Sperre
                    <InspectorHint text="Wenn aktiv: Asset kann in der Szene nicht verschoben, gedreht oder skaliert werden (nur per Inspector, wo freigegeben)." />
                  </span>
                </h3>
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
                    Gesperrt: Transform nur im Inspector eingeschränkt; Farbe/Lock hier
                    weiterhin änderbar. In der Szene ohne Transform-Gizmo.
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
                <p className="panel-hint inspector-scale-hint">
                  Stufenlos (Gizmo und Eingaben). Einheitlich: alle Achsen auf einen Wert setzen.
                </p>
                <label className="opacity-slider-field">
                  Alle Achsen gleich
                  <input
                    type="range"
                    min={0.01}
                    max={10}
                    step={0.001}
                    disabled={singleSelected.isLocked}
                    value={roundToDecimals(
                      (singleSelected.scale[0] +
                        singleSelected.scale[1] +
                        singleSelected.scale[2]) /
                        3,
                      4,
                    )}
                    onChange={(event) => {
                      const v = Number(event.target.value)
                      updateAsset(singleSelected.id, { scale: [v, v, v] })
                    }}
                  />
                  <span className="slider-value-hint">
                    {formatNumeric(
                      (singleSelected.scale[0] +
                        singleSelected.scale[1] +
                        singleSelected.scale[2]) /
                        3,
                      4,
                    )}
                  </span>
                </label>
                <div className="vector-grid" key={`${singleSelected.id}-scale`}>
                  <NumericInput
                    label="Breite (X)"
                    value={singleSelected.scale[0]}
                    fractionDigits={4}
                    disabled={singleSelected.isLocked}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        scale: [
                          Math.max(value, 0.01),
                          singleSelected.scale[1],
                          singleSelected.scale[2],
                        ],
                      })
                    }
                  />
                  <NumericInput
                    label="Höhe (Y)"
                    value={singleSelected.scale[1]}
                    fractionDigits={4}
                    disabled={singleSelected.isLocked}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        scale: [
                          singleSelected.scale[0],
                          Math.max(value, 0.01),
                          singleSelected.scale[2],
                        ],
                      })
                    }
                  />
                  <NumericInput
                    label="Länge (Z)"
                    value={singleSelected.scale[2]}
                    fractionDigits={4}
                    disabled={singleSelected.isLocked}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        scale: [
                          singleSelected.scale[0],
                          singleSelected.scale[1],
                          Math.max(value, 0.01),
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
                      GLTF-Materialien; Override färbt alle Meshes mit der gewählten Farbe.
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
                    Farbe und Deckkraft gelten für Primitive und STL; GLB/GLTF zusätzlich mit
                    Modus Original/Override.
                  </p>
                )}

                <ColorPickerPopover
                  value={singleSelected.color}
                  openSignal={colorPickerKick}
                  hint="Basisfarbe des Assets. Bei importierten GLB/GLTF nur im Modus „Override“ sichtbar; Bild-Decals liegen als eigene Fläche darüber."
                  onCommit={(nextColor) =>
                    updateAsset(singleSelected.id, { color: sanitizeColor(nextColor) })
                  }
                />

                <label className="opacity-slider-field">
                  <span className="inspector-inline-label">
                    Deckkraft ({Math.round(resolveAssetOpacity(singleSelected) * 100)}%)
                    <InspectorHint text="Durchsichtigkeit des gesamten Assets: 0 % unsichtbar, 100 % deckend. Kombiniert mit Modell-Material, falls vorhanden." />
                  </span>
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

                {singleSelected.geometry.kind !== 'text' ? (
                  <div className="inspector-decal-panel">
                    <h4 className="inspector-subheading">
                      <span className="inspector-inline-label">
                        Bild / Decal
                        <InspectorHint text="PNG, JPEG oder WebP auf eine Fläche legen (Orientierung per Seite). Näherung über die Bounding-Box; bei komplexen Modellen ggf. Seite probieren." />
                      </span>
                    </h4>
                    <input
                      ref={decalImportInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                      className="inspector-file-input-hidden"
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (!file || !singleSelected) return
                        const okType =
                          /image\/(png|jpeg|webp)/i.test(file.type) ||
                          /\.(png|jpe?g|webp)$/i.test(file.name)
                        if (!okType) {
                          setSaveFeedback('Nur PNG, JPEG oder WebP.')
                          window.setTimeout(() => setSaveFeedback(null), 2800)
                          return
                        }
                        if (file.size > MAX_DECAL_IMAGE_BYTES) {
                          setSaveFeedback('Bild zu groß (max. 5 MB).')
                          window.setTimeout(() => setSaveFeedback(null), 2800)
                          return
                        }
                        const reader = new FileReader()
                        reader.onload = () => {
                          const url = String(reader.result ?? '')
                          if (!url) return
                          patchPrimaryDecal({
                            imageUrl: url,
                            imageName: file.name,
                          })
                        }
                        reader.readAsDataURL(file)
                      }}
                    />
                    <div className="inspector-decal-actions">
                      <button
                        type="button"
                        onClick={() => decalImportInputRef.current?.click()}
                      >
                        Bild importieren
                      </button>
                      {inspectorPrimaryDecal?.imageUrl ? (
                        <button
                          type="button"
                          className="subtle-delete"
                          onClick={() => patchPrimaryDecal({ imageUrl: '', imageName: '' })}
                        >
                          Entfernen
                        </button>
                      ) : null}
                    </div>
                    {inspectorPrimaryDecal?.imageUrl ? (
                      <>
                        <p className="panel-hint inspector-decal-name">
                          {inspectorPrimaryDecal.imageName || 'Bild'}
                        </p>
                        {inspectorPrimaryDecal.imageUrl.startsWith('data:image/') ? (
                          <img
                            className="inspector-decal-thumb"
                            src={inspectorPrimaryDecal.imageUrl}
                            alt=""
                          />
                        ) : null}
                        <label className="opacity-slider-field">
                          Größe ({Math.round((inspectorPrimaryDecal.size ?? 1) * 100)}%)
                          <input
                            type="range"
                            min={10}
                            max={500}
                            step={5}
                            value={Math.round((inspectorPrimaryDecal.size ?? 1) * 100)}
                            onChange={(e) =>
                              patchPrimaryDecal({ size: Number(e.target.value) / 100 })
                            }
                          />
                        </label>
                        <label className="opacity-slider-field">
                          Bild-Deckkraft (
                          {Math.round((inspectorPrimaryDecal.opacity ?? 1) * 100)}%)
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(
                              (inspectorPrimaryDecal.opacity ?? 1) * 100,
                            )}
                            onChange={(e) =>
                              patchPrimaryDecal({ opacity: Number(e.target.value) / 100 })
                            }
                          />
                        </label>
                        <label className="opacity-slider-field">
                          Position X ({Math.round((inspectorPrimaryDecal.offsetX ?? 0) * 100)}%)
                          <input
                            type="range"
                            min={-50}
                            max={50}
                            value={Math.round((inspectorPrimaryDecal.offsetX ?? 0) * 100)}
                            onChange={(e) =>
                              patchPrimaryDecal({ offsetX: Number(e.target.value) / 100 })
                            }
                          />
                        </label>
                        <label className="opacity-slider-field">
                          Position Y ({Math.round((inspectorPrimaryDecal.offsetY ?? 0) * 100)}%)
                          <input
                            type="range"
                            min={-50}
                            max={50}
                            value={Math.round((inspectorPrimaryDecal.offsetY ?? 0) * 100)}
                            onChange={(e) =>
                              patchPrimaryDecal({ offsetY: Number(e.target.value) / 100 })
                            }
                          />
                        </label>
                        <label className="opacity-slider-field">
                          Rotation ({Math.round(inspectorPrimaryDecal.rotation ?? 0)}°)
                          <input
                            type="range"
                            min={0}
                            max={360}
                            step={1}
                            value={Math.round(inspectorPrimaryDecal.rotation ?? 0)}
                            onChange={(e) =>
                              patchPrimaryDecal({ rotation: Number(e.target.value) })
                            }
                          />
                        </label>
                        <p className="panel-hint inspector-subheading-tight">Seite</p>
                        <div className="decal-side-grid">
                          {DECAL_SIDE_OPTIONS.map((opt) => (
                            <label key={opt.id} className="decal-side-radio">
                              <input
                                type="radio"
                                name={`decal-side-${singleSelected.id}`}
                                checked={inspectorPrimaryDecal.side === opt.id}
                                onChange={() => patchPrimaryDecal({ side: opt.id })}
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="panel-hint">Kein Bild — importieren, um ein Decal anzuzeigen.</p>
                    )}
                  </div>
                ) : null}

                <h3>Info</h3>
                {singleSelected.geometry.kind === 'text' && (
                  <label className="metadata-field">
                    <span className="inspector-inline-label">
                      Textinhalt
                      <InspectorHint text="Wird im 3D-Label in der Szene angezeigt (max. 160 Zeichen)." />
                    </span>
                    <input
                      maxLength={160}
                      value={singleSelected.metadata.text ?? ''}
                      placeholder="Label"
                      onChange={(event) => patchSimpleMetadata('text', event.target.value)}
                    />
                  </label>
                )}
                <label className="metadata-field">
                  <span className="inspector-inline-label">
                    Name
                    <InspectorHint text="Anzeigename des Assets in Bibliothek, Inspector und Präsentations-Info." />
                  </span>
                  <input
                    value={singleSelected.metadata.name ?? ''}
                    onChange={(event) => patchSimpleMetadata('name', event.target.value)}
                  />
                </label>
                <label className="metadata-field">
                  <span className="inspector-inline-label">
                    Beschreibung
                    <InspectorHint text="Freitext; erscheint im Präsentations-Popup und in der Bibliothek." />
                  </span>
                  <textarea
                    rows={2}
                    value={singleSelected.metadata.description ?? ''}
                    onChange={(event) => patchSimpleMetadata('description', event.target.value)}
                  />
                </label>
                <label className="metadata-field">
                  <span className="inspector-inline-label">
                    Zonen-/Typ-Hinweis
                    <InspectorHint text="Optionales Schlagwort (z. B. Produktion, Lager) für Filter und Anzeige." />
                  </span>
                  <input
                    value={singleSelected.metadata.zoneType ?? ''}
                    onChange={(event) => patchSimpleMetadata('zoneType', event.target.value)}
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

                <h3>
                  <span className="inspector-inline-label">
                    Custom Metadata
                    <InspectorHint text="Eigene Felder (Name + Wert). Namen sind editierbar; Einträge werden im Layout gespeichert." />
                  </span>
                </h3>
                {getCustomRows(singleSelected.metadata).map((row) => (
                  <div key={row.id} className="custom-field-row custom-field-row--meta">
                    <div className="custom-field-name-col">
                      {metadataNameEditId === row.id ? (
                        <input
                          className="custom-field-name-input"
                          value={row.name}
                          autoFocus
                          onChange={(e) => renameCustomRow(row.id, e.target.value)}
                          onBlur={() => setMetadataNameEdit(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape') {
                              setMetadataNameEdit(null)
                            }
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="custom-field-name-btn"
                          title="Namen bearbeiten"
                          onClick={() =>
                            setMetadataNameEdit({
                              assetId: singleSelected.id,
                              rowId: row.id,
                            })
                          }
                        >
                          {row.name}
                        </button>
                      )}
                    </div>
                    <label className="metadata-field custom-field-value">
                      <input
                        value={row.value}
                        onChange={(event) => updateCustomRowValue(row.id, event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="subtle-delete"
                      onClick={() => removeCustomRow(row.id)}
                      aria-label={`${row.name} entfernen`}
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
                  + Feld hinzufügen
                </button>
              </div>
            ) : selectedAssets.length > 1 ? (
              <div className="inspector-content">
                <p className="selected-title">{selectedAssets.length} Assets ausgewählt</p>
                <p className="panel-hint">
                  Mehrfachauswahl: Transform nur wenn mindestens zwei nicht gesperrte Assets
                  ausgewählt sind. Gesperrte Assets werden nicht mitbewegt.
                </p>
                <h3>Stapel</h3>
                <div className="batch-lock-actions">
                  <button type="button" onClick={() => batchToggleLock(true)}>
                    Alle sperren
                  </button>
                  <button type="button" onClick={() => batchToggleLock(false)}>
                    Alle entsperren
                  </button>
                  <button type="button" onClick={batchAddFavorites}>
                    Zu Favoriten
                  </button>
                  <button type="button" className="danger" onClick={batchDeleteSelection}>
                    Löschen…
                  </button>
                </div>
                <h3>Material</h3>
                <ColorPickerPopover
                  label="Farbe (alle)"
                  value={selectedAssets[0]?.color ?? FALLBACK_ASSET_COLOR}
                  openSignal={colorPickerKick}
                  onCommit={(nextColor) => {
                    const c = sanitizeColor(nextColor)
                    updateAssets(selectedAssets.map((a) => ({ id: a.id, patch: { color: c } })))
                  }}
                />
                <h3>Ausrichten</h3>
                <p className="panel-hint">
                  Zusätzlich: Menü „⋮ Werkzeuge“ in der Toolbar für Ausrichten und Verteilen.
                </p>
                <div className="batch-lock-actions batch-align-actions">
                  <button
                    type="button"
                    disabled={selectedAssets.length < 2}
                    onClick={() => runAlign('left')}
                  >
                    Links
                  </button>
                  <button
                    type="button"
                    disabled={selectedAssets.length < 2}
                    onClick={() => runAlign('right')}
                  >
                    Rechts
                  </button>
                  <button
                    type="button"
                    disabled={selectedAssets.length < 3}
                    onClick={runDistributeH}
                  >
                    Verteilen X
                  </button>
                  <button
                    type="button"
                    disabled={selectedAssets.length < 3}
                    onClick={runDistributeZ}
                  >
                    Verteilen Z
                  </button>
                </div>
              </div>
            ) : floorInspectorOpen ? (
              <div className="inspector-content inspector-floor">
                <p className="selected-title">Boden</p>
                <p className="panel-hint">Raster im Präsentationsmodus aus; Bodenfarbe bleibt.</p>
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
                  Bodengröße ({floor.size.toFixed(0)} m)
                  <input
                    type="range"
                    min={40}
                    max={200}
                    step={5}
                    value={floor.size}
                    onChange={(e) => setFloor({ size: Number(e.target.value) })}
                  />
                </label>
                <h3>Einrasten</h3>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={floor.placementSnapEnabled}
                    onChange={(e) => setFloor({ placementSnapEnabled: e.target.checked })}
                  />
                  <span>Beim Platzieren und Verschieben am Raster einrasten (STRG: frei)</span>
                </label>
                <label className="metadata-field">
                  Raster-Schritt
                  <select
                    value={String(floor.placementSnapStep)}
                    onChange={(e) =>
                      setFloor({
                        placementSnapStep: sanitizePlacementSnapStep(Number(e.target.value)),
                      })
                    }
                    disabled={!floor.placementSnapEnabled}
                  >
                    {([0.25, 0.5, 1, 2, 5] as const).map((s) => (
                      <option key={s} value={s}>
                        {s} m
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <div className="inspector-content">
                <p className="panel-hint">
                  Klicke ein platziertes Asset an, um Informationen und Position zu bearbeiten.
                </p>
                <p className="panel-hint">Oder den Boden (kein Asset gewählt), um den Boden zu bearbeiten.</p>
              </div>
            )}
        </aside>
      </div>
      <TemplatePreviewDialog
        open={templatePreview !== null}
        template={templatePreview}
        onClose={() => setTemplatePreview(null)}
      />
      {mode === 'edit' && (
        <>
          <ShortcutsModal
            key={shortcutsOpen ? 'shortcuts-open' : 'shortcuts-closed'}
            open={shortcutsOpen}
            onClose={() => setShortcutsOpen(false)}
          />
          <button
            type="button"
            className="shortcuts-fab"
            onClick={() => setShortcutsOpen(true)}
            aria-label="Tastenkürzel öffnen"
          >
            ?
          </button>
        </>
      )}
    </div>
  )
}

export { FALLBACK_ASSET_COLOR }
