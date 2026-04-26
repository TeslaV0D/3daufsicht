import type { Vector3Tuple } from 'three'
import { sanitizeColor } from './asset'

export type MainLightType = 'directional' | 'point' | 'spot'
export type FogType = 'linear' | 'exponential'
export type ShadowQualityPreset = 'low' | 'medium' | 'high'
export type SecondaryLightType = 'point' | 'spot' | 'directional'
export type LightPresetId = 'custom' | 'studio' | 'natural' | 'dramatic' | 'evening' | 'night'

export interface LightingSettings {
  lightPreset: LightPresetId

  mainType: MainLightType
  mainIntensity: number
  mainColor: string
  mainPosition: Vector3Tuple
  primaryDistance: number
  primaryElevationDeg: number
  primaryAzimuthDeg: number
  spotAngle: number
  spotPenumbra: number

  secondaryEnabled: boolean
  secondaryType: SecondaryLightType
  secondaryIntensity: number
  secondaryColor: string
  secondaryPosition: Vector3Tuple
  secondaryDistance: number
  secondarySpotAngle: number
  secondarySpotPenumbra: number

  fillEnabled: boolean
  fillIntensity: number
  fillColor: string

  ambientIntensity: number
  ambientColor: string

  castShadow: boolean
  shadowQuality: ShadowQualityPreset
  shadowMapSize: 512 | 1024 | 2048
  shadowIntensity: number
  shadowRadius: number
  shadowCameraSize: number
  shadowBias: number

  fogEnabled: boolean
  fogColor: string
  fogDensity: number
  fogNear: number
  fogFar: number
  fogType: FogType

  backgroundColor: string
  exposure: number
  gamma: number

  bloomEnabled: boolean
  bloomIntensity: number

  environmentIntensity: number
}

const SHADOW_QUALITY_TO_MAP: Record<ShadowQualityPreset, 512 | 1024 | 2048> = {
  low: 512,
  medium: 1024,
  high: 2048,
}

export function shadowMapSizeForQuality(q: ShadowQualityPreset): 512 | 1024 | 2048 {
  return SHADOW_QUALITY_TO_MAP[q]
}

export function inferShadowQualityFromMapSize(size: number): ShadowQualityPreset {
  if (size <= 512) return 'low'
  if (size <= 1024) return 'medium'
  return 'high'
}

export function sphericalToCartesian(
  distance: number,
  elevationDeg: number,
  azimuthDeg: number,
): Vector3Tuple {
  const e = (elevationDeg * Math.PI) / 180
  const a = (azimuthDeg * Math.PI) / 180
  const ce = Math.cos(e)
  const d = Math.max(0.5, distance)
  return [d * ce * Math.sin(a), d * Math.sin(e), d * ce * Math.cos(a)]
}

export function cartesianToSpherical(pos: Vector3Tuple): {
  distance: number
  elevationDeg: number
  azimuthDeg: number
} {
  const [x, y, z] = pos
  const d = Math.sqrt(x * x + y * y + z * z)
  if (!Number.isFinite(d) || d < 1e-6) {
    return { distance: 32, elevationDeg: 45, azimuthDeg: 45 }
  }
  const elev = (Math.asin(Math.max(-1, Math.min(1, y / d))) * 180) / Math.PI
  let azim = (Math.atan2(x, z) * 180) / Math.PI
  if (azim < 0) azim += 360
  return { distance: d, elevationDeg: elev, azimuthDeg: azim }
}

export function getMainLightPosition(s: LightingSettings): Vector3Tuple {
  return sphericalToCartesian(s.primaryDistance, s.primaryElevationDeg, s.primaryAzimuthDeg)
}

const LEGACY_MAIN: Vector3Tuple = [18, 24, 12]
const LEGACY_SPH = cartesianToSpherical(LEGACY_MAIN)

export const DEFAULT_LIGHTING: LightingSettings = {
  lightPreset: 'custom',

  mainType: 'directional',
  mainIntensity: 1.25,
  mainColor: '#ffffff',
  mainPosition: [...LEGACY_MAIN],
  primaryDistance: LEGACY_SPH.distance,
  primaryElevationDeg: LEGACY_SPH.elevationDeg,
  primaryAzimuthDeg: LEGACY_SPH.azimuthDeg,
  spotAngle: 0.55,
  spotPenumbra: 0.45,

  secondaryEnabled: false,
  secondaryType: 'point',
  secondaryIntensity: 0.8,
  secondaryColor: '#b8d4ff',
  secondaryPosition: [-10, 10, 5],
  secondaryDistance: 80,
  secondarySpotAngle: 0.45,
  secondarySpotPenumbra: 0.35,

  fillEnabled: false,
  fillIntensity: 0.3,
  fillColor: '#6699ff',

  ambientIntensity: 0.24,
  ambientColor: '#ffffff',

  castShadow: true,
  shadowQuality: 'high',
  shadowMapSize: 2048,
  shadowIntensity: 0.65,
  shadowRadius: 2,
  shadowCameraSize: 100,
  shadowBias: 0.0002,

  fogEnabled: false,
  fogColor: '#d2dae3',
  fogDensity: 0.35,
  fogNear: 1,
  fogFar: 100,
  fogType: 'linear',

  backgroundColor: '#d2dae3',
  exposure: 1,
  gamma: 2.2,

  bloomEnabled: false,
  bloomIntensity: 0.3,

  environmentIntensity: 1,
}

