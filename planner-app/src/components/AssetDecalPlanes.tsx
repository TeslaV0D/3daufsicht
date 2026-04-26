import { Suspense } from 'react'
import { useLoader } from '@react-three/fiber'
import { DoubleSide, TextureLoader } from 'three'
import type { Asset } from '../types/asset'
import type { AssetDecal } from '../types/asset'
import { faceSpecs, type FaceKey } from '../scene/decalFaceSpec'
import { getDecalBounds } from '../scene/assetDecalBounds'
import { GifDecalFaceMesh } from './GifDecalFaceMesh'

function DecalFaceMeshStatic({
  decal,
  spec,
}: {
  decal: AssetDecal
  spec: import('../scene/decalFaceSpec').FaceSpec
}) {
  const texture = useLoader(TextureLoader, decal.imageUrl)

  const w = Math.max(0.02, spec.width * decal.size)
  const h = Math.max(0.02, spec.height * decal.size)
  const ox = decal.offsetX * spec.width
  const oy = decal.offsetY * spec.height
  const px =
    spec.position[0] + spec.offsetAxisX[0] * ox + spec.offsetAxisY[0] * oy
  const py =
    spec.position[1] + spec.offsetAxisX[1] * ox + spec.offsetAxisY[1] * oy
  const pz =
    spec.position[2] + spec.offsetAxisX[2] * ox + spec.offsetAxisY[2] * oy

  const rotZ = (decal.rotation * Math.PI) / 180

  return (
    <mesh
      position={[px, py, pz]}
      rotation={[spec.rotation[0], spec.rotation[1], spec.rotation[2] + rotZ]}
    >
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

function DecalFaceMesh({
  decal,
  spec,
}: {
  decal: AssetDecal
  spec: import('../scene/decalFaceSpec').FaceSpec
}) {
  const isGif =
    decal.mediaKind === 'gif' ||
    decal.imageUrl.startsWith('data:image/gif') ||
    /\.gif$/i.test(decal.imageName)
  if (isGif) {
    return <GifDecalFaceMesh decal={{ ...decal, mediaKind: 'gif' }} spec={spec} />
  }
  return <DecalFaceMeshStatic decal={decal} spec={spec} />
}

function DecalItem({ decal, bounds }: { decal: AssetDecal; bounds: NonNullable<ReturnType<typeof getDecalBounds>> }) {
  const specs = faceSpecs(bounds)
  const faces: FaceKey[] =
    decal.side === 'all'
      ? ['top', 'bottom', 'front', 'back', 'left', 'right']
      : [decal.side]

  const opacityMul = decal.side === 'all' ? 0.92 : 1

  return (
    <>
      {faces.map((fk) => (
        <Suspense key={`${decal.id}-${fk}`} fallback={null}>
          <DecalFaceMesh
            decal={{
              ...decal,
              opacity: Math.min(1, decal.opacity * opacityMul),
            }}
            spec={specs[fk]}
          />
        </Suspense>
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
        <DecalItem key={d.id} decal={d} bounds={bounds} />
      ))}
    </group>
  )
}
