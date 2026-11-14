from dataclasses import replace
from datetime import datetime, timedelta, timezone
import math
import pytest
from fastapi.testclient import TestClient
from backend.aegis.main import app
from backend.aegis.medical import cycle, features, memory, synthetic, validation
from backend.aegis.medical.adapter import ModelAdapter, ModelOutput, guard, RuleEngineAdapter
from backend.aegis.medical.domain import Assessment
from backend.aegis.medical.engine import Engine
from backend.aegis.medical.knowledge import Knowledge
from backend.aegis.medical.repository import AccessDenied, InMemoryRepository

K = Knowledge.load()
AS_OF = synthetic.AS_OF


@pytest.fixture
def repo():
    return synthetic.build(InMemoryRepository())


@pytest.fixture
def engine(repo):
    return Engine(repo, K)


def row(**over):
    base = {'biomarker_id': 'hrv', 'unit': 'ms', 'value': 50, 'measured_at': '2026-11-20T07:00:00Z',
            'source': 'test', 'is_synthetic': True}
    return base | over


# --- isolation --------------------------------------------------------------------------------
def test_records_are_isolated_and_revocable(repo):
    assert [p.code for p in repo.accessible('user-a113')] == ['A-113']
    with pytest.raises(AccessDenied):
        repo.profile('A-112', 'user-a113')
    with pytest.raises(AccessDenied):
        repo.profile('A-112', 'nobody')
    repo.revoke('user-a112', synthetic.A112)
    assert repo.accessible('user-a112') == []


def test_engine_reads_only_the_requested_astronaut(engine):
    report = engine.evaluate(synthetic.A113, AS_OF)
    every_id = {i for a in report['assessments'] for i in a['evidence_ids']}
    a112_ids = {o.id for o in engine.repo.observations(synthetic.A112)}
    assert not every_id & a112_ids
    assert all(a['alert_level'] == 'green' for a in report['assessments'])


# --- data quality, units, duplicates, missing ------------------------------------------------
@pytest.mark.parametrize('bad, message', [
    (row(value=float('nan')), 'no finito'),
    (row(value='inf'), 'no finito'),
    (row(unit='s'), 'incompatible'),
    (row(biomarker_id='unknown'), 'no registrado'),
    (row(measured_at='2026-11-20T07:00:00'), 'zona horaria'),
    (row(value=None), 'quality=missing'),
    ({k: v for k, v in row().items() if k != 'is_synthetic'}, 'is_synthetic'),
    (row(source=' '), 'fuente'),
])
def test_validation_rejects_without_repairing(bad, message):
    accepted, report = validation.validate([bad], synthetic.A112, K, set())
    assert accepted == [] and message in report['rejected'][0]['error']


def test_timestamps_are_normalised_to_utc_and_duplicates_skipped():
    accepted, report = validation.validate([row(measured_at='2026-11-20T09:00:00+02:00'), row()], 'x', K, set())
    assert len(accepted) == 1 and report['duplicates'] == 1
    assert accepted[0]['measured_at'] == datetime(2026, 11, 20, 7, tzinfo=timezone.utc)
    existing = {('x', 'hrv', accepted[0]['measured_at'], 'test')}
    assert validation.validate([row()], 'x', K, existing)[0] == []


def test_missing_layer_two_inputs_are_reported_not_imputed(engine):
    report = engine.evaluate(synthetic.A112, AS_OF)
    renal = next(a for a in report['assessments'] if a['risk_id'] == 'renal_stones')
    assert renal['input_quality'] == 'partial'
    assert 'sweat_potassium' in renal['missing_inputs']
    assert report['data_states']['sweat_potassium'] == 'missing'


# --- physiological memory ---------------------------------------------------------------------
def test_initial_reference_comes_only_from_preflight(engine):
    engine.evaluate(synthetic.A112, AS_OF)
    initial = next(b for b in engine.repo.baselines(synthetic.A112)
                   if b.biomarker_id == 'resistive_exercise_minutes' and b.kind == 'initial_stable' and b.context_key == 'all')
    preflight = {o.id for o in engine.repo.observations(synthetic.A112)
                 if o.measured_at < synthetic.MISSION_START and o.biomarker_id == 'resistive_exercise_minutes'}
    assert set(initial.input_ids) == preflight
    assert 55 < initial.center < 65  # the mission decline is not absorbed


