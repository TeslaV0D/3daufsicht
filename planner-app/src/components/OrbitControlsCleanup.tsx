import { useEffect } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { RefObject } from 'react'

/**
 * Disposes the underlying OrbitControls when unmounted (releases listeners, avoids leaks on long sessions).
 * Complements <OrbitControls> from @react-three/drei.
 */
export function OrbitControlsCleanup({
  controlsRef,
}: {
  controlsRef: RefObject<OrbitControlsImpl | null>
}) {
  useEffect(() => {
    const ref = controlsRef
    return () => {
      ref.current?.dispose()
    }
  }, [controlsRef])

  return null
}
