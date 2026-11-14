"""Download licensed mesh assets only (no upstream application code).

Pinned source revision and checksums are recorded for reproducibility.
Derived anatomy meshes retain CC BY-SA 4.0. See assets/models/ATTRIBUTION.md.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import json
import struct
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REPO = 'pernelluvsya/atlas-proto'
FILES = ['MuscularSystem100.glb', 'SkeletalSystem100.glb', 'VisceralSystem100.glb',
         'CardioVascular41.glb', 'NervousSystem100.glb']


def fetch_json(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'AEGIS-development'})))


def main():
    folder = ROOT / 'assets' / 'models' / 'source'
    folder.mkdir(parents=True, exist_ok=True)
    manifest_path=folder.parent/'source-manifest.json'
    existing=json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    revision = existing.get('revision') or fetch_json(f'https://api.github.com/repos/{REPO}/commits/master')['sha']

    def download(name):
        url = f'https://raw.githubusercontent.com/{REPO}/{revision}/{name}'
        target = folder / name
        urllib.request.urlretrieve(url, target)
        payload = target.read_bytes()
        json_length = struct.unpack_from('<I', payload, 12)[0]
        doc = json.loads(payload[20:20+json_length])
        print(name, len(payload), 'bytes', len(doc.get('meshes', [])), 'meshes',
              'extensions:', doc.get('extensionsRequired', []), flush=True)
        return {'file': name, 'source': url, 'sha256': hashlib.sha256(payload).hexdigest(), 'bytes': len(payload)}

    with ThreadPoolExecutor(max_workers=3) as pool:
        records = list(pool.map(download, FILES))
    manifest_path.write_text(json.dumps(existing | {'repository': REPO, 'revision': revision, 'license': 'CC-BY-SA-4.0', 'files': records}, indent=2), encoding='utf-8')
    for name in ['ATTRIBUTION.md']:
        urllib.request.urlretrieve(f'https://raw.githubusercontent.com/{REPO}/{revision}/{name}', folder / name)
    print('Downloaded anatomy assets; no viewer source imported.', flush=True)


if __name__ == '__main__':
    main()
