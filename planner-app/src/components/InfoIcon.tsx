import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { computeTooltipPosition } from '../ui/tooltipPosition'

const SHOW_DELAY_MS = 400

/** Kompaktes (?)-Icon; Tooltip per Portal `position:fixed`, viewport-aware, z-index 1500. */
export default function InfoIcon({
  title,
  className,
}: {
  title: string
  className?: string
}) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null)

  const clearTimer = useCallback(() => {
    if (showTimerRef.current != null) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
  }, [])

  const hide = useCallback(() => {
    clearTimer()
    setOpen(false)
  }, [clearTimer])

  const scheduleShow = useCallback(() => {
    clearTimer()
    if (!title.trim()) return
    showTimerRef.current = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS)
  }, [clearTimer, title])

  useEffect(() => () => clearTimer(), [clearTimer])

  useLayoutEffect(() => {
    if (!open || !wrapRef.current || !tipRef.current) {
      setCoords(null)
      return
    }
    const tr = wrapRef.current.getBoundingClientRect()
    const el = tipRef.current
    setCoords(computeTooltipPosition(tr, el.offsetWidth, el.offsetHeight))
  }, [open, title])

  const tooltip =
    open && title.trim()
      ? createPortal(
          <div
            ref={tipRef}
            className="info-tooltip-portal"
            role="tooltip"
            style={{
              left: coords?.left ?? 0,
              top: coords?.top ?? 0,
              opacity: coords ? 1 : 0,
            }}
          >
            {title}
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <span
        ref={wrapRef}
        className={['inspector-field-hint', className].filter(Boolean).join(' ')}
        role="img"
        aria-label={title}
        tabIndex={0}
        onMouseEnter={scheduleShow}
        onMouseLeave={hide}
        onFocus={scheduleShow}
        onBlur={hide}
      >
        ?
      </span>
      {tooltip}
    </>
  )
}
