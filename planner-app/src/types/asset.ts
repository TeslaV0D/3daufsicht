import type { Vector3Tuple } from 'three'

export type GeometryKind =
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'torus'
  | 'plane'
  | 'circle'
  | 'ring'
  | 'text'
  | 'custom'

export interface GeometryParams {
  width?: number
  height?: number
  depth?: number
  radius?: number
  radiusTop?: number
  radiusBottom?: number
  innerRadius?: number
  outerRadius?: number
  tube?: number
  radialSegments?: number
  tubularSegments?: number
  segments?: number
  heightSegments?: number
  text?: string
  fontSize?: number
  modelUrl?: string
  modelFormat?: ModelFormat
}

export type ModelFormat = 'gltf' | 'glb' | 'stl' | 'obj' | 'fbx'

export type MaterialMode = 'original' | 'override'

export interface AssetGeometry {
  kind: GeometryKind
  params: GeometryParams
}

export interface CustomMetadataRow {
  id: string
  /** User-editable display name / key. */
  name: string
  value: string
}

export interface AssetMetadata {
  name?: string
  description?: string
  zoneType?: string
  /**
   * Text content for text/label assets. Rendered by the label primitive
   * when present; falls back to a placeholder otherwise.
   */
  text?: string
  /** Legacy / denormalized map; kept in sync with `customRows` when present. */
  customData?: Record<string, string>
  /** Canonical ordered custom fields (stable ids for edit/delete/rename). */
  customRows?: CustomMetadataRow[]
}

export type AssetDecalSide =
  | 'top'
  | 'bottom'
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'all'

export interface AssetDecal {
  id: string
  imageUrl: string
  imageName: string
  /** Scale factor relative to face size (0.1–5). */
  size: number
  opacity: number
  /** -0.5 … 0.5 along face tangents */
  offsetX: number
  offsetY: number
  rotation: number
  side: AssetDecalSide
}

export interface AssetVisual {
  opacity?: number
  emissive?: string
  hoverEffect?: boolean
  doubleSided?: boolean
  wireframe?: boolean
  transparent?: boolean
  flatShading?: boolean
  /** Image decals on primitive / bbox surfaces (data URLs or http). */
  decals?: AssetDecal[]
}

export interface Asset {
  id: string
  type: string
  category: string
  /** Optional library group id (e.g. template category); set when placing from template. */
  groupId?: string
  position: Vector3Tuple
  rotation: Vector3Tuple
  scale: Vector3Tuple
  /** Hex; for GLTF with materialMode "original", mesh materials keep file colors. */
  color: string
  geometry: AssetGeometry
  metadata: AssetMetadata
  visual?: AssetVisual
  /** GLTF/GLB: use embedded materials vs. tint with `color` / `opacity`. Primitives behave like override. */
  materialMode?: MaterialMode
  /** When true: no scene selection (edit), no transform gizmo; materials may appear dimmed. */
  isLocked?: boolean
  /** 0–1; combines with `visual.opacity` — this field wins when set. */
  opacity?: number
}

export interface AssetTemplate {
  type: string
  label: string
  category: string
  color: string
  scale: Vector3Tuple
  geometry: AssetGeometry
  metadata?: AssetMetadata
  visual?: AssetVisual
  /** True for assets created via Bibliotheks-Import (Batch). */
  isUserAsset?: boolean
  /** Unix ms when the template was created (Import). */
  createdAt?: number
}

export const FALLBACK_COLOR = '#8ca0b6'
export const FALLBACK_SCALE: Vector3Tuple = [1, 1, 1]
export const FALLBACK_POSITION: Vector3Tuple = [0, 0, 0]
export const FALLBACK_ROTATION: Vector3Tuple = [0, 0, 0]

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export function sanitizeColor(value: unknown): string {
  if (typeof value === 'string' && HEX_COLOR_RE.test(value)) {
    return value
  }
  return FALLBACK_COLOR
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isVector3Tuple(value: unknown): value is Vector3Tuple {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1]) &&
    isFiniteNumber(value[2])
  )
}

export function sanitizeVector3(
  value: unknown,
  fallback: Vector3Tuple,
): Vector3Tuple {
  if (isVector3Tuple(value)) {
    return [value[0], value[1], value[2]]
  }
  return [...fallback] as Vector3Tuple
}

export function sanitizeScale(value: unknown): Vector3Tuple {
  const sanitized = sanitizeVector3(value, FALLBACK_SCALE)
  return [
    Math.max(sanitized[0], 0.01),
    Math.max(sanitized[1], 0.01),
    Math.max(sanitized[2], 0.01),
  ]
}

const VALID_GEOMETRY_KINDS: GeometryKind[] = [
  'box',
  'sphere',
  'cylinder',
  'cone',
  'torus',
  'plane',
  'circle',
  'ring',
  'text',
  'custom',
]

