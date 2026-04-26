import type { TextLabelStyle } from '../types/asset'
import { mergeLabelStyle } from '../types/asset'

export interface TextLabelTextureResult {
  canvas: HTMLCanvasElement
  /** Welt-Höhe ~ fontSize; Breite proportional */
  planeWidth: number
  planeHeight: number
}

/**
 * Canvas-Textur mit optionalem Hintergrund (abgerundetes Rechteck) für lesbare Labels.
 */
export function buildTextLabelTexture(
  text: string,
  fontSizeWorld: number,
  styleIn?: Partial<TextLabelStyle>,
): TextLabelTextureResult {
  const style = mergeLabelStyle(styleIn)
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
  const fontPx = Math.max(12, Math.round((style.fontPx ?? 28) * dpr))
  const pad = Math.max(0, Math.round((style.paddingPx ?? 10) * dpr))
  const radius = Math.max(0, Math.round((style.borderRadiusPx ?? 6) * dpr))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.width = 4
    canvas.height = 4
    return { canvas, planeWidth: fontSizeWorld, planeHeight: fontSizeWorld * 0.35 }
  }

  ctx.font = `${style.fontWeight === 'bold' ? 'bold ' : ''}${fontPx}px system-ui, Segoe UI, sans-serif`
  const lines = text.split('\n').slice(0, 8)
  const metrics = lines.map((line) => ctx.measureText(line || ' '))
  const textW = Math.max(...metrics.map((m) => m.width), fontPx)
  const lineH = fontPx * 1.25
  const textH = lines.length * lineH

  const bw = Math.ceil(textW + pad * 2)
  const bh = Math.ceil(textH + pad * 2)
  canvas.width = bw
  canvas.height = bh
  ctx.scale(1, 1)
  ctx.font = `${style.fontWeight === 'bold' ? 'bold ' : ''}${fontPx}px system-ui, Segoe UI, sans-serif`
  ctx.textBaseline = 'top'

  const drawRounded = () => {
    ctx.beginPath()
    const r = Math.min(radius, bw / 2, bh / 2)
    if (r <= 0) {
      ctx.rect(0, 0, bw, bh)
      return
    }
    const x = 0
    const y = 0
    const w = bw
    const h = bh
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  if (style.background !== 'none') {
    let fill = 'rgba(255,255,255,0.82)'
    if (style.background === 'dark') fill = 'rgba(20,24,32,0.88)'
    if (style.background === 'custom' && style.backgroundColor) {
      const hex = style.backgroundColor.replace('#', '')
      const a = Math.max(0, Math.min(1, style.backgroundOpacity ?? 0.85))
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const b = parseInt(hex.slice(4, 6), 16)
        fill = `rgba(${r},${g},${b},${a})`
      }
    } else if (style.background === 'light') {
      const a = Math.max(0, Math.min(1, style.backgroundOpacity ?? 0.82))
      fill = `rgba(255,255,255,${a})`
    } else if (style.background === 'dark') {
      const a = Math.max(0, Math.min(1, style.backgroundOpacity ?? 0.88))
      fill = `rgba(20,24,32,${a})`
    }
    ctx.fillStyle = fill
    drawRounded()
    ctx.fill()
  }

  const tx = style.textColor ?? (style.background === 'dark' ? '#f1f5f9' : '#0b1220')
  ctx.fillStyle = tx

  if (style.textShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 4 * dpr
    ctx.shadowOffsetX = 1 * dpr
    ctx.shadowOffsetY = 1 * dpr
  }

  let yOff = pad
  for (const line of lines) {
    if (style.outline) {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.lineWidth = 2 * dpr
      ctx.strokeText(line || ' ', pad, yOff)
    }
    ctx.fillText(line || ' ', pad, yOff)
    yOff += lineH
  }

  ctx.shadowColor = 'transparent'

  const aspect = bw / bh
  const planeHeight = fontSizeWorld * 1.15
  const planeWidth = planeHeight * aspect

  return { canvas, planeWidth, planeHeight }
}
