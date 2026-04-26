/** Wird von {@link PerformanceHud} befüllt; Ansicht-Menü kann Live-Werte anzeigen. */

export type PlannerPerfSnapshot = {
  fps: number
  drawCalls: number
  geometries: number
  heapMb: number | null
  updatedAt: number
}

const empty: PlannerPerfSnapshot = {
  fps: 0,
  drawCalls: 0,
  geometries: 0,
  heapMb: null,
  updatedAt: 0,
}

let snapshot: PlannerPerfSnapshot = { ...empty }

export function publishPlannerPerfStats(patch: Omit<PlannerPerfSnapshot, 'updatedAt'>) {
  snapshot = { ...patch, updatedAt: performance.now() }
}

export function getPlannerPerfStats(): PlannerPerfSnapshot {
  return snapshot
}

export function clearPlannerPerfStats() {
  snapshot = { ...empty }
}