function isGeometryKind(value: unknown): value is GeometryKind {
  return typeof value === 'string' && (VALID_GEOMETRY_KINDS as string[]).includes(value)
}

export function sanitizeGeometry(value: unknown): AssetGeometry {
  if (value && typeof value === 'object') {
    const entry = value as Record<string, unknown>
    const kind = isGeometryKind(entry.kind) ? entry.kind : 'box'
    const params: GeometryParams =
      entry.params && typeof entry.params === 'object' ? { ...(entry.params as GeometryParams) } : {}
    return { kind, params }
  }
  return { kind: 'box', params: {} }
}

export function newCustomFieldId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `cf-${Math.random().toString(36).slice(2, 12)}`
}

function legacyRowIdFromKey(key: string): string {
  return `legacy:${encodeURIComponent(key)}`
}

export function customRowsToRecord(rows: CustomMetadataRow[]): Record<string, string> {
  const o: Record<string, string> = {}
  for (const r of rows) {
    o[r.name] = r.value
  }
  return o
}

export function getCustomRows(meta: AssetMetadata): CustomMetadataRow[] {
  if (meta.customRows && meta.customRows.length > 0) {
    return meta.customRows
  }
  return Object.entries(meta.customData ?? {}).map(([name, value]) => ({
    id: legacyRowIdFromKey(name),
    name,
    value: String(value),
  }))
}

function sanitizeCustomRows(value: unknown): CustomMetadataRow[] {
  if (!Array.isArray(value)) return []
  const out: CustomMetadataRow[] = []
  for (const r of value) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.name !== 'string') continue
    const name = o.name.trim().slice(0, 200)
    if (!name) continue
    out.push({
      id: o.id.slice(0, 80),
      name,
      value: typeof o.value === 'string' ? o.value.slice(0, 8000) : String(o.value ?? ''),
    })
  }
  return out
}

function reconcileCustomMetadata(
  customData: Record<string, string>,
  rowsIn: CustomMetadataRow[] | undefined,
): { customRows: CustomMetadataRow[]; customData: Record<string, string> } {
  let rows = rowsIn?.length ? [...rowsIn] : []
  if (rows.length === 0) {
    rows = Object.entries(customData).map(([name, value]) => ({
      id: legacyRowIdFromKey(name),
      name,
      value: String(value),
    }))
  } else {
    const byName = new Map(rows.map((r) => [r.name, r]))
    for (const [name, value] of Object.entries(customData)) {
      if (!byName.has(name)) {
        rows.push({ id: newCustomFieldId(), name, value: String(value) })
      }
    }
  }
  const seen = new Set<string>()
  rows = rows.filter((r) => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
  return { customRows: rows, customData: customRowsToRecord(rows) }
}

export function sanitizeMetadata(value: unknown): AssetMetadata {
  if (value && typeof value === 'object') {
    const entry = value as Record<string, unknown>
    const customSource =
      entry.customData && typeof entry.customData === 'object'
        ? (entry.customData as Record<string, unknown>)
        : {}
    const customData: Record<string, string> = {}
    for (const [key, val] of Object.entries(customSource)) {
      customData[key] = String(val)
    }
    const rowsSan = sanitizeCustomRows(entry.customRows)
    const { customRows, customData: dataOut } = reconcileCustomMetadata(customData, rowsSan)
    return {
      name: typeof entry.name === 'string' ? entry.name : undefined,
      description: typeof entry.description === 'string' ? entry.description : undefined,
      zoneType: typeof entry.zoneType === 'string' ? entry.zoneType : undefined,
      text: typeof entry.text === 'string' ? entry.text : undefined,
      customData: dataOut,
      customRows,
    }
  }
  return { customData: {}, customRows: [] }
}

export function mergeAssetMetadata(
  prev: AssetMetadata,
  patch: Partial<AssetMetadata> | undefined,
): AssetMetadata {
  if (!patch) return prev
  const base: AssetMetadata = { ...prev, ...patch }
  if (patch.customRows !== undefined) {
    const rows = patch.customRows.map((r) => ({ ...r }))
    base.customRows = rows
    base.customData = customRowsToRecord(rows)
    return base
  }
  if (patch.customData !== undefined) {
    base.customData = { ...patch.customData }
    const reconciled = reconcileCustomMetadata(base.customData, prev.customRows)
    base.customRows = reconciled.customRows
    base.customData = reconciled.customData
    return base
  }
  return base
}

export function resolveAssetOpacity(asset: Asset): number {
  const raw = asset.opacity ?? asset.visual?.opacity ?? 1
  if (!isFiniteNumber(raw)) return 1
  return Math.min(1, Math.max(0, raw))
}

function sanitizeMaterialMode(value: unknown): MaterialMode | undefined {
  if (value === 'original' || value === 'override') return value
  return undefined
}

const DECAL_SIDES: AssetDecalSide[] = [
  'top',
  'bottom',
  'front',
  'back',
  'left',
  'right',
  'all',
]

function sanitizeDecals(value: unknown): AssetDecal[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: AssetDecal[] = []
  for (const d of value) {
    if (!d || typeof d !== 'object') continue
    const e = d as Record<string, unknown>
    if (typeof e.id !== 'string' || typeof e.imageUrl !== 'string') continue
    const side = DECAL_SIDES.includes(e.side as AssetDecalSide) ? (e.side as AssetDecalSide) : 'front'
    out.push({
      id: e.id.slice(0, 80),
      imageUrl: e.imageUrl.slice(0, 12_000_000),
      imageName:
        typeof e.imageName === 'string'
          ? e.imageName.slice(0, 256)
          : 'image.png',
      size:
        isFiniteNumber(e.size) ? Math.min(5, Math.max(0.1, e.size)) : 1,
      opacity: isFiniteNumber(e.opacity) ? Math.min(1, Math.max(0, e.opacity)) : 1,
      offsetX: isFiniteNumber(e.offsetX) ? Math.min(0.5, Math.max(-0.5, e.offsetX)) : 0,
      offsetY: isFiniteNumber(e.offsetY) ? Math.min(0.5, Math.max(-0.5, e.offsetY)) : 0,
      rotation: isFiniteNumber(e.rotation) ? Math.min(360, Math.max(0, e.rotation)) : 0,
      side,
    })
    if (out.length >= 6) break
  }
  return out.length ? out : undefined
}

export function sanitizeVisual(value: unknown): AssetVisual | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const entry = value as Record<string, unknown>
  const visual: AssetVisual = {}
  if (isFiniteNumber(entry.opacity)) visual.opacity = entry.opacity
  if (typeof entry.emissive === 'string') visual.emissive = sanitizeColor(entry.emissive)
  if (typeof entry.hoverEffect === 'boolean') visual.hoverEffect = entry.hoverEffect
  if (typeof entry.doubleSided === 'boolean') visual.doubleSided = entry.doubleSided
  if (typeof entry.wireframe === 'boolean') visual.wireframe = entry.wireframe
  if (typeof entry.transparent === 'boolean') visual.transparent = entry.transparent
  if (typeof entry.flatShading === 'boolean') visual.flatShading = entry.flatShading
  const decals = sanitizeDecals(entry.decals)
  if (decals) visual.decals = decals
  return visual
}

