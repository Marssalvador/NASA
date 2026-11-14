import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Status } from './types';
import { colors } from './Humanoid';
export default function Body3D({
  selected,
  onSelect,
  states,
}: {
  selected: string;
  onSelect: (id: string) => void;
  states: Record<string, Status>;
}) {
  const segments: [number, number, number, number, number, number][] = [
    [0, 1.95, 0, 0.23, 0.3, 0.23],
    [0, 1.48, 0, 0.11, 0.18, 0.11],
    [0, 0.85, 0, 0.48, 0.67, 0.23],
    [0, -0.03, 0, 0.32, 0.32, 0.22],
    [-0.62, 0.83, 0, 0.14, 0.5, 0.14],
    [0.62, 0.83, 0, 0.14, 0.5, 0.14],
    [-0.8, 0.05, 0, 0.11, 0.43, 0.11],
    [0.8, 0.05, 0, 0.11, 0.43, 0.11],
    [-0.22, -0.76, 0, 0.18, 0.58, 0.18],
    [0.22, -0.76, 0, 0.18, 0.58, 0.18],
    [-0.23, -1.7, 0, 0.12, 0.45, 0.12],
    [0.23, -1.7, 0, 0.12, 0.45, 0.12],
  ];
  const organs: {
    id: string;
    position: [number, number, number];
    scale: [number, number, number];
  }[] = [
    { id: 'brain', position: [0, 2, 0.03], scale: [0.18, 0.2, 0.2] },
    { id: 'lungs', position: [-0.21, 1.03, 0.12], scale: [0.18, 0.3, 0.16] },
    { id: 'lungs', position: [0.21, 1.03, 0.12], scale: [0.18, 0.3, 0.16] },
    { id: 'heart', position: [0.06, 0.88, 0.27], scale: [0.13, 0.18, 0.12] },
    { id: 'kidneys', position: [-0.22, 0.29, 0.16], scale: [0.1, 0.14, 0.1] },
    { id: 'kidneys', position: [0.22, 0.29, 0.16], scale: [0.1, 0.14, 0.1] },
    { id: 'metabolic', position: [0, 0.49, 0.19], scale: [0.28, 0.13, 0.12] },
    { id: 'muscles', position: [-0.23, -0.65, 0.12], scale: [0.13, 0.42, 0.1] },
    { id: 'muscles', position: [0.23, -0.65, 0.12], scale: [0.13, 0.42, 0.1] },
    { id: 'skeleton', position: [0, 0.82, 0.04], scale: [0.035, 0.55, 0.04] },
    { id: 'skeleton', position: [-0.23, -1.58, 0.05], scale: [0.045, 0.45, 0.05] },
    { id: 'skeleton', position: [0.23, -1.58, 0.05], scale: [0.045, 0.45, 0.05] },
  ];
  return (
    <div
      className="canvas-wrap"
      aria-label="Humanoide 3D: arrastra para rotar; selecciona sistemas con la lista accesible"
    >
      <Canvas
        camera={{ position: [0, 0.3, 6.5], fov: 46 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 3, 5]} intensity={2} />
        <pointLight position={[-3, 2, -2]} color="#73ead7" intensity={8} />
        <group position={[0, -0.03, 0]}>
          {segments.map(([x, y, z, sx, sy, sz], i) => (
            <mesh key={i} position={[x, y, z]} scale={[sx, sy, sz]}>
              <sphereGeometry args={[1, 24, 24]} />
              <meshStandardMaterial
                color="#4e8991"
                transparent
                opacity={0.14}
                depthWrite={false}
                wireframe
              />
            </mesh>
          ))}
          {organs.map((o, i) => (
            <mesh
              key={i}
              name={`region_${o.id}_${i}`}
              position={o.position}
              scale={o.scale}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(o.id);
              }}
            >
              <sphereGeometry args={[1, 24, 24]} />
              <meshStandardMaterial
                color={colors[states[o.id] ?? 'insufficient_data']}
                emissive={colors[states[o.id] ?? 'insufficient_data']}
                emissiveIntensity={selected === o.id ? 0.6 : 0.15}
                transparent
                opacity={selected === o.id ? 0.95 : 0.55}
              />
            </mesh>
          ))}
        </group>
        <gridHelper args={[6, 24, '#214047', '#17272e']} position={[0, -2.24, 0]} />
        <OrbitControls target={[0, 0, 0]} enablePan={false} minDistance={4} maxDistance={9} />
      </Canvas>
      <span className="canvas-caption">Geometría esquemática · arrastra para rotar</span>
    </div>
  );
}