/** Full preset overrides (merged onto a fresh default clone in the UI). */
export const LIGHT_PRESET_VALUES: Record<
  Exclude<LightPresetId, 'custom'>,
  Partial<LightingSettings>
> = {
  studio: {
    lightPreset: 'studio',
    mainType: 'directional',
    mainIntensity: 1.5,
    mainColor: '#ffffff',
    primaryElevationDeg: 45,
    primaryAzimuthDeg: 45,
    primaryDistance: 38,
    secondaryEnabled: true,
    secondaryType: 'point',
    secondaryIntensity: 0.8,
    secondaryColor: '#fff8f0',
    secondaryPosition: [-12, 12, 8],
    fillEnabled: true,
    fillIntensity: 0.3,
    fillColor: '#6699ff',
    ambientIntensity: 0.4,
    shadowQuality: 'medium',
    shadowMapSize: 1024,
    shadowIntensity: 0.55,
    exposure: 1,
    gamma: 2.2,
    fogEnabled: false,
    bloomEnabled: false,
    environmentIntensity: 1.05,
    backgroundColor: '#d8dee6',
  },
  natural: {
    lightPreset: 'natural',
    mainType: 'directional',
    mainIntensity: 1.2,
    mainColor: '#fffaf3',
    primaryElevationDeg: 60,
    primaryAzimuthDeg: 35,
    primaryDistance: 42,
    secondaryEnabled: true,
    secondaryIntensity: 0.5,
    secondaryColor: '#e8f4ff',
    secondaryPosition: [14, 18, -12],
    ambientIntensity: 0.5,
    shadowQuality: 'high',
    shadowMapSize: 2048,
    shadowIntensity: 0.6,
    exposure: 0.9,
    gamma: 2.2,
    fogEnabled: true,
    fogType: 'linear',
    fogColor: '#dfe8f0',
    fogNear: 2,
    fogFar: 220,
    fogDensity: 0.2,
    environmentIntensity: 1.15,
    backgroundColor: '#e8eef5',
  },
  dramatic: {
    lightPreset: 'dramatic',
    mainType: 'directional',
    mainIntensity: 2,
    mainColor: '#fff5e6',
    primaryElevationDeg: 30,
    primaryAzimuthDeg: 50,
    primaryDistance: 36,
    secondaryEnabled: true,
    secondaryIntensity: 0.3,
    secondaryColor: '#8899aa',
    secondaryPosition: [-8, 6, -6],
    ambientIntensity: 0.2,
    shadowQuality: 'high',
    shadowMapSize: 2048,
    shadowIntensity: 0.9,
    shadowRadius: 1.25,
    exposure: 0.8,
    gamma: 2.1,
    fogEnabled: false,
    environmentIntensity: 0.85,
    backgroundColor: '#c5ccd6',
  },
  evening: {
    lightPreset: 'evening',
    mainType: 'directional',
    mainIntensity: 0.9,
    mainColor: '#ffd700',
    primaryElevationDeg: 25,
    primaryAzimuthDeg: 280,
    primaryDistance: 40,
    secondaryEnabled: true,
    secondaryIntensity: 0.4,
    secondaryColor: '#6699cc',
    secondaryPosition: [10, 8, 12],
    ambientIntensity: 0.3,
    shadowQuality: 'medium',
    shadowMapSize: 1024,
    shadowIntensity: 0.5,
    exposure: 1.2,
    gamma: 2.25,
    fogEnabled: true,
    fogColor: '#4a3f55',
    fogNear: 3,
    fogFar: 180,
    fogDensity: 0.25,
    fogType: 'linear',
    environmentIntensity: 0.75,
    backgroundColor: '#3d3548',
  },
  night: {
    lightPreset: 'night',
    mainType: 'directional',
    mainIntensity: 0.5,
    mainColor: '#a8c8ff',
    primaryElevationDeg: 35,
    primaryAzimuthDeg: 120,
    primaryDistance: 45,
    secondaryEnabled: false,
    ambientIntensity: 0.1,
    fillEnabled: false,
    shadowQuality: 'medium',
    shadowMapSize: 1024,
    shadowIntensity: 0.75,
    exposure: 1.5,
    gamma: 2.2,
    fogEnabled: false,
    environmentIntensity: 0.45,
    backgroundColor: '#0a0f18',
  },
}

