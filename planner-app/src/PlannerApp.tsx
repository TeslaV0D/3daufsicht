import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber'
import {
  Html,
  OrbitControls,
  TransformControls,
  useGLTF,
} from '@react-three/drei'
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from 'react'
import {
  Box3,
  Euler,
  Group,
  Mesh,
  Quaternion,
  Vector3,
  type Object3D,
  type Vector3Tuple,
} from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import './App.css'
import FactoryFloor from './components/FactoryFloor'
import FactoryWalls from './components/FactoryWalls'
import Lighting from './components/Lighting'

type PlannerTool = 'select' | 'place'
type CameraPreset = 'perspective' | 'top' | 'front' | 'side'
type TransformMode = 'translate' | 'rotate'
type AssetShape =
  | 'box'
  | 'rectangle'
  | 'circle'
  | 'rhombus'
  | 'cylinder'
  | 'cone'
  | 'sphere'
  | 'hex'

interface AssetDefinition {
  id: string
  label: string
  category: string
  size: Vector3Tuple
  shape: AssetShape
  color: string
  metadataTemplate: Record<string, string>
  modelUrl?: string
}

interface PlacedAsset {
  id: string
  definitionId: string
  position: Vector3Tuple
  rotation: Vector3Tuple
  dimensions: Vector3Tuple
  color: string
  metadata: Record<string, string>
}

interface HistorySnapshot {
  assets: PlacedAsset[]
  selectedIds: string[]
}

interface AssetMeshProps {
  asset: PlacedAsset
  definition: AssetDefinition
  isSelected: boolean
  isPlacementMode: boolean
  useTransformGizmo: boolean
  transformMode: TransformMode
  isCtrlPressed: boolean
  orbitRef: RefObject<OrbitControlsImpl | null>
  onSelect: (id: string, addToSelection: boolean) => void
  onTransformCommit: (id: string, position: Vector3Tuple, rotation: Vector3Tuple) => void
}

interface NumericTransformInputProps {
  label: string
  value: number
  step?: string
  onCommit: (value: number) => void
}

interface ColorInputProps {
  value: string
  onCommit: (value: string) => void
}

interface MultiTransformGizmoProps {
  selectedAssets: PlacedAsset[]
  mode: TransformMode
  isCtrlPressed: boolean
  orbitRef: RefObject<OrbitControlsImpl | null>
  onCommit: (updates: Array<{ id: string; position: Vector3Tuple; rotation: Vector3Tuple }>) => void
}

interface StoredLayoutPayload {
  assets: PlacedAsset[]
  assetDefinitions: AssetDefinition[]
}

const STORAGE_KEY = 'layout-planner-v2'
const SNAP_UNIT = 1
const MAX_HISTORY = 80
const FALLBACK_ASSET_COLOR = '#8ca0b6'
const FALLBACK_ASSET_DIMENSIONS: Vector3Tuple = [1, 1, 1]
const COLOR_SWATCHES = [
  '#e03131',
  '#f08c00',
  '#f59f00',
  '#2f9e44',
  '#0ca678',
  '#15aabf',
  '#1c7ed6',
  '#3d8bfd',
  '#5f3dc4',
  '#7048e8',
  '#c2255c',
  '#495057',
]

const DEFAULT_ASSET_DEFINITIONS: AssetDefinition[] = [
  {
    id: 'production-line',
    label: 'Produktionslinie',
    category: 'Produktion',
    size: [5, 1.2, 1.8],
    shape: 'rectangle',
    color: '#3d8bfd',
    metadataTemplate: {
      Bereich: 'FA1-Montage',
      Kapazitaet: '60 Teile/h',
      Verantwortlich: 'Team Alpha',
    },
  },
  {
    id: 'shelf-block',
    label: 'Regalblock',
    category: 'Logistik',
    size: [1.8, 2.4, 0.8],
    shape: 'box',
    color: '#2f9e44',
    metadataTemplate: {
      Bereich: 'Logistik',
      Inhalt: 'Bauteile',
      Reichweite: '2 Tage',
    },
  },
  {
    id: 'workbench',
    label: 'Arbeitsplatz',
    category: 'Produktion',
    size: [1.2, 1, 1.2],
    shape: 'cylinder',
    color: '#f08c00',
    metadataTemplate: {
      Bereich: 'FA2-Montage',
      Schicht: 'Frueh',
      Personal: '2',
    },
  },
  {
    id: 'forklift',
    label: 'Hubwagen',
    category: 'Logistik',
    size: [1.6, 1.1, 2.4],
    shape: 'rectangle',
    color: '#f59f00',
    metadataTemplate: {
      Bereich: 'Materialfluss',
      Status: 'Bereit',
      Fahrer: 'M. Keller',
    },
  },
  {
    id: 'employee',
    label: 'Angestellte',
    category: 'Personal',
    size: [0.8, 1.75, 0.8],
    shape: 'circle',
    color: '#15aabf',
    metadataTemplate: {
      Bereich: 'Montage',
      Schicht: 'Frueh',
      Anzahl: '1',
    },
  },
  {
    id: 'crate-stack',
    label: 'Kisten',
    category: 'Logistik',
    size: [1.2, 1.2, 1.2],
    shape: 'box',
    color: '#8d6e63',
    metadataTemplate: {
      Bereich: 'Wareneingang',
      Inhalt: 'Komponenten',
      Bestand: '32',
    },
  },
  {
    id: 'office-block',
    label: 'Buero',
    category: 'Verwaltung',
    size: [2.8, 2.1, 2],
    shape: 'box',
    color: '#7048e8',
    metadataTemplate: {
      Bereich: 'Buero',
      Nutzung: 'Planung',
      Plaetze: '6',
    },
  },
  {
    id: 'service-zone',
    label: 'Service/TPM',
    category: 'Support',
    size: [2.2, 1.6, 2.2],
    shape: 'rhombus',
    color: '#e03131',
    metadataTemplate: {
      Bereich: 'TPM',
      Status: 'Aktiv',
      Letzte_Wartung: '2026-04-20',
    },
  },
  {
    id: 'cone-marker',
    label: 'Kegel-Markierung',
    category: 'Formen',
    size: [1.4, 2, 1.4],
    shape: 'cone',
    color: '#ff6b6b',
    metadataTemplate: {
      Bereich: 'Formen',
      Hinweis: 'Kegel',
      Status: 'Neu',
    },
  },
  {
    id: 'sphere-buffer',
    label: 'Kugel-Puffer',
    category: 'Formen',
    size: [1.8, 1.8, 1.8],
    shape: 'sphere',
    color: '#38d9a9',
    metadataTemplate: {
      Bereich: 'Formen',
      Hinweis: 'Kugel',
      Status: 'Neu',
    },
  },
  {
    id: 'hex-station',
    label: 'Hex-Station',
    category: 'Formen',
    size: [2.2, 1.6, 2.2],
    shape: 'hex',
    color: '#74c0fc',
    metadataTemplate: {
      Bereich: 'Formen',
      Hinweis: 'Hexagon',
      Status: 'Neu',
    },
  },
  {
    id: 'simple-rectangle',
    label: 'Rechteck',
    category: 'Formen',
    size: [2.5, 1, 1.4],
    shape: 'rectangle',
    color: '#5c7cfa',
    metadataTemplate: {
      Bereich: 'Formen',
      Hinweis: 'Rechteck',
      Status: 'Neu',
    },
  },
  {
    id: 'simple-circle',
    label: 'Kreis',
    category: 'Formen',
    size: [1.8, 0.6, 1.8],
    shape: 'circle',
    color: '#20c997',
    metadataTemplate: {
      Bereich: 'Formen',
      Hinweis: 'Kreis',
      Status: 'Neu',
    },
  },
]