def test_persistent_change_is_reported_but_never_normalised(engine):
    report = engine.evaluate(synthetic.A112, AS_OF)
    shift = next(s for s in report['persistent_shifts'] if s['biomarker_id'] == 'resistive_exercise_minutes')
    assert shift['robust_z'] < -2 and 'No se incorpora' in shift['note']
    later = engine.evaluate(synthetic.A112, AS_OF + timedelta(days=0))
    assert later['persistent_shifts'] == report['persistent_shifts']


def test_reference_versions_only_change_with_new_inputs(engine):
    engine.evaluate(synthetic.A112, AS_OF)
    count = len(engine.repo.baselines(synthetic.A112))
    engine.evaluate(synthetic.A112, AS_OF)
    assert len(engine.repo.baselines(synthetic.A112)) == count  # identical inputs reuse stored versions
    engine.repo.append_observations([{**validation.validate([row(measured_at='2026-10-10T07:00:00Z')], synthetic.A112, K,
                                                             set())[0][0]}], actor='test')
    engine.evaluate(synthetic.A112, AS_OF)
    versions = [b for b in engine.repo.baselines(synthetic.A112)
                if b.biomarker_id == 'hrv' and b.kind == 'initial_stable' and b.context_key == 'all']
    assert [b.version for b in versions] == [1, 2] and versions[1].parent_id == versions[0].id


def test_real_and_synthetic_observations_never_pool(repo):
    real = [o for o in repo.observations(synthetic.A112) if o.biomarker_id == 'hrv'][:1]
    pooled = real + [replace(real[0], id=999, is_synthetic=False, measured_at=real[0].measured_at + timedelta(days=60))]
    assert {o.is_synthetic for o in memory.cohort(pooled)} == {False}


# --- menstrual cycle context -------------------------------------------------------------------
def test_cycle_phase_follows_declared_menstruation(repo):
    profile = repo.profile_by_id(synthetic.A112)
    events = repo.events(synthetic.A112)
    assert cycle.phase_at(synthetic.MISSION_START + timedelta(days=19), profile, events, K) == 'menstrual'
    assert cycle.phase_at(synthetic.MISSION_START + timedelta(days=10), profile, events, K) == 'luteal'
    male = repo.profile_by_id(synthetic.A113)
    assert cycle.phase_at(AS_OF, male, [], K) is None


def test_luteal_temperature_rise_does_not_alert(engine):
    report = engine.evaluate(synthetic.A112, synthetic.MISSION_START + timedelta(days=12, hours=23))
    assert report['cycle_phase'] == 'luteal'
    assert not [m for m in report['protocol_matches'] if m['id'].startswith('temperature')]


def test_documented_tolerance_applies_when_only_global_reference_exists():
    assert features._toward_zero(0.55, 0.5) == pytest.approx(0.05)
    assert features._toward_zero(-20, 15) == -5
    assert features._toward_zero(-3, 15) == 0


# --- evaluation pipeline -----------------------------------------------------------------------
def test_pipeline_finds_documented_pattern_and_requests_layer_two(engine):
    report = engine.evaluate(synthetic.A112, AS_OF)
    by_risk = {a['risk_id']: a for a in report['assessments']}
    assert {a['biomarker_id'] for a in report['anomalies']} >= {'hrv', 'heart_rate', 'resistive_exercise_minutes'}
    assert 'hrv.yellow' in [m['id'] for m in report['protocol_matches']]
    bone = by_risk['bone_resorption']
    assert bone['certainty'] == 'suspicion' and bone['level_source'] == 'engine_assumption'
    assert {t['biomarker_id'] for t in bone['test_requests']} == {'ctx_i', 'p1np'}
    inflammation = by_risk['inflammation_recovery']
    assert inflammation['alert_level'] == 'yellow' and inflammation['level_source'] == 'document'
    assert all(r['display'] == 'Pendiente de revisión médica' for r in inflammation['recommendations'])
    assert all(r['proposed_text'] is None for r in inflammation['recommendations'] if r['category'] == 'pharmacological')
    assert all('no es un diagnóstico' in a['explanation'] for a in report['assessments'])


