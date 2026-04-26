import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Fog, FogExp2 } from 'three'
import type { LightingSettings } from '../types/lighting'

function ToneMappingExposure({ exposure }: { exposure: number }) {
  const gl = useThree((s) => s.gl)
  useFrame(() => {
    if (gl.toneMappingExposure !== exposure) {
      // WebGLRenderer tone mapping is imperative; R3F has no declarative prop for this.
      // eslint-disable-next-line react-hooks/immutability -- three.js renderer API
      gl.toneMappingExposure = exposure
    }
  })
  return null
}

/** Scene background, fog, and renderer exposure (live updates). */
export default function SceneAtmosphere({ settings }: { settings: LightingSettings }) {
  const fogObject = useMemo(() => {
    if (!settings.fogEnabled) return null
    if (settings.fogType === 'linear') {
      return new Fog(settings.fogColor, settings.fogNear, settings.fogFar)
    }
    const density = 0.002 + settings.fogDensity * 0.12
    return new FogExp2(settings.fogColor, density)
  }, [
    settings.fogEnabled,
    settings.fogColor,
    settings.fogType,
    settings.fogNear,
    settings.fogFar,
    settings.fogDensity,
  ])

  return (
    <>
      <color attach="background" args={[settings.backgroundColor]} />
      {fogObject ? <primitive object={fogObject} attach="fog" /> : null}
      <ToneMappingExposure exposure={settings.exposure} />
    </>
  )
}