const CAMERA_PRESETS: Record<CameraPreset, { position: Vector3Tuple; target: Vector3Tuple }> = {
  perspective: {
    position: [22, 18, 22],
    target: [0, 0, 0],
  },
  top: {
    position: [0, 42, 0.01],
    target: [0, 0, 0],
  },
  front: {
    position: [0, 12, 36],
    target: [0, 2, 0],
  },
  side: {
    position: [36, 12, 0],
    target: [0, 2, 0],
  },
}

const round2 = (value: number) => Number(value.toFixed(2))
const isFiniteNumber = (value: number) => Number.isFinite(value)
const formatNumber = (value: number) => String(round2(value))
const radToDeg = (value: number) => round2((value * 180) / Math.PI)
const degToRad = (value: number) => round2((value * Math.PI) / 180)

function sanitizeColor(value: string) {
  if (/^#[\da-fA-F]{6}$/.test(value)) {
    return value
  }
  return FALLBACK_ASSET_COLOR
}

function newAssetId() {
  return `asset-${crypto.randomUUID()}`
}

function newDefinitionId() {
  return `custom-${crypto.randomUUID()}`
}

function clonePlacedAsset(asset: PlacedAsset): PlacedAsset {
  return {
    ...asset,
    position: [...asset.position] as Vector3Tuple,
    rotation: [...asset.rotation] as Vector3Tuple,
    dimensions: [...asset.dimensions] as Vector3Tuple,
    color: asset.color,
    metadata: { ...asset.metadata },
  }
}

function cloneAssets(assets: PlacedAsset[]) {
  return assets.map(clonePlacedAsset)
}

function cloneDefinition(definition: AssetDefinition): AssetDefinition {
  return {
    ...definition,
    size: [...definition.size] as Vector3Tuple,
    shape: definition.shape,
    metadataTemplate: { ...definition.metadataTemplate },
  }
}

function cloneDefinitions(definitions: AssetDefinition[]) {
  return definitions.map(cloneDefinition)
}

function resolvePlacementPosition(point: Vector3Tuple, freePlacement: boolean, sizeY: number) {
  const x = freePlacement ? point[0] : Math.round(point[0] / SNAP_UNIT) * SNAP_UNIT
  const z = freePlacement ? point[2] : Math.round(point[2] / SNAP_UNIT) * SNAP_UNIT
  return [round2(x), round2(sizeY / 2), round2(z)] as Vector3Tuple
}

function isVector3Tuple(value: unknown): value is Vector3Tuple {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    typeof value[2] === 'number' &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1]) &&
    isFiniteNumber(value[2])
  )
}

function parseFiniteInput(rawValue: string): number | null {
  const parsedValue = Number(rawValue)
  return isFiniteNumber(parsedValue) ? parsedValue : null
}

function isAssetShape(value: unknown): value is AssetShape {
  return (
    value === 'box' ||
    value === 'rectangle' ||
    value === 'circle' ||
    value === 'rhombus' ||
    value === 'cylinder' ||
    value === 'cone' ||
    value === 'sphere' ||
    value === 'hex'
  )
}