def test_evaluation_is_reproducible(engine):
    first = engine.evaluate(synthetic.A112, AS_OF)
    second = engine.evaluate(synthetic.A112, AS_OF)
    strip = lambda r: [(a['risk_id'], a['alert_level'], a['certainty'], a['reproducibility_hash'], a['evidence_ids'])
                       for a in r['assessments']]
    assert strip(first) == strip(second)
    assert not any(a['test_requests'] for a in second['assessments'])  # open requests are not duplicated


def test_result_triggers_reevaluation_and_supersedes(engine):
    report = engine.evaluate(synthetic.A112, AS_OF)
    bone = next(a for a in report['assessments'] if a['risk_id'] == 'bone_resorption')
    ctx = next(t for t in bone['test_requests'] if t['biomarker_id'] == 'ctx_i')
    outcome = engine.record_test_result(ctx['id'], {'value': 0.52, 'unit': 'ng/mL', 'measured_at': AS_OF.isoformat(),
                                                    'source': 'lab-on-chip (sintético)', 'is_synthetic': True}, 'surgeon-1')
    new = outcome['reevaluation']
    assert new['certainty'] == 'confirmed_finding' and new['supersedes_id'] == bone['id']
    assert outcome['measurement_id'] in new['evidence_ids']
    request = engine.repo.request(ctx['id'])
    assert request.status == 'resulted' and request.reevaluation_assessment_id == new['id']
    with pytest.raises(ValueError):
        engine.record_test_result(ctx['id'], {'value': 0.5, 'unit': 'ng/mL', 'measured_at': AS_OF.isoformat(),
                                              'source': 'x', 'is_synthetic': True}, 'surgeon-1')


def test_engine_can_never_store_a_diagnosis_or_disease_probability(repo):
    base = dict(astronaut_id='x', risk_id='bone_resorption', period_start=AS_OF, period_end=AS_OF, model_name='m',
                model_version='1', alert_level='green', result={}, uncertainty={'kind': 'q'}, input_quality='complete',
                inputs_used={}, missing_inputs=[], evidence_ids=[], context={}, explanation='x', reproducibility_hash='h')
    with pytest.raises(ValueError):
        repo.save_assessment(Assessment(certainty='clinical_diagnosis', **base))
    with pytest.raises(ValueError):
        repo.save_assessment(Assessment(certainty='observation', **{**base, 'result': {'disease_probability': 0.3}}))


# --- emergencies and models ---------------------------------------------------------------------
class BrokenAdapter(ModelAdapter):
    name, version, validation_status = 'broken', '0', 'unvalidated'

    def __init__(self, knowledge=None):
        pass

    def predict(self, model_input):
        raise RuntimeError('model offline')


def test_emergency_is_independent_of_the_model(repo):
    repo.append_event({'astronaut_id': synthetic.A112, 'kind': 'symptom', 'started_at': AS_OF - timedelta(hours=1),
                       'severity': 'severe', 'details': {'code': 'chest_pain'}, 'is_synthetic': True})
    report = Engine(repo, K, BrokenAdapter()).evaluate(synthetic.A112, AS_OF)
    assert report['model_error'].startswith('RuntimeError')
    assert [e['id'] for e in report['emergencies']] == ['emergency.arrhythmia']
    assert report['assessments'] == []


