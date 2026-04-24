import type { Object3D } from 'three'

export function isZoneObject3D(obj: Object3D): boolean {
  let o: Object3D | null = obj
  while (o) {
    if (o.userData?.isZone === true) return true
    o = o.parent
  }
  return false
}
