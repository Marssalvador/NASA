"""Extract selected original DBCLS meshes, never material from licence exceptions.

Only selected archive members are read; no untrusted path is extracted to disk.
Original meshes are converted from millimeters/Z-up to the atlas meters/Y-up.
"""
from pathlib import Path
import json
import hashlib
import zipfile
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets' / 'models' / 'source'
SELECTION = {'FJ2810': ('BodyParts3D skin / FMA7163', 'skin', 'skin'),
             'FJ3147': ('BodyParts3D right kidney / FMA7204', 'kidneys', 'kidney'),
             'FJ3145': ('BodyParts3D left kidney / FMA7205', 'kidneys', 'kidney')}


def parse_obj(text):
    vertices, faces = [], []
    for line in text.splitlines():
        values = line.split()
        if not values:
            continue
        if values[0] == 'v':
            vertices.append([float(v) for v in values[1:4]])
        elif values[0] == 'f':
            indices = [int(v.split('/')[0])-1 for v in values[1:]]
            for i in range(1, len(indices)-1):
                faces.extend([indices[0], indices[i], indices[i+1]])
    return np.array(vertices, dtype=float), faces


def main():
    result = []
    with zipfile.ZipFile(SOURCE / 'bodyparts3d-4.zip') as archive:
        names = archive.namelist()
        print('Archive members:', len(names), names[:4])
        for identifier, (name, region, tissue) in SELECTION.items():
            matches = [n for n in names if Path(n).stem == identifier and n.lower().endswith('.obj')]
            if not matches:
                raise ValueError(f'Missing original mesh: {identifier}')
            vertices, indices = parse_obj(archive.read(matches[0]).decode('utf-8'))
            print(name, len(vertices), 'vertices', len(indices)//3, 'triangles',
                  'bounds:',vertices.min(axis=0).tolist(), vertices.max(axis=0).tolist())
            # BodyParts3D is right-handed, +Z superior, -Y anterior. Z-Anatomy preserves height.
            vertices = vertices[:, [0, 2, 1]] * np.array([.001, .001, -.001])
            # Rigid offset checked against both original atlas kidney bounding boxes (< 0.02 mm).
            vertices += np.array([0, .07478, -.09815])
            faces=np.array(indices,dtype=np.int64).reshape(-1,3)
            triangles=vertices[faces]
            face_normals=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0])
            normals=np.zeros_like(vertices)
            for column in range(3):
                np.add.at(normals,faces[:,column],face_normals)
            normals /= np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-12)
            result.append({'id':identifier, 'name':name,'region':region,'tissue':tissue,
                           'positions':vertices.ravel().tolist(),'normals':normals.ravel().tolist(), 'indices':indices, 'license':'CC-BY-4.0'})
    (SOURCE / 'bodyparts-extracted.json').write_text(json.dumps({'meshes':result}), encoding='utf-8')
    manifest_path=SOURCE.parent/'source-manifest.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['bodyparts3d']={'source':'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip',
        'sha256':hashlib.file_digest((SOURCE/'bodyparts3d-4.zip').open('rb'),'sha256').hexdigest(),
        'license':'CC-BY-4.0','license_source':'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',
        'parts':list(SELECTION),'transform':{'scale':.001,'axes':[0,2,1],'signs':[1,1,-1],'offset_m':[0,.07478,-.09815]}}
    manifest_path.write_text(json.dumps(manifest,indent=2),encoding='utf-8')


if __name__ == '__main__':
    main()