function clampRgbChannel(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function channelToHex(value: number) {
  return clampRgbChannel(value).toString(16).padStart(2, '0')
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`
}

function hexToRgb(color: string) {
  const normalized = sanitizeColor(color).slice(1)
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) {
    return false
  }
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable
}

function normalizeDefinition(input: unknown): AssetDefinition | null {
  if (typeof input !== 'object' || input === null) {
    return null
  }
  const entry = input as Record<string, unknown>
  if (
    typeof entry.id !== 'string' ||
    typeof entry.label !== 'string' ||
    typeof entry.category !== 'string' ||
    !isVector3Tuple(entry.size) ||
    !isAssetShape(entry.shape) ||
    typeof entry.color !== 'string' ||
    typeof entry.metadataTemplate !== 'object' ||
    entry.metadataTemplate === null
  ) {
    return null
  }

  return {
    id: entry.id,
    label: entry.label,
    category: entry.category,
    size: entry.size,
    shape: entry.shape,
    color: entry.color,
    metadataTemplate: Object.fromEntries(
      Object.entries(entry.metadataTemplate).map(([key, value]) => [key, String(value)]),
    ),
    modelUrl: typeof entry.modelUrl === 'string' ? entry.modelUrl : undefined,
  }
}

function parseStoredAssets(raw: unknown) {
  if (!Array.isArray(raw)) {
    return []
  }
  const safeAssets: PlacedAsset[] = []
  for (const entry of raw) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof entry.id !== 'string' ||
      typeof entry.definitionId !== 'string' ||
      !isVector3Tuple((entry as Record<string, unknown>).position) ||
      !isVector3Tuple((entry as Record<string, unknown>).rotation) ||
      typeof (entry as Record<string, unknown>).metadata !== 'object' ||
      (entry as Record<string, unknown>).metadata === null
    ) {
      continue
    }

    const casted = entry as {
      id: string
      definitionId: string
      position: Vector3Tuple
      rotation: Vector3Tuple
      dimensions?: Vector3Tuple
      color?: string
      metadata: Record<string, unknown>
    }
    safeAssets.push({
      id: casted.id,
      definitionId: casted.definitionId,
      position: casted.position,
      rotation: casted.rotation,
      dimensions: isVector3Tuple(casted.dimensions)
        ? casted.dimensions
        : [...FALLBACK_ASSET_DIMENSIONS],
      color:
        typeof casted.color === 'string' && casted.color.trim().length > 0
          ? casted.color
          : FALLBACK_ASSET_COLOR,
      metadata: Object.fromEntries(
        Object.entries(casted.metadata).map(([key, value]) => [key, String(value)]),
      ),
    })
  }
  return safeAssets
}

function parseStoredLayout(rawLayout: string): StoredLayoutPayload | null {
  try {
    const parsed = JSON.parse(rawLayout) as unknown

    // Backward compatibility: old payload only contained assets array.
    if (Array.isArray(parsed)) {
      return {
        assets: parseStoredAssets(parsed),
        assetDefinitions: cloneDefinitions(DEFAULT_ASSET_DEFINITIONS),
      }
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }
    const payload = parsed as Record<string, unknown>
    const assets = parseStoredAssets(payload.assets)
    const definitionsRaw = Array.isArray(payload.assetDefinitions) ? payload.assetDefinitions : []
    const definitions = definitionsRaw
      .map((entry) => normalizeDefinition(entry))
      .filter((definition): definition is AssetDefinition => definition !== null)

    const resolvedDefinitions =
      definitions.length > 0 ? definitions : cloneDefinitions(DEFAULT_ASSET_DEFINITIONS)
    const definitionById = new Map(resolvedDefinitions.map((definition) => [definition.id, definition]))
    const hydratedAssets = assets.map((asset) => {
      const definition = definitionById.get(asset.definitionId)
      return {
        ...asset,
        dimensions: (
          isVector3Tuple(asset.dimensions)
            ? asset.dimensions
            : definition?.size ?? [...FALLBACK_ASSET_DIMENSIONS]
        ) as Vector3Tuple,
        color:
          typeof asset.color === 'string' && asset.color.trim().length > 0
            ? asset.color
            : definition?.color ?? FALLBACK_ASSET_COLOR,
      }
    })

    return {
      assets: hydratedAssets,
      assetDefinitions: resolvedDefinitions,
    }
  } catch {
    return null
  }
}

function createDemoLayout(): PlacedAsset[] {
  return [
    {
      id: newAssetId(),
      definitionId: 'production-line',
      position: [0, 0.7, 0],
      rotation: [0, 0, 0],
      dimensions: [5, 1.2, 1.8],
      color: '#3d8bfd',
      metadata: {
        Bereich: 'FA1-Montage',
        Kapazitaet: '60 Teile/h',
        Verantwortlich: 'Team Alpha',
      },
    },
    {
      id: newAssetId(),
      definitionId: 'production-line',
      position: [0, 0.7, 4],
      rotation: [0, 0, 0],
      dimensions: [5, 1.2, 1.8],
      color: '#3d8bfd',
      metadata: {
        Bereich: 'FA2-Montage',
        Kapazitaet: '55 Teile/h',
        Verantwortlich: 'Team Beta',
      },
    },
    {
      id: newAssetId(),
      definitionId: 'shelf-block',
      position: [-6, 1.2, -6],
      rotation: [0, Math.PI / 4, 0],
      dimensions: [1.8, 2.4, 0.8],
      color: '#2f9e44',
      metadata: {
        Bereich: 'Logistik',
        Inhalt: 'Bauteile',
        Reichweite: '2 Tage',
      },
    },
  ]
}

function CameraController({
  preset,
  orbitRef,
}: {
  preset: CameraPreset
  orbitRef: RefObject<OrbitControlsImpl | null>
}) {
  const { camera } = useThree()

  useEffect(() => {
    const selectedPreset = CAMERA_PRESETS[preset]
    camera.position.set(...selectedPreset.position)
    const controls = orbitRef.current
    if (controls) {
      controls.target.set(...selectedPreset.target)
      controls.update()
    } else {
      camera.lookAt(...selectedPreset.target)
    }
  }, [preset, camera, orbitRef])

  return null
}

function UploadedAssetModel({ url, targetSize }: { url: string; targetSize: Vector3Tuple }) {
  const gltf = useGLTF(url) as { scene: Group }
  const normalizedScene = useMemo(() => {
    const cloned = gltf.scene.clone(true)
    const size = new Vector3()
    const rawBox = new Box3().setFromObject(cloned)
    rawBox.getSize(size)

    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    const targetMax = Math.max(targetSize[0], targetSize[1], targetSize[2], 0.001)
    const scale = targetMax / maxDim
    cloned.scale.setScalar(scale)

    const centeredBox = new Box3().setFromObject(cloned)
    const center = new Vector3()
    centeredBox.getCenter(center)
    cloned.position.sub(center)

    const floorBox = new Box3().setFromObject(cloned)
    cloned.position.y -= floorBox.min.y

    cloned.traverse((child: Object3D) => {
      const maybeMesh = child as Mesh
      if (maybeMesh.isMesh) {
        maybeMesh.castShadow = true
        maybeMesh.receiveShadow = true
      }
    })

    return cloned
  }, [gltf.scene, targetSize])

  return <primitive object={normalizedScene} />
}

function AssetPrimitive({
  shape,
  dimensions,
  color,
  isSelected,
  ghost = false,
}: {
  shape: AssetShape
  dimensions: Vector3Tuple
  color: string
  isSelected: boolean
  ghost?: boolean
}) {
  const x = Math.max(dimensions[0], 0.05)
  const y = Math.max(dimensions[1], 0.05)
  const z = Math.max(dimensions[2], 0.05)
  const materialColor = ghost ? '#7ce9a4' : isSelected ? '#74c0fc' : color
  const materialRoughness = ghost ? 0.35 : 0.62
  const materialMetalness = ghost ? 0.06 : 0.18
  const materialEmissive = ghost ? '#1a7f47' : isSelected ? '#0b7285' : '#000000'
  const materialEmissiveIntensity = ghost ? 0.22 : isSelected ? 0.15 : 0
  const materialOpacity = ghost ? 0.45 : 1

  if (shape === 'rhombus') {
    return (
      <mesh castShadow receiveShadow rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[x / Math.SQRT2, y, z / Math.SQRT2]} />
        <meshStandardMaterial
          color={materialColor}
          roughness={materialRoughness}
          metalness={materialMetalness}
          emissive={materialEmissive}
          emissiveIntensity={materialEmissiveIntensity}
          transparent={ghost}
          opacity={materialOpacity}
        />
      </mesh>
    )
  }

  if (shape === 'cylinder') {
    return (
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[x / 2, z / 2, y, 24]} />
        <meshStandardMaterial
          color={materialColor}
          roughness={materialRoughness}
          metalness={materialMetalness}
          emissive={materialEmissive}
          emissiveIntensity={materialEmissiveIntensity}
          transparent={ghost}
          opacity={materialOpacity}
        />
      </mesh>
    )
  }

  if (shape === 'cone') {
    return (
      <mesh castShadow receiveShadow>
        <coneGeometry args={[Math.max(x, z) / 2, y, 24]} />
        <meshStandardMaterial
          color={materialColor}
          roughness={materialRoughness}
          metalness={materialMetalness}
          emissive={materialEmissive}
          emissiveIntensity={materialEmissiveIntensity}
          transparent={ghost}
          opacity={materialOpacity}
        />
      </mesh>
    )
  }

  if (shape === 'sphere') {
    return (
      <mesh castShadow receiveShadow scale={[x, y, z]}>
        <sphereGeometry args={[0.5, 24, 16]} />
        <meshStandardMaterial
          color={materialColor}
          roughness={materialRoughness}
          metalness={materialMetalness}
          emissive={materialEmissive}
          emissiveIntensity={materialEmissiveIntensity}
          transparent={ghost}
          opacity={materialOpacity}
        />
      </mesh>
    )
  }

  if (shape === 'hex') {
    return (
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[x / 2, z / 2, y, 6]} />
        <meshStandardMaterial
          color={materialColor}
          roughness={materialRoughness}
          metalness={materialMetalness}
          emissive={materialEmissive}
          emissiveIntensity={materialEmissiveIntensity}
          transparent={ghost}
          opacity={materialOpacity}
        />
      </mesh>
    )
  }

  if (shape === 'circle') {
    return (
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[Math.max(x, z) / 2, Math.max(x, z) / 2, y, 48]} />
        <meshStandardMaterial
          color={materialColor}
          roughness={materialRoughness}
          metalness={materialMetalness}
          emissive={materialEmissive}
          emissiveIntensity={materialEmissiveIntensity}
          transparent={ghost}
          opacity={materialOpacity}
        />
      </mesh>
    )
  }

  if (shape === 'rectangle') {
    return (
      <mesh castShadow receiveShadow>
        <boxGeometry args={[x, y, z]} />
        <meshStandardMaterial
          color={materialColor}
          roughness={materialRoughness}
          metalness={materialMetalness}
          emissive={materialEmissive}
          emissiveIntensity={materialEmissiveIntensity}
          transparent={ghost}
          opacity={materialOpacity}
        />
      </mesh>
    )
  }

  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[x, y, z]} />
      <meshStandardMaterial
        color={materialColor}
        roughness={materialRoughness}
        metalness={materialMetalness}
        emissive={materialEmissive}
        emissiveIntensity={materialEmissiveIntensity}
        transparent={ghost}
        opacity={materialOpacity}
      />
    </mesh>
  )
}

function AssetVisual({
  definition,
  dimensions,
  color,
  isSelected,
}: {
  definition: AssetDefinition
  dimensions: Vector3Tuple
  color: string
  isSelected: boolean
}) {
  if (definition.modelUrl) {
    return (
      <group>
        <Suspense
          fallback={
            <AssetPrimitive
              shape={definition.shape}
              dimensions={dimensions}
              color={color}
              isSelected={isSelected}
            />
          }
        >
          <UploadedAssetModel url={definition.modelUrl} targetSize={dimensions} />
        </Suspense>
        {isSelected && (
          <mesh>
            <boxGeometry args={dimensions} />
            <meshStandardMaterial
              color="#74c0fc"
              wireframe
              roughness={0.35}
              metalness={0.1}
              emissive="#74c0fc"
              emissiveIntensity={0.15}
            />
          </mesh>
        )}
      </group>
    )
  }

  return <AssetPrimitive shape={definition.shape} dimensions={dimensions} color={color} isSelected={isSelected} />
}

function NumericTransformInput({ label, value, step = '0.1', onCommit }: NumericTransformInputProps) {
  const [draft, setDraft] = useState(formatNumber(value))
  const [isEditing, setIsEditing] = useState(false)

  const commitDraft = useCallback(() => {
    const parsedValue = parseFiniteInput(draft)
    if (parsedValue === null) {
      setDraft(formatNumber(value))
      setIsEditing(false)
      return
    }
    const normalizedValue = round2(parsedValue)
    onCommit(normalizedValue)
    setDraft(formatNumber(normalizedValue))
    setIsEditing(false)
  }, [draft, onCommit, value])

  return (
    <label>
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={isEditing ? draft : formatNumber(value)}
        onFocus={() => {
          setDraft(formatNumber(value))
          setIsEditing(true)
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitDraft()
          }
          if (event.key === 'Escape') {
            setDraft(formatNumber(value))
            setIsEditing(false)
          }
        }}
        data-step={step}
      />
    </label>
  )
}

function ColorInput({ value, onCommit }: ColorInputProps) {
  const [draft, setDraft] = useState(sanitizeColor(value))
  const [isEditing, setIsEditing] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  const activeColor = sanitizeColor(isEditing ? draft : value)
  const activeRgb = useMemo(() => hexToRgb(activeColor), [activeColor])

  const commitDraft = useCallback(() => {
    const normalized = sanitizeColor(draft)
    onCommit(normalized)
    setDraft(normalized)
    setIsEditing(false)
  }, [draft, onCommit])

  useEffect(() => {
    if (!isPickerOpen) {
      return
    }
    const onWindowPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (pickerRef.current?.contains(target)) {
        return
      }
      setIsPickerOpen(false)
      setDraft(sanitizeColor(value))
      setIsEditing(false)
    }
    window.addEventListener('pointerdown', onWindowPointerDown)
    return () => window.removeEventListener('pointerdown', onWindowPointerDown)
  }, [isPickerOpen, value])

  const applyRgbDraft = useCallback(
    (channel: 'red' | 'green' | 'blue', inputValue: string) => {
      const parsed = parseFiniteInput(inputValue)
      if (parsed === null) {
        return
      }
      const nextChannel = clampRgbChannel(parsed)
      const { red, green, blue } = activeRgb
      const nextColor =
        channel === 'red'
          ? rgbToHex(nextChannel, green, blue)
          : channel === 'green'
            ? rgbToHex(red, nextChannel, blue)
            : rgbToHex(red, green, nextChannel)
      setDraft(nextColor)
      onCommit(nextColor)
    },
    [activeRgb, onCommit],
  )

  return (
    <label className="color-picker">
      Farbe
      <div className="color-control" ref={pickerRef}>
        <button
          type="button"
          className="color-trigger"
          onClick={() => {
            setDraft(sanitizeColor(value))
            setIsEditing(false)
            setIsPickerOpen((previous) => !previous)
          }}
        >
          <span className="color-trigger-swatch" style={{ backgroundColor: activeColor }} />
          <span>{activeColor.toUpperCase()}</span>
        </button>

        {isPickerOpen && (
          <div className="color-popover" role="dialog" aria-label="Farbenauswahl">
            <div className="color-swatch-grid">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className="color-swatch"
                  style={{ backgroundColor: swatch }}
                  aria-label={`Farbe ${swatch}`}
                  onClick={() => {
                    setDraft(swatch)
                    setIsEditing(false)
                    onCommit(swatch)
                    setIsPickerOpen(false)
                  }}
                />
              ))}
            </div>

            <div className="color-rgb-grid">
              <label>
                R
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(activeRgb.red)}
                  onChange={(event) => applyRgbDraft('red', event.target.value)}
                  aria-label="Rotkanal"
                />
              </label>
              <label>
                G
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(activeRgb.green)}
                  onChange={(event) => applyRgbDraft('green', event.target.value)}
                  aria-label="Gruenkanal"
                />
              </label>
              <label>
                B
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(activeRgb.blue)}
                  onChange={(event) => applyRgbDraft('blue', event.target.value)}
                  aria-label="Blaukanal"
                />
              </label>
            </div>

            <label className="color-hex-field">
              Hex
              <input
                type="text"
                value={isEditing ? draft : sanitizeColor(value)}
                onFocus={() => {
                  setDraft(sanitizeColor(value))
                  setIsEditing(true)
                }}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitDraft}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitDraft()
                  }
                  if (event.key === 'Escape') {
                    setDraft(sanitizeColor(value))
                    setIsEditing(false)
                  }
                }}
                placeholder="#RRGGBB"
                aria-label="Hex-Farbwert"
              />
            </label>
          </div>
        )}
      </div>
    </label>
  )
}

function AssetMesh({
  asset,
  definition,
  isSelected,
  isPlacementMode,
  useTransformGizmo,
  transformMode,
  isCtrlPressed,
  orbitRef,
  onSelect,
  onTransformCommit,
}: AssetMeshProps) {
  const groupRef = useRef<Group>(null!)
  const isDraggingRef = useRef(false)

  const finishDragging = useCallback(() => {
    if (!isDraggingRef.current) {
      return
    }
    isDraggingRef.current = false
    if (orbitRef.current) {
      orbitRef.current.enabled = true
    }
    const group = groupRef.current
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
    onTransformCommit(asset.id, nextPosition, nextRotation)
  }, [asset.id, onTransformCommit, orbitRef])

  useEffect(() => {
    const onWindowPointerUp = () => finishDragging()
    const onWindowBlur = () => finishDragging()
    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('pointerup', onWindowPointerUp)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [finishDragging])

  return (
    <group>
      <group
        ref={groupRef}
        position={asset.position}
        rotation={asset.rotation}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation()
          if (isPlacementMode) {
            return
          }
          onSelect(asset.id, event.ctrlKey || event.metaKey)
        }}
      >
        <AssetVisual
          definition={definition}
          dimensions={asset.dimensions}
          color={asset.color}
          isSelected={isSelected}
        />
      </group>

      {useTransformGizmo && (
        <TransformControls
          object={groupRef}
          mode={transformMode}
          translationSnap={transformMode === 'translate' && !isCtrlPressed ? SNAP_UNIT : undefined}
          rotationSnap={transformMode === 'rotate' && !isCtrlPressed ? Math.PI / 8 : undefined}
          onMouseDown={() => {
            isDraggingRef.current = true
            if (orbitRef.current) {
              orbitRef.current.enabled = false
            }
          }}
          onMouseUp={finishDragging}
        />
      )}
    </group>
  )
}

function MultiTransformGizmo({
  selectedAssets,
  mode,
  isCtrlPressed,
  orbitRef,
  onCommit,
}: MultiTransformGizmoProps) {
  const pivotRef = useRef<Group>(null!)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{
    pivotPosition: Vector3
    pivotQuaternion: Quaternion
    assets: Array<{
      id: string
      position: Vector3
      quaternion: Quaternion
    }>
  } | null>(null)

  const center = useMemo(() => {
    const sum = selectedAssets.reduce(
      (accumulator, asset) => {
        return [
          accumulator[0] + asset.position[0],
          accumulator[1] + asset.position[1],
          accumulator[2] + asset.position[2],
        ] as Vector3Tuple
      },
      [0, 0, 0] as Vector3Tuple,
    )
    return [
      round2(sum[0] / selectedAssets.length),
      round2(sum[1] / selectedAssets.length),
      round2(sum[2] / selectedAssets.length),
    ] as Vector3Tuple
  }, [selectedAssets])

  useEffect(() => {
    const pivot = pivotRef.current
    if (!pivot || isDraggingRef.current) {
      return
    }
    pivot.position.set(...center)
    pivot.rotation.set(0, 0, 0)
  }, [center])

  const finishDragging = useCallback(() => {
    if (!isDraggingRef.current) {
      return
    }
    isDraggingRef.current = false
    if (orbitRef.current) {
      orbitRef.current.enabled = true
    }

    const pivot = pivotRef.current
    const dragStart = dragStartRef.current
    if (!pivot || !dragStart) {
      return
    }

    const deltaPosition = pivot.position.clone().sub(dragStart.pivotPosition)
    const deltaQuaternion = pivot.quaternion
      .clone()
      .multiply(dragStart.pivotQuaternion.clone().invert())

    const updates = dragStart.assets.map((assetStart) => {
      const rotatedOffset = assetStart.position
        .clone()
        .sub(dragStart.pivotPosition)
        .applyQuaternion(deltaQuaternion)
      const nextPositionVector = dragStart.pivotPosition
        .clone()
        .add(rotatedOffset)
        .add(deltaPosition)
      const nextQuaternion = deltaQuaternion.clone().multiply(assetStart.quaternion)
      const nextRotationEuler = new Euler().setFromQuaternion(nextQuaternion, 'XYZ')

      return {
        id: assetStart.id,
        position: [
          round2(nextPositionVector.x),
          round2(nextPositionVector.y),
          round2(nextPositionVector.z),
        ] as Vector3Tuple,
        rotation: [
          round2(nextRotationEuler.x),
          round2(nextRotationEuler.y),
          round2(nextRotationEuler.z),
        ] as Vector3Tuple,
      }
    })

    onCommit(updates)
    dragStartRef.current = null
  }, [onCommit, orbitRef])

  useEffect(() => {
    const onWindowPointerUp = () => finishDragging()
    const onWindowBlur = () => finishDragging()
    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('pointerup', onWindowPointerUp)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [finishDragging])

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
          isDraggingRef.current = true
          if (orbitRef.current) {
            orbitRef.current.enabled = false
          }
          dragStartRef.current = {
            pivotPosition: pivot.position.clone(),
            pivotQuaternion: pivot.quaternion.clone(),
            assets: selectedAssets.map((asset) => ({
              id: asset.id,
              position: new Vector3(...asset.position),
              quaternion: new Quaternion().setFromEuler(new Euler(...asset.rotation, 'XYZ')),
            })),
          }
        }}
        onMouseUp={finishDragging}
      />
    </group>
  )
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'))
    reader.readAsDataURL(file)
  })
}

export default function PlannerApp() {
  const orbitRef = useRef<OrbitControlsImpl | null>(null)

  const [assetDefinitions, setAssetDefinitions] = useState<AssetDefinition[]>(() =>
    cloneDefinitions(DEFAULT_ASSET_DEFINITIONS),
  )
  const [assets, setAssets] = useState<PlacedAsset[]>(() => createDemoLayout())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [tool, setTool] = useState<PlannerTool>('select')
  const [transformMode, setTransformMode] = useState<TransformMode>('translate')
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('perspective')
  const [activeDefinitionId, setActiveDefinitionId] = useState<string>(DEFAULT_ASSET_DEFINITIONS[0].id)
  const [previewPosition, setPreviewPosition] = useState<Vector3Tuple | null>(null)
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)

  const [historyPast, setHistoryPast] = useState<HistorySnapshot[]>([])
  const [historyFuture, setHistoryFuture] = useState<HistorySnapshot[]>([])
  const [clipboardAssets, setClipboardAssets] = useState<PlacedAsset[]>([])

  const assetsRef = useRef(assets)
  const selectedIdsRef = useRef(selectedIds)
  const historyPastRef = useRef(historyPast)
  const historyFutureRef = useRef(historyFuture)
  const pasteStepRef = useRef(0)

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

  const activeDefinition = useMemo(
    () => assetDefinitions.find((definition) => definition.id === activeDefinitionId) ?? null,
    [activeDefinitionId, assetDefinitions],
  )

  const definitionById = useMemo(
    () => new Map(assetDefinitions.map((definition) => [definition.id, definition])),
    [assetDefinitions],
  )

  const groupedDefinitions = useMemo(
    () =>
      assetDefinitions.reduce<Record<string, AssetDefinition[]>>((grouped, definition) => {
        const list = grouped[definition.category] ?? []
        list.push(definition)
        grouped[definition.category] = list
        return grouped
      }, {}),
    [assetDefinitions],
  )

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.includes(asset.id)),
    [assets, selectedIds],
  )
  const singleSelectedAsset = selectedAssets.length === 1 ? selectedAssets[0] : null
  const singleSelectedDefinition = singleSelectedAsset
    ? definitionById.get(singleSelectedAsset.definitionId) ?? null
    : null

  const createSnapshot = useCallback((): HistorySnapshot => {
    return {
      assets: cloneAssets(assetsRef.current),
      selectedIds: [...selectedIdsRef.current],
    }
  }, [])

  const applySceneChange = useCallback(
    (nextAssets: PlacedAsset[], nextSelectedIds: string[], recordHistory: boolean) => {
      if (recordHistory) {
        const snapshot = createSnapshot()
        setHistoryPast((current) => [...current.slice(-(MAX_HISTORY - 1)), snapshot])
        setHistoryFuture([])
      }
      setAssets(nextAssets)
      setSelectedIds(nextSelectedIds)
    },
    [createSnapshot],
  )

  const undo = useCallback(() => {
    const past = historyPastRef.current
    if (past.length === 0) {
      return
    }
    const previous = past[past.length - 1]
    const currentSnapshot = createSnapshot()

    setHistoryPast(past.slice(0, -1))
    setHistoryFuture((current) => [currentSnapshot, ...current].slice(0, MAX_HISTORY))
    setAssets(cloneAssets(previous.assets))
    setSelectedIds([...previous.selectedIds])
  }, [createSnapshot])

  const redo = useCallback(() => {
    const future = historyFutureRef.current
    if (future.length === 0) {
      return
    }
    const [next, ...remaining] = future
    const currentSnapshot = createSnapshot()

    setHistoryFuture(remaining)
    setHistoryPast((current) => [...current.slice(-(MAX_HISTORY - 1)), currentSnapshot])
    setAssets(cloneAssets(next.assets))
    setSelectedIds([...next.selectedIds])
  }, [createSnapshot])

  const removeSelectedAssets = useCallback(() => {
    if (selectedIdsRef.current.length === 0) {
      return
    }
    const nextAssets = assetsRef.current.filter((asset) => !selectedIdsRef.current.includes(asset.id))
    applySceneChange(nextAssets, [], true)
  }, [applySceneChange])

  const copySelection = useCallback(() => {
    if (selectedIdsRef.current.length === 0) {
      return
    }
    const copied = assetsRef.current
      .filter((asset) => selectedIdsRef.current.includes(asset.id))
      .map(clonePlacedAsset)
    setClipboardAssets(copied)
    pasteStepRef.current = 0
  }, [])

  const pasteSelection = useCallback(() => {
    if (clipboardAssets.length === 0) {
      return
    }
    pasteStepRef.current += 1
    const offset = pasteStepRef.current

    const pasted = clipboardAssets.map((asset) => ({
      ...clonePlacedAsset(asset),
      id: newAssetId(),
      position: [
        round2(asset.position[0] + offset),
        asset.position[1],
        round2(asset.position[2] + offset),
      ] as Vector3Tuple,
    }))
    const nextAssets = [...assetsRef.current, ...pasted]
    applySceneChange(
      nextAssets,
      pasted.map((asset) => asset.id),
      true,
    )
    setTool('select')
  }, [applySceneChange, clipboardAssets])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const editable = isEditableTarget(event.target)
      const hasPrimaryModifier = event.ctrlKey || event.metaKey

      if (event.key === 'Control' || event.key === 'Meta') {
        setIsCtrlPressed(true)
      }

      if (hasPrimaryModifier && !editable && key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
        return
      }
      if (
        hasPrimaryModifier &&
        !editable &&
        ((key === 'z' && event.shiftKey) || key === 'y')
      ) {
        event.preventDefault()
        redo()
        return
      }
      if (hasPrimaryModifier && !editable && key === 'c') {
        event.preventDefault()
        copySelection()
        return
      }
      if (hasPrimaryModifier && !editable && key === 'v') {
        event.preventDefault()
        pasteSelection()
        return
      }

      if (editable) {
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeSelectedAssets()
      }
      if (event.key === 'Escape') {
        setTool('select')
        setPreviewPosition(null)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control' || event.key === 'Meta') {
        setIsCtrlPressed(false)
      }
    }

    const handleWindowBlur = () => {
      setIsCtrlPressed(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [copySelection, pasteSelection, redo, removeSelectedAssets, undo])

  const onAssetClick = useCallback(
    (id: string, addToSelection: boolean) => {
      setTool('select')
      setPreviewPosition(null)
      setSelectedIds((currentIds) => {
        if (!addToSelection && !isCtrlPressed) {
          return [id]
        }
        if (currentIds.includes(id)) {
          return currentIds.filter((currentId) => currentId !== id)
        }
        return [...currentIds, id]
      })
    },
    [isCtrlPressed],
  )

  const onFloorHover = useCallback(
    (point: Vector3Tuple) => {
      if (tool !== 'place' || !activeDefinition) {
        return
      }
      const position = resolvePlacementPosition(point, isCtrlPressed, activeDefinition.size[1])
      setPreviewPosition(position)
    },
    [activeDefinition, isCtrlPressed, tool],
  )

  const onFloorAction = useCallback(
    (point: Vector3Tuple) => {
      if (tool === 'place' && activeDefinition) {
        const newAsset: PlacedAsset = {
          id: newAssetId(),
          definitionId: activeDefinition.id,
          position: resolvePlacementPosition(point, isCtrlPressed, activeDefinition.size[1]),
          rotation: [0, 0, 0],
          dimensions: [...activeDefinition.size] as Vector3Tuple,
          color: activeDefinition.color,
          metadata: {
            ...activeDefinition.metadataTemplate,
          },
        }
        applySceneChange([...assetsRef.current, newAsset], [newAsset.id], true)
        return
      }
      setSelectedIds([])
    },
    [activeDefinition, applySceneChange, isCtrlPressed, tool],
  )

  const updateAssetTransform = useCallback(
    (id: string, position: Vector3Tuple, rotation: Vector3Tuple) => {
      if (!isVector3Tuple(position) || !isVector3Tuple(rotation)) {
        return
      }
      const nextAssets = assetsRef.current.map((asset) =>
        asset.id === id
          ? {
              ...asset,
              position,
              rotation,
            }
          : asset,
      )
      applySceneChange(nextAssets, selectedIdsRef.current, true)
    },
    [applySceneChange],
  )

  const updateManyAssetTransforms = useCallback(
    (updates: Array<{ id: string; position: Vector3Tuple; rotation: Vector3Tuple }>) => {
      if (updates.length === 0) {
        return
      }
      const updateById = new Map(updates.map((update) => [update.id, update]))
      const nextAssets = assetsRef.current.map((asset) => {
        const update = updateById.get(asset.id)
        if (!update) {
          return asset
        }
        return {
          ...asset,
          position: update.position,
          rotation: update.rotation,
        }
      })
      applySceneChange(nextAssets, selectedIdsRef.current, true)
    },
    [applySceneChange],
  )

  const updateSingleAssetMetadata = useCallback(
    (key: string, value: string) => {
      if (!singleSelectedAsset) {
        return
      }
      const nextAssets = assetsRef.current.map((asset) =>
        asset.id === singleSelectedAsset.id
          ? {
              ...asset,
              metadata: {
                ...asset.metadata,
                [key]: value,
              },
            }
          : asset,
      )
      applySceneChange(nextAssets, selectedIdsRef.current, true)
    },
    [applySceneChange, singleSelectedAsset],
  )

  const updateAssetDimensions = useCallback(
    (id: string, dimensions: Vector3Tuple) => {
      if (!isVector3Tuple(dimensions)) {
        return
      }
      const normalizedDimensions: Vector3Tuple = [
        Math.max(round2(dimensions[0]), 0.05),
        Math.max(round2(dimensions[1]), 0.05),
        Math.max(round2(dimensions[2]), 0.05),
      ]
      const nextAssets = assetsRef.current.map((asset) =>
        asset.id === id
          ? {
              ...asset,
              dimensions: normalizedDimensions,
              position: [
                asset.position[0],
                Math.max(asset.position[1], normalizedDimensions[1] / 2),
                asset.position[2],
              ] as Vector3Tuple,
            }
          : asset,
      )
      applySceneChange(nextAssets, selectedIdsRef.current, true)
    },
    [applySceneChange],
  )

  const updateAssetColor = useCallback(
    (id: string, color: string) => {
      const normalizedColor = sanitizeColor(color)
      const nextAssets = assetsRef.current.map((asset) =>
        asset.id === id
          ? {
              ...asset,
              color: normalizedColor,
            }
          : asset,
      )
      applySceneChange(nextAssets, selectedIdsRef.current, true)
    },
    [applySceneChange],
  )

  const saveLayout = useCallback(() => {
    const payload: StoredLayoutPayload = {
      assets,
      assetDefinitions,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [assetDefinitions, assets])

  const loadLayout = useCallback(() => {
    const rawLayout = localStorage.getItem(STORAGE_KEY)
    if (!rawLayout) {
      return
    }
    const parsedLayout = parseStoredLayout(rawLayout)
    if (!parsedLayout) {
      return
    }

    setAssets(parsedLayout.assets)
    setAssetDefinitions(parsedLayout.assetDefinitions)
    setSelectedIds([])
    setHistoryPast([])
    setHistoryFuture([])
    if (!parsedLayout.assetDefinitions.some((definition) => definition.id === activeDefinitionId)) {
      setActiveDefinitionId(parsedLayout.assetDefinitions[0]?.id ?? DEFAULT_ASSET_DEFINITIONS[0].id)
    }
  }, [activeDefinitionId])

  const onUploadAsset = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const modelUrl = await readFileAsDataUrl(file)
      const label = file.name.replace(/\.[^/.]+$/, '') || 'Custom Asset'
      const definition: AssetDefinition = {
        id: newDefinitionId(),
        label,
        category: 'Eigene Assets',
        size: [2, 2, 2],
        shape: 'box',
        color: '#a5b4c4',
        modelUrl,
        metadataTemplate: {
          Quelle: file.name,
          Typ: 'Custom Upload',
        },
      }
      setAssetDefinitions((current) => [...current, definition])
      setActiveDefinitionId(definition.id)
      setTool('place')
    } finally {
      event.target.value = ''
    }
  }, [])

  return (
    <div className="planner-shell">
      <header className="top-bar">
        <div className="toolbar-group">
          <span className="toolbar-title">Factory Planning Studio</span>
          <button
            type="button"
            className={tool === 'select' ? 'active' : ''}
            onClick={() => setTool('select')}
          >
            Auswahl
          </button>
          <button
            type="button"
            className={tool === 'place' ? 'active' : ''}
            onClick={() => setTool('place')}
          >
            Platzieren
          </button>
          <button
            type="button"
            className={transformMode === 'translate' ? 'active' : ''}
            onClick={() => setTransformMode('translate')}
            disabled={selectedIds.length === 0}
          >
            XYZ bewegen
          </button>
          <button
            type="button"
            className={transformMode === 'rotate' ? 'active' : ''}
            onClick={() => setTransformMode('rotate')}
            disabled={selectedIds.length === 0}
          >
            Drehen
          </button>
        </div>

        <div className="toolbar-group">
          <button type="button" onClick={undo} disabled={historyPast.length === 0}>
            Undo
          </button>
          <button type="button" onClick={redo} disabled={historyFuture.length === 0}>
            Redo
          </button>
          <button type="button" onClick={copySelection} disabled={selectedIds.length === 0}>
            Copy
          </button>
          <button type="button" onClick={pasteSelection} disabled={clipboardAssets.length === 0}>
            Paste
          </button>
          {(['perspective', 'top', 'front', 'side'] as CameraPreset[]).map((preset) => (
            <button
              type="button"
              key={preset}
              className={cameraPreset === preset ? 'active' : ''}
              onClick={() => setCameraPreset(preset)}
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
          <button type="button" onClick={saveLayout}>
            Speichern
          </button>
          <button type="button" onClick={loadLayout}>
            Laden
          </button>
          <button type="button" className="danger" onClick={removeSelectedAssets}>
            Loeschen
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="panel left">
          <h2>Asset-Bibliothek</h2>
          <p className="panel-hint">
            Waehle einen Typ und platziere ihn per Klick auf die Flaeche.
          </p>
          <label className="upload-field">
            Eigene Assets hochladen (GLB/GLTF)
            <input type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onChange={onUploadAsset} />
          </label>
          {Object.entries(groupedDefinitions).map(([category, definitions]) => (
            <div key={category} className="asset-group">
              <h3>{category}</h3>
              {definitions.map((definition) => (
                <button
                  type="button"
                  key={definition.id}
                  className={tool === 'place' && activeDefinitionId === definition.id ? 'active' : ''}
                  onClick={() => {
                    setTool('place')
                    setActiveDefinitionId(definition.id)
                  }}
                >
                  <span>{definition.label}</span>
                  <small>
                    {definition.shape} | {definition.size.join(' x ')} m
                  </small>
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main className="scene-wrapper">
          <Canvas shadows camera={{ position: CAMERA_PRESETS.perspective.position, fov: 48 }}>
            <color attach="background" args={['#d2dae3']} />
            <fog attach="fog" args={['#d2dae3', 55, 135]} />
            <Lighting />
            <CameraController preset={cameraPreset} orbitRef={orbitRef} />
            <FactoryFloor onHover={onFloorHover} onAction={onFloorAction} />
            <FactoryWalls />

            {assets.map((asset) => {
              const definition = definitionById.get(asset.definitionId)
              if (!definition) {
                return null
              }
              return (
                <AssetMesh
                  key={asset.id}
                  asset={asset}
                  definition={definition}
                  isSelected={selectedIds.includes(asset.id)}
                  useTransformGizmo={selectedIds.length === 1 && selectedIds.includes(asset.id)}
                  isPlacementMode={tool === 'place'}
                  isCtrlPressed={isCtrlPressed}
                  transformMode={transformMode}
                  orbitRef={orbitRef}
                  onSelect={onAssetClick}
                  onTransformCommit={updateAssetTransform}
                />
              )
            })}

            {selectedAssets.length > 1 && (
              <MultiTransformGizmo
                selectedAssets={selectedAssets}
                mode={transformMode}
                isCtrlPressed={isCtrlPressed}
                orbitRef={orbitRef}
                onCommit={updateManyAssetTransforms}
              />
            )}

            {tool === 'place' && activeDefinition && previewPosition && (
              <group>
                <group position={previewPosition}>
                  <AssetPrimitive
                    shape={activeDefinition.shape}
                    dimensions={activeDefinition.size}
                    color={activeDefinition.color}
                    isSelected={false}
                    ghost
                  />
                </group>
                <Html
                  position={[
                    previewPosition[0],
                    previewPosition[1] + Math.max(activeDefinition.size[1], 0.05) / 2 + 0.75,
                    previewPosition[2],
                  ]}
                  center
                >
                  <div className="preview-badge">{activeDefinition.label}</div>
                </Html>
              </group>
            )}

            <OrbitControls
              ref={orbitRef}
              makeDefault
              enablePan
              enableZoom
              enableDamping
              dampingFactor={0.08}
              screenSpacePanning
              zoomToCursor
              minDistance={6}
              maxDistance={75}
              minPolarAngle={0.2}
              maxPolarAngle={Math.PI / 2 - 0.03}
            />
          </Canvas>

          <div className="status-bar">
            <span>STRG/CMD: freie Platzierung und freies Bewegen/Rotieren</span>
            <span>STRG/CMD + Z: Undo | Shift+Z/Y: Redo</span>
            <span>STRG/CMD + C/V: Copy/Paste</span>
          </div>
        </main>

        <aside className="panel right">
          <h2>Inspector</h2>
          {singleSelectedAsset && singleSelectedDefinition ? (
            <div className="inspector-content">
              <p className="selected-title">{singleSelectedDefinition.label}</p>
              <p className="panel-hint">
                Form: {singleSelectedDefinition.shape} | Kategorie: {singleSelectedDefinition.category}
              </p>
              <p className="panel-hint">ID: {singleSelectedAsset.id.slice(0, 16)}...</p>
              <div className="vector-grid" key={singleSelectedAsset.id}>
                <NumericTransformInput
                  label="X"
                  value={singleSelectedAsset.position[0]}
                  onCommit={(nextValue) =>
                    updateAssetTransform(
                      singleSelectedAsset.id,
                      [nextValue, singleSelectedAsset.position[1], singleSelectedAsset.position[2]],
                      singleSelectedAsset.rotation,
                    )
                  }
                />
                <NumericTransformInput
                  label="Y"
                  value={singleSelectedAsset.position[1]}
                  onCommit={(nextValue) =>
                    updateAssetTransform(
                      singleSelectedAsset.id,
                      [singleSelectedAsset.position[0], nextValue, singleSelectedAsset.position[2]],
                      singleSelectedAsset.rotation,
                    )
                  }
                />
                <NumericTransformInput
                  label="Z"
                  value={singleSelectedAsset.position[2]}
                  onCommit={(nextValue) =>
                    updateAssetTransform(
                      singleSelectedAsset.id,
                      [singleSelectedAsset.position[0], singleSelectedAsset.position[1], nextValue],
                      singleSelectedAsset.rotation,
                    )
                  }
                />
                <NumericTransformInput
                  label="Rot X (deg)"
                  step="1"
                  value={radToDeg(singleSelectedAsset.rotation[0])}
                  onCommit={(nextValue) =>
                    updateAssetTransform(
                      singleSelectedAsset.id,
                      singleSelectedAsset.position,
                      [degToRad(nextValue), singleSelectedAsset.rotation[1], singleSelectedAsset.rotation[2]],
                    )
                  }
                />
                <NumericTransformInput
                  label="Rot Y (deg)"
                  step="0.05"
                  value={radToDeg(singleSelectedAsset.rotation[1])}
                  onCommit={(nextValue) =>
                    updateAssetTransform(
                      singleSelectedAsset.id,
                      singleSelectedAsset.position,
                      [singleSelectedAsset.rotation[0], degToRad(nextValue), singleSelectedAsset.rotation[2]],
                    )
                  }
                />
                <NumericTransformInput
                  label="Rot Z (deg)"
                  step="1"
                  value={radToDeg(singleSelectedAsset.rotation[2])}
                  onCommit={(nextValue) =>
                    updateAssetTransform(
                      singleSelectedAsset.id,
                      singleSelectedAsset.position,
                      [singleSelectedAsset.rotation[0], singleSelectedAsset.rotation[1], degToRad(nextValue)],
                    )
                  }
                />
              </div>
              <h3>Groesse (anpassbar)</h3>
              <div className="vector-grid">
                <NumericTransformInput
                  label="Breite (X)"
                  value={singleSelectedAsset.dimensions[0]}
                  onCommit={(nextValue) =>
                    updateAssetDimensions(singleSelectedAsset.id, [
                      nextValue,
                      singleSelectedAsset.dimensions[1],
                      singleSelectedAsset.dimensions[2],
                    ])
                  }
                />
                <NumericTransformInput
                  label="Hoehe (Y)"
                  value={singleSelectedAsset.dimensions[1]}
                  onCommit={(nextValue) =>
                    updateAssetDimensions(singleSelectedAsset.id, [
                      singleSelectedAsset.dimensions[0],
                      nextValue,
                      singleSelectedAsset.dimensions[2],
                    ])
                  }
                />
                <NumericTransformInput
                  label="Laenge (Z)"
                  value={singleSelectedAsset.dimensions[2]}
                  onCommit={(nextValue) =>
                    updateAssetDimensions(singleSelectedAsset.id, [
                      singleSelectedAsset.dimensions[0],
                      singleSelectedAsset.dimensions[1],
                      nextValue,
                    ])
                  }
                />
              </div>
              <ColorInput
                value={singleSelectedAsset.color}
                onCommit={(nextColor) => updateAssetColor(singleSelectedAsset.id, nextColor)}
              />
              <h3>Asset-Infos</h3>
              {Object.entries(singleSelectedAsset.metadata).map(([key, value]) => (
                <label key={key} className="metadata-field">
                  {key}
                  <input
                    value={value}
                    onChange={(event) => updateSingleAssetMetadata(key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          ) : selectedAssets.length > 1 ? (
            <div className="inspector-content">
              <p className="selected-title">{selectedAssets.length} Assets ausgewaehlt</p>
              <p className="panel-hint">
                Mehrfachauswahl kann direkt ueber den Transform-Gizmo bewegt/gedreht werden.
              </p>
            </div>
          ) : (
            <div className="inspector-content">
              <p className="panel-hint">
                Klicke ein platziertes Asset an, um Informationen und Position zu bearbeiten.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
