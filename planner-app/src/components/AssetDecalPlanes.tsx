import { Suspense } from 'react'
import { useLoader } from '@react-three/fiber'
import { DoubleSide, TextureLoader } from 'three'
import { getDecalBounds, type DecalBounds } from '../scene/assetDecalBounds'
import type { Asset } from '../types/asset'
import type { AssetDecal, AssetDecalSide } from '../types/asset'

const EPS = 0.004

type FaceKey = Exclude<AssetDecalSide, 'all'>

interface FaceSpec {
  key: FaceKey
  position: [number, number, number]
  rotation: [number, number, number]
  width: number
  height: number
  offsetAxisX: [number, number, number]
  offsetAxisY: [number, number, number]
}

function faceSpecs(b: DecalBounds): Record<FaceKey, FaceSpec> {
  const { hx, hy, hz } = b
  return {
    top: {
      key: 'top',
      position: [0, hy + EPS, 0],
      rotation: [-Math.PI / 2, 0, 0],
      width: 2 * hx,
      height: 2 * hz,
      offsetAxisX: [1, 0, 0],
      offsetAxisY: [0, 0, 1],
    },
    bottom: {
      key: 'bottom',
      position: [0, -hy - EPS, 0],
      rotation: [Math.PI / 2, 0, 0],
      width: 2 * hx,
      height: 2 * hz,
      offsetAxisX: [1, 0, 0],
      offsetAxisY: [0, 0, -1],
    },
    front: {
      key: 'front',
      position: [0, 0, hz + EPS],
      rotation: [0, 0, 0],
      width: 2 * hx,
      height: 2 * hy,
      offsetAxisX: [1, 0, 0],
      offsetAxisY: [0, 1, 0],
    },
    back: {
      key: 'back',
      position: [0, 0, -hz - EPS],
      rotation: [0, Math.PI, 0],
      width: 2 * hx,
      height: 2 * hy,
      offsetAxisX: [-1, 0, 0],
      offsetAxisY: [0, 1, 0],
    },
    right: {
      key: 'right',
      position: [hx + EPS, 0, 0],
      rotation: [0, Math.PI / 2, 0],
      width: 2 * hz,
      height: 2 * hy,
      offsetAxisX: [0, 0, -1],
      offsetAxisY: [0, 1, 0],
    },
    left: {
      key: 'left',
      position: [-hx - EPS, 0, 0],
      rotation: [0, -Math.PI / 2, 0],
      width: 2 * hz,
      height: 2 * hy,
      offsetAxisX: [0, 0, 1],
      offsetAxisY: [0, 1, 0],
    },
  }
}

function DecalFaceMesh({
  decal,
  spec,
}: {
  decal: AssetDecal
  spec: FaceSpec
}) {
  const texture = useLoader(TextureLoader, decal.imageUrl)

  const w = Math.max(0.02, spec.width * decal.size)
  const h = Math.max(0.02, spec.height * decal.size)
  const ox = decal.offsetX * spec.width
  const oy = decal.offsetY * spec.height
  const px =
    spec.position[0] +
    spec.offsetAxisX[0] * ox +
    spec.offsetAxisY[0] * oy
  const py =
    spec.position[1] +
    spec.offsetAxisX[1] * ox +
    spec.offsetAxisY[1] * oy
  const pz =
    spec.position[2] +
    spec.offsetAxisX[2] * ox +
    spec.offsetAxisY[2] * oy

  const rotZ = (decal.rotation * Math.PI) / 180

  return (
    <mesh position={[px, py, pz]} rotation={[spec.rotation[0], spec.rotation[1], spec.rotation[2] + rotZ]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={decal.opacity}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
        side={DoubleSide}
      />
    </mesh>
  )
}

function DecalItem({ decal, bounds }: { decal: AssetDecal; bounds: DecalBounds }) {
  const specs = faceSpecs(bounds)
  const faces: FaceKey[] =
    decal.side === 'all'
      ? ['top', 'bottom', 'front', 'back', 'left', 'right']
      : [decal.side]

  const opacityMul = decal.side === 'all' ? 0.92 : 1

  return (
    <>
      {faces.map((fk) => (
        <DecalFaceMesh
          key={`${decal.id}-${fk}`}
          decal={{
            ...decal,
            opacity: Math.min(1, decal.opacity * opacityMul),
          }}
          spec={specs[fk]}
        />
      ))}
    </>
  )
}

export default function AssetDecalPlanes({ asset }: { asset: Asset }) {
  const decals = asset.visual?.decals
  if (!decals?.length) return null
  const bounds = getDecalBounds(asset)
  if (!bounds) return null

  return (
    <group>
      {decals.map((d) => (
        <Suspense key={d.id} fallback={null}>
          <DecalItem decal={d} bounds={bounds} />
        </Suspense>
      ))}
    </group>
  )
}
