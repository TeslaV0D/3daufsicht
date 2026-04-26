/** Viewport-sichere fixed-Position für Tooltips (Trigger = Icon-Rect). */
export function computeTooltipPosition(
  trigger: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
  margin = 8,
): { left: number; top: number } {
  let left = trigger.right + margin
  let top = trigger.top

  if (left + tooltipWidth > window.innerWidth - margin) {
    left = trigger.left - tooltipWidth - margin
  }

  if (top + tooltipHeight > window.innerHeight - margin) {
    top = trigger.bottom - tooltipHeight
  }

  if (top < margin) {
    top = trigger.top
  }

  const maxLeft = Math.max(margin, window.innerWidth - tooltipWidth - margin)
  const maxTop = Math.max(margin, window.innerHeight - tooltipHeight - margin)
  left = Math.max(margin, Math.min(left, maxLeft))
  top = Math.max(margin, Math.min(top, maxTop))

  return { left, top }
}
