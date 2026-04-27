import tinycolor from 'tinycolor2'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { registerColorPickerEscape } from '../colorPickerEscapeStack'
import { sanitizeColor } from '../types/asset'
import InfoIcon from './InfoIcon'

export const COLOR_FAVORITES_STORAGE_KEY = 'factory-color-favorites'
const MAX_FAVORITES = 10

const HEX_VALID = /^#[0-9A-Fa-f]{6}$/
const HEX_DEBOUNCE_MS = 300

function formatHexInput(s: string): string {
  const t = s.trim()
  if (t === '') return ''
  if (t.startsWith('#')) return t
  if (/^[0-9A-Fa-f]+$/i.test(t)) return `#${t}`
  return t
}

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
  /** Kurzer Hilfetext neben dem Label (?). */
  hint?: string
  /** Erhöhen öffnet den Picker (z. B. Tastatur C). */
  openSignal?: number
}

function ColorPickerPopoverImpl({
  value,
  onCommit,
  disabled,
  label = 'Farbe',
  hint,
  openSignal,
}: ColorPickerPopoverProps) {
  const safe = sanitizeColor(value)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(safe)
  const [hexInput, setHexInput] = useState(safe)
  const [hexError, setHexError] = useState(false)
  const [favorites, setFavorites] = useState<ColorHistoryEntry[]>(() => loadFavorites())
  const popoverRef = useRef<HTMLDivElement>(null)
  const hexDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hexFocusedRef = useRef(false)
  const svDragRef = useRef<HTMLDivElement | null>(null)
  const hueDragRef = useRef<HTMLDivElement | null>(null)
  const svDraggingRef = useRef(false)
  const hueDraggingRef = useRef(false)

  const hsv = useMemo(() => tinycolor(draft).toHsv(), [draft])

  useEffect(() => {
    if (!open || hexFocusedRef.current) return
    setHexInput(sanitizeColor(draft))
  }, [draft, open])

  useEffect(() => {
    return () => {
      if (hexDebounceRef.current != null) clearTimeout(hexDebounceRef.current)
    }
  }, [])

  const commit = useCallback(
    (hex: string) => {
      const n = sanitizeColor(hex)
      setDraft(n)
      setHexInput(n)
      onCommit(n)
    },
    [onCommit],
  )

  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => {
        const c = sanitizeColor(value)
        setDraft(c)
        setHexInput(c)
        setHexError(false)
      }, 0)
      return () => clearTimeout(t)
    }
  }, [value, open])

  useEffect(() => {
    if (openSignal == null || openSignal < 1 || disabled) return
    const t = window.setTimeout(() => {
      const c = sanitizeColor(value)
      setDraft(c)
      setHexInput(c)
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

  const setFromHsv = useCallback(
    (h: number, s: number, v: number) => {
      const next = tinycolor({ h, s, v }).toHexString()
      commit(next)
    },
    [commit],
  )

  const onSvFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = svDragRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
      const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height))
      setFromHsv(hsv.h, x, 1 - y)
    },
    [hsv.h, setFromHsv],
  )

  const onHueFromClient = useCallback(
    (clientX: number) => {
      const el = hueDragRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
      setFromHsv(x * 360, hsv.s, hsv.v)
    },
    [hsv.s, hsv.v, setFromHsv],
  )

  const handleHexChange = useCallback(
    (value: string) => {
      setHexInput(value)
      if (hexDebounceRef.current != null) clearTimeout(hexDebounceRef.current)
      const t = value.trim()
      if (t === '' || t === '#') {
        setHexError(false)
        return
      }
      hexDebounceRef.current = setTimeout(() => {
        if (HEX_VALID.test(value)) {
          setHexError(false)
          setDraft(value)
          onCommit(sanitizeColor(value))
          return
        }
        if (value.length === 7) {
          setHexError(true)
        } else {
          setHexError(false)
        }
      }, HEX_DEBOUNCE_MS)
    },
    [onCommit],
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

  const removeFavorite = useCallback((timestamp: number) => {
    if (!window.confirm('Farbe wirklich aus Favoriten entfernen?')) {
      return
    }
    setFavorites((prev) => {
      const next = prev.filter((e) => e.timestamp !== timestamp)
      persistFavorites(next)
      return next
    })
  }, [])

  const svBg = useMemo(
    () =>
      `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`,
    [hsv.h],
  )

  const cursorLeft = `${hsv.s * 100}%`
  const cursorTop = `${(1 - hsv.v) * 100}%`

  return (
    <label className={`color-picker color-picker-advanced${disabled ? ' input-disabled' : ''}`}>
      <span className="inspector-inline-label">
        {label}
        {hint ? <InfoIcon title={hint} /> : null}
      </span>
      <div className="color-control" ref={popoverRef}>
        <button
          type="button"
          className="color-trigger"
          disabled={disabled}
          onClick={() => {
            if (disabled) return
            const c = sanitizeColor(value)
            setDraft(c)
            setHexInput(c)
            setHexError(false)
            setOpen((o) => !o)
          }}
        >
          <span className="color-trigger-swatch" style={{ backgroundColor: draft }} />
          <span>{draft.toUpperCase()}</span>
        </button>

        {open && !disabled && (
          <div className="color-popover color-popover-extended" role="dialog" aria-label="Farbe">
            <div
              ref={(el) => {
                svDragRef.current = el
              }}
              className="color-sv-grid"
              style={{ background: svBg, width: GRID_SIZE, height: GRID_SIZE }}
              onPointerDown={(e) => {
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                svDraggingRef.current = true
                onSvFromClient(e.clientX, e.clientY)
              }}
              onPointerUp={(e) => {
                svDraggingRef.current = false
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId)
                } catch {
                  /* not captured */
                }
              }}
              onPointerMove={(e) => {
                if (!svDraggingRef.current) return
                onSvFromClient(e.clientX, e.clientY)
              }}
            >
              <div
                className="color-sv-cursor"
                style={{ left: cursorLeft, top: cursorTop }}
              />
            </div>

            <div
              ref={(el) => {
                hueDragRef.current = el
              }}
              className="color-hue-rail"
              style={{ width: GRID_SIZE, height: HUE_HEIGHT }}
              onPointerDown={(e) => {
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                hueDraggingRef.current = true
                onHueFromClient(e.clientX)
              }}
              onPointerUp={(e) => {
                hueDraggingRef.current = false
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId)
                } catch {
                  /* not captured */
                }
              }}
              onPointerMove={(e) => {
                if (!hueDraggingRef.current) return
                onHueFromClient(e.clientX)
              }}
            />

            <label className="color-hex-field">
              Hex
              <input
                type="text"
                value={hexInput}
                placeholder="#RRGGBB"
                maxLength={7}
                onChange={(e) => {
                  const v = e.target.value
                  if (v.length > 7) return
                  handleHexChange(v)
                }}
                onFocus={() => {
                  hexFocusedRef.current = true
                }}
                onBlur={() => {
                  hexFocusedRef.current = false
                  const v = formatHexInput(hexInput)
                  if (HEX_VALID.test(v) || (hexInput.length === 7 && HEX_VALID.test(hexInput))) {
                    const c = HEX_VALID.test(v) ? v : hexInput
                    setHexError(false)
                    setDraft(sanitizeColor(c))
                    onCommit(sanitizeColor(c))
                    setHexInput(sanitizeColor(c))
                    return
                  }
                  if (hexInput.trim() === '') {
                    setHexError(true)
                    setHexInput(sanitizeColor(draft))
                    return
                  }
                  if (!tinycolor(hexInput).isValid()) {
                    setHexError(true)
                    setHexInput(sanitizeColor(draft))
                  } else {
                    setHexError(false)
                    setDraft(sanitizeColor(hexInput))
                    onCommit(sanitizeColor(hexInput))
                    setHexInput(sanitizeColor(hexInput))
                  }
                }}
                className={hexError ? 'color-hex-input-invalid' : undefined}
                style={{
                  border: `1px solid ${hexError ? 'rgb(220, 80, 80)' : 'var(--form-border, #3a3a3a)'}`,
                }}
                aria-invalid={hexError}
              />
              {hexError && (
                <span className="color-hex-error" style={{ color: 'rgb(220, 80, 80)', fontSize: 11 }}>
                  Ungültiger Hex-Wert
                </span>
              )}
            </label>

            <div className="color-favorites-row">
              <button type="button" className="color-fav-add" onClick={addFavorite} title="Als Favorit">
                &#9733; Favorit
              </button>
            </div>
            <div className="color-favorites-heading" aria-hidden="true">
              Favoriten
            </div>
            <ul className="color-favorites-list">
              {favorites.map((f) => (
                <li key={`${f.color}-${f.timestamp}`} className="color-favorite-row">
                  <button
                    type="button"
                    className="color-swatch color-swatch-fav"
                    style={{ backgroundColor: f.color }}
                    title={f.color}
                    onClick={() => commit(f.color)}
                  />
                  <button
                    type="button"
                    className="color-favorite-remove"
                    title="Aus Favoriten entfernen"
                    aria-label={`Favorit ${f.color} entfernen`}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFavorite(f.timestamp)
                    }}
                  >
                    ×
                  </button>
                  <span className="color-favorite-label">
                    {f.label?.trim() ||
                      (() => {
                        const n = tinycolor(f.color).toName()
                        return typeof n === 'string' && n ? n : f.color.toUpperCase()
                      })()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </label>
  )
}

const ColorPickerPopover = memo(ColorPickerPopoverImpl)
export default ColorPickerPopover