def test_unvalidated_models_cannot_emit_probabilities(engine):
    report = engine.evaluate(synthetic.A112, AS_OF)
    model_input = type('I', (), {'astronaut_id': synthetic.A112, 'period_start': AS_OF, 'period_end': AS_OF})()
    output = ModelOutput('bone_resorption', synthetic.A112, AS_OF, AS_OF, 'x', '1', 'unvalidated', {}, 'complete',
                         {'risk': {'probability': 0.7}}, {'kind': 'q'}, [])
    with pytest.raises(ValueError, match='no validado'):
        guard(output, model_input)
    with pytest.raises(ValueError, match='otro astronauta'):
        guard(replace(output, astronaut_id='other', result={}), model_input)
    assert isinstance(engine.adapter, RuleEngineAdapter) and report['model']['validation_status'] == 'demo_unvalidated'


# --- corrections and API ----------------------------------------------------------------------
def test_corrections_keep_the_original(repo):
    original = repo.observations(synthetic.A112)[0]
    new_id = repo.correct_observation(original.id, 51.0, 'good', 'transcription error', 'user-a112')
    chain = repo.observation_chain(original.id)
    assert [o.id for o in chain] == [original.id, new_id] and chain[0].value == original.value
    assert original.id not in {o.id for o in repo.observations(synthetic.A112)}
    with pytest.raises(ValueError):
        repo.correct_observation(original.id, 52.0, 'good', 'again', 'user-a112')


@pytest.fixture
def api(tmp_path, monkeypatch):
    from backend.aegis import store
    monkeypatch.setattr(store, 'DB_PATH', str(tmp_path / 'legacy.sqlite'))
    monkeypatch.setenv('AEGIS_RECORD_BACKEND', 'memory')
    with TestClient(app) as client:
        if hasattr(app.state, 'medical'):
            del app.state.medical
        yield client


def test_api_record_evaluation_and_body_systems(api):
    a112 = {'X-AEGIS-User': 'user-a112'}
    assert [p['code'] for p in api.get('/api/v2/astronauts', headers=a112).json()] == ['A-112']
    assert api.get('/api/v2/astronauts/A-113/record', headers=a112).status_code == 404
    record = api.get('/api/v2/astronauts/A-112/record', headers=a112).json()
    hrv = next(x for x in record['latest'] if x['biomarker_id'] == 'hrv')
    assert api.get(hrv['href'], headers=a112).json()['current']['biomarker_id'] == 'hrv'
    assert api.get(hrv['href'], headers={'X-AEGIS-User': 'user-a113'}).status_code == 404
    report = api.post('/api/v2/astronauts/A-112/evaluations', params={'as_of': AS_OF.isoformat()}, headers=a112).json()
    assert all(link.startswith('/api/v2/measurements/') for a in report['assessments'] for link in a['evidence_links'])
    systems = api.get('/api/v2/astronauts/A-112/body-systems', headers=a112).json()
    assert {'skeleton', 'metabolic', 'heart'} <= set(systems['highlight'])
    trend = api.get('/api/v2/astronauts/A-112/trends', params={'biomarker': 'hrv', 'days': 10}, headers=a112).json()
    assert trend['series'] and trend['references']


def test_api_declared_cycle_event_is_timezone_aware_and_profile_scoped(api):
    headers = {'X-AEGIS-User': 'user-a112'}
    path = '/api/v2/astronauts/A-112/events'
    body = {'kind': 'menstruation_start', 'started_at': '2026-11-14T08:00:00Z',
            'is_synthetic': True, 'severity': 'declared', 'details': {'declared_by': 'astronaut'}}
    saved = api.post(path, headers=headers, json=body)
    assert saved.status_code == 201
    assert saved.json()['started_at'].endswith('+00:00')
    assert api.post(path, headers=headers, json=body).status_code == 409
    assert api.post(path, headers={'X-AEGIS-User': 'user-a113'}, json=body).status_code == 404
    assert api.post(path, headers=headers, json={**body, 'started_at': '2026-11-15T08:00:00'}).status_code == 422