export function sanitizeAsset(value: unknown): Asset | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Record<string, unknown>
  if (typeof entry.id !== 'string' || entry.id.length === 0) return null
  if (typeof entry.type !== 'string') return null

  const opacityRaw = entry.opacity
  const opacity =
    isFiniteNumber(opacityRaw) ? Math.min(1, Math.max(0, opacityRaw)) : undefined

  const groupIdRaw = entry.groupId
  const groupId =
    typeof groupIdRaw === 'string' && groupIdRaw.length > 0 ? groupIdRaw : undefined

  return {
    id: entry.id,
    type: entry.type,
    category: typeof entry.category === 'string' ? entry.category : 'Allgemein',
    groupId,
    position: sanitizeVector3(entry.position, FALLBACK_POSITION),
    rotation: sanitizeVector3(entry.rotation, FALLBACK_ROTATION),
    scale: sanitizeScale(entry.scale),
    color: sanitizeColor(entry.color),
    geometry: sanitizeGeometry(entry.geometry),
    metadata: sanitizeMetadata(entry.metadata),
    visual: sanitizeVisual(entry.visual),
    materialMode: sanitizeMaterialMode(entry.materialMode),
    isLocked: typeof entry.isLocked === 'boolean' ? entry.isLocked : undefined,
    opacity,
  }
}

export function cloneAsset(asset: Asset): Asset {
  return {
    ...asset,
    position: [...asset.position] as Vector3Tuple,
    rotation: [...asset.rotation] as Vector3Tuple,
    scale: [...asset.scale] as Vector3Tuple,
    geometry: {
      kind: asset.geometry.kind,
      params: { ...asset.geometry.params },
    },
    metadata: {
      ...asset.metadata,
      customData: { ...(asset.metadata.customData ?? {}) },
      customRows: (asset.metadata.customRows ?? []).map((r) => ({ ...r })),
    },
    visual: asset.visual
      ? {
          ...asset.visual,
          decals: asset.visual.decals?.map((d) => ({ ...d })),
        }
      : undefined,
    materialMode: asset.materialMode,
    isLocked: asset.isLocked,
    opacity: asset.opacity,
  }
}

export function cloneAssets(assets: Asset[]): Asset[] {
  return assets.map(cloneAsset)
}
