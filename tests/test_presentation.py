from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from backend.aegis.medical import api, demo, synthetic
from backend.aegis.medical.engine import Engine
from backend.aegis.medical.repository import InMemoryRepository, PostgresRepository


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv('AEGIS_RECORD_BACKEND', 'memory')
    app = FastAPI()
    app.include_router(api.router)
    app.include_router(demo.router)
    with TestClient(app) as c:
        yield c


def start(client):
    response = client.post('/api/v2/demo/sessions')
    assert response.status_code == 200
    return response.json()


def mutate(client, state, path='/step', operation='step', **payload):
    return client.post(f'/api/v2/demo/sessions/{state["session_id"]}{path}',
                       json={'operation_id': operation, 'expected_revision': state['revision'], **payload})


def test_demo_baseline_pattern_test_and_evidence_use_the_actual_engine(client):
    s = start(client)
    original_count = len(client.app.state.medical.repo.observations(synthetic.A112))
    assert s['is_synthetic'] and s['storage'] == 'local'
    assert all(a['certainty'] == 'observation' for a in s['report']['assessments'])
    assert s['references']['hrv']['status'] == 'accepted'
    initial_reference = s['references']['hrv']
    for n in range(2):
        response = mutate(client, s, operation=f'step-{n}')
        assert response.status_code == 200
        after = response.json()
        assert after['as_of'] > s['as_of'] and after['measurement_count'] > s['measurement_count']
        s = after
    heart = next(a for a in s['report']['assessments'] if a['body_region'] == 'heart')
    assert heart['certainty'] == 'suspicion' and heart['evidence_links']
    assert s['references']['hrv'] == initial_reference
    request = next(t for t in s['requests'] if t['biomarker_id'] == 'systolic_bp')
    response = mutate(client, s, f'/tests/{request["id"]}/result', 'result', value=140)
    assert response.status_code == 200
    final = response.json()
    heart = next(a for a in final['report']['assessments'] if a['body_region'] == 'heart')
    assert heart['certainty'] == 'confirmed_finding' and heart['supersedes_id']
    assert final['last_change']['measurement_id'] in heart['evidence_ids']
    headers = {'X-AEGIS-User': final['user_id']}
    original = client.get(f'/api/v2/measurements/{final["last_change"]["measurement_id"]}', headers=headers)
    assert original.status_code == 200 and original.json()['current']['is_synthetic']
    stored = client.get(f'/api/v2/astronauts/{final["code"]}/evaluations', headers=headers).json()
    assert heart['id'] in {a['id'] for a in stored}
    assert len(client.app.state.medical.repo.observations(synthetic.A112)) == original_count


def test_retries_and_stale_revisions_do_not_duplicate_measurements(client):
    s = start(client)
    first = mutate(client, s).json()
    retry = mutate(client, s).json()
    assert retry['revision'] == first['revision'] and retry['measurement_count'] == first['measurement_count']
    assert mutate(client, s, operation='another').status_code == 409


def test_reset_keeps_old_synthetic_runs_and_real_records(client):
    s = start(client)
    repo = client.app.state.medical.repo
    # Unrelated real record must survive a reset without a single changed field.
    from dataclasses import replace
    original = repo.profile_by_id(synthetic.A113)
    real = replace(original, id='real-do-not-touch', code='R-001', is_synthetic=False)
    repo.add_profile(real)
    before = list(repo.observations(synthetic.A112))
    new = start(client)
    assert new['session_id'] != s['session_id'] and new['code'] != s['code']
    assert client.get(f'/api/v2/demo/sessions/{s["session_id"]}').status_code == 200
    assert repo.profile_by_id(real.id) == real and repo.observations(synthetic.A112) == before


def test_manual_measurements_validate_quality_units_and_update_history(client):
    s = start(client)
    response = mutate(client, s, '/measurements', 'manual', biomarker_id='heart_rate', value=71, quality='good')
    assert response.status_code == 200
    new = response.json()
    m = next(m for m in new['latest'] if m['biomarker_id'] == 'heart_rate')
    assert m['value'] == 71 and m['is_synthetic'] and m['measured_at'] > s['as_of']
    assert m['id'] in new['series']['heart_rate'][-1]['measurement_ids']
    assert mutate(client, new, '/measurements', 'bad', biomarker_id='unknown', value=4).status_code == 422
    assert mutate(client, new, '/measurements', 'layer2', biomarker_id='ctx_i', value=.5).status_code == 422
    missing = mutate(client, new, '/measurements', 'missing', biomarker_id='heart_rate', value=None, quality='missing').json()
    assert missing['report']['data_states']['heart_rate'] == 'missing'


def test_a_secondary_test_from_another_session_is_rejected(client):
    s = start(client)
    for n in range(2):
        s = mutate(client, s, operation=str(n)).json()
    other = start(client)
    test = s['requests'][0]
    assert mutate(client, other, f'/tests/{test["id"]}/result', value=140).status_code == 404


def test_unavailable_supabase_falls_back_before_start_without_mocking_the_engine(client, monkeypatch):
    repo = PostgresRepository('unused')
    def unavailable(*args, **kwargs):
        raise ConnectionError('unavailable')
    monkeypatch.setattr(repo, 'profile_by_id', unavailable)
    client.app.state.medical = Engine(repo)
    s = start(client)
    assert s['storage'] == 'local' and 'Supabase' in s['storage_note']
    assert s['report']['engine'].startswith('aegis-rules')
    assert isinstance(client.app.state.medical.repo, InMemoryRepository)


def test_missing_supabase_credentials_use_the_same_api_with_local_storage(client, monkeypatch):
    monkeypatch.setenv('AEGIS_RECORD_BACKEND', 'postgres')
    monkeypatch.delenv('AEGIS_DATABASE_URL', raising=False)
    s = start(client)
    assert s['storage'] == 'local' and 'Supabase' in s['storage_note']
    assert len(s['report']['assessments']) == 4
