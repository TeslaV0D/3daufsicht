import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber'
import { Grid, Html, OrbitControls, TransformControls } from '@react-three/drei'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Mesh, type Vector3Tuple } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import './App.css'

type PlannerTool = 'select' | 'place'
type CameraPreset = 'perspective' | 'top' | 'front' | 'side'
type TransformMode = 'translate' | 'rotate'

interface AssetDefinition {
  id: string
  label: string
  category: string
  size: Vector3Tuple
  color: string
  metadataTemplate: Record<string, string>
}

interface PlacedAsset {
  id: string
  definitionId: string
  position: Vector3Tuple
  rotation: Vector3Tuple
  metadata: Record<string, string>
}

interface AssetMeshProps {
  asset: PlacedAsset
  definition: AssetDefinition
  isSelected: boolean
  useTransformGizmo: boolean
  transformMode: TransformMode
  orbitRef: RefObject<OrbitControlsImpl | null>
  onSelect: (id: string, addToSelection: boolean) => void
  onTransform: (id: string, position: Vector3Tuple, rotation: Vector3Tuple) => void
}

interface NumericTransformInputProps {
  label: string
  value: number
  step?: string
  onCommit: (value: number) => void
}

const STORAGE_KEY = 'layout-planner-v1'
const SNAP_UNIT = 1

