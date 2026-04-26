import type { PerspectiveCameraSettings } from './types/plannerUi'
import { sanitizePerspectiveCamera } from './types/plannerUi'

export const PERSPECTIVE_CUSTOM_PRESETS_KEY = 'factory-perspective-custom-presets-v1'

export interface SavedPerspectivePreset {
  id: string
  name: string
  settings: PerspectiveCameraSettings
}

function safeParse(raw: string | null): SavedPerspectivePreset[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v)) return []
    const out: SavedPerspectivePreset[] = []
    for (const item of v) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      if (typeof o.id !== 'string' || typeof o.name !== 'string') continue
      if (!o.settings || typeof o.settings !== 'object') continue
      out.push({
        id: o.id,
        name: o.name.slice(0, 80),
        settings: sanitizePerspectiveCamera(o.settings),
      })
    }
    return out
  } catch {
    return []
  }
}

export function loadPerspectiveCustomPresets(): SavedPerspectivePreset[] {
  if (typeof localStorage === 'undefined') return []
  return safeParse(localStorage.getItem(PERSPECTIVE_CUSTOM_PRESETS_KEY))
}

export function savePerspectiveCustomPresets(presets: SavedPerspectivePreset[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PERSPECTIVE_CUSTOM_PRESETS_KEY, JSON.stringify(presets.slice(0, 24)))
  } catch {
    /* ignore */
  }
}

export function newPerspectivePresetId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `pp-${globalThis.crypto.randomUUID()}`
  }
  return `pp-${Date.now().toString(36)}`
}
