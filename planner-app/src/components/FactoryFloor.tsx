import { Grid } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { Vector3Tuple } from 'three'

interface FactoryFloorProps {
  onHover: (point: Vector3Tuple) => void
  onAction: (point: Vector3Tuple) => void
}

export default function FactoryFloor({ onHover, onAction }: FactoryFloorProps) {
  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          const point = event.point
          onHover([point.x, point.y, point.z])
        }}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation()
          const point = event.point
          onAction([point.x, point.y, point.z])
        }}
      >
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#e5e5e5" roughness={0.9} metalness={0.1} />
      </mesh>

      <Grid
        position={[0, 0.02, 0]}
        args={[120, 120]}
        cellColor="#94a3b8"
        sectionColor="#64748b"
        cellSize={1}
        sectionSize={5}
        fadeDistance={90}
        fadeStrength={1.2}
      />
    </>
  )
}
