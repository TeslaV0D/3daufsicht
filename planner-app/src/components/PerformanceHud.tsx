import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * FPS und WebGL-Info (Draw Calls, Geometrien). Nur Anzeige — kein Einfluss auf das Rendering.
 */
export default function PerformanceHud({ visible }: { visible: boolean }) {
  const frames = useRef(0)
  const [fps, setFps] = useState(0)
  const [calls, setCalls] = useState(0)
  const [geometries, setGeometries] = useState(0)
  const [heapMb, setHeapMb] = useState<number | null>(null)
  const last = useRef(0)
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    if (!visible) {
      last.current = 0
      frames.current = 0
    }
  }, [visible])

  const style = useMemo(
    () => ({
      pointerEvents: 'none' as const,
      margin: 0,
      padding: '6px 10px',
      fontSize: '12px',
      fontFamily: 'ui-monospace, monospace',
      color: '#b8f5c0',
      background: 'rgba(10, 14, 22, 0.82)',
      borderRadius: '6px',
      border: '1px solid rgba(120, 200, 160, 0.35)',
      position: 'absolute' as const,
      top: 8,
      left: 8,
      zIndex: 10,
    }),
    [],
  )

  useFrame(() => {
    if (!visible) return
    const now = performance.now()
    if (last.current === 0) last.current = now
    frames.current += 1
    if (now - last.current >= 1000) {
      setFps(Math.round((frames.current * 1000) / (now - last.current)))
      frames.current = 0
      last.current = now
      const info = gl.info.render
      setCalls(info.calls)
      setGeometries(gl.info.memory.geometries)
      const perfMem = (
        performance as Performance & {
          memory?: { usedJSHeapSize?: number }
        }
      ).memory
      if (perfMem?.usedJSHeapSize != null) {
        setHeapMb(Math.round(perfMem.usedJSHeapSize / (1024 * 1024)))
      }
    }
  })

  if (!visible) return null

  return (
    <Html prepend fullscreen>
      <div style={style} aria-live="polite">
        FPS: <strong>{fps}</strong>
        {' · '}
        Draw: {calls}
        {' · '}
        Geom: {geometries}
        {heapMb != null ? (
          <>
            {' · '}
            JS: {heapMb} MB
          </>
        ) : null}
      </div>
    </Html>
  )
}
