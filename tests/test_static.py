import gzip
from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.aegis.static import PrecompressedStaticFiles


def test_precompressed_assets_and_cache_negotiation(tmp_path):
    folder=tmp_path/'assets';folder.mkdir()
    content=b'export const anatomy = true;\n'*200
    (folder/'scene-12345678.js').write_bytes(content)
    (folder/'scene-12345678.js.gz').write_bytes(gzip.compress(content))
    app=FastAPI();app.mount('/',PrecompressedStaticFiles(directory=tmp_path,html=True))
    client=TestClient(app)
    response=client.get('/assets/scene-12345678.js',headers={'Accept-Encoding':'gzip'})
    assert response.content==content and response.headers['content-encoding']=='gzip'
    assert 'javascript' in response.headers['content-type']
    assert 'immutable' in response.headers['cache-control']
    assert response.headers['vary']=='Accept-Encoding'
    identity=client.get('/assets/scene-12345678.js',headers={'Accept-Encoding':'gzip;q=0, br;q=0'})
    assert 'content-encoding' not in identity.headers and identity.content==content
    assert client.get('/missing.glb').status_code==404


def test_models_revalidate_instead_of_becoming_stale(tmp_path):
    (tmp_path/'overview.glb').write_bytes(b'glTF test')
    app=FastAPI();app.mount('/',PrecompressedStaticFiles(directory=tmp_path))
    client=TestClient(app)
    response=client.get('/overview.glb')
    assert response.headers['cache-control']=='no-cache'
    assert client.get('/overview.glb',headers={'If-None-Match':response.headers['etag']}).status_code==304
