import { getDecalBounds, type DecalBounds } from './assetDecalBounds'
import type { Asset } from '../types/asset'
import type { AssetDecalSide } from '../types/asset'

const EPS = 0.004

export type FaceKey = Exclude<AssetDecalSide, 'all'>

export interface FaceSpec {
  key: FaceKey
  position: [number, number, number]
  rotation: [number, number, number]
  width: number
  height: number
  offsetAxisX: [number, number, number]
  offsetAxisY: [number, number, number]
}

export function faceSpecs(b: DecalBounds): Record<FaceKey, FaceSpec> {
  const { hx, hy, hz } = b
  return {
    top: {
      key: 'top',
      position: [0, hy + EPS, 0],
      rotation: [-Math.PI / 2, 0, 0],
      width: 2 * hx,
      height: 2 * hz,
      offsetAxisX: [1, 0, 0],
      offsetAxisY: [0, 0, 1],
    },
    bottom: {
      key: 'bottom',
      position: [0, -hy - EPS, 0],
      rotation: [Math.PI / 2, 0, 0],
      width: 2 * hx,
      height: 2 * hz,
      offsetAxisX: [1, 0, 0],
      offsetAxisY: [0, 0, -1],
    },
    front: {
      key: 'front',
      position: [0, 0, hz + EPS],
      rotation: [0, 0, 0],
      width: 2 * hx,
      height: 2 * hy,
      offsetAxisX: [1, 0, 0],
      offsetAxisY: [0, 1, 0],
    },
    back: {
      key: 'back',
      position: [0, 0, -hz - EPS],
      rotation: [0, Math.PI, 0],
      width: 2 * hx,
      height: 2 * hy,
      offsetAxisX: [-1, 0, 0],
      offsetAxisY: [0, 1, 0],
    },
    right: {
      key: 'right',
      position: [hx + EPS, 0, 0],
      rotation: [0, Math.PI / 2, 0],
      width: 2 * hz,
      height: 2 * hy,
      offsetAxisX: [0, 0, -1],
      offsetAxisY: [0, 1, 0],
    },
    left: {
      key: 'left',
      position: [-hx - EPS, 0, 0],
      rotation: [0, -Math.PI / 2, 0],
      width: 2 * hz,
      height: 2 * hy,
      offsetAxisX: [0, 0, 1],
      offsetAxisY: [0, 1, 0],
    },
  }
}

export function getFaceSpecsForAsset(asset: Asset): Record<FaceKey, FaceSpec> | null {
  const bounds = getDecalBounds(asset)
  if (!bounds) return null
  return faceSpecs(bounds)
}
