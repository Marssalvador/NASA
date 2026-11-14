"""Opt-in live Supabase verification. Adds tagged synthetic records; never deletes data.

Credentials come only from AEGIS_DATABASE_URL. Tests never print the connection string.
Evidence contains synthetic identifiers/counts, not connection parameters or tokens.
"""
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.aegis.medical import api, synthetic
from backend.aegis.medical.repository import AccessDenied, PostgresRepository

PROJECT = 'hudkkzrkwdbgoltrtlqu'
DSN = os.environ.get('AEGIS_DATABASE_URL')
pytestmark = pytest.mark.skipif(not DSN, reason='AEGIS_DATABASE_URL missing: no live PostgreSQL evidence')


@pytest.fixture(scope='module')
def live():
    import psycopg
    from psycopg.conninfo import conninfo_to_dict
    from psycopg.rows import dict_row

    try:
        target = conninfo_to_dict(DSN)
    except psycopg.Error:
        pytest.fail('Invalid PostgreSQL connection settings; credentials suppressed', pytrace=False)
    assert PROJECT in target.get('host', '') + target.get('user', ''), 'Connection must identify AEGIS-Development'
    evidence = {'project_ref': PROJECT, 'run_id': uuid.uuid4().hex,
                'started_at_utc': datetime.now(timezone.utc).isoformat(), 'checks': {}}
    # Never fall back to a local/memory repository if the connection is unavailable.
    try:
        connection = psycopg.connect(DSN, connect_timeout=12, row_factory=dict_row)
    except psycopg.Error:
        pytest.fail('Live PostgreSQL connection failed; credentials suppressed', pytrace=False)
    with connection as conn:
        identity = conn.execute("select current_database() as database, version() as version, "
                                "(select ssl from pg_stat_ssl where pid = pg_backend_pid()) as tls").fetchone()
        # With Supavisor, pg_stat_ssl describes pooler -> PostgreSQL, not this client.
        client_tls = bool(conn.pgconn.ssl_in_use)
        assert client_tls is True, 'Client connection to the Supabase pooler must use TLS'
        expected = sorted(p.name.split('_', 1)[0] for p in Path('supabase/migrations').glob('*.sql'))
        applied = [r['version'] for r in conn.execute('select version from supabase_migrations.schema_migrations order by version')]
        assert len(expected) == 5 and set(expected) <= set(applied)
        evidence['checks']['connection_and_migrations'] = {'database': identity['database'], 'client_to_pooler_tls': client_tls,
                                                         'server_reported_pooler_tls': identity['tls'],
                                                         'expected': expected, 'applied': applied}
        tables = conn.execute("select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace "
                              "where n.nspname='aegis' and c.relkind='r'").fetchall()
        assert tables and all(r['relrowsecurity'] for r in tables)
        evidence['checks']['rls_enabled'] = [r['relname'] for r in tables]

    # Committed, synthetic-only fixtures let independent connections prove persistence.
    run = evidence['run_id'][:10]
    users = {key: str(uuid.uuid4()) for key in ('owner', 'other', 'surgeon')}
    astronaut, other = str(uuid.uuid4()), str(uuid.uuid4())
    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        original = conn.execute('select id, is_synthetic from aegis.astronauts where id=%s', (synthetic.A112,)).fetchone()
        assert original and original['is_synthetic'] is True, 'Existing synthetic A-112 required'
        codes = [row['code'] for row in conn.execute(
            "select 'Z-' || lpad(n::text,3,'0') as code from generate_series(0,999) n "
            "where not exists (select 1 from aegis.astronauts a where a.code = 'Z-' || lpad(n::text,3,'0')) limit 2")]
        assert len(codes) == 2, 'Two unused synthetic fixture codes required'
        code, other_code = codes
        for kind, user in users.items():
            conn.execute("insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) "
                         "values (%s,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',%s,'{}','{}',now(),now())",
                         (user, f'{kind}.{run}@aegis.invalid'))
        for identifier, label in ((astronaut, code), (other, other_code)):
            conn.execute('insert into aegis.astronauts (id,code,display_name,sex,cycle_status,usual_cycle_length_days,is_synthetic,mission_start) '
                         'select %s,%s,%s,sex,cycle_status,usual_cycle_length_days,true,mission_start from aegis.astronauts where id=%s',
                         (identifier, label, f'Integration synthetic {run}', synthetic.A112))
        for user, identifier, role in ((users['owner'], astronaut, 'self'), (users['other'], other, 'self'),
                                       (users['surgeon'], astronaut, 'flight_surgeon'), (users['surgeon'], synthetic.A112, 'flight_surgeon')):
            conn.execute('insert into aegis.astronaut_access (user_id,astronaut_id,role,can_write) values (%s,%s,%s,true)',
                         (user, identifier, role))
        conn.execute('insert into aegis.measurements (astronaut_id,biomarker_id,unit,value,measured_at,source,method,quality,context,is_synthetic) '
                     'select %s,biomarker_id,unit,value,measured_at,source,method,quality,context,true from aegis.measurements '
                     'where astronaut_id=%s and is_synthetic and supersedes_id is null and source=%s',
                     (astronaut, synthetic.A112, synthetic.SOURCE))
        conn.execute('insert into aegis.mission_events (astronaut_id,kind,started_at,severity,details,source,is_synthetic) '
                     'select %s,kind,started_at,severity,details,source,true from aegis.mission_events where astronaut_id=%s and is_synthetic',
                     (astronaut, synthetic.A112))
    evidence['synthetic_fixture'] = {'astronaut_id': astronaut, 'code': code, 'users': users,
                                     'retained': True, 'note': 'New tagged synthetic fixtures retained; no original measurements changed.'}
    app = FastAPI()
    app.include_router(api.router)
    prior_backend = os.environ.get('AEGIS_RECORD_BACKEND')
    os.environ['AEGIS_RECORD_BACKEND'] = 'postgres'
    app.state.medical = api.build_services()
    if prior_backend is None:
        os.environ.pop('AEGIS_RECORD_BACKEND')
    else:
        os.environ['AEGIS_RECORD_BACKEND'] = prior_backend
    assert isinstance(app.state.medical.repo, PostgresRepository)
    with TestClient(app) as client:
        yield {'client': client, 'repo': app.state.medical.repo, 'code': code, 'astronaut': astronaut,
               'users': users, 'evidence': evidence}
    destination = Path('docs/verification/postgres-live.json')
    destination.parent.mkdir(parents=True, exist_ok=True)
    evidence['completed_at_utc'] = datetime.now(timezone.utc).isoformat()
    required = {'connection_and_migrations', 'rls_enabled', 'a112_persistence', 'api_workflow', 'unprivileged_rls'}
    evidence['verification_status'] = 'passed' if required <= set(evidence['checks']) else 'incomplete'
    destination.write_text(json.dumps(evidence, indent=2, default=str), encoding='utf-8')


