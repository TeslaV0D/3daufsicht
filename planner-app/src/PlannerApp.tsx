import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { List, type RowComponentProps } from 'react-window'
import { Html, OrbitControls, TransformControls } from '@react-three/drei'
import {
  Fragment,
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
import DistanceCullWrap from './components/DistanceCullWrap'
import InstancedBoxBatch from './components/InstancedBoxBatch'
import PerformanceHud from './components/PerformanceHud'
import AssetInfoModal from './components/AssetInfoModal'
import AssetRenderer, { GhostAssetRenderer } from './components/AssetRenderer'
import ColorPickerPopover from './components/ColorPickerPopover'
import ExportLayoutModal from './components/ExportLayoutModal'
import FactoryFloor from './components/FactoryFloor'
import InfoIcon from './components/InfoIcon'
import Lighting from './components/Lighting'
import LightingToolbarPanel from './components/LightingToolbarPanel'
import PostFxBloom from './components/PostFxBloom'
import SceneAtmosphere from './components/SceneAtmosphere'
import LoadLayoutModal from './components/LoadLayoutModal'
import ScenePlacementRaycast from './components/ScenePlacementRaycast'
import CustomMetadataRowEditModal from './components/CustomMetadataRowEditModal'
import SaveAssetFromSceneModal from './components/SaveAssetFromSceneModal'
import ShortcutsModal from './components/ShortcutsModal'
import TemplatePreviewDialog from './components/TemplatePreviewDialog'

import {
  loadPerspectiveCustomPresets,
  newPerspectivePresetId,
  savePerspectiveCustomPresets,
} from './perspectiveCustomPresets'
import { dismissTopColorPickerEscape } from './colorPickerEscapeStack'
import { createAssetFromTemplate, geometryKindSupports2D } from './AssetFactory'
import { useAssetsStore, type LayoutExportKind } from './store/useAssetsStore'
import type {
  Asset,
  AssetDecal,
  AssetDecalGifSettings,
  AssetDecalSide,
  AssetMetadata,
  AssetTemplate,
  MaterialMode,
  ModelFormat,
} from './types/asset'
import {
  DEFAULT_TEXT_LABEL_STYLE,
  getCustomRows,
  mergeLabelStyle,
  newCustomFieldId,
  resolveAssetOpacity,
  sanitizeColor,
  type TextLabelStyle,
} from './types/asset'
import type { CameraViewPreset } from './types/plannerUi'
import {
  perspectivePresetDefaults,
  perspectiveToPosition,
  sanitizePerspectiveCamera,
} from './types/plannerUi'
import {
  alignAssetsXZ,
  distributeCentersX,
  distributeCentersZ,
  snapAssetsToGrid,
} from './scene/assetAlignment'
import { computeInstancedBoxBatches, instancedAssetIdSet } from './scene/instancedBoxGrouping'
import {
  fetchGifBufferFromDataUrl,
  MAX_GIF_DECAL_FRAMES,
  quickGifMeta,
} from './scene/gifDecalParse'
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
import { FIELD_DESC } from './ui/fieldDescriptions'

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
/** GIF-Decals können viele Frames enthalten — etwas höheres Limit als für Einzelbilder. */
const MAX_GIF_DECAL_BYTES = 12 * 1024 * 1024

const DECAL_SIDE_OPTIONS: { id: AssetDecalSide; label: string }[] = [
  { id: 'top', label: 'Oben' },
  { id: 'bottom', label: 'Unten' },
  { id: 'front', label: 'Vorne' },
  { id: 'back', label: 'Hinten' },
  { id: 'left', label: 'Links' },
  { id: 'right', label: 'Rechts' },
  { id: 'all', label: 'Alle Seiten' },
]

type LibraryTemplateVirtualRowData = {
  sectionAccent: string
  templates: AssetTemplate[]
  tool: PlannerTool
  activeTemplateType: string | null
  setLibraryDropTargetKey: (key: string | null) => void
  setFloorInspectorOpen: (open: boolean) => void
  setSelectedTemplateType: (type: string) => void
  changeTool: (t: PlannerTool) => void
  openLibraryTemplateMenu: (e: ReactMouseEvent<HTMLElement>, templateType: string) => void
}

function LibraryTemplateVirtualRow({
  index,
  style,
  sectionAccent,
  templates,
  tool,
  activeTemplateType,
  setLibraryDropTargetKey,
  setFloorInspectorOpen,
  setSelectedTemplateType,
  changeTool,
  openLibraryTemplateMenu,
}: RowComponentProps<LibraryTemplateVirtualRowData>) {
  const template = templates[index]!
  return (
    <div style={style} className="library-virtual-template-row">
      <div
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
    </div>
  )
}

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
  hint?: string
}