export function applyLightPreset(preset: Exclude<LightPresetId, 'custom'>): LightingSettings {
  const base = cloneLighting(DEFAULT_LIGHTING)
  const patch = LIGHT_PRESET_VALUES[preset]
  const merged = { ...base, ...patch, lightPreset: preset }
  merged.mainPosition = [...getMainLightPosition(merged)] as Vector3Tuple
  if (patch.secondaryPosition) {
    merged.secondaryPosition = [...patch.secondaryPosition] as Vector3Tuple
  }
  merged.shadowMapSize = shadowMapSizeForQuality(merged.shadowQuality)
  return merged
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function isVector3(value: unknown): value is Vector3Tuple {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    typeof value[2] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    Number.isFinite(value[2])
  )
}

export function cloneLighting(settings: LightingSettings): LightingSettings {
  return {
    ...settings,
    mainPosition: [...settings.mainPosition] as Vector3Tuple,
    secondaryPosition: [...settings.secondaryPosition] as Vector3Tuple,
  }
}

export function sanitizeLighting(value: unknown): LightingSettings {
  const base: LightingSettings = { ...DEFAULT_LIGHTING }
  if (!value || typeof value !== 'object') {
    base.mainPosition = [...getMainLightPosition(base)] as Vector3Tuple
    return base
  }
  const e = value as Record<string, unknown>

  const presetIds: LightPresetId[] = ['custom', 'studio', 'natural', 'dramatic', 'evening', 'night']
  if (typeof e.lightPreset === 'string' && presetIds.includes(e.lightPreset as LightPresetId)) {
    base.lightPreset = e.lightPreset as LightPresetId
  }

  if (e.mainType === 'directional' || e.mainType === 'point' || e.mainType === 'spot') {
    base.mainType = e.mainType
  }
  if (typeof e.mainIntensity === 'number' && Number.isFinite(e.mainIntensity)) {
    base.mainIntensity = clamp(e.mainIntensity, 0, 3)
  }
  if (typeof e.mainColor === 'string') {
    base.mainColor = sanitizeColor(e.mainColor)
  }
  if (isVector3(e.mainPosition)) {
    base.mainPosition = [...e.mainPosition] as Vector3Tuple
  }
  if (typeof e.primaryDistance === 'number' && Number.isFinite(e.primaryDistance)) {
    base.primaryDistance = clamp(e.primaryDistance, 8, 120)
  }
  if (typeof e.primaryElevationDeg === 'number' && Number.isFinite(e.primaryElevationDeg)) {
    base.primaryElevationDeg = clamp(e.primaryElevationDeg, 0, 90)
  }
  if (typeof e.primaryAzimuthDeg === 'number' && Number.isFinite(e.primaryAzimuthDeg)) {
    base.primaryAzimuthDeg = clamp(e.primaryAzimuthDeg, 0, 360)
  }
  if (typeof e.spotAngle === 'number' && Number.isFinite(e.spotAngle)) {
    base.spotAngle = clamp(e.spotAngle, 0.15, 1.2)
  }
  if (typeof e.spotPenumbra === 'number' && Number.isFinite(e.spotPenumbra)) {
    base.spotPenumbra = clamp(e.spotPenumbra, 0, 1)
  }
  if (typeof e.secondaryEnabled === 'boolean') {
    base.secondaryEnabled = e.secondaryEnabled
  }
  if (e.secondaryType === 'point' || e.secondaryType === 'spot' || e.secondaryType === 'directional') {
    base.secondaryType = e.secondaryType
  }
  if (typeof e.secondaryIntensity === 'number' && Number.isFinite(e.secondaryIntensity)) {
    base.secondaryIntensity = clamp(e.secondaryIntensity, 0, 4)
  }
  if (typeof e.secondaryColor === 'string') {
    base.secondaryColor = sanitizeColor(e.secondaryColor)
  }
  if (isVector3(e.secondaryPosition)) {
    base.secondaryPosition = [...e.secondaryPosition] as Vector3Tuple
  }
  if (typeof e.secondaryDistance === 'number' && Number.isFinite(e.secondaryDistance)) {
    base.secondaryDistance = clamp(e.secondaryDistance, 5, 200)
  }
  if (typeof e.secondarySpotAngle === 'number' && Number.isFinite(e.secondarySpotAngle)) {
    base.secondarySpotAngle = clamp(e.secondarySpotAngle, 0.15, 1.2)
  }
  if (typeof e.secondarySpotPenumbra === 'number' && Number.isFinite(e.secondarySpotPenumbra)) {
    base.secondarySpotPenumbra = clamp(e.secondarySpotPenumbra, 0, 1)
  }
  if (typeof e.fillEnabled === 'boolean') {
    base.fillEnabled = e.fillEnabled
  }
  if (typeof e.fillIntensity === 'number' && Number.isFinite(e.fillIntensity)) {
    base.fillIntensity = clamp(e.fillIntensity, 0, 3)
  }
  if (typeof e.fillColor === 'string') {
    base.fillColor = sanitizeColor(e.fillColor)
  }
  if (typeof e.ambientIntensity === 'number' && Number.isFinite(e.ambientIntensity)) {
    base.ambientIntensity = clamp(e.ambientIntensity, 0, 2)
  }
  if (typeof e.ambientColor === 'string') {
    base.ambientColor = sanitizeColor(e.ambientColor)
  }
  if (typeof e.castShadow === 'boolean') {
    base.castShadow = e.castShadow
  }
  if (e.shadowQuality === 'low' || e.shadowQuality === 'medium' || e.shadowQuality === 'high') {
    base.shadowQuality = e.shadowQuality
  } else if (e.shadowMapSize === 512 || e.shadowMapSize === 1024 || e.shadowMapSize === 2048) {
    base.shadowQuality = inferShadowQualityFromMapSize(e.shadowMapSize)
  }
  if (e.shadowMapSize === 512 || e.shadowMapSize === 1024 || e.shadowMapSize === 2048) {
    base.shadowMapSize = e.shadowMapSize
  } else {
    base.shadowMapSize = shadowMapSizeForQuality(base.shadowQuality)
  }
  if (typeof e.shadowIntensity === 'number' && Number.isFinite(e.shadowIntensity)) {
    base.shadowIntensity = clamp(e.shadowIntensity, 0, 1)
  }
  if (typeof e.shadowRadius === 'number' && Number.isFinite(e.shadowRadius)) {
    base.shadowRadius = clamp(e.shadowRadius, 0, 3)
  }
  if (typeof e.shadowCameraSize === 'number' && Number.isFinite(e.shadowCameraSize)) {
    base.shadowCameraSize = clamp(e.shadowCameraSize, 50, 500)
  }
  if (typeof e.shadowBias === 'number' && Number.isFinite(e.shadowBias)) {
    base.shadowBias = clamp(e.shadowBias, 0.0001, 0.001)
  }
  if (typeof e.fogEnabled === 'boolean') {
    base.fogEnabled = e.fogEnabled
  }
  if (typeof e.fogColor === 'string') {
    base.fogColor = sanitizeColor(e.fogColor)
  }
  if (typeof e.fogDensity === 'number' && Number.isFinite(e.fogDensity)) {
    base.fogDensity = clamp(e.fogDensity, 0, 1)
  }
  if (typeof e.fogNear === 'number' && Number.isFinite(e.fogNear)) {
    base.fogNear = clamp(e.fogNear, 0, 100)
  }
  if (typeof e.fogFar === 'number' && Number.isFinite(e.fogFar)) {
    base.fogFar = clamp(e.fogFar, 5, 500)
  }
  if (e.fogType === 'linear' || e.fogType === 'exponential') {
    base.fogType = e.fogType
  }
  if (typeof e.backgroundColor === 'string') {
    base.backgroundColor = sanitizeColor(e.backgroundColor)
  }
  if (typeof e.exposure === 'number' && Number.isFinite(e.exposure)) {
    base.exposure = clamp(e.exposure, 0.5, 2)
  }
  if (typeof e.gamma === 'number' && Number.isFinite(e.gamma)) {
    base.gamma = clamp(e.gamma, 0.5, 2.5)
  }
  if (typeof e.bloomEnabled === 'boolean') {
    base.bloomEnabled = e.bloomEnabled
  }
  if (typeof e.bloomIntensity === 'number' && Number.isFinite(e.bloomIntensity)) {
    base.bloomIntensity = clamp(e.bloomIntensity, 0, 1)
  }
  if (typeof e.environmentIntensity === 'number' && Number.isFinite(e.environmentIntensity)) {
    base.environmentIntensity = clamp(e.environmentIntensity, 0, 3)
  }

  if (
    e.primaryDistance == null ||
    e.primaryElevationDeg == null ||
    e.primaryAzimuthDeg == null
  ) {
    const sph = cartesianToSpherical(base.mainPosition)
    if (e.primaryDistance == null) base.primaryDistance = sph.distance
    if (e.primaryElevationDeg == null) base.primaryElevationDeg = sph.elevationDeg
    if (e.primaryAzimuthDeg == null) base.primaryAzimuthDeg = sph.azimuthDeg
  }

  base.mainPosition = [...getMainLightPosition(base)] as Vector3Tuple

  if (base.fogFar <= base.fogNear) {
    base.fogFar = base.fogNear + 5
  }

  return base
}
