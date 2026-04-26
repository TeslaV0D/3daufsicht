import { Suspense, useLayoutEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useLoader, type ThreeEvent } from '@react-three/fiber'
import {
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  Vector3,
  type Material,
  type Object3D,
} from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { CATEGORY_ZONES } from '../AssetFactory'
import type { Asset, GeometryParams } from '../types/asset'
import { resolveAssetOpacity } from '../types/asset'
import AssetDecalPlanes from './AssetDecalPlanes'
import BillboardTextLabel from './BillboardTextLabel'

export interface AssetRendererProps {
  asset: Asset
  isSelected: boolean
  isHovered: boolean
  isEditMode: boolean
  /** Kategorie-Akzent bei Auswahl (Outline/Emissive) */
  selectionAccent?: string
  onPointerDown?: (event: ThreeEvent<PointerEvent>, asset: Asset) => void
  onClick?: (event: ThreeEvent<MouseEvent>, asset: Asset) => void
  onContextMenu?: (event: ThreeEvent<MouseEvent>, asset: Asset) => void
  onPointerOver?: (event: ThreeEvent<PointerEvent>, asset: Asset) => void
  onPointerOut?: (event: ThreeEvent<PointerEvent>, asset: Asset) => void
}

const HOVER_SCALE = 1.02
const SELECT_EMISSIVE = '#74c0fc'
const HOVER_EMISSIVE = '#ffd43b'
const EMISSIVE_IDLE_OVERRIDE = new Color(0, 0, 0)

interface GltfMaterialSnapshot {
  baseColor: Color
  baseOpacity: number
  baseTransparent: boolean
  baseEmissive: Color
  baseEmissiveIntensity: number
}

const gltfMaterialSnapshots = new WeakMap<Material, GltfMaterialSnapshot>()

function snapshotGltfMaterial(material: Material): GltfMaterialSnapshot | null {
  if (!('color' in material)) return null
  const m = material as Material & {
    color: Color
    opacity: number
    transparent: boolean
    emissive: Color
    emissiveIntensity: number
  }
  if (!m.color) return null
  return {
    baseColor: m.color.clone(),
    baseOpacity: 'opacity' in m && typeof m.opacity === 'number' ? m.opacity : 1,
    baseTransparent: 'transparent' in m && typeof m.transparent === 'boolean' ? m.transparent : false,
    baseEmissive: 'emissive' in m && m.emissive ? m.emissive.clone() : new Color(0, 0, 0),
    baseEmissiveIntensity:
      'emissiveIntensity' in m && typeof m.emissiveIntensity === 'number' ? m.emissiveIntensity : 0,
  }
}

function cloneMaterialsDeep(root: Object3D) {
  root.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh || !mesh.material) return
    const cloneOne = (mat: Material) => {
      const c = mat.clone()
      const snap = snapshotGltfMaterial(c)
      if (snap) gltfMaterialSnapshots.set(c, snap)
      return c
    }
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(cloneOne)
    } else {
      mesh.material = cloneOne(mesh.material)
    }
  })
}

function applyGltfMaterialState(
  root: Object3D,
  asset: Asset,
  isSelected: boolean,
  isHovered: boolean,
) {
  const mode = asset.materialMode ?? 'original'
  const overrideColor = asset.color
  const opacity = resolveAssetOpacity(asset)
  const transparentExtra = asset.visual?.transparent ?? false
  const locked = asset.isLocked === true

  root.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh || !mesh.material) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      const snap = gltfMaterialSnapshots.get(mat)
      if (!snap || !('color' in mat)) continue
      const m = mat as Material & {
        color: Color
        opacity: number
        transparent: boolean
        emissive: Color
        emissiveIntensity: number
        needsUpdate: boolean
      }

      let nextOpacity: number
      if (mode === 'override') {
        m.color.set(overrideColor)
        nextOpacity = opacity
        m.transparent = nextOpacity < 1 || transparentExtra
      } else {
        m.color.copy(snap.baseColor)
        nextOpacity = snap.baseOpacity * opacity
        m.transparent = nextOpacity < 1 || snap.baseTransparent || transparentExtra
      }
      m.opacity = nextOpacity

      if (locked) {
        m.color.multiplyScalar(1.18)
        m.opacity *= 0.97
      }

      const idleEmissive = mode === 'override' ? EMISSIVE_IDLE_OVERRIDE : snap.baseEmissive
      const idleIntensity = mode === 'override' ? 0 : snap.baseEmissiveIntensity

      if ('emissive' in m && m.emissive) {
        if (isSelected) {
          m.emissive.set(SELECT_EMISSIVE)
          m.emissiveIntensity = locked ? 0.2 : 0.32
        } else if (isHovered) {
          m.emissive.set(HOVER_EMISSIVE)
          m.emissiveIntensity = locked ? 0.12 : 0.18
        } else if (locked) {
          m.emissive.copy(m.color).multiplyScalar(0.4)
          m.emissiveIntensity = 0.26
        } else {
          m.emissive.copy(idleEmissive)
          m.emissiveIntensity = idleIntensity
        }
      }

      m.needsUpdate = true
    }
  })
}

