import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Raycaster, Vector2 } from 'three'
import type { Vector3Tuple } from 'three'
import { isZoneObject3D } from '../scene/isZoneObject'

interface ScenePlacementRaycastProps {
  active: boolean
  onHover: (point: Vector3Tuple) => void
  onPlace: (point: Vector3Tuple) => void
}

/**
 * Placement hover/click with zone meshes filtered out so the ray hits the floor
 * (or non-zone geometry) beneath zones.
 */
export default function ScenePlacementRaycast({
  active,
  onHover,
  onPlace,
}: ScenePlacementRaycastProps) {
  const { camera, scene, gl } = useThree()
  const raycaster = useRef(new Raycaster())
  const pointer = useRef(new Vector2())
  const onHoverRef = useRef(onHover)
  const onPlaceRef = useRef(onPlace)

  useEffect(() => {
    onHoverRef.current = onHover
    onPlaceRef.current = onPlace
  }, [onHover, onPlace])

  useEffect(() => {
    if (!active) return
    const canvas = gl.domElement

    const pickFiltered = (excludeZones: boolean) => {
      raycaster.current.setFromCamera(pointer.current, camera)
      const hits = raycaster.current.intersectObjects(scene.children, true)
      const list = excludeZones ? hits.filter((h) => !isZoneObject3D(h.object)) : hits
      return list[0]?.point ?? null
    }

    const setPointer = (e: { clientX: number; clientY: number }) => {
      const r = canvas.getBoundingClientRect()
      pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1
      pointer.current.y = -((e.clientY - r.top) / r.height) * 2 + 1
    }

    const onMove = (e: PointerEvent) => {
      setPointer(e)
      const p = pickFiltered(true)
      if (!p) return
      onHoverRef.current([p.x, p.y, p.z])
    }

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return
      setPointer(e)
      const p = pickFiltered(true)
      if (!p) return
      onPlaceRef.current([p.x, p.y, p.z])
    }

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('click', onClick)
    return () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('click', onClick)
    }
  }, [active, camera, gl, scene])

  return null
}
