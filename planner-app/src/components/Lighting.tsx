import { Environment } from '@react-three/drei'
import type { LightingSettings } from '../types/lighting'

export interface SceneLightingProps {
  settings: LightingSettings
  /** Extra fill lights for presentation mode */
  presentation: boolean
}

export default function Lighting({ settings, presentation }: SceneLightingProps) {
  const mainIntensity = settings.mainIntensity * (presentation ? 1.35 : 1)
  const ambientMul = presentation ? 1.55 : 1

  const dirShadow = {
    'shadow-mapSize-width': settings.shadowMapSize,
    'shadow-mapSize-height': settings.shadowMapSize,
    'shadow-camera-near': 0.5,
    'shadow-camera-far': presentation ? 120 : 90,
    'shadow-camera-left': presentation ? -50 : -40,
    'shadow-camera-right': presentation ? 50 : 40,
    'shadow-camera-top': presentation ? 50 : 40,
    'shadow-camera-bottom': presentation ? -50 : -40,
    'shadow-bias': -0.0002,
    'shadow-radius': settings.shadowRadius,
  } as const

  const pointShadow = {
    'shadow-mapSize-width': settings.shadowMapSize,
    'shadow-mapSize-height': settings.shadowMapSize,
    'shadow-camera-near': 0.5,
    'shadow-camera-far': 80,
    'shadow-bias': -0.0001,
  } as const

  return (
    <>
      <ambientLight
        intensity={settings.ambientIntensity * ambientMul}
        color={settings.ambientColor}
      />
      {settings.mainType === 'directional' && (
        <directionalLight
          castShadow={settings.castShadow}
          position={settings.mainPosition}
          intensity={mainIntensity}
          color={settings.mainColor}
          {...dirShadow}
        />
      )}
      {settings.mainType === 'point' && (
        <pointLight
          castShadow={settings.castShadow}
          position={settings.mainPosition}
          intensity={mainIntensity * 1.8}
          color={settings.mainColor}
          distance={80}
          decay={2}
          {...pointShadow}
        />
      )}
      {settings.mainType === 'spot' && (
        <spotLight
          castShadow={settings.castShadow}
          position={settings.mainPosition}
          angle={settings.spotAngle}
          penumbra={settings.spotPenumbra}
          intensity={mainIntensity * 2.2}
          color={settings.mainColor}
          distance={90}
          decay={2}
          {...dirShadow}
        >
          <object3D attach="target" position={[0, 0, 0]} />
        </spotLight>
      )}
      {presentation && (
        <>
          <directionalLight position={[-20, 16, -10]} intensity={0.45} color="#bfe3ff" />
          <hemisphereLight args={['#eaf2ff', '#20303f', 0.55]} />
        </>
      )}
      <Environment
        preset="warehouse"
        environmentIntensity={settings.environmentIntensity * (presentation ? 1.05 : 1)}
      />
    </>
  )
}
