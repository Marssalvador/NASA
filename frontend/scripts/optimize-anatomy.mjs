/** Progressive local atlas: inexpensive overview, detailed systems on demand. */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, flatten, prune, simplifyPrimitive, meshopt, unpartition } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const folder=root+'assets/models/runtime/';await mkdir(folder,{recursive:true});
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const report=[];
for(const region of ['overview','heart','lungs','kidneys','brain','skeleton','muscles','metabolic']) {
 const doc=await io.read(root+'assets/models/humanoid.glb');await doc.transform(dequantize(),flatten());
 let triangles=0;
 for(const node of doc.getRoot().listNodes()) {
  const mesh=node.getMesh();if(!mesh)continue;
  const info=node.getExtras();const peripheral=info.tissue==='artery'||info.tissue==='vein';
  if((region!=='overview'&&info.region!==region)||peripheral||(region!=='overview'&&info.region==='skin')){node.dispose();continue;}
  const ratio=region==='overview'?(info.tissue?.startsWith('cardiac')?.34:info.region==='kidneys'?.4:info.region==='skin'?.45:info.region==='muscles'?.08:.105):region==='heart'?.8:region==='kidneys'?.85:region==='brain'?.3:region==='muscles'?.23:region==='skeleton'?.3:.5;
  for(const primitive of mesh.listPrimitives()) {
   simplifyPrimitive(primitive,{simplifier:MeshoptSimplifier,ratio,error:region==='overview'?.009:.004,lockBorder:false});
   triangles+=(primitive.getIndices()?.getCount()??primitive.getAttribute('POSITION').getCount())/3;
   // Lower cost PBR: no unused clearcoat extension, textures or alpha metadata.
  }
 }
 await doc.transform(prune(),unpartition(),meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:14,quantizeNormal:8}));
 const file=region==='overview'?'overview.glb':`detail-${region}.glb`;
 await io.write(folder+file,doc);const bytes=(await stat(folder+file)).size;
 report.push({region,file,triangles,bytes});console.log(file,triangles,'triangles',bytes,'bytes');
}
await writeFile(folder+'runtime-manifest.json',JSON.stringify({source:'../humanoid.glb',license:'CC-BY-SA-4.0',models:report},null,2));