def test_existing_a112_evaluation_really_persists(live):
    repo, client = live['repo'], live['client']
    assert len(repo.observations(synthetic.A112)) >= 796
    response = client.post('/api/v2/astronauts/A-112/evaluations',
                           params={'as_of': synthetic.AS_OF.isoformat()}, headers={'X-AEGIS-User': live['users']['surgeon']})
    assert response.status_code == 200
    report = response.json()
    assert report['assessments'] and report['model_error'] is None
    # Fresh repository, hence fresh database connections: not app-state persistence.
    independent = PostgresRepository(DSN)
    stored = independent.assessments(synthetic.A112)
    assert {a['id'] for a in report['assessments']} <= {a.id for a in stored}
    assert independent.baselines(synthetic.A112)
    assert independent.requests(synthetic.A112)
    live['evidence']['checks']['a112_persistence'] = {'measurements': len(independent.observations(synthetic.A112)),
        'baselines': len(independent.baselines(synthetic.A112)), 'assessments': len(stored),
        'test_requests': len(independent.requests(synthetic.A112)), 'assessment_ids': [a['id'] for a in report['assessments']]}


def test_full_api_workflow_persists_across_connections(live):
    client, code, repo = live['client'], live['code'], live['repo']
    headers = {'X-AEGIS-User': live['users']['owner']}
    surgeon = {'X-AEGIS-User': live['users']['surgeon']}
    base = f'/api/v2/astronauts/{code}'
    moment = synthetic.AS_OF + timedelta(minutes=30)
    body = {'format': 'json', 'is_synthetic': True, 'source': f'integration-{live["evidence"]["run_id"]}',
            'content': [{'biomarker_id': 'hrv', 'unit': 'ms', 'value': 32.0, 'measured_at': moment.isoformat()}]}
    response = client.post(base + '/measurements', json=body, headers=headers)
    assert response.status_code == 200 and response.json()['accepted'] == 1
    [measurement] = response.json()['ids']
    trend = client.get(base + '/trends', params={'biomarker': 'hrv'}, headers=headers)
    assert trend.status_code == 200
    assert any(f'/api/v2/measurements/{measurement}' in row['links'] for row in trend.json()['series'])
    first = client.post(base + '/evaluations', params={'as_of': moment.isoformat()}, headers=headers)
    assert first.status_code == 200
    bone = next(a for a in first.json()['assessments'] if a['risk_id'] == 'bone_resorption')
    request = next(t for t in bone['test_requests'] if t['biomarker_id'] == 'ctx_i')
    result = {'value': .52, 'unit': 'ng/mL', 'measured_at': moment.isoformat(), 'source': body['source'], 'is_synthetic': True}
    path = f'/api/v2/test-requests/{request["id"]}/result'
    before = len(repo.observations(live['astronaut']))
    assert client.post(path, json=result, headers=headers).status_code == 403
    assert len(repo.observations(live['astronaut'])) == before
    response = client.post(path, json=result, headers=surgeon)
    assert response.status_code == 200
    outcome = response.json()
    assert outcome['reevaluation']['certainty'] == 'confirmed_finding'
    assert outcome['reevaluation']['supersedes_id'] == bone['id']
    assert outcome['measurement_id'] in outcome['reevaluation']['evidence_ids']
    independent = PostgresRepository(DSN)
    stored_request = independent.request(request['id'])
    assert stored_request.status == 'resulted'
    assert stored_request.reevaluation_assessment_id == outcome['reevaluation']['id']
    history = client.get(base + '/evaluations', headers=headers)
    assert history.status_code == 200 and outcome['reevaluation']['id'] in {a['id'] for a in history.json()}
    for endpoint in (base + '/record', base + '/body-systems', outcome['measurement_href']):
        assert client.get(endpoint, headers=headers).status_code == 200
    live['evidence']['checks']['api_workflow'] = {'initial_measurement_id': measurement, 'request_id': request['id'],
        'result_measurement_id': outcome['measurement_id'], 'first_assessment_id': bone['id'],
        'reevaluation_id': outcome['reevaluation']['id'], 'certainty': 'confirmed_finding',
        'persisted_reloaded': True, 'transport': 'FastAPI ASGI TestClient -> real Supabase PostgreSQL'}


