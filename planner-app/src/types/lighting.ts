import type { Vector3Tuple } from 'three'
import { sanitizeColor } from './asset'

export type MainLightType = 'directional' | 'point' | 'spot'

export interface LightingSettings {
  mainType: MainLightType
  mainIntensity: number
  mainColor: string
  mainPosition: Vector3Tuple
  spotAngle: number
  spotPenumbra: number
  ambientIntensity: number
  ambientColor: string
  castShadow: boolean
  shadowMapSize: 512 | 1024 | 2048
  shadowRadius: number
  environmentIntensity: number
}

export const DEFAULT_LIGHTING: LightingSettings = {
  mainType: 'directional',
  mainIntensity: 1.25,
  mainColor: '#ffffff',
  mainPosition: [18, 24, 12],
  spotAngle: 0.55,
  spotPenumbra: 0.45,
  ambientIntensity: 0.24,
  ambientColor: '#ffffff',
  castShadow: true,
  shadowMapSize: 2048,
  shadowRadius: 2,
  environmentIntensity: 1,
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
  }
}

export function sanitizeLighting(value: unknown): LightingSettings {
  const base = { ...DEFAULT_LIGHTING }
  if (!value || typeof value !== 'object') return base
  const e = value as Record<string, unknown>
  if (e.mainType === 'directional' || e.mainType === 'point' || e.mainType === 'spot') {
    base.mainType = e.mainType
  }
  if (typeof e.mainIntensity === 'number' && Number.isFinite(e.mainIntensity)) {
    base.mainIntensity = clamp(e.mainIntensity, 0, 4)
  }
  if (typeof e.mainColor === 'string') {
    base.mainColor = sanitizeColor(e.mainColor)
  }
  if (isVector3(e.mainPosition)) {
    base.mainPosition = [...e.mainPosition] as Vector3Tuple
  }
  if (typeof e.spotAngle === 'number' && Number.isFinite(e.spotAngle)) {
    base.spotAngle = clamp(e.spotAngle, 0.15, 1.2)
  }
  if (typeof e.spotPenumbra === 'number' && Number.isFinite(e.spotPenumbra)) {
    base.spotPenumbra = clamp(e.spotPenumbra, 0, 1)
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
  if (e.shadowMapSize === 512 || e.shadowMapSize === 1024 || e.shadowMapSize === 2048) {
    base.shadowMapSize = e.shadowMapSize
  }
  if (typeof e.shadowRadius === 'number' && Number.isFinite(e.shadowRadius)) {
    base.shadowRadius = clamp(e.shadowRadius, 0, 12)
  }
  if (typeof e.environmentIntensity === 'number' && Number.isFinite(e.environmentIntensity)) {
    base.environmentIntensity = clamp(e.environmentIntensity, 0, 3)
  }
  return base
}