interface MaterialConfig {
  color: string
  opacity: number
  transparent: boolean
  emissive: string
  emissiveIntensity: number
  doubleSided: boolean
  wireframe: boolean
  roughness: number
  metalness: number
}

function buildMaterialConfig(
  asset: Asset,
  isSelected: boolean,
  isHovered: boolean,
  ghost: boolean,
  selectionAccent?: string,
  ghostOpacityMul = 1,
): MaterialConfig {
  const baseOpacity = resolveAssetOpacity(asset)
  const explicitTransparent = asset.visual?.transparent ?? baseOpacity < 1
  const locked = asset.isLocked === true && !ghost
  let surfaceColor = asset.color
  if (ghost) {
    const c = new Color(asset.color)
    c.multiplyScalar(0.88)
    surfaceColor = `#${c.getHexString()}`
  } else if (locked && !isSelected && !isHovered) {
    const c = new Color(surfaceColor)
    c.multiplyScalar(1.22)
    surfaceColor = `#${c.getHexString()}`
  }
  const emissive = ghost
    ? asset.color
    : isSelected
      ? selectionAccent ?? SELECT_EMISSIVE
      : isHovered
        ? HOVER_EMISSIVE
        : locked
          ? asset.color
          : (asset.visual?.emissive ?? '#000000')
  const emissiveIntensity = ghost
    ? 0.42 * ghostOpacityMul
    : isSelected
      ? locked
        ? 0.2
        : 0.3
      : isHovered
        ? locked
          ? 0.12
          : 0.18
        : locked
          ? 0.22
          : 0
  return {
    color: surfaceColor,
    opacity: ghost ? Math.min(1, 0.74 * ghostOpacityMul) : baseOpacity,
    transparent: ghost ? true : explicitTransparent,
    emissive,
    emissiveIntensity,
    doubleSided: asset.visual?.doubleSided ?? false,
    wireframe: asset.visual?.wireframe ?? false,
    roughness: ghost ? 0.42 : 0.62,
    metalness: ghost ? 0.12 : 0.18,
  }
}

