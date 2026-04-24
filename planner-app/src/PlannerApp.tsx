import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls, TransformControls } from '@react-three/drei'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
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
import FactoryFloor from './components/FactoryFloor'
import FactoryWalls from './components/FactoryWalls'
import Lighting from './components/Lighting'
import ViewModeOverlay from './components/ViewModeOverlay'
import AssetInfoModal from './components/AssetInfoModal'
import AssetRenderer, { GhostAssetRenderer } from './components/AssetRenderer'

import {
  getTemplatesByCategory,
  createAssetFromTemplate,
  geometryKindSupports2D,
} from './AssetFactory'
import { useAssetsStore } from './store/useAssetsStore'
import type { Asset, AssetTemplate } from './types/asset'
import { sanitizeColor } from './types/asset'

type PlannerTool = 'select' | 'place'
type PlannerMode = 'edit' | 'view'
type CameraPreset = 'perspective' | 'top' | 'front' | 'side'
type TransformMode = 'translate' | 'rotate' | 'scale'

const SNAP_UNIT = 1
const FALLBACK_ASSET_COLOR = '#8ca0b6'
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

const CAMERA_PRESETS: Record<CameraPreset, { position: Vector3Tuple; target: Vector3Tuple }> = {
  perspective: { position: [22, 18, 22], target: [0, 0, 0] },
  top: { position: [0, 42, 0.01], target: [0, 0, 0] },
  front: { position: [0, 12, 36], target: [0, 2, 0] },
  side: { position: [36, 12, 0], target: [0, 2, 0] },
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

function CameraController({
  preset,
  orbitRef,
}: {
  preset: CameraPreset
  orbitRef: RefObject<OrbitControlsImpl | null>
}) {
  const { camera } = useThree()
  useEffect(() => {
    const selected = CAMERA_PRESETS[preset]
    camera.position.set(...selected.position)
    const controls = orbitRef.current
    if (controls) {
      controls.target.set(...selected.target)
      controls.update()
    } else {
      camera.lookAt(...selected.target)
    }
  }, [preset, camera, orbitRef])
  return null
}

// --- Inputs

interface NumericInputProps {
  label: string
  value: number
  step?: string
  onCommit: (value: number) => void
}

function NumericInput({ label, value, onCommit }: NumericInputProps) {
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
    <label>
      {label}
      <input
        type="text"
        inputMode="decimal"
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

interface ColorInputProps {
  value: string
  onCommit: (value: string) => void
}

function ColorInput({ value, onCommit }: ColorInputProps) {
  const [draft, setDraft] = useState(sanitizeColor(value))
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  const activeColor = sanitizeColor(editing ? draft : value)
  const activeRgb = useMemo(() => hexToRgb(activeColor), [activeColor])

  const commitDraft = useCallback(() => {
    const normalized = sanitizeColor(draft)
    onCommit(normalized)
    setDraft(normalized)
    setEditing(false)
  }, [draft, onCommit])

  useEffect(() => {
    if (!open) return
    const handler = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (pickerRef.current?.contains(target)) return
      setOpen(false)
      setDraft(sanitizeColor(value))
      setEditing(false)
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [open, value])

  const applyRgb = useCallback(
    (channel: 'red' | 'green' | 'blue', input: string) => {
      const parsed = parseFiniteInput(input)
      if (parsed === null) return
      const next = clampRgbChannel(parsed)
      const { red, green, blue } = activeRgb
      const color =
        channel === 'red'
          ? rgbToHex(next, green, blue)
          : channel === 'green'
            ? rgbToHex(red, next, blue)
            : rgbToHex(red, green, next)
      setDraft(color)
      onCommit(color)
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
            setEditing(false)
            setOpen((p) => !p)
          }}
        >
          <span className="color-trigger-swatch" style={{ backgroundColor: activeColor }} />
          <span>{activeColor.toUpperCase()}</span>
        </button>

        {open && (
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
                    setEditing(false)
                    onCommit(swatch)
                    setOpen(false)
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
                  onChange={(event) => applyRgb('red', event.target.value)}
                />
              </label>
              <label>
                G
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(activeRgb.green)}
                  onChange={(event) => applyRgb('green', event.target.value)}
                />
              </label>
              <label>
                B
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(activeRgb.blue)}
                  onChange={(event) => applyRgb('blue', event.target.value)}
                />
              </label>
            </div>

            <label className="color-hex-field">
              Hex
              <input
                type="text"
                value={editing ? draft : sanitizeColor(value)}
                onFocus={() => {
                  setDraft(sanitizeColor(value))
                  setEditing(true)
                }}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitDraft}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitDraft()
                  if (event.key === 'Escape') {
                    setDraft(sanitizeColor(value))
                    setEditing(false)
                  }
                }}
                placeholder="#RRGGBB"
              />
            </label>
          </div>
        )}
      </div>
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
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('perspective')
  const [selectedTemplateType, setSelectedTemplateType] = useState<string | null>(null)
  const [previewPosition, setPreviewPosition] = useState<Vector3Tuple | null>(null)
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [infoAssetId, setInfoAssetId] = useState<string | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)

  const {
    assets,
    templates,
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
  } = store

  const activeTemplateType = selectedTemplateType ?? templates[0]?.type ?? null
  const activeTemplate = useMemo(
    () => templates.find((template) => template.type === activeTemplateType) ?? null,
    [activeTemplateType, templates],
  )

  const groupedTemplates = useMemo(() => getTemplatesByCategory(templates), [templates])

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.includes(asset.id)),
    [assets, selectedIds],
  )
  const singleSelected = selectedAssets.length === 1 ? selectedAssets[0] : null

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
  }, [])

  const changeTool = useCallback((nextTool: PlannerTool) => {
    setTool(nextTool)
    setHoveredId(null)
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
      const addToSelection = event.ctrlKey || event.metaKey || isCtrlPressed
      setSelectedIds(
        selectedIds.includes(asset.id)
          ? addToSelection
            ? selectedIds.filter((id) => id !== asset.id)
            : [asset.id]
          : addToSelection
            ? [...selectedIds, asset.id]
            : [asset.id],
      )
    },
    [isCtrlPressed, mode, selectedIds, setSelectedIds, tool],
  )

  const onAssetPointerOver = useCallback(
    (_event: ThreeEvent<PointerEvent>, asset: Asset) => {
      setHoveredId(asset.id)
    },
    [],
  )
  const onAssetPointerOut = useCallback((_event: ThreeEvent<PointerEvent>, asset: Asset) => {
    setHoveredId((current) => (current === asset.id ? null : current))
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
    },
    [activeTemplate, addAsset, isCtrlPressed, mode, setSelectedIds, tool],
  )

  const onRemoveSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    removeAssets(selectedIds)
  }, [removeAssets, selectedIds])

  const onSaveLayout = useCallback(() => {
    save()
    setSaveFeedback('Gespeichert')
    window.setTimeout(() => setSaveFeedback(null), 2000)
  }, [save])

  const onLoadLayout = useCallback(() => {
    const ok = load()
    setSaveFeedback(ok ? 'Geladen' : 'Kein gespeichertes Layout gefunden')
    window.setTimeout(() => setSaveFeedback(null), 2200)
  }, [load])

  const onUploadAsset = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      try {
        const modelUrl = await readFileAsDataUrl(file)
        const label = file.name.replace(/\.[^/.]+$/, '') || 'Custom Asset'
        const template = addCustomModelTemplate(label, modelUrl)
        setSelectedTemplateType(template.type)
        changeTool('place')
      } finally {
        event.target.value = ''
      }
    },
    [addCustomModelTemplate, changeTool],
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
    (key: string, value: string, kind: 'name' | 'description' | 'zoneType' | 'custom') => {
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
      <header className="top-bar">
        <div className="toolbar-group">
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

          {mode === 'edit' && (
            <>
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
                className={transformMode === 'translate' ? 'active' : ''}
                onClick={() => setTransformMode('translate')}
                disabled={selectedIds.length === 0}
              >
                Bewegen
              </button>
              <button
                type="button"
                className={transformMode === 'rotate' ? 'active' : ''}
                onClick={() => setTransformMode('rotate')}
                disabled={selectedIds.length === 0}
              >
                Drehen
              </button>
              <button
                type="button"
                className={transformMode === 'scale' ? 'active' : ''}
                onClick={() => setTransformMode('scale')}
                disabled={selectedIds.length === 0}
              >
                Skalieren
              </button>
            </>
          )}
        </div>

        <div className="toolbar-group">
          {mode === 'edit' && (
            <>
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
            </>
          )}
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
          <button type="button" onClick={onSaveLayout}>
            Speichern
          </button>
          <button type="button" onClick={onLoadLayout}>
            Laden
          </button>
          {mode === 'edit' && (
            <button type="button" className="danger" onClick={onRemoveSelected}>
              Loeschen
            </button>
          )}
        </div>
      </header>

      <div className={`workspace${mode === 'view' ? ' view-mode' : ''}`}>
        <aside className="panel left" aria-hidden={mode === 'view'}>
          <h2>Asset-Bibliothek</h2>
          <p className="panel-hint">Kategorie waehlen und per Klick in der Szene platzieren.</p>
          <label className="upload-field">
            Eigene Assets hochladen (GLB/GLTF)
            <input
              type="file"
              accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
              onChange={onUploadAsset}
            />
          </label>
          {Object.entries(groupedTemplates).map(([category, list]) => (
            <div key={category} className="asset-group">
              <h3>{category}</h3>
              {list.map((template) => (
                <button
                  type="button"
                  key={template.type}
                  className={
                    tool === 'place' && activeTemplateType === template.type ? 'active' : ''
                  }
                  onClick={() => {
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
          ))}
        </aside>

        <main className="scene-wrapper">
          {mode === 'view' && infoAsset && (
            <AssetInfoModal asset={infoAsset} onClose={() => setInfoAssetId(null)} />
          )}

          <Canvas
            shadows
            camera={{ position: CAMERA_PRESETS.perspective.position, fov: 48 }}
          >
            <color attach="background" args={[mode === 'view' ? '#0f1b29' : '#d2dae3']} />
            <fog
              attach="fog"
              args={[mode === 'view' ? '#0f1b29' : '#d2dae3', 55, 145]}
            />
            {mode === 'edit' ? <Lighting /> : <ViewModeOverlay mode="view" />}
            <CameraController preset={cameraPreset} orbitRef={orbitRef} />
            <FactoryFloor onHover={onFloorHover} onAction={onFloorAction} />
            <FactoryWalls />

            {assets.map((asset) => {
              const isOnlySingleEditSelection =
                mode === 'edit' && singleSelected?.id === asset.id
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

            {mode === 'edit' && singleSelected && (
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

            {mode === 'edit' && selectedAssets.length > 1 && (
              <MultiTransformGizmo
                selectedAssets={selectedAssets}
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
              ref={orbitRef}
              makeDefault
              enablePan
              enableZoom
              enableDamping
              dampingFactor={0.08}
              screenSpacePanning
              zoomToCursor
              minDistance={6}
              maxDistance={85}
              minPolarAngle={0.2}
              maxPolarAngle={Math.PI / 2 - 0.03}
            />
          </Canvas>

          {mode === 'edit' && (
            <div className="status-bar">
              <span>STRG/CMD: freie Platzierung und freies Bewegen/Rotieren</span>
              <span>STRG/CMD + Z: Undo | Shift+Z/Y: Redo</span>
              <span>STRG/CMD + C/V: Copy/Paste</span>
              {saveFeedback && <span className="save-feedback">{saveFeedback}</span>}
            </div>
          )}

          {mode === 'view' && (
            <div className="view-hint-bar">
              <span>Praesentationsmodus: Klicke ein Asset fuer Details.</span>
              {saveFeedback && <span className="save-feedback">{saveFeedback}</span>}
            </div>
          )}
        </main>

        <aside className="panel right" aria-hidden={mode === 'view'}>
          <h2>Inspector</h2>
            {singleSelected ? (
              <div className="inspector-content">
                <p className="selected-title">
                  {singleSelected.metadata.name ?? singleSelected.type}
                </p>
                <p className="panel-hint">
                  Form: {singleSelected.geometry.kind} | Kategorie: {singleSelected.category}
                </p>
                <p className="panel-hint">ID: {singleSelected.id.slice(0, 20)}...</p>

                <h3>Position</h3>
                <div className="vector-grid" key={`${singleSelected.id}-pos`}>
                  <NumericInput
                    label="X"
                    value={singleSelected.position[0]}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        position: [value, singleSelected.position[1], singleSelected.position[2]],
                      })
                    }
                  />
                  <NumericInput
                    label="Y"
                    value={singleSelected.position[1]}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        position: [singleSelected.position[0], value, singleSelected.position[2]],
                      })
                    }
                  />
                  <NumericInput
                    label="Z"
                    value={singleSelected.position[2]}
                    onCommit={(value) =>
                      updateAsset(singleSelected.id, {
                        position: [singleSelected.position[0], singleSelected.position[1], value],
                      })
                    }
                  />
                </div>

                <h3>Rotation (Grad)</h3>
                <div className="vector-grid" key={`${singleSelected.id}-rot`}>
                  <NumericInput
                    label="X"
                    value={radToDeg(singleSelected.rotation[0])}
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

                <h3>Skalierung</h3>
                <div className="vector-grid" key={`${singleSelected.id}-scale`}>
                  <NumericInput
                    label="Breite (X)"
                    value={singleSelected.scale[0]}
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

                <ColorInput
                  value={singleSelected.color}
                  onCommit={(nextColor) =>
                    updateAsset(singleSelected.id, { color: sanitizeColor(nextColor) })
                  }
                />

                <h3>Info</h3>
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
                  Mehrfachauswahl kann direkt ueber den Transform-Gizmo bewegt, gedreht und
                  skaliert werden.
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

export { FALLBACK_ASSET_COLOR }
