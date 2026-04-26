import { Environment } from '@react-three/drei'
import { Vector3 } from 'three'
import type { Vector3Tuple } from 'three'
import type { LightingSettings } from '../types/lighting'
import { getMainLightPosition, shadowMapSizeForQuality } from '../types/lighting'

export interface SceneLightingProps {
  settings: LightingSettings
  /** Extra fill lights for presentation mode */
  presentation: boolean
}

function fillLightPosition(main: Vector3Tuple): Vector3Tuple {
  const v = new Vector3(main[0], main[1], main[2])
  if (v.lengthSq() < 1e-6) v.set(0, 1, 0)
  v.normalize()
  const d = 28
  return [-v.x * d, Math.max(2.5, -v.y * d * 0.35 + 12), -v.z * d]
}

export default function Lighting({ settings, presentation }: SceneLightingProps) {
  const gammaMul = settings.gamma / 2.2
  const mainPos = getMainLightPosition(settings)
  const mapSize = shadowMapSizeForQuality(settings.shadowQuality)
  const shadowMap = settings.castShadow ? mapSize : settings.shadowMapSize

  const mainIntensity =
    settings.mainIntensity * (presentation ? 1.35 : 1) * gammaMul
  const ambientMul = presentation ? 1.55 : 1
  const ambientShadowMul = 1 - 0.35 * settings.shadowIntensity
  const ambientIntensity =
    settings.ambientIntensity * ambientMul * ambientShadowMul * gammaMul

  const halfCam = settings.shadowCameraSize * (presentation ? 1.12 : 1)

  const dirShadow = {
    'shadow-mapSize-width': shadowMap,
    'shadow-mapSize-height': shadowMap,
    'shadow-camera-near': 0.5,
    'shadow-camera-far': presentation ? 120 : 90,
    'shadow-camera-left': -halfCam,
    'shadow-camera-right': halfCam,
    'shadow-camera-top': halfCam,
    'shadow-camera-bottom': -halfCam,
    'shadow-bias': -Math.abs(settings.shadowBias),
    'shadow-radius': settings.shadowRadius,
  } as const

  const pointShadow = {
    'shadow-mapSize-width': shadowMap,
    'shadow-mapSize-height': shadowMap,
    'shadow-camera-near': 0.5,
    'shadow-camera-far': 80,
    'shadow-bias': -Math.abs(settings.shadowBias) * 0.5,
  } as const

  const secondaryInt = settings.secondaryIntensity * gammaMul * (presentation ? 1.1 : 1)
  const fillInt = settings.fillIntensity * gammaMul * (presentation ? 1.05 : 1)
  const fillPos = fillLightPosition(mainPos)

  const shadowLift = settings.castShadow ? (1 - settings.shadowIntensity) * 0.42 : 0

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={settings.ambientColor} />

      {shadowLift > 0.02 ? (
        <directionalLight
          position={[0, 36, 0]}
          intensity={shadowLift * (presentation ? 0.85 : 1)}
          color="#eef6ff"
        />
      ) : null}

      {settings.mainType === 'directional' && (
        <directionalLight
          castShadow={settings.castShadow}
          position={mainPos}
          intensity={mainIntensity}
          color={settings.mainColor}
          {...dirShadow}
        />
      )}
      {settings.mainType === 'point' && (
        <pointLight
          castShadow={settings.castShadow}
          position={mainPos}
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
          position={mainPos}
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

      {settings.secondaryEnabled &&
        (settings.secondaryType === 'directional' ? (
          <directionalLight
            position={settings.secondaryPosition}
            intensity={secondaryInt}
            color={settings.secondaryColor}
          />
        ) : settings.secondaryType === 'point' ? (
          <pointLight
            position={settings.secondaryPosition}
            intensity={secondaryInt * 1.6}
            color={settings.secondaryColor}
            distance={settings.secondaryDistance}
            decay={2}
          />
        ) : (
          <spotLight
            position={settings.secondaryPosition}
            angle={settings.secondarySpotAngle}
            penumbra={settings.secondarySpotPenumbra}
            intensity={secondaryInt * 2}
            color={settings.secondaryColor}
            distance={settings.secondaryDistance}
            decay={2}
          >
            <object3D attach="target" position={[0, 0, 0]} />
          </spotLight>
        ))}

      {settings.fillEnabled ? (
        <directionalLight position={fillPos} intensity={fillInt} color={settings.fillColor} />
      ) : null}

      {presentation && (
        <>
          <directionalLight position={[-20, 16, -10]} intensity={0.45} color="#bfe3ff" />
          <hemisphereLight args={['#eaf2ff', '#20303f', 0.55]} />
        </>
      )}
      <Environment
        preset="warehouse"
        environmentIntensity={
          settings.environmentIntensity * (presentation ? 1.05 : 1) * gammaMul
        }
      />
    </>
  )
}
