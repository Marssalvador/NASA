from datetime import datetime, timezone
import json
import pytest
from backend.aegis import registry as registry_module


def spec(content, **kwargs):
    return dict(astronaut_id='crew-01',format='csv',content=content,is_synthetic=False,source='Test instrument') | kwargs


CSV = 'timestamp,metric_id,value,unit\n2026-11-14T12:00:00Z,heart_rate,72,bpm\n'


def test_three_scenarios_come_from_engines(client):
    for i, state in enumerate(['stable','review','emergency'],1):
        d=client.get(f'/api/astronauts/crew-{i:02}/dashboard').json()
        assert d['status'] == state
        assert d['prediction']['validation_status'] == 'demo_unvalidated'
        assert all(a['ci95'] is None for a in d['analyses'])
    assert client.get('/api/astronauts/unknown/dashboard').status_code == 404


def test_import_preview_atomic_commit_duplicates_and_provenance(client):
    s=spec(CSV)
    assert client.post('/api/import/preview',json=s).json()['inserted']==1
    assert client.post('/api/import/preview',json=s).json()['inserted']==1 # preview did not persist
    assert client.post('/api/import/commit',json=s).json()['inserted']==1
    assert client.post('/api/import/commit',json=s).json()['duplicates']==1
    d=client.get('/api/astronauts/crew-01/dashboard?as_of=2026-11-14T13:00:00Z').json()
    a=next(a for a in d['analyses'] if a['metric_id']=='heart_rate')
    assert a['n']==1 and a['baseline'] is None and a['latest']['is_synthetic'] is False


@pytest.mark.parametrize('bad_row',[
    '2026-11-14T12:00:00,heart_rate,72,bpm',
    '2026-11-14T12:00:00Z,heart_rate,nan,bpm',
    '2026-11-14T12:00:00Z,heart_rate,72,kg',
    '2026-11-14T12:00:00Z,unregistered,72,bpm',
])
def test_invalid_import_is_atomic(client,bad_row):
    s=spec(CSV+bad_row+'\n')
    preview=client.post('/api/import/preview',json=s).json()
    assert not preview['valid']
    assert client.post('/api/import/commit',json=s).status_code==422
    assert client.post('/api/import/preview',json=spec(CSV)).json()['inserted']==1


def test_wide_mapping_and_unit_conversion(client):
    s=spec('date;sugar;temp\n2026-11-14T14:00:00+02:00;5;98.6\n',timestamp_column='date',mapping={'sugar':'glucose','temp':'temperature'},units={'glucose':'mmol/L','temperature':'°F'})
    p=client.post('/api/import/preview',json=s).json()
    assert p['valid'] and p['inserted']==2
    assert p['measurements'][0]['value']==pytest.approx(90.091)
    assert p['measurements'][1]['value']==pytest.approx(37)
    assert p['measurements'][0]['timestamp'].startswith('2026-11-14T12:00:00')


def test_multiple_people_rejected(client):
    s=spec(CSV.replace('timestamp,','astronaut_id,timestamp,').replace('2026-','crew-02,2026-'))
    p=client.post('/api/import/preview',json=s).json()
    assert not p['valid'] and 'otra persona' in p['errors'][0]['message']


def test_duplicate_within_file_rejected(client):
    s=spec(CSV+CSV.splitlines()[1]+'\n')
    assert client.post('/api/import/commit',json=s).status_code==422


def test_json_missing_and_quality(client):
    content=json.dumps([{'timestamp':'2026-11-14T12:00:00Z','metric_id':'heart_rate','value':None,'unit':'bpm','quality':'missing'}])
    p=client.post('/api/import/preview',json=spec(content,format='json')).json()
    assert p['valid'] and p['measurements'][0]['quality']=='missing'


def test_dynamic_registry_without_frontend_rebuild(client,tmp_path,monkeypatch):
    definitions=json.loads(registry_module.REGISTRY_PATH.read_text(encoding='utf-8'))
    definitions.append(dict(definitions[0],id='new_variable',name='Nueva variable'))
    path=tmp_path/'registry.json';path.write_text(json.dumps(definitions),encoding='utf-8')
    monkeypatch.setattr(registry_module,'REGISTRY_PATH',path)
    assert any(r['id']=='new_variable' for r in client.get('/api/registry').json())
    d=client.get('/api/astronauts/crew-01/dashboard').json()
    assert next(a for a in d['analyses'] if a['metric_id']=='new_variable')['status']=='insufficient_data'


def test_emergency_bypasses_broken_model(client):
    from backend.aegis.main import app
    class Broken:
        def predict(self,_): raise RuntimeError('offline model error')
    app.state.model=Broken()
    response=client.post('/api/astronauts/crew-01/symptoms',json={'symptom':'severe_breathlessness','timestamp':datetime.now(timezone.utc).isoformat(),'is_synthetic':True})
    assert response.json()['status']=='emergency'
    d=client.get('/api/astronauts/crew-01/dashboard').json()
    assert d['status']=='emergency' and d['prediction'] is None
    assert d['guidance'][0]['validation_status']=='pending_medical_review'


def test_replay_changes_computed_evaluation(client):
    now=client.get('/api/astronauts/crew-02/dashboard').json()
    early=client.get('/api/astronauts/crew-02/dashboard',params={'as_of':now['demo_start']}).json()
    assert now['status']=='review' and early['status']=='insufficient_data'
    assert all(a['n']==1 for a in early['analyses'])


def test_exports_preserve_provenance(client):
    text=client.get('/api/astronauts/crew-01/export?format=csv').text
    assert 'is_synthetic' in text and 'astronaut_id' in text and 'measurement_method' in text
    assert client.get('/api/astronauts/crew-01/export').json()['prediction']['prediction_kind']=='anomaly_score'


def test_export_respects_replay_time(client):
    start=client.get('/api/astronauts/crew-01/dashboard').json()['demo_start']
    result=client.get('/api/astronauts/crew-01/export',params={'as_of':start}).json()
    assert all(a['n']==1 for a in result['analyses'])
    csv=client.get('/api/astronauts/crew-01/export',params={'as_of':start,'format':'csv'}).text
    assert len(csv.splitlines())==len(result['analyses'])+1
