import { Billboard } from '@react-three/drei'
import { useLayoutEffect, useMemo } from 'react'
import { CanvasTexture, DoubleSide, MeshBasicMaterial, SRGBColorSpace } from 'three'
import { buildTextLabelTexture } from '../scene/textLabelTexture'
import type { TextLabelStyle } from '../types/asset'

/**
 * Lesbares Label: Canvas mit Hintergrund + Text, als Plane immer zur Kamera gedreht.
 */
export default function BillboardTextLabel({
  text,
  fontSizeWorld,
  labelStyle,
}: {
  text: string
  fontSizeWorld: number
  labelStyle: TextLabelStyle
}) {
  const { texture, planeWidth, planeHeight } = useMemo(() => {
    const { canvas, planeWidth: pw, planeHeight: ph } = buildTextLabelTexture(
      text,
      fontSizeWorld,
      labelStyle,
    )
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.needsUpdate = true
    return { texture: tex, planeWidth: pw, planeHeight: ph }
  }, [text, fontSizeWorld, labelStyle])

  useLayoutEffect(() => {
    return () => {
      texture.dispose()
    }
  }, [texture])

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    [texture],
  )

  useLayoutEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      <mesh material={material} scale={[planeWidth, planeHeight, 1]}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </Billboard>
  )
}
