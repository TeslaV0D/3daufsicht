import { decompressFrames, parseGIF } from 'gifuct-js'

export const MAX_GIF_DECAL_FRAMES = 60

export interface GifQuickMeta {
  frameCount: number
  fpsApprox: number
  truncated: boolean
}

/** Schnelle Metadaten ohne vollständiges Raster (für Inspector). */
export function quickGifMeta(buffer: ArrayBuffer): GifQuickMeta | null {
  try {
    const gif = parseGIF(buffer)
    let frames = decompressFrames(gif, false)
    const truncated = frames.length > MAX_GIF_DECAL_FRAMES
    if (truncated) {
      frames = frames.slice(0, MAX_GIF_DECAL_FRAMES)
    }
    const delays = frames.map((f) => Math.max(1, f.delay || 100))
    const avgDelay = delays.reduce((a, b) => a + b, 0) / Math.max(1, delays.length)
    const fpsApprox = Math.round((1000 / avgDelay) * 10) / 10
    return {
      frameCount: frames.length,
      fpsApprox,
      truncated,
    }
  } catch {
    return null
  }
}

export interface GifFrameRaster {
  width: number
  height: number
  delaysMs: number[]
  /** RGBA pro Frame, Länge width*height*4 */
  frames: Uint8ClampedArray[]
  truncated: boolean
}

function drawPatch(
  frame: ReturnType<typeof decompressFrames>[number],
  tempCanvas: HTMLCanvasElement,
  tempCtx: CanvasRenderingContext2D,
  gifCtx: CanvasRenderingContext2D,
  frameImageData: { current: ImageData | null },
) {
  if (!('patch' in frame) || !frame.patch) return
  const patch = frame.patch as Uint8ClampedArray
  const dims = frame.dims
  if (
    !frameImageData.current ||
    frameImageData.current.width !== dims.width ||
    frameImageData.current.height !== dims.height
  ) {
    tempCanvas.width = dims.width
    tempCanvas.height = dims.height
    frameImageData.current = tempCtx.createImageData(dims.width, dims.height)
  }
  frameImageData.current.data.set(patch)
  tempCtx.putImageData(frameImageData.current, 0, 0)
  gifCtx.drawImage(tempCanvas, dims.left, dims.top)
}

/**
 * Dekodiert GIF in RGBA-Frame-Arrays für CanvasTexture / DataTexture.
 */
export function rasterizeGifFrames(buffer: ArrayBuffer): GifFrameRaster | null {
  try {
    const gif = parseGIF(buffer)
    let frames = decompressFrames(gif, true)
    let truncated = false
    if (frames.length > MAX_GIF_DECAL_FRAMES) {
      frames = frames.slice(0, MAX_GIF_DECAL_FRAMES)
      truncated = true
    }
    if (frames.length === 0) return null

    const w = gif.lsd.width
    const h = gif.lsd.height
    const gifCanvas = document.createElement('canvas')
    gifCanvas.width = w
    gifCanvas.height = h
    const gifCtx = gifCtxSafe(gifCanvas)
    const tempCanvas = document.createElement('canvas')
    const tempCtx = gifCtxSafe(tempCanvas)
    const frameImageData: { current: ImageData | null } = { current: null }

    const delaysMs: number[] = []
    const out: Uint8ClampedArray[] = []

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i]
      if (frame.disposalType === 2) {
        gifCtx.clearRect(0, 0, w, h)
      }
      drawPatch(frame, tempCanvas, tempCtx, gifCtx, frameImageData)
      delaysMs.push(Math.max(20, frame.delay || 100))
      const snap = gifCtx.getImageData(0, 0, w, h)
      out.push(new Uint8ClampedArray(snap.data))
    }

    return { width: w, height: h, delaysMs, frames: out, truncated }
  } catch {
    return null
  }
}

function gifCtxSafe(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2d context')
  return ctx
}

export async function fetchGifBufferFromDataUrl(dataUrl: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(dataUrl)
    return await res.arrayBuffer()
  } catch {
    return null
  }
}
