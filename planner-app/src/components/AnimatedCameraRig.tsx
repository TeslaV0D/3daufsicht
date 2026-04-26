import { useFrame, useThree, type RootState } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import {
  perspectiveToPosition,
  type CameraViewPreset,
  type PerspectiveCameraSettings,
} from '../types/plannerUi'
import type { Vector3Tuple } from 'three'

const DURATION_MS = 500

const CAMERA_PRESETS: Record<CameraViewPreset, { position: Vector3Tuple; target: Vector3Tuple }> = {
  perspective: { position: [22, 18, 22], target: [0, 0, 0] },
  top: { position: [0, 42, 0.01], target: [0, 0, 0] },
  front: { position: [0, 12, 36], target: [0, 2, 0] },
  side: { position: [36, 12, 0], target: [0, 2, 0] },
}

export { CAMERA_PRESETS }

export default function AnimatedCameraRig({
  preset,
  orbitRef,
  perspectiveCamera,
}: {
  preset: CameraViewPreset
  orbitRef: RefObject<OrbitControlsImpl | null>
  perspectiveCamera: PerspectiveCameraSettings | null
}) {
  const { camera } = useThree()
  const fromPos = useRef(new Vector3())
  const fromTarget = useRef(new Vector3())
  const toPos = useRef(new Vector3())
  const toTarget = useRef(new Vector3())
  const startTime = useRef<number | null>(null)
  const desiredFov = useRef(48)

  useEffect(() => {
    const p = CAMERA_PRESETS[preset]
    fromPos.current.copy(camera.position)
    const ctr = orbitRef.current
    if (ctr) {
      fromTarget.current.copy(ctr.target)
    } else {
      fromTarget.current.set(...p.target)
    }
    desiredFov.current =
      preset === 'perspective' && perspectiveCamera ? perspectiveCamera.fov : 48
    if (preset === 'perspective' && perspectiveCamera) {
      const pos = perspectiveToPosition(perspectiveCamera)
      toPos.current.set(...pos)
      toTarget.current.set(...perspectiveCamera.target)
    } else {
      toPos.current.set(...p.position)
      toTarget.current.set(...p.target)
    }
    startTime.current = performance.now()
  }, [preset, perspectiveCamera, camera, orbitRef])

  useFrame((state: RootState) => {
    const cam = state.camera
    if (cam instanceof PerspectiveCamera) {
      const tf = desiredFov.current
      if (Math.abs(cam.fov - tf) > 0.02) {
        cam.fov = tf
        cam.updateProjectionMatrix()
      }
    }
    const ctr = orbitRef.current
    if (!ctr || startTime.current === null) return
    const raw = (performance.now() - startTime.current) / DURATION_MS
    const t = Math.min(1, raw)
    const ease = 1 - (1 - t) ** 3
    cam.position.lerpVectors(fromPos.current, toPos.current, ease)
    ctr.target.lerpVectors(fromTarget.current, toTarget.current, ease)
    ctr.update()
    if (t >= 1) startTime.current = null
  })

  return null
}
