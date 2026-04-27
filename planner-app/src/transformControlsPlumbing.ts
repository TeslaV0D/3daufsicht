import type { TransformControls } from 'three-stdlib'

/**
 * three-stdlib's TransformControls `pointerMove` only applies drag deltas when
 * `pointer.button === -1` (per three.js PointerEventInfo convention for moves).
 * DOM pointermove events have `button === 0` after a left-button down, so drags
 * would stop as soon as the pointer leaves the canvas unless we fix getPointer.
 */
const PATCH_KEY = '__plannerGetPointerPatched' as const

type TransformWithGetPointer = {
  [PATCH_KEY]?: boolean
  getPointer: (e: PointerEvent) => { x: number; y: number; button: number }
}

export function patchTransformControlsGetPointer(controls: TransformControls | null): void {
  if (!controls) return
  const t = controls as unknown as TransformWithGetPointer
  if (t[PATCH_KEY]) return
  t[PATCH_KEY] = true
  const original = t.getPointer.bind(controls)
  t.getPointer = (event: PointerEvent) => {
    const p = original(event)
    if (event.type === 'pointermove' || event.type === 'mousemove') {
      return { ...p, button: -1 }
    }
    return p
  }
}