function UploadedModel({
  url,
  targetScale,
  asset,
  isSelected,
  isHovered,
}: {
  url: string
  targetScale: [number, number, number]
  asset: Asset
  isSelected: boolean
  isHovered: boolean
}) {
  const gltf = useGLTF(url) as { scene: Group }
  const normalized = useMemo(() => {
    const cloned = gltf.scene.clone(true)
    cloneMaterialsDeep(cloned)
    const box = new Box3().setFromObject(cloned)
    const size = new Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    const targetMax = Math.max(targetScale[0], targetScale[1], targetScale[2], 0.001)
    const scale = targetMax / maxDim
    cloned.scale.setScalar(scale)

    const centeredBox = new Box3().setFromObject(cloned)
    const center = new Vector3()
    centeredBox.getCenter(center)
    cloned.position.sub(center)
    const floorBox = new Box3().setFromObject(cloned)
    cloned.position.y -= floorBox.min.y

    cloned.traverse((child: Object3D) => {
      const mesh = child as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    return cloned
  }, [gltf.scene, targetScale])

  useLayoutEffect(() => {
    applyGltfMaterialState(normalized, asset, isSelected, isHovered)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volles `asset` würde bei jedem Transform traversieren
  }, [
    normalized,
    asset.materialMode,
    asset.color,
    asset.opacity,
    asset.visual?.opacity,
    asset.visual?.transparent,
    asset.isLocked,
    isSelected,
    isHovered,
  ])

  return <primitive object={normalized} />
}

function STLModel({
  url,
  targetScale,
  material,
  flatShading,
}: {
  url: string
  targetScale: [number, number, number]
  material: MaterialConfig
  flatShading: boolean
}) {
  const rawGeometry = useLoader(STLLoader, url) as BufferGeometry

  const geometry = useMemo(() => {
    const cloned = rawGeometry.clone()
    if (flatShading) {
      cloned.computeVertexNormals()
    } else {
      if (!cloned.getAttribute('normal')) {
        cloned.computeVertexNormals()
      }
    }
    cloned.computeBoundingBox()
    const size = new Vector3()
    cloned.boundingBox?.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    const targetMax = Math.max(targetScale[0], targetScale[1], targetScale[2], 0.001)
    const normalizedScale = targetMax / maxDim
    cloned.center()
    cloned.scale(normalizedScale, normalizedScale, normalizedScale)
    cloned.computeBoundingBox()
    const halfHeight = (cloned.boundingBox?.max.y ?? 0) - (cloned.boundingBox?.min.y ?? 0)
    cloned.translate(0, (halfHeight / 2) - (cloned.boundingBox?.max.y ?? 0), 0)
    return cloned
  }, [rawGeometry, flatShading, targetScale])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={material.color}
        opacity={material.opacity}
        transparent={material.transparent}
        emissive={material.emissive}
        emissiveIntensity={material.emissiveIntensity}
        wireframe={material.wireframe}
        roughness={material.roughness}
        metalness={material.metalness}
        flatShading={flatShading}
        side={material.doubleSided ? DoubleSide : undefined}
      />
    </mesh>
  )
}

function NormalizedObjectRoot({
  root,
  targetScale,
}: {
  root: Object3D
  targetScale: [number, number, number]
}) {
  const normalized = useMemo(() => {
    const obj = root.clone(true)
    obj.traverse((child) => {
      const m = child as Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
    obj.updateMatrixWorld(true)
    const box = new Box3().setFromObject(obj)
    const size = new Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    const targetMax = Math.max(targetScale[0], targetScale[1], targetScale[2], 0.001)
    const s = targetMax / maxDim
    obj.scale.setScalar(s)
    obj.updateMatrixWorld(true)
    const box2 = new Box3().setFromObject(obj)
    const center = new Vector3()
    box2.getCenter(center)
    obj.position.sub(center)
    obj.updateMatrixWorld(true)
    const box3 = new Box3().setFromObject(obj)
    obj.position.y -= box3.min.y
    return obj
  }, [root, targetScale])
  return <primitive object={normalized} />
}

function ObjSceneModel({
  url,
  targetScale,
}: {
  url: string
  targetScale: [number, number, number]
}) {
  const root = useLoader(OBJLoader, url) as Group
  return <NormalizedObjectRoot root={root} targetScale={targetScale} />
}

function FbxSceneModel({
  url,
  targetScale,
}: {
  url: string
  targetScale: [number, number, number]
}) {
  const root = useLoader(FBXLoader, url) as Group
  return <NormalizedObjectRoot root={root} targetScale={targetScale} />
}

function GeometryMesh({
  asset,
  material,
  isSelected,
  isHovered,
}: {
  asset: Asset
  material: MaterialConfig
  isSelected: boolean
  isHovered: boolean
}) {
  const params: GeometryParams = asset.geometry.params ?? {}
  const side = material.doubleSided ? DoubleSide : undefined

  const stdMaterial = (
    <meshStandardMaterial
      color={material.color}
      opacity={material.opacity}
      transparent={material.transparent}
      emissive={material.emissive}
      emissiveIntensity={material.emissiveIntensity}
      wireframe={material.wireframe}
      roughness={material.roughness}
      metalness={material.metalness}
      side={side}
    />
  )

  switch (asset.geometry.kind) {
    case 'sphere':
      return (
        <mesh castShadow receiveShadow>
          <sphereGeometry
            args={[
              params.radius ?? 0.5,
              params.segments ?? 32,
              params.heightSegments ?? 24,
            ]}
          />
          {stdMaterial}
        </mesh>
      )
    case 'cylinder':
      return (
        <mesh castShadow receiveShadow>
          <cylinderGeometry
            args={[
              params.radiusTop ?? 0.5,
              params.radiusBottom ?? 0.5,
              params.height ?? 1,
              params.radialSegments ?? 24,
            ]}
          />
          {stdMaterial}
        </mesh>
      )
    case 'cone':
      return (
        <mesh castShadow receiveShadow>
          <coneGeometry
            args={[params.radius ?? 0.5, params.height ?? 1, params.radialSegments ?? 24]}
          />
          {stdMaterial}
        </mesh>
      )
    case 'torus':
      return (
        <mesh castShadow receiveShadow>
          <torusGeometry
            args={[
              params.radius ?? 0.5,
              params.tube ?? 0.15,
              params.radialSegments ?? 16,
              params.tubularSegments ?? 48,
            ]}
          />
          {stdMaterial}
        </mesh>
      )
    case 'plane':
      return (
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[params.width ?? 1, params.height ?? 1]} />
          {stdMaterial}
        </mesh>
      )
    case 'circle':
      return (
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[params.radius ?? 0.5, params.segments ?? 48]} />
          {stdMaterial}
        </mesh>
      )
    case 'ring':
      return (
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry
            args={[
              params.innerRadius ?? 0.35,
              params.outerRadius ?? 0.5,
              params.segments ?? 48,
            ]}
          />
          {stdMaterial}
        </mesh>
      )
    case 'text': {
      const labelText = asset.metadata.text ?? params.text ?? 'Label'
      const ls = params.labelStyle
      if (!ls) {
        return (
          <mesh>
            <boxGeometry args={[0.01, 0.01, 0.01]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        )
      }
      return (
        <BillboardTextLabel
          text={labelText}
          fontSizeWorld={params.fontSize ?? 0.5}
          labelStyle={ls}
        />
      )
    }
    case 'custom': {
      const modelUrl = params.modelUrl
      const modelFormat = params.modelFormat ?? 'glb'
      if (!modelUrl) {
        return (
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            {stdMaterial}
          </mesh>
        )
      }
      const fallback = (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          {stdMaterial}
        </mesh>
      )
      if (modelFormat === 'stl') {
        return (
          <Suspense fallback={fallback}>
            <STLModel
              url={modelUrl}
              targetScale={asset.scale}
              material={material}
              flatShading={asset.visual?.flatShading ?? true}
            />
          </Suspense>
        )
      }
      if (modelFormat === 'obj') {
        return (
          <Suspense fallback={fallback}>
            <ObjSceneModel url={modelUrl} targetScale={asset.scale} />
          </Suspense>
        )
      }
      if (modelFormat === 'fbx') {
        return (
          <Suspense fallback={fallback}>
            <FbxSceneModel url={modelUrl} targetScale={asset.scale} />
          </Suspense>
        )
      }
      return (
        <Suspense fallback={fallback}>
          <UploadedModel
            url={modelUrl}
            targetScale={asset.scale}
            asset={asset}
            isSelected={isSelected}
            isHovered={isHovered}
          />
        </Suspense>
      )
    }
    case 'box':
    default:
      return (
        <mesh castShadow receiveShadow>
          <boxGeometry
            args={[params.width ?? 1, params.height ?? 1, params.depth ?? 1]}
          />
          {stdMaterial}
        </mesh>
      )
  }
}

export interface AssetBodyProps {
  asset: Asset
  isSelected: boolean
  isHovered: boolean
  isEditMode: boolean
  selectionAccent?: string
}

export function AssetBody({
  asset,
  isSelected,
  isHovered,
  isEditMode,
  selectionAccent,
}: AssetBodyProps) {
  const accent = selectionAccent ?? SELECT_EMISSIVE
  const material = buildMaterialConfig(asset, isSelected, isHovered, false, selectionAccent)
  const showWireOutline =
    isSelected && asset.geometry.kind === 'custom' && asset.geometry.params.modelUrl

  return (
    <group>
      <GeometryMesh
        asset={asset}
        material={material}
        isSelected={isSelected}
        isHovered={isHovered}
      />
      <AssetDecalPlanes asset={asset} />
      {showWireOutline && (
        <mesh>
          <boxGeometry args={[1.02, 1.02, 1.02]} />
          <meshStandardMaterial
            color={accent}
            wireframe
            transparent
            opacity={0.6}
            emissive={accent}
            emissiveIntensity={0.35}
          />
        </mesh>
      )}
      {isEditMode && isHovered && !isSelected && asset.geometry.kind !== 'custom' && (
        <HoverOutline asset={asset} />
      )}
    </group>
  )
}

export default function AssetRenderer({
  asset,
  isSelected,
  isHovered,
  isEditMode,
  selectionAccent,
  onPointerDown,
  onClick,
  onContextMenu,
  onPointerOver,
  onPointerOut,
  skipTransform = false,
}: AssetRendererProps & { skipTransform?: boolean }) {
  const hoverScale = (asset.visual?.hoverEffect !== false) && isHovered ? HOVER_SCALE : 1
  const finalScale: [number, number, number] = [
    asset.scale[0] * hoverScale,
    asset.scale[1] * hoverScale,
    asset.scale[2] * hoverScale,
  ]

  const zoneUserData = useMemo(
    () => ({ isZone: asset.category === CATEGORY_ZONES }),
    [asset.category],
  )

  const eventProps = {
    onClick: (event: ThreeEvent<MouseEvent>) => onClick?.(event, asset),
    onContextMenu: (event: ThreeEvent<MouseEvent>) => onContextMenu?.(event, asset),
    onPointerDown: (event: ThreeEvent<PointerEvent>) => onPointerDown?.(event, asset),
    onPointerEnter: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      onPointerOver?.(event, asset)
    },
    onPointerLeave: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      onPointerOut?.(event, asset)
    },
  }

  if (skipTransform) {
    return (
      <group userData={zoneUserData} {...eventProps}>
        <AssetBody
          asset={asset}
          isSelected={isSelected}
          isHovered={isHovered}
          isEditMode={isEditMode}
          selectionAccent={selectionAccent}
        />
      </group>
    )
  }

  return (
    <group
      userData={zoneUserData}
      position={asset.position}
      rotation={asset.rotation}
      scale={finalScale}
      {...eventProps}
    >
      <AssetBody
        asset={asset}
        isSelected={isSelected}
        isHovered={isHovered}
        isEditMode={isEditMode}
        selectionAccent={selectionAccent}
      />
    </group>
  )
}