function NumericInput({
  label,
  value,
  fractionDigits = 2,
  onCommit,
  disabled,
  hint,
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
      <span className="inspector-inline-label">
        {label}
        {hint ? <InfoIcon title={hint} /> : null}
      </span>
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

function InspectorCoreMetadataFields({
  asset,
  patchSimpleMetadata,
  zoneTypeSuggestions,
}: {
  asset: Asset
  patchSimpleMetadata: (kind: 'name' | 'description' | 'zoneType', value: string) => void
  zoneTypeSuggestions: string[]
}) {
  const [coreMetaEdit, setCoreMetaEdit] = useState<null | 'name' | 'description' | 'zoneType'>(
    null,
  )
  const [coreMetaDraft, setCoreMetaDraft] = useState('')

  return (
    <>
      <datalist id="inspector-zone-suggestions">
        {zoneTypeSuggestions.map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>

      <div className="inspector-core-meta-block">
        <div className="inspector-core-meta-label-row inspector-inline-label">
          <span>Name</span>
          <InfoIcon title={FIELD_DESC.metaName} />
        </div>
        {coreMetaEdit === 'name' ? (
          <div className="inspector-core-meta-edit">
            <input
              value={coreMetaDraft}
              onChange={(e) => setCoreMetaDraft(e.target.value)}
              autoFocus
            />
            <div className="inspector-core-meta-actions">
              <button
                type="button"
                onClick={() => {
                  patchSimpleMetadata('name', coreMetaDraft)
                  setCoreMetaEdit(null)
                }}
              >
                Speichern
              </button>
              <button type="button" onClick={() => setCoreMetaEdit(null)}>
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  patchSimpleMetadata('name', '')
                  setCoreMetaEdit(null)
                }}
              >
                Leeren
              </button>
            </div>
          </div>
        ) : (
          <div className="inspector-core-meta-view-row">
            <p
              className="inspector-core-meta-display inspector-core-meta-truncate"
              title={asset.metadata.name?.trim() ? asset.metadata.name : ''}
            >
              {asset.metadata.name?.trim() ? asset.metadata.name : '—'}
            </p>
            <button
              type="button"
              className="inspector-pencil-btn"
              aria-label="Name bearbeiten"
              onClick={() => {
                setCoreMetaEdit('name')
                setCoreMetaDraft(asset.metadata.name?.trim() ?? '')
              }}
            >
              ✎
            </button>
            <button
              type="button"
              className="inspector-clear-btn"
              aria-label="Name leeren"
              onClick={() => patchSimpleMetadata('name', '')}
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="inspector-core-meta-block">
        <div className="inspector-core-meta-label-row inspector-inline-label">
          <span>Beschreibung</span>
          <InfoIcon title={FIELD_DESC.metaDescription} />
        </div>
        {coreMetaEdit === 'description' ? (
          <div className="inspector-core-meta-edit">
            <textarea
              rows={4}
              value={coreMetaDraft}
              onChange={(e) => setCoreMetaDraft(e.target.value)}
              autoFocus
            />
            <div className="inspector-core-meta-actions">
              <button
                type="button"
                onClick={() => {
                  patchSimpleMetadata('description', coreMetaDraft)
                  setCoreMetaEdit(null)
                }}
              >
                Speichern
              </button>
              <button type="button" onClick={() => setCoreMetaEdit(null)}>
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  patchSimpleMetadata('description', '')
                  setCoreMetaEdit(null)
                }}
              >
                Leeren
              </button>
            </div>
          </div>
        ) : (
          <div className="inspector-core-meta-view-row">
            <p
              className="inspector-core-meta-display inspector-core-meta-description-preview"
              title={asset.metadata.description ?? ''}
            >
              {asset.metadata.description?.trim() ? asset.metadata.description : '—'}
            </p>
            <button
              type="button"
              className="inspector-pencil-btn"
              aria-label="Beschreibung bearbeiten"
              onClick={() => {
                setCoreMetaEdit('description')
                setCoreMetaDraft(asset.metadata.description ?? '')
              }}
            >
              ✎
            </button>
            <button
              type="button"
              className="inspector-clear-btn"
              aria-label="Beschreibung leeren"
              onClick={() => patchSimpleMetadata('description', '')}
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="inspector-core-meta-block">
        <div className="inspector-core-meta-label-row inspector-inline-label">
          <span>Zonen-/Typ</span>
          <InfoIcon title={FIELD_DESC.metaZoneType} />
        </div>
        {coreMetaEdit === 'zoneType' ? (
          <div className="inspector-core-meta-edit">
            <input
              list="inspector-zone-suggestions"
              value={coreMetaDraft}
              onChange={(e) => setCoreMetaDraft(e.target.value)}
              autoFocus
            />
            <div className="inspector-core-meta-actions">
              <button
                type="button"
                onClick={() => {
                  patchSimpleMetadata('zoneType', coreMetaDraft)
                  setCoreMetaEdit(null)
                }}
              >
                Speichern
              </button>
              <button type="button" onClick={() => setCoreMetaEdit(null)}>
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  patchSimpleMetadata('zoneType', '')
                  setCoreMetaEdit(null)
                }}
              >
                Leeren
              </button>
            </div>
          </div>
        ) : (
          <div className="inspector-core-meta-view-row">
            <p
              className="inspector-core-meta-display inspector-core-meta-truncate"
              title={asset.metadata.zoneType ?? ''}
            >
              {asset.metadata.zoneType?.trim() || '—'}
            </p>
            <button
              type="button"
              className="inspector-pencil-btn"
              aria-label="Zonen-/Typ bearbeiten"
              onClick={() => {
                setCoreMetaEdit('zoneType')
                setCoreMetaDraft(asset.metadata.zoneType ?? '')
              }}
            >
              ✎
            </button>
            <button
              type="button"
              className="inspector-clear-btn"
              aria-label="Zonen-/Typ leeren"
              onClick={() => patchSimpleMetadata('zoneType', '')}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </>
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
  /** Verhindert Boden-Klicks direkt nach Gizmo-Interaktion (Fokus / Auswahl). */
  onTransformPointerChange?: (pointerDown: boolean) => void
  children?: React.ReactNode
}

function SingleTransformGizmo({
  asset,
  mode,
  isCtrlPressed,
  translationSnap,
  orbitRef,
  onCommit,
  onTransformPointerChange,
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
    onTransformPointerChange?.(false)
  }, [asset.id, mode, onCommit, onTransformPointerChange, orbitRef, translationSnap])

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
          onTransformPointerChange?.(true)
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
  onTransformPointerChange?: (pointerDown: boolean) => void
}

function MultiTransformGizmo({
  selectedAssets,
  mode,
  isCtrlPressed,
  translationSnap,
  orbitRef,
  onCommit,
  onTransformPointerChange,
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
    onTransformPointerChange?.(false)
  }, [onCommit, onTransformPointerChange, orbitRef])

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
          onTransformPointerChange?.(true)
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
  const [multiPlaceMode, setMultiPlaceMode] = useState(false)
  const [multiPlaceGhostPositions, setMultiPlaceGhostPositions] = useState<Vector3Tuple[]>([])
  const transformSuppressFloorUntilRef = useRef(0)
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [infoAssetId, setInfoAssetId] = useState<string | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false)
  const [floorInspectorOpen, setFloorInspectorOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [saveAssetModalOpen, setSaveAssetModalOpen] = useState(false)
  const [customRowEditId, setCustomRowEditId] = useState<string | null>(null)
  const [exportModalKey, setExportModalKey] = useState(0)
  const [lightingPanelOpen, setLightingPanelOpen] = useState(false)
  const lightingBarRef = useRef<HTMLDivElement>(null)
  const lightingButtonRef = useRef<HTMLButtonElement>(null)
  const lightingPopoverRef = useRef<HTMLDivElement>(null)
  const toolsMenuRef = useRef<HTMLDivElement>(null)
  const toolsMenuButtonRef = useRef<HTMLButtonElement>(null)
  const toolsPopoverRef = useRef<HTMLDivElement>(null)
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false)
  const viewMenuRef = useRef<HTMLDivElement>(null)
  const viewMenuButtonRef = useRef<HTMLButtonElement>(null)
  const viewPopoverRef = useRef<HTMLDivElement>(null)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [perspectiveCustomPresets, setPerspectiveCustomPresets] = useState(loadPerspectiveCustomPresets)
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
    perspectiveCamera,
    setPerspectiveCamera,
    performanceSettings,
    setPerformanceSettings,
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
    saveSceneAssetAsTemplate,
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

  const canvasCamera = useMemo(() => {
    if (cameraView === 'perspective') {
      return {
        position: perspectiveToPosition(perspectiveCamera) as Vector3Tuple,
        fov: perspectiveCamera.fov,
      }
    }
    const p = CAMERA_PRESETS[cameraView]
    return { position: p.position, fov: 48 }
  }, [cameraView, perspectiveCamera])

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

  useEffect(() => {
    if (!viewMenuOpen) return
    const onDown = (e: PointerEvent) => {
      const el = viewMenuRef.current
      if (el && !el.contains(e.target as Node)) setViewMenuOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [viewMenuOpen])

  useLayoutEffect(() => {
    if (!viewMenuOpen) return
    const pop = viewPopoverRef.current
    if (!pop) return

    pop.style.opacity = '0'
    pop.style.pointerEvents = 'none'
    pop.style.transition = 'none'

    const update = () => {
      applyToolbarPopoverLayout(viewMenuButtonRef.current, viewPopoverRef.current, 380)
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
  }, [viewMenuOpen])

  useLayoutEffect(() => {
    if (!lightingPanelOpen) return
    const pop = lightingPopoverRef.current
    if (!pop) return

    pop.style.opacity = '0'
    pop.style.pointerEvents = 'none'
    pop.style.transition = 'none'

    const update = () => {
      applyToolbarPopoverLayout(lightingButtonRef.current, lightingPopoverRef.current, 448)
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

  const instancedBoxBatches = useMemo(
    () =>
      computeInstancedBoxBatches(assets, {
        useInstancing: performanceSettings.useInstancing,
        selectedIds,
        hoveredId,
      }),
    [assets, performanceSettings.useInstancing, selectedIds, hoveredId],
  )

  const instancedAssetIds = useMemo(
    () => instancedAssetIdSet(instancedBoxBatches),
    [instancedBoxBatches],
  )

  const zoneTypeSuggestions = useMemo(() => {
    const set = new Set<string>()
    for (const id of ['production', 'storage', 'safety', 'walkway', 'vehicle-path']) {
      set.add(id)
    }
    for (const a of assets) {
      const z = a.metadata.zoneType?.trim()
      if (z) set.add(z)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'))
  }, [assets])
  const inspectorPrimaryDecal = singleSelected?.visual?.decals?.[0]
  const inspectorPrimaryDecalIsGif = useMemo(() => {
    const d = inspectorPrimaryDecal
    if (!d?.imageUrl) return false
    return (
      d.mediaKind === 'gif' ||
      d.imageUrl.startsWith('data:image/gif') ||
      /\.gif$/i.test(d.imageName ?? '')
    )
  }, [inspectorPrimaryDecal])
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
    setViewMenuOpen(false)
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

  const onTransformPointerChange = useCallback((pointerDown: boolean) => {
    if (pointerDown) transformSuppressFloorUntilRef.current = 0
    else transformSuppressFloorUntilRef.current = Date.now() + 220
  }, [])

  const changeTool = useCallback((nextTool: PlannerTool) => {
    setTool(nextTool)
    setHoveredId(null)
    setFloorInspectorOpen(false)
    setLightingPanelOpen(false)
    setToolsMenuOpen(false)
    setViewMenuOpen(false)
    if (nextTool !== 'place') {
      setPreviewPosition(null)
      setMultiPlaceMode(false)
      setMultiPlaceGhostPositions([])
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

  const onInstancedBoxPointerDown = useCallback(
    (assetId: string, event: ThreeEvent<PointerEvent>) => {
      const asset = assets.find((a) => a.id === assetId)
      if (!asset) return
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
    [assets, mode, selectedIds, setSelectedIds, tool],
  )

  const onAssetContextMenu = useCallback(
    (event: ThreeEvent<MouseEvent>, asset: Asset) => {
      event.stopPropagation()
      event.nativeEvent.preventDefault()
      if (mode !== 'edit' || tool !== 'select') return
      if (asset.isLocked) return
      setFloorInspectorOpen(false)
      setSelectedIds([asset.id])
      setSaveAssetModalOpen(true)
    },
    [mode, setSelectedIds, tool],
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
        addAsset(asset, !multiPlaceMode)
        recordRecentTemplatePlacement(activeTemplate.type)
        if (multiPlaceMode) {
          setMultiPlaceGhostPositions((prev) => [...prev, position].slice(-16))
        }
        return
      }
      if (Date.now() < transformSuppressFloorUntilRef.current) {
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
      multiPlaceMode,
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
        if (viewMenuOpen) {
          event.preventDefault()
          setViewMenuOpen(false)
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
        if (multiPlaceMode) {
          event.preventDefault()
          setMultiPlaceMode(false)
          setMultiPlaceGhostPositions([])
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
        setSelectedIds([])
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
    multiPlaceMode,
    newGroupDialogOpen,
    onRemoveSelected,
    paste,
    redo,
    selectedAssets,
    setCameraView,
    setSelectedIds,
    shortcutsOpen,
    templateDetailsDialog,
    templateGroupDialog,
    templateMetaDialog,
    templatePreview,
    toggleFavoriteTemplateType,
    tool,
    toolsMenuOpen,
    viewMenuOpen,
    undo,
    updateAssets,
  ])

  const patchSimpleMetadata = useCallback(
    (kind: 'name' | 'description' | 'zoneType' | 'text', value: string) => {
      if (!singleSelected) return
      let normalized: string | undefined
      if (kind === 'description') {
        normalized = value.trim() === '' ? undefined : value
      } else if (kind === 'name' || kind === 'zoneType') {
        const t = value.trim()
        normalized = t === '' ? undefined : t
      } else {
        normalized = value.trim() === '' ? undefined : value.slice(0, 160)
      }
      updateAsset(singleSelected.id, {
        metadata: { [kind]: normalized } as Partial<AssetMetadata>,
      })
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

  const patchCustomMetadataRow = useCallback(
    (rowId: string, name: string, value: string, description: string) => {
      if (!singleSelected) return
      const trimmedName = name.trim().slice(0, 200)
      if (!trimmedName) return
      const desc = description.trim()
      const rows = getCustomRows(singleSelected.metadata).map((r) =>
        r.id === rowId
          ? {
              ...r,
              name: trimmedName,
              value: value.slice(0, 8000),
              description: desc ? desc.slice(0, 500) : undefined,
            }
          : r,
      )
      updateAsset(singleSelected.id, { metadata: { customRows: rows } })
    },
    [singleSelected, updateAsset],
  )

  const patchPrimaryDecal = useCallback(
    (
      partial: Partial<Omit<AssetDecal, 'gif'>> & {
        gif?: Partial<AssetDecalGifSettings>
      },
    ) => {
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
      const { gif: gifPartial, ...restDecalPatch } = partial
      const merged: AssetDecal = { ...base, ...restDecalPatch }
      if (gifPartial) {
        merged.gif = {
          ...(base.gif ?? { playing: true, speed: 1, loop: true }),
          ...gifPartial,
        }
      }
      if (merged.mediaKind === 'image') {
        merged.gif = undefined
      }
      if (!merged.imageUrl) {
        updateAsset(singleSelected.id, {
          visual: { ...(singleSelected.visual ?? {}), decals: [] },
        })
        return
      }
      updateAsset(singleSelected.id, {
        visual: { ...(singleSelected.visual ?? {}), decals: [merged] },
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

  function renderViewMenuDropdown() {
    return (
      <div className="toolbar-dropdown-wrap toolbar-view-menu-wrap" ref={viewMenuRef}>
        <button
          ref={viewMenuButtonRef}
          type="button"
          className={viewMenuOpen ? 'active' : ''}
          aria-expanded={viewMenuOpen}
          aria-haspopup="true"
          onClick={() => {
            setViewMenuOpen((o) => !o)
            setToolsMenuOpen(false)
            setLightingPanelOpen(false)
          }}
        >
          👁 Ansicht
        </button>
        {viewMenuOpen ? (
          <div
            ref={viewPopoverRef}
            className="toolbar-popover view-menu-popover toolbar-popover--anchored"
            role="menu"
            aria-label="Ansicht und Kamera"
          >
            <div className="toolbar-more-menu-heading">Standard-Ansichten</div>
            {(['perspective', 'top', 'front', 'side'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                role="menuitemradio"
                aria-checked={cameraView === preset}
                className={cameraView === preset ? 'view-menu-item-active' : ''}
                onClick={() => {
                  setCameraView(preset)
                }}
              >
                {preset === 'perspective'
                  ? 'Perspektive'
                  : preset === 'top'
                    ? 'Top (Draufsicht)'
                    : preset === 'front'
                      ? 'Front (Vorne)'
                      : 'Seite'}
              </button>
            ))}
            {cameraView === 'perspective' ? (
              <>
                <div className="toolbar-more-menu-heading">Perspektive</div>
                <label className="opacity-slider-field view-menu-slider">
                  <span className="inspector-inline-label">Höhe (m)</span>
                  <input
                    type="range"
                    min={-5}
                    max={35}
                    step={0.5}
                    value={perspectiveCamera.height}
                    onChange={(e) =>
                      setPerspectiveCamera({
                        height: Number(e.target.value),
                        subPreset: 'custom',
                      })
                    }
                  />
                  <span className="slider-value-hint">{perspectiveCamera.height.toFixed(1)}</span>
                </label>
                <label className="opacity-slider-field view-menu-slider">
                  <span className="inspector-inline-label">Entfernung (m)</span>
                  <input
                    type="range"
                    min={8}
                    max={90}
                    step={0.5}
                    value={perspectiveCamera.distance}
                    onChange={(e) =>
                      setPerspectiveCamera({
                        distance: Number(e.target.value),
                        subPreset: 'custom',
                      })
                    }
                  />
                  <span className="slider-value-hint">{perspectiveCamera.distance.toFixed(1)}</span>
                </label>
                <label className="opacity-slider-field view-menu-slider">
                  <span className="inspector-inline-label">FOV (°)</span>
                  <input
                    type="range"
                    min={20}
                    max={80}
                    step={1}
                    value={perspectiveCamera.fov}
                    onChange={(e) =>
                      setPerspectiveCamera({
                        fov: Number(e.target.value),
                        subPreset: 'custom',
                      })
                    }
                  />
                  <span className="slider-value-hint">{perspectiveCamera.fov.toFixed(0)}</span>
                </label>
                <label className="opacity-slider-field view-menu-slider">
                  <span className="inspector-inline-label">Elevation (°)</span>
                  <input
                    type="range"
                    min={0}
                    max={89}
                    step={1}
                    value={perspectiveCamera.elevationDeg}
                    onChange={(e) =>
                      setPerspectiveCamera({
                        elevationDeg: Number(e.target.value),
                        subPreset: 'custom',
                      })
                    }
                  />
                  <span className="slider-value-hint">
                    {perspectiveCamera.elevationDeg.toFixed(0)}
                  </span>
                </label>
                <label className="opacity-slider-field view-menu-slider">
                  <span className="inspector-inline-label">Azimut (°)</span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={1}
                    value={perspectiveCamera.azimuthDeg}
                    onChange={(e) =>
                      setPerspectiveCamera({
                        azimuthDeg: Number(e.target.value),
                        subPreset: 'custom',
                      })
                    }
                  />
                  <span className="slider-value-hint">{perspectiveCamera.azimuthDeg.toFixed(0)}</span>
                </label>
                <div className="toolbar-more-menu-heading">Perspektive-Presets</div>
                <div className="view-menu-preset-grid">
                  {(
                    [
                      ['standard', 'Standard'],
                      ['elevated', 'Erhöht'],
                      ['birdsEye', 'Vogel'],
                      ['isometric', 'Isometrisch'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className="toolbar-btn secondary"
                      onClick={() => {
                        setCameraView('perspective')
                        setPerspectiveCamera(perspectivePresetDefaults(id))
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {perspectiveCustomPresets.length > 0 ? (
                  <div className="view-menu-custom-presets">
                    {perspectiveCustomPresets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="toolbar-btn secondary"
                        onClick={() => {
                          setCameraView('perspective')
                          setPerspectiveCamera(sanitizePerspectiveCamera(p.settings))
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="view-menu-actions-row">
                  <button
                    type="button"
                    className="toolbar-btn secondary"
                    onClick={() => {
                      setCameraView('perspective')
                      setPerspectiveCamera(perspectivePresetDefaults('standard'))
                    }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="toolbar-btn secondary"
                    onClick={() => {
                      const name = window.prompt('Name für Perspektive-Preset:', 'Mein Preset')
                      if (name == null || !name.trim()) return
                      const next = [
                        ...perspectiveCustomPresets,
                        {
                          id: newPerspectivePresetId(),
                          name: name.trim().slice(0, 80),
                          settings: sanitizePerspectiveCamera(perspectiveCamera),
                        },
                      ]
                      setPerspectiveCustomPresets(next)
                      savePerspectiveCustomPresets(next)
                    }}
                  >
                    Als Preset speichern…
                  </button>
                </div>
              </>
            ) : (
              <p className="view-menu-hint subtle-hint">
                Perspektive-Einstellungen sind nur in der Perspektive-Ansicht aktiv.
              </p>
            )}
          </div>
        ) : null}
      </div>
    )
  }

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
      <SaveAssetFromSceneModal
        open={saveAssetModalOpen && singleSelected != null}
        asset={singleSelected}
        onClose={() => setSaveAssetModalOpen(false)}
        onSave={(opts) => {
          if (!singleSelected) return
          saveSceneAssetAsTemplate(singleSelected, opts)
          setSaveAssetModalOpen(false)
          setSaveFeedback('In „Eigene Assets“ gespeichert.')
          window.setTimeout(() => setSaveFeedback(null), 3200)
        }}
      />
      <CustomMetadataRowEditModal
        open={customRowEditId != null && singleSelected != null}
        row={
          singleSelected && customRowEditId
            ? getCustomRows(singleSelected.metadata).find((r) => r.id === customRowEditId) ?? null
            : null
        }
        defaultDescriptionHint={FIELD_DESC.customMetaPair}
        onClose={() => setCustomRowEditId(null)}
        onSave={(rowId, name, value, description) => {
          patchCustomMetadataRow(rowId, name, value, description)
        }}
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
              <button
                type="button"
                className={tool === 'place' && multiPlaceMode ? 'active' : ''}
                disabled={tool !== 'place' || !activeTemplate}
                title="Mehrere gleiche Assets nacheinander setzen (ESC beenden)"
                onClick={() => {
                  if (tool !== 'place') return
                  setMultiPlaceMode((m) => !m)
                  setMultiPlaceGhostPositions([])
                }}
              >
                Multi
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
                  setViewMenuOpen(false)
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

            {renderViewMenuDropdown()}

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
                  setViewMenuOpen(false)
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
            {renderViewMenuDropdown()}
          </>
        )}
      </header>

      <div
        className={`workspace${mode === 'view' ? ' view-mode' : ''}${leftPanelHidden ? ' workspace--hide-library' : ''}${rightPanelHidden ? ' workspace--hide-inspector' : ''}`}
      >
        <aside className="panel left" aria-hidden={mode === 'view'}>
          <h2 className="inspector-inline-label panel-library-heading">
            Asset-Bibliothek
            <InfoIcon
              title={`Vorlage wählen und auf den Boden klicken. Eigene Modelle: Plus neben „${EIGENE_ASSETS_USER_GROUP_LABEL}“ — GLB, GLTF, STL, OBJ, FBX (max. ${formatBytes(MAX_MODEL_SIZE_BYTES)} pro Datei, mehrere Dateien möglich).`}
            />
          </h2>
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
                    <p className="library-fav-empty inspector-inline-label">
                      <span className="library-fav-empty-dash">—</span>
                      <InfoIcon title={FIELD_DESC.libraryFavoritesEmpty} />
                    </p>
                  ) : null}
                  {section.kind === 'recents' && section.templates.length === 0 ? (
                    <p className="library-fav-empty inspector-inline-label">
                      <span className="library-fav-empty-dash">—</span>
                      <InfoIcon title={FIELD_DESC.libraryRecentsEmpty} />
                    </p>
                  ) : null}
                  {!expanded ||
                  !performanceSettings.virtualLibraryScroll ||
                  section.templates.length < performanceSettings.virtualLibraryThreshold ? (
                    section.templates.map((template) => (
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
                              tool === 'place' && activeTemplateType === template.type
                                ? ' active'
                                : ''
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
                    ))
                  ) : (
                    <List<LibraryTemplateVirtualRowData>
                      className="library-template-virtual-list"
                      style={{
                        height: Math.min(
                          520,
                          section.templates.length * performanceSettings.libraryRowHeight,
                        ),
                        width: '100%',
                      }}
                      rowCount={section.templates.length}
                      rowHeight={performanceSettings.libraryRowHeight}
                      rowComponent={LibraryTemplateVirtualRow}
                      rowProps={{
                        sectionAccent,
                        templates: section.templates,
                        tool,
                        activeTemplateType,
                        setLibraryDropTargetKey,
                        setFloorInspectorOpen,
                        setSelectedTemplateType,
                        changeTool,
                        openLibraryTemplateMenu,
                      }}
                    />
                  )}
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
                  <span className="inspector-inline-label">
                    Name
                    <InfoIcon title={FIELD_DESC.templateMetaName} />
                  </span>
                  <input
                    className="library-dialog-input"
                    value={templateMetaDraft.name}
                    onChange={(e) =>
                      setTemplateMetaDraft((d) => ({ ...d, name: e.target.value }))
                    }
                  />
                </label>
                <label className="library-dialog-field">
                  <span className="inspector-inline-label">
                    Beschreibung
                    <InfoIcon title={FIELD_DESC.templateMetaDescription} />
                  </span>
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
                  <span className="inspector-inline-label">
                    Tags (kommagetrennt)
                    <InfoIcon title={FIELD_DESC.templateMetaTags} />
                  </span>
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
                      <dt className="details-dt-with-hint">
                        <span className="inspector-inline-label">
                          Name
                          <InfoIcon title={FIELD_DESC.templateDetailsName} />
                        </span>
                      </dt>
                      <dd>{templateDetailsDialog.label}</dd>
                      <dt className="details-dt-with-hint">
                        <span className="inspector-inline-label">
                          Beschreibung
                          <InfoIcon title={FIELD_DESC.templateDetailsDescription} />
                        </span>
                      </dt>
                      <dd>{templateDetailsDialog.metadata?.description?.trim() || '—'}</dd>
                      <dt className="details-dt-muted details-dt-with-hint">
                        <span className="inspector-inline-label">
                          Typ-ID
                          <InfoIcon title={FIELD_DESC.templateDetailsTypeId} />
                        </span>
                      </dt>
                      <dd className="details-dd-muted">
                        <code>{templateDetailsDialog.type}</code>
                      </dd>
                    </dl>
                  </section>
                  <section className="details-section">
                    <h4>Geometrie</h4>
                    <dl className="details-dl">
                      <dt className="details-dt-with-hint">
                        <span className="inspector-inline-label">
                          Art
                          <InfoIcon title={FIELD_DESC.templateDetailsGeometryKind} />
                        </span>
                      </dt>
                      <dd>{templateDetailsDialog.geometry.kind}</dd>
                      <dt className="details-dt-with-hint">
                        <span className="inspector-inline-label">
                          Abmessungen (ca.)
                          <InfoIcon title={FIELD_DESC.templateDetailsDimensions} />
                        </span>
                      </dt>
                      <dd>{formatTemplateDimensions(templateDetailsDialog)}</dd>
                      <dt className="details-dt-with-hint">
                        <span className="inspector-inline-label">
                          In Millimetern
                          <InfoIcon title={FIELD_DESC.templateDetailsDimensionsMm} />
                        </span>
                      </dt>
                      <dd>{formatTemplateDimensionsMm(templateDetailsDialog)}</dd>
                      <dt className="details-dt-with-hint">
                        <span className="inspector-inline-label">
                          Template-Skalierung
                          <InfoIcon title={FIELD_DESC.templateDetailsScale} />
                        </span>
                      </dt>
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
                      <dt className="details-dt-with-hint">
                        <span className="inspector-inline-label">
                          Farbe
                          <InfoIcon title={FIELD_DESC.templateDetailsMaterialColor} />
                        </span>
                      </dt>
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
                      <dt className="details-dt-with-hint">
                        <span className="inspector-inline-label">
                          Favorit
                          <InfoIcon title={FIELD_DESC.templateDetailsFavorite} />
                        </span>
                      </dt>
                      <dd>
                        {libraryOrganization.favoriteTemplateTypes.includes(
                          templateDetailsDialog.type,
                        )
                          ? '★ Ja'
                          : '☆ Nein'}
                      </dd>
                      <dt className="details-dt-with-hint">
                        <span className="inspector-inline-label">
                          Bibliotheks-Gruppe
                          <InfoIcon title={FIELD_DESC.templateDetailsUserGroup} />
                        </span>
                      </dt>
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
                      <dt className="details-dt-with-hint">
                        <span className="inspector-inline-label">
                          Tags
                          <InfoIcon title={FIELD_DESC.templateDetailsTags} />
                        </span>
                      </dt>
                      <dd>
                        {getTagsFromTemplate(templateDetailsDialog, libraryOrganization).join(', ') ||
                          '—'}
                      </dd>
                      {templateDetailsDialog.createdAt ? (
                        <>
                          <dt className="details-dt-with-hint">
                            <span className="inspector-inline-label">
                              Importiert am
                              <InfoIcon title={FIELD_DESC.templateDetailsImportedAt} />
                            </span>
                          </dt>
                          <dd>
                            {new Date(templateDetailsDialog.createdAt).toLocaleString('de-DE')}
                          </dd>
                        </>
                      ) : (
                        <>
                          <dt className="details-dt-with-hint">
                            <span className="inspector-inline-label">
                              Import
                              <InfoIcon title={FIELD_DESC.templateDetailsImportBuiltin} />
                            </span>
                          </dt>
                          <dd>Nein (eingebaute Vorlage)</dd>
                        </>
                      )}
                      {templateDetailsDialog.geometry.kind === 'custom' ? (
                        <>
                          <dt className="details-dt-with-hint">
                            <span className="inspector-inline-label">
                              Modell-Format
                              <InfoIcon title={FIELD_DESC.templateDetailsModelFormat} />
                            </span>
                          </dt>
                          <dd>{templateDetailsDialog.geometry.params.modelFormat ?? '—'}</dd>
                          <dt className="details-dt-with-hint">
                            <span className="inspector-inline-label">
                              Modell-URL
                              <InfoIcon title={FIELD_DESC.templateDetailsModelUrl} />
                            </span>
                          </dt>
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
            dpr={[1, performanceSettings.maxDpr]}
            camera={{ position: canvasCamera.position, fov: canvasCamera.fov }}
          >
            <SceneAtmosphere settings={lighting} />
            <PostFxBloom enabled={lighting.bloomEnabled} intensity={lighting.bloomIntensity} />
            <Lighting settings={lighting} presentation={mode === 'view'} />
            <PerformanceHud visible={performanceSettings.showHud && mode === 'edit'} />
            <AnimatedCameraRig
              preset={cameraView}
              orbitRef={orbitRef}
              perspectiveCamera={cameraView === 'perspective' ? perspectiveCamera : null}
            />
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

            {instancedBoxBatches.map((batch) => (
              <InstancedBoxBatch
                key={batch.key}
                assets={batch.assets}
                width={batch.width}
                height={batch.height}
                depth={batch.depth}
                distanceCullEnabled={performanceSettings.distanceCullEnabled}
                distanceCullMeters={performanceSettings.distanceCullMeters}
                onInstancePointerDown={onInstancedBoxPointerDown}
              />
            ))}

            {assets.map((asset) => {
              const isOnlySingleEditSelection =
                mode === 'edit' && singleSelected?.id === asset.id && !singleSelected.isLocked
              if (isOnlySingleEditSelection) {
                return null
              }
              if (instancedAssetIds.has(asset.id)) {
                return null
              }
              const renderer = (
                <AssetRenderer
                  asset={asset}
                  isSelected={selectedIds.includes(asset.id)}
                  isHovered={hoveredId === asset.id}
                  isEditMode={mode === 'edit'}
                  selectionAccent={libraryAccentForSectionTitle(asset.category)}
                  onClick={onAssetClick}
                  onContextMenu={onAssetContextMenu}
                  onPointerOver={onAssetPointerOver}
                  onPointerOut={onAssetPointerOut}
                />
              )
              return (
                <Fragment key={asset.id}>
                  {performanceSettings.distanceCullEnabled ? (
                    <DistanceCullWrap
                      enabled
                      maxMeters={performanceSettings.distanceCullMeters}
                      center={asset.position}
                    >
                      {renderer}
                    </DistanceCullWrap>
                  ) : (
                    renderer
                  )}
                </Fragment>
              )
            })}

            {mode === 'edit' && singleSelected && !singleSelected.isLocked && (
              <SingleTransformGizmo
                asset={singleSelected}
                mode={transformMode}
                isCtrlPressed={isCtrlPressed}
                orbitRef={orbitRef}
                translationSnap={gizmoTranslateSnap}
                onTransformPointerChange={onTransformPointerChange}
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
                  onContextMenu={onAssetContextMenu}
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
                onTransformPointerChange={onTransformPointerChange}
                onCommit={(updates) => updateAssets(updates)}
              />
            )}

            {multiPlaceMode &&
              activeTemplate &&
              multiPlaceGhostPositions.map((pos, i) => (
                <GhostAssetRenderer
                  key={`multi-ghost-${i}-${pos[0]}-${pos[1]}-${pos[2]}`}
                  asset={createAssetFromTemplate(activeTemplate, { position: pos })}
                  opacityMultiplier={0.42}
                />
              ))}

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
          <div className="inspector-global-blocks">
            <p className="subtle-hint inspector-toolbar-hint">
              Kamera & Perspektive: Toolbar → <strong>Ansicht</strong>.
            </p>
            <section className="inspector-performance-panel">
              <h3 className="inspector-panel-section-title">Performance</h3>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={performanceSettings.showHud}
                  onChange={(e) => setPerformanceSettings({ showHud: e.target.checked })}
                />
                <span>FPS / Draw-Calls / Speicher (Chrome)</span>
              </label>
              <label className="opacity-slider-field">
                <span className="inspector-inline-label">Max. Pixel-Ratio</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.5}
                  value={performanceSettings.maxDpr}
                  onChange={(e) =>
                    setPerformanceSettings({ maxDpr: Number(e.target.value) })
                  }
                />
                <span className="slider-value-hint">{performanceSettings.maxDpr.toFixed(1)}</span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={performanceSettings.lodHintEnabled}
                  onChange={(e) =>
                    setPerformanceSettings({ lodHintEnabled: e.target.checked })
                  }
                />
                <span>LOD-Hinweis (für große Szenen)</span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={performanceSettings.useInstancing}
                  onChange={(e) =>
                    setPerformanceSettings({ useInstancing: e.target.checked })
                  }
                />
                <span>Instancing (gleiche Boxen, 1 Draw-Call pro Gruppe)</span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={performanceSettings.distanceCullEnabled}
                  onChange={(e) =>
                    setPerformanceSettings({ distanceCullEnabled: e.target.checked })
                  }
                />
                <span>Distanz-Culling (Rendering)</span>
              </label>
              <label className="opacity-slider-field">
                <span className="inspector-inline-label">Max. Distanz (m)</span>
                <input
                  type="range"
                  min={80}
                  max={800}
                  step={10}
                  value={performanceSettings.distanceCullMeters}
                  onChange={(e) =>
                    setPerformanceSettings({ distanceCullMeters: Number(e.target.value) })
                  }
                  disabled={!performanceSettings.distanceCullEnabled}
                />
                <span className="slider-value-hint">
                  {performanceSettings.distanceCullMeters}
                </span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={performanceSettings.virtualLibraryScroll}
                  onChange={(e) =>
                    setPerformanceSettings({ virtualLibraryScroll: e.target.checked })
                  }
                />
                <span>Virtuelle Bibliotheks-Liste (react-window)</span>
              </label>
              <label className="metadata-field">
                <span className="inspector-inline-label">Ab Schwellwert (Templates)</span>
                <input
                  type="number"
                  min={4}
                  max={200}
                  step={1}
                  value={performanceSettings.virtualLibraryThreshold}
                  onChange={(e) =>
                    setPerformanceSettings({
                      virtualLibraryThreshold: Number(e.target.value),
                    })
                  }
                  disabled={!performanceSettings.virtualLibraryScroll}
                />
              </label>
              <label className="opacity-slider-field">
                <span className="inspector-inline-label">Zeilenhöhe (px)</span>
                <input
                  type="range"
                  min={40}
                  max={76}
                  step={2}
                  value={performanceSettings.libraryRowHeight}
                  onChange={(e) =>
                    setPerformanceSettings({ libraryRowHeight: Number(e.target.value) })
                  }
                  disabled={!performanceSettings.virtualLibraryScroll}
                />
                <span className="slider-value-hint">{performanceSettings.libraryRowHeight}</span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={performanceSettings.shadowOptimize}
                  onChange={(e) =>
                    setPerformanceSettings({ shadowOptimize: e.target.checked })
                  }
                />
                <span>Schatten-Optimierung (vorbereitet / Metadaten)</span>
              </label>
              <p className="subtle-hint inspector-perf-footnote">
                Frustum-Culling nutzt three.js pro Objekt. Bei Instancing ist die Kugel grob — pro
                Instanz zusätzlich Distanz-Culling in der Batch.
              </p>
            </section>
          </div>
            {singleSelected ? (
              <div
                className={`inspector-content${singleSelected.isLocked ? ' inspector-asset-locked' : ''}`}
              >
                <p className="selected-title">
                  {singleSelected.metadata.name?.trim() || singleSelected.type}
                  {singleSelected.isLocked ? (
                    <span className="lock-indicator" title="Gesperrt">
                      {' '}
                      &#128274; Locked
                    </span>
                  ) : null}
                </p>
                <h4 className="inspector-subheading inspector-inline-label">
                  Instanz
                  <InfoIcon title={FIELD_DESC.inspectorInstance} />
                </h4>
                <p className="inspector-compact-facts" title={`ID: ${singleSelected.id}`}>
                  <span className="inspector-compact-facts-mono">{singleSelected.geometry.kind}</span>
                  <span aria-hidden> · </span>
                  <span>{singleSelected.category}</span>
                  <span aria-hidden> · </span>
                  <span>
                    {templateByType.has(singleSelected.type)
                      ? formatTemplateDimensions(templateByType.get(singleSelected.type)!)
                      : '—'}
                  </span>
                  <span aria-hidden> · </span>
                  <span>
                    Pos {formatNumber(singleSelected.position[0])},{' '}
                    {formatNumber(singleSelected.position[1])},{' '}
                    {formatNumber(singleSelected.position[2])}
                  </span>
                  <span aria-hidden> · </span>
                  <code className="inspector-id-chip">{singleSelected.id.slice(0, 10)}…</code>
                </p>
                {!singleSelected.isLocked ? (
                  <p className="inspector-save-asset-row">
                    <button
                      type="button"
                      className="toolbar-btn secondary"
                      onClick={() => setSaveAssetModalOpen(true)}
                    >
                      Als Asset speichern…
                    </button>
                  </p>
                ) : null}

                <h3>
                  <span className="inspector-inline-label">
                    Sperre
                    <InfoIcon title={FIELD_DESC.assetLock} />
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
                  <span className="inspector-inline-label">
                    Asset sperren
                    <InfoIcon title="Kein Transform-Gizmo in der Szene; gesperrte Assets werden bei Stapel-Aktionen ausgelassen." />
                  </span>
                </label>

                <h3
                  className="inspector-inline-label"
                  title={singleSelected.isLocked ? 'Asset ist gesperrt' : undefined}
                >
                  Transform
                  <InfoIcon title={FIELD_DESC.inspectorTransform} />
                </h3>
                <h4 className="inspector-subheading inspector-inline-label">
                  Position
                  <InfoIcon title={FIELD_DESC.transformPositionAxis} />
                </h4>
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

                <h4 className="inspector-subheading inspector-inline-label">
                  Rotation (Grad)
                  <InfoIcon title={FIELD_DESC.transformRotationAxis} />
                </h4>
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

                <h4 className="inspector-subheading inspector-inline-label">
                  Skalierung
                  <InfoIcon title={FIELD_DESC.transformScaleHint} />
                </h4>
                {(() => {
                  const scaleDigits =
                    singleSelected.geometry.kind === 'custom' ||
                    customTemplateTypeSet.has(singleSelected.type)
                      ? 6
                      : 4
                  return (
                    <>
                <label className="opacity-slider-field">
                  <span className="inspector-inline-label">
                    Alle Achsen gleich
                    <InfoIcon title={FIELD_DESC.transformScaleUniformSlider} />
                  </span>
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
                      scaleDigits,
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
                      scaleDigits,
                    )}
                  </span>
                </label>
                <div className="vector-grid" key={`${singleSelected.id}-scale`}>
                  <NumericInput
                    label="Breite (X)"
                    value={singleSelected.scale[0]}
                    fractionDigits={scaleDigits}
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
                    fractionDigits={scaleDigits}
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
                    fractionDigits={scaleDigits}
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
                    </>
                  )
                })()}

                <h3 className="inspector-inline-label">
                  Material
                  <InfoIcon title={FIELD_DESC.materialOverview} />
                </h3>
                {singleSelected.geometry.kind === 'custom' &&
                (singleSelected.geometry.params.modelFormat === 'glb' ||
                  singleSelected.geometry.params.modelFormat === 'gltf') ? (
                  <>
                    <p className="inspector-inline-label material-mode-label">
                      <span>
                        Modus: <strong>{singleSelected.materialMode ?? 'original'}</strong>
                      </span>
                      <InfoIcon title={FIELD_DESC.materialModeGlb} />
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
                ) : null}

                <ColorPickerPopover
                  value={singleSelected.color}
                  openSignal={colorPickerKick}
                  hint={FIELD_DESC.materialColor}
                  onCommit={(nextColor) =>
                    updateAsset(singleSelected.id, { color: sanitizeColor(nextColor) })
                  }
                />

                <label className="opacity-slider-field">
                  <span className="inspector-inline-label">
                    Deckkraft ({Math.round(resolveAssetOpacity(singleSelected) * 100)}%)
                    <InfoIcon title={FIELD_DESC.assetOpacity} />
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
                        <InfoIcon title={FIELD_DESC.decalImage} />
                      </span>
                    </h4>
                    <input
                      ref={decalImportInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
                      className="inspector-file-input-hidden"
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (!file || !singleSelected) return
                        const isGif =
                          /image\/gif/i.test(file.type) || /\.gif$/i.test(file.name)
                        const okStatic =
                          /image\/(png|jpeg|webp)/i.test(file.type) ||
                          /\.(png|jpe?g|webp)$/i.test(file.name)
                        if (!isGif && !okStatic) {
                          setSaveFeedback('Nur PNG, JPEG, WebP oder GIF.')
                          window.setTimeout(() => setSaveFeedback(null), 2800)
                          return
                        }
                        const maxBytes = isGif ? MAX_GIF_DECAL_BYTES : MAX_DECAL_IMAGE_BYTES
                        if (file.size > maxBytes) {
                          setSaveFeedback(
                            isGif
                              ? `GIF zu groß (max. ${Math.round(MAX_GIF_DECAL_BYTES / (1024 * 1024))} MB).`
                              : 'Bild zu groß (max. 5 MB).',
                          )
                          window.setTimeout(() => setSaveFeedback(null), 2800)
                          return
                        }
                        const reader = new FileReader()
                        reader.onload = () => {
                          void (async () => {
                            const url = String(reader.result ?? '')
                            if (!url) return
                            if (isGif) {
                              const buf = await fetchGifBufferFromDataUrl(url)
                              const meta = buf ? quickGifMeta(buf) : null
                              if (!meta) {
                                setSaveFeedback('GIF konnte nicht gelesen werden.')
                                window.setTimeout(() => setSaveFeedback(null), 3200)
                                return
                              }
                              patchPrimaryDecal({
                                imageUrl: url,
                                imageName: file.name,
                                mediaKind: 'gif',
                                gif: {
                                  playing: true,
                                  speed: 1,
                                  loop: true,
                                  frameCount: meta.frameCount,
                                  fpsApprox: meta.fpsApprox,
                                  truncated: meta.truncated,
                                },
                              })
                              if (meta.truncated) {
                                setSaveFeedback(
                                  `Hinweis: nur die ersten ${MAX_GIF_DECAL_FRAMES} Frames werden abgespielt (Performance).`,
                                )
                                window.setTimeout(() => setSaveFeedback(null), 4200)
                              }
                              return
                            }
                            patchPrimaryDecal({
                              imageUrl: url,
                              imageName: file.name,
                              mediaKind: 'image',
                            })
                          })()
                        }
                        reader.readAsDataURL(file)
                      }}
                    />
                    <div className="inspector-decal-actions">
                      <button
                        type="button"
                        onClick={() => decalImportInputRef.current?.click()}
                      >
                        Bild / GIF importieren
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
                        <p className="inspector-decal-name" title={inspectorPrimaryDecal.imageName || ''}>
                          {inspectorPrimaryDecal.imageName || 'Bild'}
                        </p>
                        <p className="inspector-decal-kind subtle-hint">
                          {inspectorPrimaryDecalIsGif
                            ? 'Typ: GIF (animiert)'
                            : 'Typ: Bild (statisch)'}
                        </p>
                        {inspectorPrimaryDecal.imageUrl.startsWith('data:image/') ? (
                          <img
                            className="inspector-decal-thumb"
                            src={inspectorPrimaryDecal.imageUrl}
                            alt=""
                          />
                        ) : null}
                        <label className="opacity-slider-field">
                          <span className="inspector-inline-label">
                            Größe ({Math.round((inspectorPrimaryDecal.size ?? 1) * 100)}%)
                            <InfoIcon title={FIELD_DESC.decalSize} />
                          </span>
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
                          <span className="inspector-inline-label">
                            Bild-Deckkraft (
                            {Math.round((inspectorPrimaryDecal.opacity ?? 1) * 100)}%)
                            <InfoIcon title={FIELD_DESC.decalOpacity} />
                          </span>
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
                          <span className="inspector-inline-label">
                            Position X ({Math.round((inspectorPrimaryDecal.offsetX ?? 0) * 100)}%)
                            <InfoIcon title={FIELD_DESC.decalOffsetX} />
                          </span>
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
                          <span className="inspector-inline-label">
                            Position Y ({Math.round((inspectorPrimaryDecal.offsetY ?? 0) * 100)}%)
                            <InfoIcon title={FIELD_DESC.decalOffsetY} />
                          </span>
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
                          <span className="inspector-inline-label">
                            Rotation ({Math.round(inspectorPrimaryDecal.rotation ?? 0)}°)
                            <InfoIcon title={FIELD_DESC.decalRotation} />
                          </span>
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
                        <p className="inspector-subheading-tight inspector-inline-label">
                          Seite
                          <InfoIcon title={FIELD_DESC.decalSide} />
                        </p>
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
                        {inspectorPrimaryDecalIsGif ? (
                          <div className="inspector-gif-decal-panel">
                            <h4 className="inspector-subheading-tight">GIF-Einstellungen</h4>
                            <p className="subtle-hint inspector-gif-perf-hint">
                              GIFs können die Performance beeinflussen. Empfohlen: höchstens{' '}
                              {MAX_GIF_DECAL_FRAMES} Frames.
                            </p>
                            <label className="inspector-checkbox-row">
                              <input
                                type="checkbox"
                                checked={inspectorPrimaryDecal.gif?.playing !== false}
                                onChange={(e) =>
                                  patchPrimaryDecal({
                                    gif: { playing: e.target.checked },
                                  })
                                }
                              />
                              Animation abspielen
                            </label>
                            <label className="opacity-slider-field">
                              <span className="inspector-inline-label">
                                Geschwindigkeit ({(inspectorPrimaryDecal.gif?.speed ?? 1).toFixed(2)}×)
                              </span>
                              <input
                                type="range"
                                min={0.5}
                                max={2}
                                step={0.05}
                                value={inspectorPrimaryDecal.gif?.speed ?? 1}
                                onChange={(e) =>
                                  patchPrimaryDecal({
                                    gif: { speed: Number(e.target.value) },
                                  })
                                }
                              />
                            </label>
                            <label className="inspector-checkbox-row">
                              <input
                                type="checkbox"
                                checked={inspectorPrimaryDecal.gif?.loop !== false}
                                onChange={(e) =>
                                  patchPrimaryDecal({
                                    gif: { loop: e.target.checked },
                                  })
                                }
                              />
                              Loop (endlos wiederholen)
                            </label>
                            <p className="inspector-gif-frames-info">
                              Frames: {inspectorPrimaryDecal.gif?.frameCount ?? '—'} @{' '}
                              {inspectorPrimaryDecal.gif?.fpsApprox != null
                                ? `${inspectorPrimaryDecal.gif.fpsApprox} fps`
                                : '—'}
                              {inspectorPrimaryDecal.gif?.truncated ? ' (gekürzt)' : ''}
                            </p>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="inspector-decal-empty inspector-inline-label">
                        <span className="inspector-decal-empty-label">—</span>
                        <InfoIcon title={FIELD_DESC.decalNoImage} />
                      </p>
                    )}
                  </div>
                ) : null}

                <h3 className="inspector-inline-label">
                  Info
                  <InfoIcon title={FIELD_DESC.inspectorInfoSection} />
                </h3>
                {singleSelected.geometry.kind === 'text' &&
                  (() => {
                    const ls = mergeLabelStyle(singleSelected.geometry.params.labelStyle)
                    const patchLs = (partial: Partial<TextLabelStyle>) => {
                      updateAsset(singleSelected.id, {
                        geometry: {
                          ...singleSelected.geometry,
                          params: {
                            ...singleSelected.geometry.params,
                            labelStyle: mergeLabelStyle({ ...ls, ...partial }),
                          },
                        },
                      })
                    }
                    return (
                      <>
                        <label className="metadata-field">
                          <span className="inspector-inline-label">
                            Textinhalt
                            <InfoIcon title={FIELD_DESC.textContent} />
                          </span>
                          <input
                            maxLength={160}
                            value={singleSelected.metadata.text ?? ''}
                            placeholder="Label"
                            onChange={(event) => patchSimpleMetadata('text', event.target.value)}
                          />
                        </label>
                        <div className="inspector-label-style-panel">
                          <h4 className="inspector-subheading">Text-Label (Lesbarkeit)</h4>
                          <p className="subtle-hint inspector-label-bg-hint">
                            Hintergrund über Canvas-Textur; wirkt auf alle Text-Instanzen dieses Typs
                            gemäß Vorlage.
                          </p>
                          <span className="inspector-inline-label">Hintergrund</span>
                          <div className="decal-side-grid">
                            {(
                              [
                                ['none', 'Aus'],
                                ['light', 'Hell'],
                                ['dark', 'Dunkel'],
                                ['custom', 'Farbe…'],
                              ] as const
                            ).map(([id, label]) => (
                              <label key={id} className="decal-side-radio">
                                <input
                                  type="radio"
                                  name={`label-bg-${singleSelected.id}`}
                                  checked={ls.background === id}
                                  onChange={() => patchLs({ background: id })}
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                          {ls.background === 'custom' ? (
                            <label className="metadata-field">
                              <span className="inspector-inline-label">Hintergrundfarbe</span>
                              <input
                                type="text"
                                value={ls.backgroundColor ?? '#ffffff'}
                                onChange={(e) => patchLs({ backgroundColor: e.target.value })}
                              />
                            </label>
                          ) : null}
                          <label className="opacity-slider-field">
                            <span className="inspector-inline-label">
                              Hintergrund-Deckkraft (
                              {Math.round((ls.backgroundOpacity ?? 0.8) * 100)}%)
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={Math.round((ls.backgroundOpacity ?? 0.8) * 100)}
                              onChange={(e) =>
                                patchLs({ backgroundOpacity: Number(e.target.value) / 100 })
                              }
                            />
                          </label>
                          <label className="opacity-slider-field">
                            <span className="inspector-inline-label">Padding (px)</span>
                            <input
                              type="range"
                              min={2}
                              max={28}
                              step={1}
                              value={ls.paddingPx ?? DEFAULT_TEXT_LABEL_STYLE.paddingPx}
                              onChange={(e) => patchLs({ paddingPx: Number(e.target.value) })}
                            />
                            <span className="slider-value-hint">{ls.paddingPx}</span>
                          </label>
                          <label className="opacity-slider-field">
                            <span className="inspector-inline-label">Eckenradius (px)</span>
                            <input
                              type="range"
                              min={0}
                              max={24}
                              step={1}
                              value={ls.borderRadiusPx ?? DEFAULT_TEXT_LABEL_STYLE.borderRadiusPx}
                              onChange={(e) => patchLs({ borderRadiusPx: Number(e.target.value) })}
                            />
                            <span className="slider-value-hint">{ls.borderRadiusPx}</span>
                          </label>
                          <label className="metadata-field">
                            <span className="inspector-inline-label">Textfarbe</span>
                            <input
                              type="text"
                              value={ls.textColor ?? DEFAULT_TEXT_LABEL_STYLE.textColor}
                              onChange={(e) => patchLs({ textColor: e.target.value })}
                            />
                          </label>
                          <label className="opacity-slider-field">
                            <span className="inspector-inline-label">Schrift (Canvas px)</span>
                            <input
                              type="range"
                              min={16}
                              max={48}
                              step={1}
                              value={ls.fontPx ?? DEFAULT_TEXT_LABEL_STYLE.fontPx}
                              onChange={(e) => patchLs({ fontPx: Number(e.target.value) })}
                            />
                            <span className="slider-value-hint">{ls.fontPx}</span>
                          </label>
                          <label className="metadata-field">
                            <span className="inspector-inline-label">Schriftstärke</span>
                            <select
                              value={ls.fontWeight ?? 'bold'}
                              onChange={(e) =>
                                patchLs({
                                  fontWeight: e.target.value === 'normal' ? 'normal' : 'bold',
                                })
                              }
                            >
                              <option value="normal">Normal</option>
                              <option value="bold">Fett</option>
                            </select>
                          </label>
                          <label className="checkbox-field">
                            <input
                              type="checkbox"
                              checked={ls.textShadow !== false}
                              onChange={(e) => patchLs({ textShadow: e.target.checked })}
                            />
                            <span>Textschatten</span>
                          </label>
                          <label className="checkbox-field">
                            <input
                              type="checkbox"
                              checked={ls.outline === true}
                              onChange={(e) => patchLs({ outline: e.target.checked })}
                            />
                            <span>Kontur (Outline)</span>
                          </label>
                        </div>
                      </>
                    )
                  })()}
                <InspectorCoreMetadataFields
                  key={singleSelected.id}
                  asset={singleSelected}
                  patchSimpleMetadata={patchSimpleMetadata}
                  zoneTypeSuggestions={zoneTypeSuggestions}
                />

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
                      <span className="inspector-inline-label">
                        Wireframe
                        <InfoIcon title={FIELD_DESC.modelWireframe} />
                      </span>
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
                        <span className="inspector-inline-label">
                          Flat Shading (CAD-Look)
                          <InfoIcon title={FIELD_DESC.modelFlatShading} />
                        </span>
                      </label>
                    )}
                  </>
                )}

                <h3>
                  <span className="inspector-inline-label">
                    Custom Metadata
                    <InfoIcon title={FIELD_DESC.customMetaSection} />
                  </span>
                </h3>
                {getCustomRows(singleSelected.metadata).map((row) => (
                  <div key={row.id} className="custom-meta-block">
                    <div className="custom-meta-block-heading inspector-inline-label">
                      <span className="custom-meta-heading-truncate" title={row.name}>
                        {row.name}
                      </span>
                      <InfoIcon
                        title={
                          row.description?.trim()
                            ? row.description.trim()
                            : FIELD_DESC.customMetaPair
                        }
                      />
                    </div>
                    <div className="custom-meta-pair-row">
                      <div className="custom-meta-pair-name">
                        {metadataNameEditId === row.id ? (
                          <input
                            className="custom-meta-pair-input"
                            value={row.name}
                            autoFocus
                            title={row.name}
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
                            className="custom-meta-name-hit"
                            title={row.name}
                            onClick={() =>
                              setMetadataNameEdit({
                                assetId: singleSelected.id,
                                rowId: row.id,
                              })
                            }
                          >
                            <span className="custom-meta-pair-truncate">{row.name}</span>
                          </button>
                        )}
                      </div>
                      <div className="custom-meta-pair-value">
                        <input
                          className="custom-meta-pair-input"
                          value={row.value}
                          title={row.value}
                          onChange={(event) => updateCustomRowValue(row.id, event.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="inspector-pencil-btn custom-meta-edit-btn"
                        aria-label="Feld bearbeiten"
                        onClick={() => setCustomRowEditId(row.id)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="custom-meta-delete"
                        onClick={() => removeCustomRow(row.id)}
                        aria-label={`${row.name} entfernen`}
                      >
                        ×
                      </button>
                    </div>
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
                <h3 className="inspector-inline-label">
                  Stapel
                  <InfoIcon title={FIELD_DESC.batchMultiSelect} />
                </h3>
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
                <h3 className="inspector-inline-label">
                  Material
                  <InfoIcon title={FIELD_DESC.batchMaterialColor} />
                </h3>
                <ColorPickerPopover
                  label="Farbe (alle)"
                  hint={FIELD_DESC.batchMaterialColor}
                  value={selectedAssets[0]?.color ?? FALLBACK_ASSET_COLOR}
                  openSignal={colorPickerKick}
                  onCommit={(nextColor) => {
                    const c = sanitizeColor(nextColor)
                    updateAssets(selectedAssets.map((a) => ({ id: a.id, patch: { color: c } })))
                  }}
                />
                <h3 className="inspector-inline-label">
                  Ausrichten
                  <InfoIcon title={FIELD_DESC.batchAlignTools} />
                </h3>
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
                <p className="selected-title inspector-inline-label">
                  Boden
                  <InfoIcon title={FIELD_DESC.floorPresentationGrid} />
                </p>
                <ColorPickerPopover
                  label="Bodenfarbe"
                  hint={FIELD_DESC.floorColor}
                  value={floor.color}
                  onCommit={(c) => setFloor({ color: sanitizeColor(c) })}
                />
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={floor.gridVisible}
                    onChange={(e) => setFloor({ gridVisible: e.target.checked })}
                  />
                  <span className="inspector-inline-label">
                    Raster anzeigen (nur Bearbeiten)
                    <InfoIcon title={FIELD_DESC.floorGridVisible} />
                  </span>
                </label>
                <ColorPickerPopover
                  label="Rasterfarbe"
                  hint={FIELD_DESC.floorGridColor}
                  value={floor.gridColor}
                  onCommit={(c) => setFloor({ gridColor: sanitizeColor(c) })}
                />
                <label className="opacity-slider-field">
                  <span className="inspector-inline-label">
                    Raster-Zellenabstand ({floor.gridSize.toFixed(2)} m)
                    <InfoIcon title={FIELD_DESC.floorGridSpacing} />
                  </span>
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
                  <span className="inspector-inline-label">
                    Bodengröße ({floor.size.toFixed(0)} m)
                    <InfoIcon title={FIELD_DESC.floorSize} />
                  </span>
                  <input
                    type="range"
                    min={40}
                    max={200}
                    step={5}
                    value={floor.size}
                    onChange={(e) => setFloor({ size: Number(e.target.value) })}
                  />
                </label>
                <h3 className="inspector-inline-label">
                  Einrasten
                  <InfoIcon title={FIELD_DESC.snapSection} />
                </h3>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={floor.placementSnapEnabled}
                    onChange={(e) => setFloor({ placementSnapEnabled: e.target.checked })}
                  />
                  <span className="inspector-inline-label">
                    Beim Platzieren und Verschieben am Raster einrasten (STRG: frei)
                    <InfoIcon title={FIELD_DESC.snapEnabled} />
                  </span>
                </label>
                <label className="metadata-field">
                  <span className="inspector-inline-label">
                    Raster-Schritt
                    <InfoIcon title={FIELD_DESC.snapStep} />
                  </span>
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
              <div className="inspector-content inspector-empty-state">
                <p className="inspector-inline-label inspector-empty-hint">
                  Auswahl
                  <InfoIcon title={FIELD_DESC.inspectorEmpty} />
                </p>
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
