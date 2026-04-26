import { useFrame, useThree } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import type { Group } from 'three'
import type { Vector3Tuple } from 'three'

/** Blendet Kinder aus, wenn die Position weiter als maxMeters von der Kamera entfernt ist. */
export default function DistanceCullWrap({
  enabled,
  maxMeters,
  center,
  children,
}: {
  enabled: boolean
  maxMeters: number
  center: Vector3Tuple
  children?: ReactNode
}) {
  const ref = useRef<Group>(null)
  const { camera } = useThree()

  useFrame(() => {
    const g = ref.current
    if (!g) return
    if (!enabled) {
      g.visible = true
      return
    }
    const dx = center[0] - camera.position.x
    const dy = center[1] - camera.position.y
    const dz = center[2] - camera.position.z
    const d2 = dx * dx + dy * dy + dz * dz
    const r = maxMeters
    g.visible = d2 <= r * r
  })

  return <group ref={ref}>{children}</group>
}