def test_api_import_is_atomic_and_detects_duplicates(api):
    a112 = {'X-AEGIS-User': 'user-a112'}
    good = 'biomarker_id,value,unit,measured_at\nhrv,49,ms,2026-11-20T07:00:00Z\n'
    body = {'format': 'csv', 'content': good, 'is_synthetic': True, 'source': 'csv-test'}
    assert api.post('/api/v2/astronauts/A-112/measurements', json=body, headers=a112).json()['accepted'] == 1
    again = api.post('/api/v2/astronauts/A-112/measurements', json=body, headers=a112).json()
    assert again['accepted'] == 0 and again['duplicates'] == 1
    mixed = good.replace('2026-11-20', '2026-11-21') + 'hrv,48,s,2026-11-22T07:00:00Z\n'
    response = api.post('/api/v2/astronauts/A-112/measurements', json={**body, 'content': mixed}, headers=a112)
    assert response.status_code == 422
    assert api.post('/api/v2/astronauts/A-112/measurements', json=body | {'content': good}, headers={'X-AEGIS-User': 'user-a113'}).status_code == 404


def test_api_correction_returns_the_requested_measurement_and_keeps_original(api):
    headers = {'X-AEGIS-User': 'user-a112'}
    record = api.get('/api/v2/astronauts/A-112/record', headers=headers).json()
    link = next(item['href'] for item in record['latest'] if item['biomarker_id'] == 'hrv')
    original = api.get(link, headers=headers).json()['current']
    response = api.post(link + '/corrections', headers=headers,
                        json={'value': 49.5, 'reason': 'Synthetic transcription correction'})
    assert response.status_code == 200
    chain = api.get(link, headers=headers).json()
    assert chain['versions'][0]['value'] == original['value']
    assert chain['current']['value'] == 49.5
    assert chain['current']['supersedes_id'] == original['id']


def test_api_result_requires_flight_surgeon_before_persisting_anything(api):
    headers = {'X-AEGIS-User': 'user-a112'}
    report = api.post('/api/v2/astronauts/A-112/evaluations', params={'as_of': AS_OF.isoformat()}, headers=headers).json()
    request = next(t for assessment in report['assessments'] for t in assessment['test_requests'] if t['biomarker_id'] == 'ctx_i')
    repo = app.state.medical.repo
    before = len(repo.observations(synthetic.A112))
    path = f'/api/v2/test-requests/{request["id"]}/result'
    body = {'value': .52, 'unit': 'ng/mL', 'measured_at': AS_OF.isoformat(), 'source': 'synthetic lab', 'is_synthetic': True}
    assert api.post(path, json=body, headers=headers).status_code == 403
    assert len(repo.observations(synthetic.A112)) == before
    assert repo.request(request['id']).status == 'proposed'
    allowed = api.post(path, json=body, headers={'X-AEGIS-User': 'surgeon-1'})
    assert allowed.status_code == 200
    assert allowed.json()['reevaluation']['certainty'] == 'confirmed_finding'


def test_postgres_request_identity_never_mutates_the_shared_repository():
    import uuid
    from starlette.requests import Request
    from backend.aegis.medical import api as routes
    from backend.aegis.medical.repository import PostgresRepository
    service = Engine(PostgresRepository('unused: no connection attempted'))
    fake_app = type('App', (), {'state': type('State', (), {'medical': service})()})()
    users = [str(uuid.uuid4()), str(uuid.uuid4())]
    engines = [routes._engine(Request({'type': 'http', 'headers': [(b'x-aegis-user', user.encode())], 'app': fake_app})) for user in users]
    assert [engine.repo._user for engine in engines] == users
    assert service.repo._user is None
    assert engines[0].repo is not engines[1].repo


def test_postgres_connection_failure_does_not_disclose_credentials(monkeypatch):
    import psycopg
    from backend.aegis.medical.repository import PostgresRepository
    def failure(*args, **kwargs):
        raise psycopg.ProgrammingError('invalid DSN containing synthetic-private-password')
    monkeypatch.setattr(psycopg, 'connect', failure)
    with pytest.raises(ConnectionError) as caught:
        PostgresRepository('unused').accessible('user')
    assert 'synthetic-private-password' not in str(caught.value)
    assert 'ProgrammingError' in str(caught.value)
