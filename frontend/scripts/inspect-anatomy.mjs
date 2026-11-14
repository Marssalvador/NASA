import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, flatten, getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
for (const name of ['MuscularSystem100','SkeletalSystem100','VisceralSystem100','CardioVascular41','NervousSystem100']) {
 const doc=await io.read(`../assets/models/source/${name}.glb`);await doc.transform(dequantize(),flatten());
 const scene=doc.getRoot().listScenes()[0];console.log(name,JSON.stringify(getBounds(scene)));
 const nodes=doc.getRoot().listNodes().filter(n=>n.getMesh());
 for(const n of nodes.filter(n=>/^(Kidney|Stomach|Trachea|Superior lobe|Mandible|Left ventricle|Right ventricle|Myocardium|Right atrium|Left atrium|Left renal|Aorta)|heart|atrial|ventricular/i.test(n.getName())).slice(0,16)) console.log(n.getName(),getBounds(n));
}
