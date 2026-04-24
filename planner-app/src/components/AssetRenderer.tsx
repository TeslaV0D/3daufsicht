import { Suspense, useMemo } from 'react'
import { Text, useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import {
  Box3,
  DoubleSide,
  Group,
  Mesh,
  Vector3,
  type Object3D,
} from 'three'
import type { Asset, GeometryParams } from '../types/asset'

export interface AssetRendererProps {
  asset: Asset
  isSelected: boolean
  isHovered: boolean
  isEditMode: boolean
  onPointerDown?: (event: ThreeEvent<PointerEvent>, asset: Asset) => void
  onClick?: (event: ThreeEvent<MouseEvent>, asset: Asset) => void
  onPointerOver?: (event: ThreeEvent<PointerEvent>, asset: Asset) => void
  onPointerOut?: (event: ThreeEvent<PointerEvent>, asset: Asset) => void
}

const HOVER_SCALE = 1.02
const SELECT_EMISSIVE = '#74c0fc'
const HOVER_EMISSIVE = '#ffd43b'

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
): MaterialConfig {
  const baseOpacity = asset.visual?.opacity ?? 1
  const explicitTransparent = asset.visual?.transparent ?? baseOpacity < 1
  const emissive = isSelected
    ? SELECT_EMISSIVE
    : isHovered
      ? HOVER_EMISSIVE
      : asset.visual?.emissive ?? '#000000'
  const emissiveIntensity = ghost ? 0.22 : isSelected ? 0.3 : isHovered ? 0.18 : 0
  return {
    color: ghost ? '#7ce9a4' : asset.color,
    opacity: ghost ? 0.45 : baseOpacity,
    transparent: ghost ? true : explicitTransparent,
    emissive,
    emissiveIntensity,
    doubleSided: asset.visual?.doubleSided ?? false,
    wireframe: asset.visual?.wireframe ?? false,
    roughness: ghost ? 0.35 : 0.62,
    metalness: ghost ? 0.06 : 0.18,
  }
}

function UploadedModel({ url, targetScale }: { url: string; targetScale: [number, number, number] }) {
  const gltf = useGLTF(url) as { scene: Group }
  const normalized = useMemo(() => {
    const cloned = gltf.scene.clone(true)
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

  return <primitive object={normalized} />
}

function GeometryMesh({
  asset,
  material,
}: {
  asset: Asset
  material: MaterialConfig
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
      return (
        <Text
          fontSize={params.fontSize ?? 0.5}
          color={material.color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#0b1220"
        >
          {labelText}
        </Text>
      )
    }
    case 'custom': {
      const modelUrl = params.modelUrl
      if (!modelUrl) {
        return (
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            {stdMaterial}
          </mesh>
        )
      }
      return (
        <Suspense
          fallback={
            <mesh castShadow receiveShadow>
              <boxGeometry args={[1, 1, 1]} />
              {stdMaterial}
            </mesh>
          }
        >
          <UploadedModel url={modelUrl} targetScale={asset.scale} />
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
}

export function AssetBody({ asset, isSelected, isHovered, isEditMode }: AssetBodyProps) {
  const material = buildMaterialConfig(asset, isSelected, isHovered, false)
  const showWireOutline =
    isSelected && asset.geometry.kind === 'custom' && asset.geometry.params.modelUrl

  return (
    <group>
      <GeometryMesh asset={asset} material={material} />
      {showWireOutline && (
        <mesh>
          <boxGeometry args={[1.02, 1.02, 1.02]} />
          <meshStandardMaterial
            color={SELECT_EMISSIVE}
            wireframe
            transparent
            opacity={0.6}
            emissive={SELECT_EMISSIVE}
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
  onPointerDown,
  onClick,
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

  const eventProps = {
    onClick: (event: ThreeEvent<MouseEvent>) => onClick?.(event, asset),
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
      <group {...eventProps}>
        <AssetBody
          asset={asset}
          isSelected={isSelected}
          isHovered={isHovered}
          isEditMode={isEditMode}
        />
      </group>
    )
  }

  return (
    <group
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

export function GhostAssetRenderer({ asset }: { asset: Asset }) {
  const material = buildMaterialConfig(asset, false, false, true)
  return (
    <group position={asset.position} rotation={asset.rotation} scale={asset.scale}>
      <GeometryMesh asset={asset} material={material} />
    </group>
  )
}
