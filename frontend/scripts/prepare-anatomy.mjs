/** Prepare licensed atlas meshes for AEGIS. No procedural anatomy or upstream viewer code. */
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dequantize,
  flatten,
  getBounds,
  join,
  mergeDocuments,
  meshopt,
  prune,
  simplify,
  unpartition,
  weld,
} from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = path.join(root, 'assets/models/source');
const output = path.join(root, 'frontend/public/models');
await mkdir(output, { recursive: true });
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});
const atlas = new Document();
const scene = atlas.createScene('AEGIS — Z-Anatomy / BodyParts3D');
const retained = [],
  excluded = [];

function zoneFor(bounds) {
  const y = (bounds.min[1] + bounds.max[1]) / 2;
  const x = (bounds.min[0] + bounds.max[0]) / 2;
  return (
    (y > 1.48 ? 'head' : y > 1.03 ? 'thorax' : y > 0.76 ? 'pelvis' : 'legs') +
    (x < -0.08 ? '_right' : x > 0.08 ? '_left' : '_center')
  );
}

for (const [file, system] of [
  ['MuscularSystem100', 'muscles'],
  ['SkeletalSystem100', 'skeleton'],
  ['VisceralSystem100', 'viscera'],
  ['CardioVascular41', 'heart'],
  ['NervousSystem100', 'brain'],
]) {
  const document = await io.read(path.join(source, file + '.glb'));
  // Name child primitives before flattening so anatomical identity is never lost.
  for (const node of document.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    const ancestry = [];
    let ancestor = node;
    while (ancestor) {
      if (ancestor.getName()) ancestry.push(ancestor.getName());
      ancestor = ancestor.getParentNode();
    }
    node.setName(ancestry[0] || 'unnamed');
    node.setExtras({
      originalName: ancestry[0] || 'unnamed',
      ancestry: ancestry.join(' / '),
      source: file,
    });
  }
  await document.transform(dequantize(), flatten());
  const materials = new Map();
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const name = node.getName(),
      lower = name.toLowerCase(),
      ancestry = String(node.getExtras().ancestry).toLowerCase();
    let region = system,
      tissue = system;
    // Upstream identifies kidney and inner-ear exceptions. Do not redistribute these meshes.
    const excludedLicense =
      (system === 'viscera' && /kidney/i.test(name)) ||
      (system === 'brain' &&
        /ear|tympan|cochle|vestibul|semicircular|saccule|utricle|malleus|incus|stapes|labyrinth|ossicle/i.test(
          ancestry,
        ));
    const excludedExtra = /vh_f_|female|uterus|ovary|vagina|cervicovaginal/i.test(ancestry);
    const attachment =
      system === 'skeleton' && /muscle\.[oe]|muscle\.(o|e)\d|muscle.*\.(or|ol|er|el)\b/i.test(name);
    const brainDisplay =
      /gyrus|gyri|sulcus|lobule|pole|cerebell|pons|medulla|spinal cord|telencephalon|cornea|sclera|iris|lens/i.test(
        name,
      );
    if (excludedLicense || excludedExtra || attachment || (system === 'brain' && !brainDisplay)) {
      excluded.push({
        name,
        source: file,
        reason: excludedLicense
          ? 'upstream licence exception'
          : excludedExtra
            ? 'outside selected male atlas'
            : attachment
              ? 'attachment annotation'
              : 'not required in this view',
      });
      node.dispose();
      continue;
    }
    if (system === 'viscera') {
      region = /lung|bronch|trachea|pleura|epiglott/i.test(ancestry)
        ? 'lungs'
        : /renal|ureter|urethra|urinary/i.test(ancestry)
          ? 'kidneys'
          : 'metabolic';
      if (/lobe.*lung/.test(lower)) tissue = 'lung';
      else if (region === 'lungs') tissue = 'airway';
      else if (/liver/i.test(ancestry)) tissue = 'liver';
      else if (/intestin|colon|duoden|jejun|stomach|oesophag|appendix/i.test(ancestry))
        tissue = 'digestive';
      else if (/omentum|mesocolon|taenia|peritone/.test(lower)) {
        node.dispose();
        continue;
      } else tissue = 'viscera';
    }
    if (system === 'heart') {
      tissue = /atrium|ventricle|papillary|leaflet|valve|myocard/i.test(name)
        ? 'cardiac'
        : /vein|vena|venous|sinus/i.test(name)
          ? 'vein'
          : 'artery';
      if (
        /heart\.g|coronary|atrium|ventricle|ventricular|ascending aorta|arch of aorta|bifurcation of pulmonary trunk/i.test(
          ancestry,
        )
      ) {
        tissue =
          tissue === 'vein' ? 'cardiac_vein' : tissue === 'artery' ? 'cardiac_artery' : 'cardiac';
      }
    }
    if (system === 'muscles')
      tissue = /fascia|aponeuros|tendon|retinacul|linea alba/i.test(name) ? 'tendon' : 'muscle';
    if (system === 'brain') tissue = /cornea|sclera|iris|lens/i.test(name) ? 'eye' : 'brain';
    const bounds = getBounds(node),
      zone = zoneFor(bounds);
    const key = [region, tissue, zone].join('__');
    if (!materials.has(key))
      materials.set(
        key,
        document
          .createMaterial(key)
          .setBaseColorFactor([0.8, 0.7, 0.65, 1])
          .setRoughnessFactor(0.5)
          .setMetallicFactor(0),
      );
    for (const primitive of mesh.listPrimitives()) primitive.setMaterial(materials.get(key));
    retained.push({ name, region, tissue, zone, bounds, source: file });
  }
  await document.transform(prune(), join({ keepNamed: false }), prune());
  const map = mergeDocuments(atlas, document);
  for (const s of document.getRoot().listScenes()) {
    const imported = map.get(s);
    for (const child of [...imported.listChildren()]) scene.addChild(child);
    imported.dispose();
  }
  console.log('Prepared', file, 'parts:', document.getRoot().listMeshes().length);
}