function HoverOutline({ asset }: { asset: Asset }) {
  const params: GeometryParams = asset.geometry.params ?? {}
  const outlineColor = HOVER_EMISSIVE
  const outlineOpacity = 0.35

  const material = (
    <meshBasicMaterial
      color={outlineColor}
      transparent
      opacity={outlineOpacity}
      wireframe
    />
  )

  switch (asset.geometry.kind) {
    case 'sphere':
      return (
        <mesh scale={[1.03, 1.03, 1.03]}>
          <sphereGeometry
            args={[params.radius ?? 0.5, 24, 16]}
          />
          {material}
        </mesh>
      )
    case 'cylinder':
    case 'cone':
    case 'torus':
    case 'plane':
    case 'circle':
    case 'ring':
      return null
    case 'box':
    default:
      return (
        <mesh scale={[1.03, 1.03, 1.03]}>
          <boxGeometry
            args={[params.width ?? 1, params.height ?? 1, params.depth ?? 1]}
          />
          {material}
        </mesh>
      )
  }
}

export function GhostAssetRenderer({
  asset,
  opacityMultiplier = 1,
}: {
  asset: Asset
  /** Zusätzliche Transparenz für Multi-Preview (0–1 skaliert die Ghost-Deckkraft). */
  opacityMultiplier?: number
}) {
  const material = buildMaterialConfig(
    asset,
    false,
    false,
    true,
    undefined,
    opacityMultiplier,
  )
  return (
    <group position={asset.position} rotation={asset.rotation} scale={asset.scale}>
      <GeometryMesh
        asset={asset}
        material={material}
        isSelected={false}
        isHovered={false}
      />
      <AssetDecalPlanes asset={asset} />
    </group>
  )
}
