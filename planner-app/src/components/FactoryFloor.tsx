import { Grid } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { Vector3Tuple } from 'three'
import type { FloorSettings } from '../types/floor'

interface FactoryFloorProps {
  floor: FloorSettings
  /** Presentation mode: never show grid (per UX spec). */
  isPresentation: boolean
  /** When true, hover/click are handled by ScenePlacementRaycast instead. */
  deferPointerToSceneRaycast: boolean
  onHover: (point: Vector3Tuple) => void
  onAction: (point: Vector3Tuple) => void
}

export default function FactoryFloor({
  floor,
  isPresentation,
  deferPointerToSceneRaycast,
  onHover,
  onAction,
}: FactoryFloorProps) {
  const showGrid = !isPresentation && floor.gridVisible
  const section = Math.max(floor.gridSize * 5, floor.gridSize + 0.01)

  const meshHandlers = deferPointerToSceneRaycast
    ? {}
    : {
        onPointerMove: (event: ThreeEvent<PointerEvent>) => {
          const point = event.point
          onHover([point.x, point.y, point.z])
        },
        /** pointerdown (not click): avoids deselect on mouseup after the picked mesh unmounts (e.g. instancing → gizmo path). */
        onPointerDown: (event: ThreeEvent<PointerEvent>) => {
          if (event.button !== 0) return
          event.stopPropagation()
          const point = event.point
          onAction([point.x, point.y, point.z])
        },
      }

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        userData={{ isFactoryFloor: true }}
        {...meshHandlers}
        onContextMenu={(e: ThreeEvent<MouseEvent>) => {
          e.nativeEvent.preventDefault()
        }}
      >
        <planeGeometry args={[floor.size, floor.size]} />
        <meshStandardMaterial color={floor.color} roughness={0.9} metalness={0.1} />
      </mesh>

      {showGrid && (
        <Grid
          position={[0, 0.02, 0]}
          args={[floor.size, floor.size]}
          cellColor={floor.gridColor}
          sectionColor={floor.gridColor}
          cellSize={floor.gridSize}
          sectionSize={section}
          fadeDistance={Math.max(floor.size * 0.75, 40)}
          fadeStrength={1.2}
        />
      )}
    </>
  )
}
