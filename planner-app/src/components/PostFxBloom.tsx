import { Bloom, EffectComposer } from '@react-three/postprocessing'

export default function PostFxBloom({
  enabled,
  intensity,
}: {
  enabled: boolean
  intensity: number
}) {
  if (!enabled || intensity <= 0.001) return null
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        luminanceThreshold={0.82}
        mipmapBlur
        intensity={intensity * 1.75}
        radius={0.42}
      />
    </EffectComposer>
  )
}