// Original BodyParts3D geometry replaces upstream's kidney licence exceptions and supplies skin.
const bodypartsPath = path.join(source, 'bodyparts-extracted.json');
let bodyparts;
try {
  bodyparts = JSON.parse(await readFile(bodypartsPath, 'utf8'));
} catch {
  throw new Error(
    'Run scripts/extract_bodyparts.py first; required licensed kidney and skin meshes are missing.',
  );
}
for (const item of bodyparts.meshes) {
  const buffer = atlas.createBuffer();
  const position = atlas
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array(item.positions))
    .setBuffer(buffer);
  const indices = atlas
    .createAccessor()
    .setType('SCALAR')
    .setArray(new Uint32Array(item.indices))
    .setBuffer(buffer);
  const normal = atlas
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array(item.normals))
    .setBuffer(buffer);
  const material = atlas
    .createMaterial(`${item.region}__${item.tissue}__center`)
    .setBaseColorFactor([0.8, 0.7, 0.65, 1])
    .setRoughnessFactor(0.5);
  const primitive = atlas
    .createPrimitive()
    .setAttribute('POSITION', position)
    .setAttribute('NORMAL', normal)
    .setIndices(indices)
    .setMaterial(material);
  const mesh = atlas.createMesh(item.name).addPrimitive(primitive);
  const node = atlas.createNode(item.name).setMesh(mesh);
  scene.addChild(node);
  retained.push({
    name: item.name,
    region: item.region,
    tissue: item.tissue,
    zone: 'center',
    bounds: getBounds(node),
    source: 'BodyParts3D 4.0 / DBCLS',
  });
}
// Primitive normals missing from OBJ are generated before compression.
const { normals } = await import('@gltf-transform/functions');
await atlas.transform(weld(), normals({ overwrite: false }), unpartition(), prune());
await atlas.transform(
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.4, error: 0.001, lockBorder: true }),
  prune(),
);
const pieces = [];
for (const node of atlas.getRoot().listNodes()) {
  if (!node.getMesh()) continue;
  const material = node.getMesh().listPrimitives()[0].getMaterial();
  const [region, tissue, zone] = material.getName().split('__');
  const bounds = getBounds(node);
  node.setName(`region_${region}__${tissue}__${zone}`);
  node.setExtras({
    region,
    tissue,
    zone,
    license: region === 'skin' ? 'CC-BY-4.0' : 'CC-BY-SA-4.0',
  });
  pieces.push({
    name: node.getName(),
    region,
    tissue,
    zone,
    bounds,
    triangles: node
      .getMesh()
      .listPrimitives()
      .reduce(
        (n, p) => n + (p.getIndices()?.getCount() || p.getAttribute('POSITION').getCount()) / 3,
        0,
      ),
  });
}
const fullBounds = getBounds(scene);
await atlas.transform(
  meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 16, quantizeNormal: 10 }),
);
await io.write(path.join(output, 'humanoid.glb'), atlas);
await copyFile(path.join(output, 'humanoid.glb'), path.join(root, 'assets/models/humanoid.glb'));
const sourceManifestPath=path.join(root,'assets/models/source-manifest.json');
const sourceManifest=JSON.parse(await readFile(sourceManifestPath,'utf8'));
const modelBytes=await readFile(path.join(output,'humanoid.glb'));
sourceManifest.derived={file:'humanoid.glb',sha256:createHash('sha256').update(modelBytes).digest('hex'),bytes:modelBytes.length,parts:retained.length,render_pieces:pieces.length,triangles:pieces.reduce((s,p)=>s+p.triangles,0),license:'CC-BY-SA-4.0'};
await writeFile(sourceManifestPath,JSON.stringify(sourceManifest,null,2));
await writeFile(
  path.join(output, 'anatomy-manifest.json'),
  JSON.stringify(
    { version: 1, units: 'meters', bounds: fullBounds, pieces, parts: retained, excluded },
    null,
    2,
  ),
);
console.log(
  'AEGIS anatomy:',
  pieces.length,
  'render pieces;',
  pieces.reduce((s, p) => s + p.triangles, 0),
  'triangles;',
  JSON.stringify(fullBounds),
);