def test_non_admin_rls_and_api_scope(live):
    import psycopg
    repo = live['repo'].for_user(live['users']['other'])
    identity = repo._run('select current_user as role, rolsuper, rolbypassrls from pg_roles where rolname=current_user', fetch='one')
    assert identity == {'role': 'authenticated', 'rolsuper': False, 'rolbypassrls': False}
    assert not repo.observations(synthetic.A112) and not repo.observations(live['astronaut'])
    assert not repo.baselines(synthetic.A112) and not repo.assessments(synthetic.A112)
    assert not repo.requests(synthetic.A112) and not repo.events(synthetic.A112)
    with pytest.raises(AccessDenied):
        repo.profile_by_id(synthetic.A112)
    # A rejected INSERT cannot persist; no destructive probes or schema changes.
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        repo._run('insert into aegis.measurements (astronaut_id,biomarker_id,unit,value,measured_at,source,method,quality,is_synthetic,ingested_by) '
                  "values (%s,'hrv','ms',42,now(),'rls-probe','synthetic','good',true,%s)",
                  (synthetic.A112, live['users']['other']), fetch=None)
    client = live['client']
    headers = {'X-AEGIS-User': live['users']['other']}
    for tail in ('record', 'evaluations', 'body-systems', 'trends?biomarker=hrv'):
        assert client.get(f'/api/v2/astronauts/A-112/{tail}', headers=headers).status_code == 404
    evidence = live['evidence']['checks'].get('api_workflow', {})
    if evidence:
        assert client.get(f'/api/v2/measurements/{evidence["result_measurement_id"]}', headers=headers).status_code == 404
        assert client.post(f'/api/v2/test-requests/{evidence["request_id"]}/result', headers=headers,
                           json={'value': .5, 'unit': 'ng/mL', 'measured_at': synthetic.AS_OF.isoformat(),
                                 'source': 'blocked', 'is_synthetic': True}).status_code == 404
    live['evidence']['checks']['unprivileged_rls'] = {**identity, 'cross_record_reads_empty': True,
        'cross_record_insert_denied': True, 'cross_record_api_404': True}
