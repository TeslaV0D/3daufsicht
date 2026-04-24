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

export interface AssetMetadata {
  name?: string
  description?: string
  zoneType?: string
  /**
   * Text content for text/label assets. Rendered by the label primitive
   * when present; falls back to a placeholder otherwise.
   */
  text?: string
  customData?: Record<string, string>
}

export interface AssetVisual {
  opacity?: number
  emissive?: string
  hoverEffect?: boolean
  doubleSided?: boolean
  wireframe?: boolean
  transparent?: boolean
  flatShading?: boolean
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
    return {
      name: typeof entry.name === 'string' ? entry.name : undefined,
      description: typeof entry.description === 'string' ? entry.description : undefined,
      zoneType: typeof entry.zoneType === 'string' ? entry.zoneType : undefined,
      text: typeof entry.text === 'string' ? entry.text : undefined,
      customData,
    }
  }
  return { customData: {} }
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
    },
    visual: asset.visual ? { ...asset.visual } : undefined,
    materialMode: asset.materialMode,
    isLocked: asset.isLocked,
    opacity: asset.opacity,
  }
}

export function cloneAssets(assets: Asset[]): Asset[] {
  return assets.map(cloneAsset)
}
