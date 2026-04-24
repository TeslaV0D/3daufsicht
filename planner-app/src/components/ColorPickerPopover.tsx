import tinycolor from 'tinycolor2'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { registerColorPickerEscape } from '../colorPickerEscapeStack'
import { sanitizeColor } from '../types/asset'

export const COLOR_FAVORITES_STORAGE_KEY = 'factory-color-favorites'
const MAX_FAVORITES = 10

export interface ColorHistoryEntry {
  color: string
  label?: string
  timestamp: number
}

function loadFavorites(): ColorHistoryEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(COLOR_FAVORITES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (x): x is ColorHistoryEntry =>
          !!x &&
          typeof x === 'object' &&
          typeof (x as ColorHistoryEntry).color === 'string' &&
          typeof (x as ColorHistoryEntry).timestamp === 'number',
      )
      .slice(0, MAX_FAVORITES)
  } catch {
    return []
  }
}

function persistFavorites(entries: ColorHistoryEntry[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      COLOR_FAVORITES_STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_FAVORITES)),
    )
  } catch {
    /* ignore */
  }
}

const GRID_SIZE = 200
const HUE_HEIGHT = 18

interface ColorPickerPopoverProps {
  value: string
  onCommit: (hex: string) => void
  disabled?: boolean
  label?: string
  /** Erhöhen öffnet den Picker (z. B. Tastatur C). */
  openSignal?: number
}

export default function ColorPickerPopover({
  value,
  onCommit,
  disabled,
  label = 'Farbe',
  openSignal,
}: ColorPickerPopoverProps) {
  const safe = sanitizeColor(value)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(safe)
  const [favorites, setFavorites] = useState<ColorHistoryEntry[]>(() => loadFavorites())
  const popoverRef = useRef<HTMLDivElement>(null)

  const hsv = useMemo(() => tinycolor(draft).toHsv(), [draft])

  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => setDraft(sanitizeColor(value)), 0)
      return () => clearTimeout(t)
    }
  }, [value, open])

  useEffect(() => {
    if (openSignal == null || openSignal < 1 || disabled) return
    const t = window.setTimeout(() => {
      setDraft(sanitizeColor(value))
      setOpen(true)
    }, 0)
    return () => clearTimeout(t)
  }, [openSignal, disabled, value])

  useEffect(() => {
    if (!open) return
    const onPtr = (event: PointerEvent) => {
      const t = event.target
      if (!(t instanceof Node)) return
      if (popoverRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('pointerdown', onPtr)
    return () => window.removeEventListener('pointerdown', onPtr)
  }, [open])

  useEffect(() => {
    if (!open || disabled) return
    return registerColorPickerEscape(() => setOpen(false))
  }, [open, disabled])

  const commit = useCallback(
    (hex: string) => {
      const n = sanitizeColor(hex)
      setDraft(n)
      onCommit(n)
    },
    [onCommit],
  )

  const setFromHsv = useCallback(
    (h: number, s: number, v: number) => {
      const next = tinycolor({ h, s, v }).toHexString()
      commit(next)
    },
    [commit],
  )

  const onSvGrid = useCallback(
    (clientX: number, clientY: number, el: HTMLDivElement) => {
      const r = el.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
      const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height))
      const s = x
      const v = 1 - y
      setFromHsv(hsv.h, s, v)
    },
    [hsv.h, setFromHsv],
  )

  const onHue = useCallback(
    (clientX: number, el: HTMLDivElement) => {
      const r = el.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
      setFromHsv(x * 360, hsv.s, hsv.v)
    },
    [hsv.s, hsv.v, setFromHsv],
  )

  const addFavorite = useCallback(() => {
    const entry: ColorHistoryEntry = {
      color: sanitizeColor(draft),
      timestamp: Date.now(),
    }
    setFavorites((prev) => {
      const rest = prev.filter(
        (e) => e.color.toLowerCase() !== entry.color.toLowerCase(),
      )
      const next = [entry, ...rest].slice(0, MAX_FAVORITES)
      persistFavorites(next)
      return next
    })
  }, [draft])

  const gridRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)

  const svBg = useMemo(
    () =>
      `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`,
    [hsv.h],
  )

  const cursorLeft = `${hsv.s * 100}%`
  const cursorTop = `${(1 - hsv.v) * 100}%`

  return (
    <label className={`color-picker color-picker-advanced${disabled ? ' input-disabled' : ''}`}>
      {label}
      <div className="color-control" ref={popoverRef}>
        <button
          type="button"
          className="color-trigger"
          disabled={disabled}
          onClick={() => {
            if (disabled) return
            setDraft(sanitizeColor(value))
            setOpen((o) => !o)
          }}
        >
          <span className="color-trigger-swatch" style={{ backgroundColor: draft }} />
          <span>{draft.toUpperCase()}</span>
        </button>

        {open && !disabled && (
          <div className="color-popover color-popover-extended" role="dialog" aria-label="Farbe">
            <div
              ref={gridRef}
              className="color-sv-grid"
              style={{ background: svBg, width: GRID_SIZE, height: GRID_SIZE }}
              onPointerDown={(e) => {
                if (!gridRef.current) return
                onSvGrid(e.clientX, e.clientY, gridRef.current)
              }}
              onPointerMove={(e) => {
                if (e.buttons !== 1 || !gridRef.current) return
                onSvGrid(e.clientX, e.clientY, gridRef.current)
              }}
            >
              <div
                className="color-sv-cursor"
                style={{ left: cursorLeft, top: cursorTop }}
              />
            </div>

            <div
              ref={hueRef}
              className="color-hue-rail"
              style={{ width: GRID_SIZE, height: HUE_HEIGHT }}
              onPointerDown={(e) => {
                if (!hueRef.current) return
                onHue(e.clientX, hueRef.current)
              }}
              onPointerMove={(e) => {
                if (e.buttons !== 1 || !hueRef.current) return
                onHue(e.clientX, hueRef.current)
              }}
            />

            <label className="color-hex-field">
              Hex
              <input
                type="text"
                value={draft}
                placeholder="#RRGGBB"
                onChange={(e) => {
                  const v = e.target.value
                  setDraft(v)
                  if (tinycolor(v).isValid()) commit(v)
                }}
                onBlur={() => commit(draft)}
              />
            </label>

            <div className="color-favorites-row">
              <button type="button" className="color-fav-add" onClick={addFavorite} title="Als Favorit">
                &#9733; Favorit
              </button>
            </div>
            <div className="color-favorites-swatches">
              {favorites.map((f) => (
                <button
                  key={`${f.color}-${f.timestamp}`}
                  type="button"
                  className="color-swatch color-swatch-fav"
                  style={{ backgroundColor: f.color }}
                  title={f.color}
                  onClick={() => commit(f.color)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </label>
  )
}
