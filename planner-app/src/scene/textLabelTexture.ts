import tinycolor from 'tinycolor2'
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
    const a = Math.max(0, Math.min(1, style.backgroundOpacity ?? 0.85))
    let fill: string
    if (style.background === 'light') {
      fill = `rgba(255,255,255,${a})`
    } else if (style.background === 'dark') {
      fill = `rgba(20,24,32,${a})`
    } else if (style.background === 'custom' && style.backgroundColor) {
      const tc = tinycolor(style.backgroundColor)
      if (tc.isValid()) {
        const rgb = tc.toRgb()
        fill = `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`
      } else {
        fill = `rgba(255,255,255,${a})`
      }
    } else {
      fill = `rgba(255,255,255,${a})`
    }
    ctx.fillStyle = fill
    drawRounded()
    ctx.fill()
  }

  const textTc = tinycolor(style.textColor)
  const tx = textTc.isValid()
    ? textTc.toRgbString()
    : style.background === 'dark'
      ? 'rgb(241, 245, 249)'
      : 'rgb(11, 18, 32)'
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
      const strokeTc = tinycolor(style.textColor)
      const strokeRgb = strokeTc.isValid() ? strokeTc.toRgb() : { r: 11, g: 18, b: 32 }
      ctx.strokeStyle = `rgba(${strokeRgb.r},${strokeRgb.g},${strokeRgb.b},0.35)`
      ctx.lineWidth = 2 * dpr
      ctx.strokeText(line || ' ', pad, yOff)
    }
    ctx.fillStyle = tx
    ctx.fillText(line || ' ', pad, yOff)
    yOff += lineH
  }

  ctx.shadowColor = 'transparent'

  const aspect = bw / bh
  const planeHeight = fontSizeWorld * 1.15
  const planeWidth = planeHeight * aspect

  return { canvas, planeWidth, planeHeight }
}
