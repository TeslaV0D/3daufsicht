import { Environment } from '@react-three/drei'

export default function Lighting() {
  return (
    <>
      <ambientLight intensity={0.24} />
      <directionalLight
        castShadow
        position={[18, 24, 12]}
        intensity={1.25}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={90}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <Environment preset="warehouse" />
    </>
  )
}
