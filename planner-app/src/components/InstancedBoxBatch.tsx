import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BoxGeometry,
  Color,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three'
import type { Asset } from '../types/asset'

const m4 = new Matrix4()
const pos = new Vector3()
const quat = new Quaternion()
const scl = new Vector3()
const eul = new Euler()
const col = new Color()

/**
 * Ein InstancedMesh für mehrere gleiche Box-Geometrien (gleiche Abmessungen).
 * Reduziert Draw-Calls bei vielen gleichartigen Assets.
 */
export default function InstancedBoxBatch({
  assets,
  width,
  height,
  depth,
  distanceCullEnabled,
  distanceCullMeters,
  onInstanceInteract,
}: {
  assets: Asset[]
  width: number
  height: number
  depth: number
  /** Pro-Instanz: zu weit von der Kamera → Matrix auf ~0 skaliert (nur Rendering). */
  distanceCullEnabled?: boolean
  distanceCullMeters?: number
  onInstanceInteract?: (assetId: string, event: ThreeEvent<PointerEvent>) => void
}) {
  const meshRef = useRef<InstancedMesh>(null!)
  const camera = useThree((s) => s.camera)
  const count = assets.length
  const cullR2 =
    distanceCullEnabled && (distanceCullMeters ?? 0) > 0
      ? (distanceCullMeters as number) * (distanceCullMeters as number)
      : 0

  const geometry = useMemo(
    () => new BoxGeometry(width, height, depth),
    [width, height, depth],
  )

  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        roughness: 0.62,
        metalness: 0.18,
      }),
    [],
  )

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || count === 0) return
    const camPos = camera.position
    for (let i = 0; i < count; i++) {
      const a = assets[i]!
      pos.set(a.position[0], a.position[1], a.position[2])
      if (cullR2 > 0) {
        const dx = pos.x - camPos.x
        const dy = pos.y - camPos.y
        const dz = pos.z - camPos.z
        if (dx * dx + dy * dy + dz * dz > cullR2) {
          m4.makeScale(0.00001, 0.00001, 0.00001)
          mesh.setMatrixAt(i, m4)
          continue
        }
      }
      eul.set(a.rotation[0], a.rotation[1], a.rotation[2], 'XYZ')
      quat.setFromEuler(eul)
      scl.set(a.scale[0], a.scale[1], a.scale[2])
      m4.compose(pos, quat, scl)
      mesh.setMatrixAt(i, m4)
      col.set(a.color)
      mesh.setColorAt(i, col)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  if (count === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      castShadow
      receiveShadow
      onPointerDown={(e) => {
        if (!onInstanceInteract) return
        if (e.button !== 0) return
        const hit = e.intersections[0]
        const inst =
          hit && typeof hit.instanceId === 'number' ? hit.instanceId : undefined
        if (inst == null || inst < 0 || inst >= assets.length) return
        e.stopPropagation()
        onInstanceInteract(assets[inst]!.id, e)
      }}
    />
  )
}
