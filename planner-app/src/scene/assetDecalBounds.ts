import type { Asset } from '../types/asset'

export type DecalBounds = { hx: number; hy: number; hz: number }

export function getDecalBounds(asset: Asset): DecalBounds | null {
  const p = asset.geometry.params ?? {}
  switch (asset.geometry.kind) {
    case 'box':
      return {
        hx: (p.width ?? 1) / 2,
        hy: (p.height ?? 1) / 2,
        hz: (p.depth ?? 1) / 2,
      }
    case 'sphere': {
      const r = p.radius ?? 0.5
      return { hx: r, hy: r, hz: r }
    }
    case 'cylinder':
      return {
        hx: p.radiusTop ?? p.radiusBottom ?? p.radius ?? 0.5,
        hy: (p.height ?? 1) / 2,
        hz: p.radiusTop ?? p.radiusBottom ?? p.radius ?? 0.5,
      }
    case 'cone':
      return {
        hx: p.radius ?? 0.5,
        hy: (p.height ?? 1) / 2,
        hz: p.radius ?? 0.5,
      }
    case 'torus': {
      const R = p.radius ?? 0.5
      const tube = p.tube ?? 0.15
      const e = R + tube
      return { hx: e, hy: tube * 1.2, hz: e }
    }
    case 'plane':
      return {
        hx: (p.width ?? 1) / 2,
        hy: 0.02,
        hz: (p.height ?? 1) / 2,
      }
    case 'circle': {
      const r = p.radius ?? 0.5
      return { hx: r, hy: 0.02, hz: r }
    }
    case 'ring': {
      const or = p.outerRadius ?? 0.5
      return { hx: or, hy: 0.02, hz: or }
    }
    case 'text':
      return null
    case 'custom':
      return {
        hx: Math.max(asset.scale[0], 0.02) / 2,
        hy: Math.max(asset.scale[1], 0.02) / 2,
        hz: Math.max(asset.scale[2], 0.02) / 2,
      }
    default:
      return {
        hx: 0.5,
        hy: 0.5,
        hz: 0.5,
      }
  }
}
