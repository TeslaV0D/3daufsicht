import type { Vector3Tuple } from 'three'
import type { Asset, AssetTemplate } from '../types/asset'

const round2 = (n: number) => Number(n.toFixed(2))

export function approxHalfExtents(
  asset: Asset,
  template: AssetTemplate | undefined,
): Vector3Tuple {
  const sx = asset.scale[0]
  const sy = asset.scale[1]
  const sz = asset.scale[2]
  if (!template) {
    return [sx / 2, sy / 2, sz / 2]
  }
  const p = template.geometry.params
  switch (template.geometry.kind) {
    case 'box':
      return [
        ((p.width ?? 1) * sx) / 2,
        ((p.height ?? 1) * sy) / 2,
        ((p.depth ?? 1) * sz) / 2,
      ]
    case 'sphere': {
      const r = (p.radius ?? 0.5) * Math.max(sx, sy, sz)
      return [r, r, r]
    }
    case 'cylinder':
    case 'cone':
      return [
        ((p.radiusBottom ?? p.radius ?? 0.5) * Math.max(sx, sz)) / 2,
        ((p.height ?? 1) * sy) / 2,
        ((p.radiusBottom ?? p.radius ?? 0.5) * Math.max(sx, sz)) / 2,
      ]
    case 'torus':
      return [
        ((p.radius ?? 0.5) * sx) / 2 + ((p.tube ?? 0.15) * sy) / 2,
        ((p.tube ?? 0.15) * sy) / 2,
        ((p.radius ?? 0.5) * sz) / 2 + ((p.tube ?? 0.15) * sy) / 2,
      ]
    case 'plane':
      return [((p.width ?? 1) * sx) / 2, 0.02, ((p.height ?? 1) * sz) / 2]
    case 'circle':
    case 'ring':
      return [((p.radius ?? 0.5) * Math.max(sx, sz)) / 2, 0.02, ((p.radius ?? 0.5) * Math.max(sx, sz)) / 2]
    case 'text':
      return [0.35 * sx, ((p.fontSize ?? 1) * sy) / 2, 0.1 * sz]
    case 'custom':
    default:
      return [sx / 2, sy / 2, sz / 2]
  }
}

export type AlignUpdate = { id: string; patch: Partial<Asset> }

function withPosition(asset: Asset, pos: Vector3Tuple): AlignUpdate {
  return {
    id: asset.id,
    patch: { position: [round2(pos[0]), round2(pos[1]), round2(pos[2])] },
  }
}

export function alignAssetsXZ(
  assets: Asset[],
  templateByType: Map<string, AssetTemplate>,
  mode: 'left' | 'right' | 'centerX' | 'top' | 'bottom' | 'centerZ',
): AlignUpdate[] {
  if (assets.length < 2) return []
  const items = assets.map((a) => {
    const t = templateByType.get(a.type)
    const [hx, , hz] = approxHalfExtents(a, t)
    return { asset: a, hx, hz }
  })

  if (mode === 'left') {
    const target = Math.min(...items.map((i) => i.asset.position[0] - i.hx))
    return items.map((i) =>
      withPosition(i.asset, [target + i.hx, i.asset.position[1], i.asset.position[2]]),
    )
  }
  if (mode === 'right') {
    const target = Math.max(...items.map((i) => i.asset.position[0] + i.hx))
    return items.map((i) =>
      withPosition(i.asset, [target - i.hx, i.asset.position[1], i.asset.position[2]]),
    )
  }
  if (mode === 'centerX') {
    const mid =
      items.reduce((s, i) => s + i.asset.position[0], 0) / items.length
    return items.map((i) =>
      withPosition(i.asset, [mid, i.asset.position[1], i.asset.position[2]]),
    )
  }
  if (mode === 'top') {
    const target = Math.max(...items.map((i) => i.asset.position[2] + i.hz))
    return items.map((i) =>
      withPosition(i.asset, [i.asset.position[0], i.asset.position[1], target - i.hz]),
    )
  }
  if (mode === 'bottom') {
    const target = Math.min(...items.map((i) => i.asset.position[2] - i.hz))
    return items.map((i) =>
      withPosition(i.asset, [i.asset.position[0], i.asset.position[1], target + i.hz]),
    )
  }
  if (mode === 'centerZ') {
    const mid =
      items.reduce((s, i) => s + i.asset.position[2], 0) / items.length
    return items.map((i) =>
      withPosition(i.asset, [i.asset.position[0], i.asset.position[1], mid]),
    )
  }
  return []
}

/** Gleichmäßige Abstände der Zentren auf X (2D-Boden). */
export function distributeCentersX(assets: Asset[]): AlignUpdate[] {
  if (assets.length < 3) return []
  const sorted = [...assets].sort((a, b) => a.position[0] - b.position[0])
  const firstX = sorted[0]!.position[0]
  const lastX = sorted[sorted.length - 1]!.position[0]
  const step = (lastX - firstX) / (sorted.length - 1)
  return sorted.map((a, i) =>
    withPosition(a, [round2(firstX + step * i), a.position[1], a.position[2]]),
  )
}

export function distributeCentersZ(assets: Asset[]): AlignUpdate[] {
  if (assets.length < 3) return []
  const sorted = [...assets].sort((a, b) => a.position[2] - b.position[2])
  const firstZ = sorted[0]!.position[2]
  const lastZ = sorted[sorted.length - 1]!.position[2]
  const step = (lastZ - firstZ) / (sorted.length - 1)
  return sorted.map((a, i) =>
    withPosition(a, [a.position[0], a.position[1], round2(firstZ + step * i)]),
  )
}

export function snapAssetsToGrid(assets: Asset[], step: number): AlignUpdate[] {
  if (step <= 0) return []
  const snap = (v: number) => round2(Math.round(v / step) * step)
  return assets.map((a) =>
    withPosition(a, [snap(a.position[0]), a.position[1], snap(a.position[2])]),
  )
}
