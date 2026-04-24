import { sanitizeColor } from './asset'

export interface FloorSettings {
  color: string
  gridVisible: boolean
  gridColor: string
  gridSize: number
  size: number
  /** Raster für Platzieren / Transform (Translation) */
  placementSnapEnabled: boolean
  placementSnapStep: number
}

export const DEFAULT_FLOOR: FloorSettings = {
  color: '#e5e5e5',
  gridVisible: true,
  gridColor: '#94a3b8',
  gridSize: 1,
  size: 120,
  placementSnapEnabled: false,
  placementSnapStep: 1,
}

const SNAP_STEPS = [0.25, 0.5, 1, 2, 5] as const

export function sanitizePlacementSnapStep(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const closest = SNAP_STEPS.reduce((a, b) =>
      Math.abs(b - value) < Math.abs(a - value) ? b : a,
    )
    return closest
  }
  return DEFAULT_FLOOR.placementSnapStep
}

export function sanitizeFloor(value: unknown): FloorSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_FLOOR }
  }
  const e = value as Record<string, unknown>
  const gridSize =
    typeof e.gridSize === 'number' && Number.isFinite(e.gridSize)
      ? Math.min(2, Math.max(0.1, e.gridSize))
      : DEFAULT_FLOOR.gridSize
  const size =
    typeof e.size === 'number' && Number.isFinite(e.size)
      ? Math.min(400, Math.max(20, e.size))
      : DEFAULT_FLOOR.size
  return {
    color: typeof e.color === 'string' ? sanitizeColor(e.color) : DEFAULT_FLOOR.color,
    gridVisible: typeof e.gridVisible === 'boolean' ? e.gridVisible : DEFAULT_FLOOR.gridVisible,
    gridColor:
      typeof e.gridColor === 'string' ? sanitizeColor(e.gridColor) : DEFAULT_FLOOR.gridColor,
    gridSize,
    size,
    placementSnapEnabled:
      typeof e.placementSnapEnabled === 'boolean'
        ? e.placementSnapEnabled
        : DEFAULT_FLOOR.placementSnapEnabled,
    placementSnapStep: sanitizePlacementSnapStep(e.placementSnapStep),
  }
}

export function cloneFloor(f: FloorSettings): FloorSettings {
  return { ...f }
}