const ASSET_DEFINITIONS: AssetDefinition[] = [
  {
    id: 'assembly-line',
    label: 'Montage-Linie',
    category: 'Produktion',
    size: [4, 1.4, 1.6],
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
    color: '#f08c00',
    metadataTemplate: {
      Bereich: 'FA2-Montage',
      Schicht: 'Frueh',
      Personal: '2',
    },
  },
  {
    id: 'office-block',
    label: 'Buero',
    category: 'Verwaltung',
    size: [2.8, 2.1, 2],
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
    color: '#e03131',
    metadataTemplate: {
      Bereich: 'TPM',
      Status: 'Aktiv',
      Letzte_Wartung: '2026-04-20',
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

function newAssetId() {
  return `asset-${crypto.randomUUID()}`
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

function parseStoredAssets(rawLayout: string): PlacedAsset[] | null {
  try {
    const parsed = JSON.parse(rawLayout)
    if (!Array.isArray(parsed)) {
      return null
    }

    const safeAssets: PlacedAsset[] = []
    for (const entry of parsed) {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        typeof entry.id !== 'string' ||
        typeof entry.definitionId !== 'string' ||
        !isVector3Tuple(entry.position) ||
        !isVector3Tuple(entry.rotation) ||
        typeof entry.metadata !== 'object' ||
        entry.metadata === null
      ) {
        continue
      }

      safeAssets.push({
        id: entry.id,
        definitionId: entry.definitionId,
        position: entry.position,
        rotation: entry.rotation,
        metadata: Object.fromEntries(
          Object.entries(entry.metadata).map(([key, value]) => [key, String(value)]),
        ),
      })
    }
    return safeAssets
  } catch {
    return null
  }
}

function createDemoLayout(): PlacedAsset[] {
  return [
    {
      id: newAssetId(),
      definitionId: 'assembly-line',
      position: [0, 0.7, 0],
      rotation: [0, 0, 0],
      metadata: {
        Bereich: 'FA1-Montage',
        Kapazitaet: '60 Teile/h',
        Verantwortlich: 'Team Alpha',
      },
    },
    {
      id: newAssetId(),
      definitionId: 'assembly-line',
      position: [0, 0.7, 4],
      rotation: [0, 0, 0],
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

function NumericTransformInput({ label, value, step = '0.1', onCommit }: NumericTransformInputProps) {
  const [draft, setDraft] = useState(formatNumber(value))
  const [isEditing, setIsEditing] = useState(false)

  const visibleValue = isEditing ? draft : formatNumber(value)

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
        value={visibleValue}
        onFocus={() => setIsEditing(true)}
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

function AssetMesh({
  asset,
  definition,
  isSelected,
  useTransformGizmo,
  transformMode,
  orbitRef,
  onSelect,
  onTransform,
}: AssetMeshProps) {
  const meshRef = useRef<Mesh>(null!)

  return (
    <group>
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        position={asset.position}
        rotation={asset.rotation}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation()
          onSelect(asset.id, event.ctrlKey || event.metaKey)
        }}
      >
        <boxGeometry args={definition.size} />
        <meshStandardMaterial
          color={isSelected ? '#74c0fc' : definition.color}
          roughness={0.55}
          metalness={0.25}
          emissive={isSelected ? '#0b7285' : '#000000'}
          emissiveIntensity={isSelected ? 0.15 : 0}
        />
      </mesh>

      {useTransformGizmo && (
        <TransformControls
          object={meshRef}
          mode={transformMode}
          onMouseDown={() => {
            if (orbitRef.current) {
              orbitRef.current.enabled = false
            }
          }}
          onMouseUp={() => {
            if (orbitRef.current) {
              orbitRef.current.enabled = true
            }
          }}
          onObjectChange={() => {
            const currentMesh = meshRef.current
            const currentPosition: Vector3Tuple = [
              round2(currentMesh.position.x),
              round2(currentMesh.position.y),
              round2(currentMesh.position.z),
            ]
            const currentRotation: Vector3Tuple = [
              round2(currentMesh.rotation.x),
              round2(currentMesh.rotation.y),
              round2(currentMesh.rotation.z),
            ]
            onTransform(asset.id, currentPosition, currentRotation)
          }}
        />
      )}
    </group>
  )
}

function App() {
  const orbitRef = useRef<OrbitControlsImpl | null>(null)
  const [assets, setAssets] = useState<PlacedAsset[]>(() => createDemoLayout())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [tool, setTool] = useState<PlannerTool>('select')
  const [transformMode, setTransformMode] = useState<TransformMode>('translate')
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('perspective')
  const [activeDefinitionId, setActiveDefinitionId] = useState<string>(ASSET_DEFINITIONS[0].id)
  const [previewPosition, setPreviewPosition] = useState<Vector3Tuple | null>(null)
  const [isAltPressed, setIsAltPressed] = useState(false)
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)

  const activeDefinition = useMemo(
    () => ASSET_DEFINITIONS.find((definition) => definition.id === activeDefinitionId) ?? null,
    [activeDefinitionId],
  )

  const definitionById = useMemo(
    () => new Map(ASSET_DEFINITIONS.map((definition) => [definition.id, definition])),
    [],
  )

  const groupedDefinitions = useMemo(
    () =>
      ASSET_DEFINITIONS.reduce<Record<string, AssetDefinition[]>>((grouped, definition) => {
        const list = grouped[definition.category] ?? []
        list.push(definition)
        grouped[definition.category] = list
        return grouped
      }, {}),
    [],
  )

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.includes(asset.id)),
    [assets, selectedIds],
  )
  const singleSelectedAsset = selectedAssets.length === 1 ? selectedAssets[0] : null
  const singleSelectedDefinition = singleSelectedAsset
    ? definitionById.get(singleSelectedAsset.definitionId) ?? null
    : null

  const removeSelectedAssets = useCallback(() => {
    if (selectedIds.length === 0) {
      return
    }
    setAssets((currentAssets) =>
      currentAssets.filter((asset) => !selectedIds.includes(asset.id)),
    )
    setSelectedIds([])
  }, [selectedIds])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt') {
        setIsAltPressed(true)
      }
      if (event.key === 'Control' || event.key === 'Meta') {
        setIsCtrlPressed(true)
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
      if (event.key === 'Alt') {
        setIsAltPressed(false)
      }
      if (event.key === 'Control' || event.key === 'Meta') {
        setIsCtrlPressed(false)
      }
    }

    const handleWindowBlur = () => {
      setIsAltPressed(false)
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
  }, [removeSelectedAssets])

  const onAssetClick = useCallback((id: string, addToSelection: boolean) => {
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
  }, [isCtrlPressed])

  const onFloorHover = useCallback(
    (point: Vector3Tuple) => {
      if (tool !== 'place' || !activeDefinition) {
        return
      }
      const position = resolvePlacementPosition(point, isAltPressed, activeDefinition.size[1])
      setPreviewPosition(position)
    },
    [activeDefinition, isAltPressed, tool],
  )

  const onFloorAction = useCallback(
    (point: Vector3Tuple) => {
      if (tool === 'place' && activeDefinition) {
        const newAsset: PlacedAsset = {
          id: newAssetId(),
          definitionId: activeDefinition.id,
          position: resolvePlacementPosition(point, isAltPressed, activeDefinition.size[1]),
          rotation: [0, 0, 0],
          metadata: {
            ...activeDefinition.metadataTemplate,
          },
        }
        setAssets((currentAssets) => [...currentAssets, newAsset])
        setSelectedIds([newAsset.id])
        return
      }
      setSelectedIds([])
    },
    [activeDefinition, isAltPressed, tool],
  )

  const updateAssetTransform = useCallback(
    (id: string, position: Vector3Tuple, rotation: Vector3Tuple) => {
      setAssets((currentAssets) =>
        currentAssets.map((asset) =>
          asset.id === id
            ? {
                ...asset,
                position: isVector3Tuple(position) ? position : asset.position,
                rotation: isVector3Tuple(rotation) ? rotation : asset.rotation,
              }
            : asset,
        ),
      )
    },
    [],
  )

  const updateSingleAssetMetadata = useCallback(
    (key: string, value: string) => {
      if (!singleSelectedAsset) {
        return
      }
      setAssets((currentAssets) =>
        currentAssets.map((asset) =>
          asset.id === singleSelectedAsset.id
            ? {
                ...asset,
                metadata: {
                  ...asset.metadata,
                  [key]: value,
                },
              }
            : asset,
        ),
      )
    },
    [singleSelectedAsset],
  )

  const saveLayout = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assets))
  }, [assets])

  const loadLayout = useCallback(() => {
    const rawLayout = localStorage.getItem(STORAGE_KEY)
    if (!rawLayout) {
      return
    }
    const parsedLayout = parseStoredAssets(rawLayout)
    if (!parsedLayout) {
      return
    }
    setAssets(parsedLayout)
    setSelectedIds([])
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
            disabled={selectedIds.length !== 1}
          >
            XYZ bewegen
          </button>
          <button
            type="button"
            className={transformMode === 'rotate' ? 'active' : ''}
            onClick={() => setTransformMode('rotate')}
            disabled={selectedIds.length !== 1}
          >
            Drehen
          </button>
        </div>

        <div className="toolbar-group">
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
          {Object.entries(groupedDefinitions).map(([category, definitions]) => (
            <div key={category} className="asset-group">
              <h3>{category}</h3>
              {definitions.map((definition) => (
                <button
                  type="button"
                  key={definition.id}
                  className={
                    tool === 'place' && activeDefinitionId === definition.id ? 'active' : ''
                  }
                  onClick={() => {
                    setTool('place')
                    setActiveDefinitionId(definition.id)
                  }}
                >
                  <span>{definition.label}</span>
                  <small>{definition.size.join(' x ')} m</small>
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main className="scene-wrapper">
          <Canvas shadows camera={{ position: CAMERA_PRESETS.perspective.position, fov: 48 }}>
            <color attach="background" args={['#0a1018']} />
            <fog attach="fog" args={['#0a1018', 40, 95]} />
            <hemisphereLight intensity={0.35} groundColor="#172029" />
            <ambientLight intensity={0.6} />
            <directionalLight
              castShadow
              position={[18, 20, 14]}
              intensity={1}
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            <CameraController preset={cameraPreset} orbitRef={orbitRef} />

            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
              onPointerMove={(event: ThreeEvent<PointerEvent>) => {
                const point = event.point
                onFloorHover([point.x, point.y, point.z])
              }}
              onClick={(event: ThreeEvent<MouseEvent>) => {
                event.stopPropagation()
                const point = event.point
                onFloorAction([point.x, point.y, point.z])
              }}
            >
              <planeGeometry args={[80, 80]} />
              <meshStandardMaterial color="#1f2a35" roughness={0.95} metalness={0.05} />
            </mesh>

            <Grid
              position={[0, 0.02, 0]}
              args={[80, 80]}
              cellColor="#2b8aef"
              sectionColor="#8ce99a"
              cellSize={1}
              sectionSize={5}
              fadeDistance={70}
            />

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
                  transformMode={transformMode}
                  orbitRef={orbitRef}
                  onSelect={onAssetClick}
                  onTransform={updateAssetTransform}
                />
              )
            })}

            {tool === 'place' && activeDefinition && previewPosition && (
              <group>
                <mesh position={previewPosition}>
                  <boxGeometry args={activeDefinition.size} />
                  <meshStandardMaterial
                    color={activeDefinition.color}
                    transparent
                    opacity={0.45}
                    roughness={0.4}
                  />
                </mesh>
                <Html
                  position={[
                    previewPosition[0],
                    previewPosition[1] + activeDefinition.size[1] / 2 + 0.75,
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
              minDistance={6}
              maxDistance={75}
              maxPolarAngle={Math.PI / 2}
            />
          </Canvas>

          <div className="status-bar">
            <span>ALT: frei platzieren</span>
            <span>STRG: Mehrfachauswahl</span>
            <span>Entf: Assets loeschen</span>
          </div>
        </main>

        <aside className="panel right">
          <h2>Inspector</h2>
          {singleSelectedAsset && singleSelectedDefinition ? (
            <div className="inspector-content">
              <p className="selected-title">{singleSelectedDefinition.label}</p>
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
                  label="Rot Y"
                  step="0.05"
                  value={singleSelectedAsset.rotation[1]}
                  onCommit={(nextValue) =>
                    updateAssetTransform(
                      singleSelectedAsset.id,
                      singleSelectedAsset.position,
                      [singleSelectedAsset.rotation[0], nextValue, singleSelectedAsset.rotation[2]],
                    )
                  }
                />
              </div>
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
                Mit STRG weitere Elemente auswaehlen oder Loeschen klicken.
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

export default App
