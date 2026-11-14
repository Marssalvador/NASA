import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Status } from './types';
import { colors } from './Humanoid';
export default function Body3D({selected,onSelect,states}:{selected:string;onSelect:(id:string)=>void;states:Record<string,Status>}) {
  const segments:[number,number,number,number,number,number][]=[
    [0,1.95,0,.23,.3,.23],[0,1.48,0,.11,.18,.11],[0,.85,0,.48,.67,.23],[0,-.03,0,.32,.32,.22],
    [-.62,.83,0,.14,.5,.14],[.62,.83,0,.14,.5,.14],[-.8,.05,0,.11,.43,.11],[.8,.05,0,.11,.43,.11],
    [-.22,-.76,0,.18,.58,.18],[.22,-.76,0,.18,.58,.18],[-.23,-1.7,0,.12,.45,.12],[.23,-1.7,0,.12,.45,.12]];
  const organs:{id:string;position:[number,number,number];scale:[number,number,number]}[]=[
    {id:'brain',position:[0,2,.03],scale:[.18,.2,.2]}, {id:'lungs',position:[-.21,1.03,.12],scale:[.18,.3,.16]},
    {id:'lungs',position:[.21,1.03,.12],scale:[.18,.3,.16]}, {id:'heart',position:[.06,.88,.27],scale:[.13,.18,.12]},
    {id:'kidneys',position:[-.22,.29,.16],scale:[.1,.14,.1]}, {id:'kidneys',position:[.22,.29,.16],scale:[.1,.14,.1]},
    {id:'metabolic',position:[0,.49,.19],scale:[.28,.13,.12]}, {id:'muscles',position:[-.23,-.65,.12],scale:[.13,.42,.1]},
    {id:'muscles',position:[.23,-.65,.12],scale:[.13,.42,.1]}, {id:'skeleton',position:[0,.82,.04],scale:[.035,.55,.04]},
    {id:'skeleton',position:[-.23,-1.58,.05],scale:[.045,.45,.05]}, {id:'skeleton',position:[.23,-1.58,.05],scale:[.045,.45,.05]}];
  return <div className="canvas-wrap" aria-label="Humanoide 3D: arrastra para rotar; selecciona sistemas con la lista accesible"><Canvas camera={{position:[0,.3,6.5],fov:46}} dpr={[1,1.5]} gl={{antialias:true,preserveDrawingBuffer:true}}>
    <ambientLight intensity={1.2}/><directionalLight position={[3,3,5]} intensity={2}/><pointLight position={[-3,2,-2]} color="#73ead7" intensity={8}/>
    <group position={[0,-.03,0]}>
      {segments.map(([x,y,z,sx,sy,sz],i)=><mesh key={i} position={[x,y,z]} scale={[sx,sy,sz]}><sphereGeometry args={[1,24,24]}/><meshStandardMaterial color="#4e8991" transparent opacity={.14} depthWrite={false} wireframe/></mesh>)}
      {organs.map((o,i)=><mesh key={i} name={`region_${o.id}_${i}`} position={o.position} scale={o.scale} onClick={e=>{e.stopPropagation();onSelect(o.id);}}>
        <sphereGeometry args={[1,24,24]}/><meshStandardMaterial color={colors[states[o.id]??'insufficient_data']} emissive={colors[states[o.id]??'insufficient_data']} emissiveIntensity={selected===o.id?.6:.15} transparent opacity={selected===o.id?.95:.55}/>
      </mesh>)}
    </group><gridHelper args={[6,24,'#214047','#17272e']} position={[0,-2.24,0]}/><OrbitControls target={[0,0,0]} enablePan={false} minDistance={4} maxDistance={9}/>
  </Canvas><span className="canvas-caption">Geometría esquemática · arrastra para rotar</span></div>;
}
