const WALL_HEIGHT = 8
const WALL_THICKNESS = 0.35
const HALF_FLOOR = 40

export default function FactoryWalls() {
  const wallY = WALL_HEIGHT / 2
  const sideWallLength = HALF_FLOOR * 2 + WALL_THICKNESS * 2

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, wallY, -HALF_FLOOR - WALL_THICKNESS / 2]}>
        <boxGeometry args={[sideWallLength, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#c5ced8" roughness={0.84} metalness={0.08} />
      </mesh>

      <mesh castShadow receiveShadow position={[-HALF_FLOOR - WALL_THICKNESS / 2, wallY, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, sideWallLength]} />
        <meshStandardMaterial color="#c0cad6" roughness={0.84} metalness={0.08} />
      </mesh>

      <mesh castShadow receiveShadow position={[HALF_FLOOR + WALL_THICKNESS / 2, wallY, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, sideWallLength]} />
        <meshStandardMaterial color="#c0cad6" roughness={0.84} metalness={0.08} />
      </mesh>
    </group>
  )
}
