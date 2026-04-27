import type { PlannerShellMode } from './plannerUi'

export type PlannerSessionTool = 'select' | 'place'

/**
 * Remembers shell UI when persisting the layout to localStorage (F5 / refresh).
 * Camera, lighting, and scene content live in the main `StoredPayload`.
 */
export interface LayoutSessionState {
  shellMode: PlannerShellMode
  tool: PlannerSessionTool
  selectedIds: string[]
  infoAssetId: string | null
  floorInspectorOpen: boolean
  lightingPanelOpen: boolean
  leftPanelHidden: boolean
  rightPanelHidden: boolean
}

const DEFAULT: LayoutSessionState = {
  shellMode: 'edit',
  tool: 'select',
  selectedIds: [],
  infoAssetId: null,
  floorInspectorOpen: false,
  lightingPanelOpen: false,
  leftPanelHidden: false,
  rightPanelHidden: false,
}

function isTool(v: unknown): v is PlannerSessionTool {
  return v === 'select' || v === 'place'
}

function isShellMode(v: unknown): v is PlannerShellMode {
  return v === 'edit' || v === 'view'
}

export function sanitizeLayoutSession(
  v: unknown,
  fallback: LayoutSessionState = DEFAULT,
): LayoutSessionState {
  if (!v || typeof v !== 'object') return { ...fallback }
  const o = v as Record<string, unknown>
  return {
    shellMode: isShellMode(o.shellMode) ? o.shellMode : fallback.shellMode,
    tool: isTool(o.tool) ? o.tool : fallback.tool,
    selectedIds: Array.isArray(o.selectedIds)
      ? o.selectedIds.filter((id): id is string => typeof id === 'string')
      : [...fallback.selectedIds],
    infoAssetId:
      o.infoAssetId == null
        ? null
        : typeof o.infoAssetId === 'string'
          ? o.infoAssetId
          : fallback.infoAssetId,
    floorInspectorOpen: typeof o.floorInspectorOpen === 'boolean' ? o.floorInspectorOpen : false,
    lightingPanelOpen: typeof o.lightingPanelOpen === 'boolean' ? o.lightingPanelOpen : false,
    leftPanelHidden: typeof o.leftPanelHidden === 'boolean' ? o.leftPanelHidden : false,
    rightPanelHidden: typeof o.rightPanelHidden === 'boolean' ? o.rightPanelHidden : false,
  }
}
