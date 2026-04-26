import type { Asset } from '../types/asset'
import { resolveAssetOpacity } from '../types/asset'

export interface InstancedBoxBatchSpec {
  key: string
  assets: Asset[]
  width: number
  height: number
  depth: number
}

export function computeInstancedBoxBatches(
  assets: Asset[],
  opts: {
    useInstancing: boolean
    selectedIds: string[]
    hoveredId: string | null
  },
): InstancedBoxBatchSpec[] {
  if (!opts.useInstancing) return []
  const groups = new Map<string, Asset[]>()
  for (const a of assets) {
    if (a.geometry.kind !== 'box') continue
    if (a.visual?.decals?.length) continue
    if (resolveAssetOpacity(a) < 0.999) continue
    if (a.visual?.transparent) continue
    if (opts.selectedIds.includes(a.id)) continue
    if (opts.hoveredId === a.id) continue
    const paramsKey = JSON.stringify(a.geometry.params)
    const key = `${a.type}@@${paramsKey}`
    const list = groups.get(key)
    if (list) list.push(a)
    else groups.set(key, [a])
  }
  const batches: InstancedBoxBatchSpec[] = []
  for (const [key, list] of groups) {
    if (list.length < 2) continue
    const p = list[0]!.geometry.params
    batches.push({
      key,
      assets: list,
      width: p.width ?? 1,
      height: p.height ?? 1,
      depth: p.depth ?? 1,
    })
  }
  return batches
}

export function instancedAssetIdSet(batches: InstancedBoxBatchSpec[]): Set<string> {
  const s = new Set<string>()
  for (const b of batches) for (const a of b.assets) s.add(a.id)
  return s
}
