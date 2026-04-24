import { Environment } from '@react-three/drei'

export interface ViewModeOverlayProps {
  mode: 'edit' | 'view'
}

export default function ViewModeOverlay({ mode }: ViewModeOverlayProps) {
  if (mode !== 'view') {
    return null
  }

  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight
        castShadow
        position={[22, 32, 18]}
        intensity={1.9}
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={0.5}
        shadow-camera-far={120}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-bias={-0.00015}
      />
      <directionalLight position={[-20, 16, -10]} intensity={0.45} color="#bfe3ff" />
      <hemisphereLight args={['#eaf2ff', '#20303f', 0.55]} />
      <Environment preset="warehouse" />
    </>
  )
}
