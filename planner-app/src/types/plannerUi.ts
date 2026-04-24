export type CameraViewPreset = 'perspective' | 'top' | 'front' | 'side'

export type PlannerShellMode = 'edit' | 'view'

/** Alte Saves mit „cabinet“ werden auf Perspektive gemappt. */
export function normalizeCameraViewPreset(value: unknown): CameraViewPreset {
  if (value === 'perspective' || value === 'top' || value === 'front' || value === 'side') {
    return value
  }
  return 'perspective'
}
