import { Billboard } from '@react-three/drei'
import { useLayoutEffect, useMemo } from 'react'
import { CanvasTexture, DoubleSide, MeshBasicMaterial, SRGBColorSpace } from 'three'
import { buildTextLabelTexture } from '../scene/textLabelTexture'
import type { TextLabelStyle } from '../types/asset'
import { mergeLabelStyle } from '../types/asset'

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
  const styleKey = JSON.stringify(mergeLabelStyle(labelStyle))

  const { texture, planeWidth, planeHeight } = useMemo(() => {
    const { canvas, planeWidth: pw, planeHeight: ph } = buildTextLabelTexture(
      text,
      fontSizeWorld,
      JSON.parse(styleKey) as Partial<TextLabelStyle>,
    )
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.needsUpdate = true
    return { texture: tex, planeWidth: pw, planeHeight: ph }
  }, [text, fontSizeWorld, styleKey])

  useLayoutEffect(() => {
    return () => {
      texture.dispose()
    }
  }, [texture])

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: texture,
        color: '#ffffff',
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
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
