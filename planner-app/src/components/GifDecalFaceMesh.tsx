/* eslint-disable react-hooks/immutability -- GIF frames blit into CanvasTexture imperatively (Three.js). */
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import {
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  SRGBColorSpace,
  type Texture,
} from 'three'
import type { AssetDecal } from '../types/asset'
import type { FaceSpec } from '../scene/decalFaceSpec'
import { fetchGifBufferFromDataUrl, rasterizeGifFrames } from '../scene/gifDecalParse'

export function GifDecalFaceMesh({
  decal,
  spec,
}: {
  decal: AssetDecal
  spec: FaceSpec
}) {
  const [texture, setTexture] = useState<Texture | null>(null)
  const rasterRef = useRef<Awaited<ReturnType<typeof rasterizeGifFrames>> | null>(null)
  const frameIndexRef = useRef(0)
  const accMsRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const imageDataRef = useRef<ImageData | null>(null)

  const gif = decal.gif
  const playing = gif?.playing !== false
  const speed = gif?.speed != null && gif.speed >= 0.5 && gif.speed <= 2 ? gif.speed : 1
  const loop = gif?.loop !== false

  useEffect(() => {
    if (!playing || loop || !texture) return
    const raster = rasterRef.current
    if (!raster || raster.frames.length < 2) return
    const last = raster.frames.length - 1
    if (frameIndexRef.current < last) return
    frameIndexRef.current = 0
    accMsRef.current = 0
    const ctx = ctxRef.current
    const img = imageDataRef.current
    const px0 = raster.frames[0]
    if (ctx && img && px0) {
      img.data.set(px0)
      ctx.putImageData(img, 0, 0)
      texture.needsUpdate = true
    }
  }, [playing, loop, texture])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const buf = await fetchGifBufferFromDataUrl(decal.imageUrl)
      if (!buf || cancelled) return
      const raster = rasterizeGifFrames(buf)
      if (!raster || raster.frames.length === 0 || cancelled) return
      rasterRef.current = raster
      const canvas = document.createElement('canvas')
      canvas.width = raster.width
      canvas.height = raster.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      canvasRef.current = canvas
      ctxRef.current = ctx
      imageDataRef.current = ctx.createImageData(raster.width, raster.height)
      const first = raster.frames[0]
      if (imageDataRef.current && first) {
        imageDataRef.current.data.set(first)
        ctx.putImageData(imageDataRef.current, 0, 0)
      }
      const tex = new CanvasTexture(canvas)
      tex.colorSpace = SRGBColorSpace
      tex.minFilter = LinearFilter
      tex.magFilter = LinearFilter
      tex.needsUpdate = true
      setTexture(tex)
      frameIndexRef.current = 0
      accMsRef.current = 0
    })()
    return () => {
      cancelled = true
      setTexture((t) => {
        t?.dispose()
        return null
      })
      rasterRef.current = null
      canvasRef.current = null
      ctxRef.current = null
      imageDataRef.current = null
    }
  }, [decal.imageUrl])

  useFrame((_, delta) => {
    const raster = rasterRef.current
    const ctx = ctxRef.current
    const img = imageDataRef.current
    if (!raster || !ctx || !img || !texture) return
    if (!playing || raster.frames.length < 2) return

    accMsRef.current += delta * 1000 * speed
    const delays = raster.delaysMs
    let idx = frameIndexRef.current
    const delay = delays[idx] ?? 100

    if (accMsRef.current < delay) return
    accMsRef.current = 0
    idx += 1
    if (idx >= raster.frames.length) {
      if (loop) {
        idx = 0
      } else {
        idx = raster.frames.length - 1
        frameIndexRef.current = idx
        const px = raster.frames[idx]
        if (px) {
          img.data.set(px)
          ctx.putImageData(img, 0, 0)
          texture.needsUpdate = true
        }
        return
      }
    }
    frameIndexRef.current = idx
    const px = raster.frames[idx]
    if (px) {
      img.data.set(px)
      ctx.putImageData(img, 0, 0)
      texture.needsUpdate = true
    }
  })

  const w = Math.max(0.02, spec.width * decal.size)
  const h = Math.max(0.02, spec.height * decal.size)
  const ox = decal.offsetX * spec.width
  const oy = decal.offsetY * spec.height
  const px =
    spec.position[0] + spec.offsetAxisX[0] * ox + spec.offsetAxisY[0] * oy
  const py =
    spec.position[1] + spec.offsetAxisX[1] * ox + spec.offsetAxisY[1] * oy
  const pz =
    spec.position[2] + spec.offsetAxisX[2] * ox + spec.offsetAxisY[2] * oy
  const rotZ = (decal.rotation * Math.PI) / 180

  if (!texture) return null

  return (
    <mesh
      position={[px, py, pz]}
      rotation={[spec.rotation[0], spec.rotation[1], spec.rotation[2] + rotZ]}
    >
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={decal.opacity}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
        side={DoubleSide}
      />
    </mesh>
  )
}
