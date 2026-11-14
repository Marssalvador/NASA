"""Storage contract and two implementations.

* InMemoryRepository: offline/local mode and tests. Mirrors the database guarantees: append-only
  observations, linear corrections, versioned baselines, immutable assessments, explicit grants.
* PostgresRepository: Supabase/PostgreSQL. User-scoped reads run as role `authenticated` with the
  caller's JWT claims, so the RLS policies of supabase/migrations apply to the API as well. Engine
  writes run with the service connection.
"""
from dataclasses import replace
from copy import copy
from datetime import datetime
import itertools
import json
import uuid
from .domain import Assessment, Baseline, Event, Feature, Observation, Profile, TestRequest


class AccessDenied(PermissionError):
    pass


class Repository:
    """Interface. All methods are synchronous; timestamps are UTC."""

    def accessible(self, user: str) -> list[Profile]: raise NotImplementedError
    def profile(self, code: str, user: str, write: bool = False) -> Profile: raise NotImplementedError
    def profile_by_id(self, astronaut_id: str) -> Profile: raise NotImplementedError
    def observations(self, astronaut_id: str, until: datetime | None = None,
                     include_superseded: bool = False) -> list[Observation]: raise NotImplementedError
    def observation_chain(self, observation_id: int) -> list[Observation]: raise NotImplementedError
    def events(self, astronaut_id: str, until: datetime | None = None) -> list[Event]: raise NotImplementedError
    def existing_keys(self, astronaut_id: str) -> set[tuple]: raise NotImplementedError
    def append_observations(self, rows: list[dict], actor: str | None) -> list[int]: raise NotImplementedError
    def correct_observation(self, observation_id: int, value: float | None, quality: str, reason: str,
                            actor: str | None) -> int: raise NotImplementedError
    def append_event(self, event: dict) -> int: raise NotImplementedError
    def save_baseline(self, astronaut_id: str, baseline: Baseline, engine_version: str) -> Baseline: raise NotImplementedError
    def baselines(self, astronaut_id: str) -> list[Baseline]: raise NotImplementedError
    def save_features(self, astronaut_id: str, run_id: str, features: list[Feature], engine_version: str): raise NotImplementedError
    def model_version_id(self, name: str, version: str) -> str: raise NotImplementedError
    def save_assessment(self, assessment: Assessment) -> Assessment: raise NotImplementedError
    def assessments(self, astronaut_id: str) -> list[Assessment]: raise NotImplementedError
    def save_request(self, request: TestRequest) -> TestRequest: raise NotImplementedError
    def requests(self, astronaut_id: str) -> list[TestRequest]: raise NotImplementedError
    def request(self, request_id: str) -> TestRequest: raise NotImplementedError
    def can_decide_request(self, astronaut_id: str, user: str) -> bool: raise NotImplementedError
    def update_request(self, request: TestRequest, actor: str | None) -> TestRequest: raise NotImplementedError


class InMemoryRepository(Repository):
    def __init__(self):
        self._profiles: dict[str, Profile] = {}
        self._grants: dict[tuple[str, str], dict] = {}
        self._observations: list[Observation] = []
        self._events: list[Event] = []
        self._baselines: dict[str, list[Baseline]] = {}
        self._features: list[tuple[str, str, Feature]] = []
        self._assessments: list[Assessment] = []
        self._requests: dict[str, TestRequest] = {}
        self._ids = itertools.count(1)
        self.audit: list[dict] = []

    # identity and access -------------------------------------------------------------------
    def add_profile(self, profile: Profile):
        self._profiles[profile.id] = profile

    def grant(self, user: str, astronaut_id: str, role: str = 'self', can_write: bool = False):
        self._grants[(user, astronaut_id)] = {'role': role, 'can_write': can_write, 'revoked': False}

    def revoke(self, user: str, astronaut_id: str):
        self._grants[(user, astronaut_id)]['revoked'] = True

    def _allowed(self, user: str, astronaut_id: str, write: bool) -> bool:
        grant = self._grants.get((user, astronaut_id))
        return bool(grant and not grant['revoked'] and (grant['can_write'] or not write))

    def accessible(self, user):
        return [p for p in self._profiles.values() if self._allowed(user, p.id, False)]

    def profile(self, code, user, write=False):
        profile = next((p for p in self._profiles.values() if p.code == code), None)
        if profile is None or not self._allowed(user, profile.id, write):
            raise AccessDenied('Sin permiso explícito sobre este expediente.')
        return profile

    def profile_by_id(self, astronaut_id):
        return self._profiles[astronaut_id]

    # observations ------------------------------------------------------------------------------
    def observations(self, astronaut_id, until=None, include_superseded=False):
        superseded = {o.supersedes_id for o in self._observations if o.supersedes_id}
        return [o for o in self._observations if o.astronaut_id == astronaut_id
                and (until is None or o.measured_at <= until)
                and (include_superseded or o.id not in superseded)]

    def observation_chain(self, observation_id):
        by_id = {o.id: o for o in self._observations}
        chain = [by_id[observation_id]]
        while chain[0].supersedes_id:
            chain.insert(0, by_id[chain[0].supersedes_id])
        successors = {o.supersedes_id: o for o in self._observations if o.supersedes_id}
        while chain[-1].id in successors:
            chain.append(successors[chain[-1].id])
        return chain

    def events(self, astronaut_id, until=None):
        return [e for e in self._events if e.astronaut_id == astronaut_id and (until is None or e.started_at <= until)]

    def existing_keys(self, astronaut_id):
        return {(o.astronaut_id, o.biomarker_id, o.measured_at, o.source) for o in self._observations
                if o.astronaut_id == astronaut_id and o.supersedes_id is None}

    def append_observations(self, rows, actor):
        ids = []
        keys = {(o.astronaut_id, o.biomarker_id, o.measured_at, o.source) for o in self._observations
                if o.supersedes_id is None}
        for row in rows:
            key = (row['astronaut_id'], row['biomarker_id'], row['measured_at'], row['source'])
            if key in keys:
                raise ValueError(f'Medición duplicada: {key}')
            keys.add(key)
            observation = Observation(id=next(self._ids), **row)
            self._observations.append(observation)
            ids.append(observation.id)
        self.audit.append({'action': 'append_observations', 'actor': actor, 'ids': ids})
        return ids

    def correct_observation(self, observation_id, value, quality, reason, actor):
        if not reason:
            raise ValueError('Una corrección requiere motivo.')
        original = next(o for o in self._observations if o.id == observation_id)
        if any(o.supersedes_id == observation_id for o in self._observations):
            raise ValueError('Esta medición ya tiene una corrección; corrige la versión vigente.')
        corrected = replace(original, id=next(self._ids), value=value, quality=quality,
                            supersedes_id=observation_id, correction_reason=reason)
        self._observations.append(corrected)
        self.audit.append({'action': 'correct_observation', 'actor': actor, 'id': corrected.id,
                           'supersedes': observation_id, 'reason': reason})
        return corrected.id

    def append_event(self, event):
        stored = Event(id=next(self._ids), **event)
        self._events.append(stored)
        return stored.id

    # memory, features, assessments ---------------------------------------------------------------
    def save_baseline(self, astronaut_id, baseline, engine_version):
        key = f'{astronaut_id}|{baseline.biomarker_id}|{baseline.kind}|{baseline.context_key}'
        history = self._baselines.setdefault(key, [])
        if history and history[-1].input_ids == baseline.input_ids:
            return history[-1]
        stored = replace(baseline, id=next(self._ids), version=len(history) + 1,
                         parent_id=history[-1].id if history else None)
        history.append(stored)
        return stored

    def baselines(self, astronaut_id):
        return [b for key, history in self._baselines.items() if key.startswith(astronaut_id + '|') for b in history]

    def save_features(self, astronaut_id, run_id, features, engine_version):
        self._features += [(astronaut_id, run_id, f) for f in features]

    def model_version_id(self, name, version):
        return f'{name}@{version}'

    def save_assessment(self, assessment):
        if assessment.certainty == 'clinical_diagnosis' and assessment.produced_by != 'clinician':
            raise ValueError('El motor no puede registrar diagnósticos.')
        if 'disease_probability' in assessment.result:
            raise ValueError('No se almacenan probabilidades de enfermedad.')
        stored = replace(assessment, id=str(uuid.uuid4()))
        self._assessments.append(stored)
        return stored

    def assessments(self, astronaut_id):
        return [a for a in self._assessments if a.astronaut_id == astronaut_id]

    def save_request(self, request):
        stored = replace(request, id=str(uuid.uuid4()))
        self._requests[stored.id] = stored
        return stored

    def requests(self, astronaut_id):
        return [r for r in self._requests.values() if r.astronaut_id == astronaut_id]

    def request(self, request_id):
        return self._requests[request_id]

    def can_decide_request(self, astronaut_id, user):
        grant = self._grants.get((user, astronaut_id))
        return bool(grant and not grant['revoked'] and grant['role'] == 'flight_surgeon' and grant['can_write'])

    def update_request(self, request, actor):
        if request.status == 'resulted' and request.result_measurement_id is None:
            raise ValueError('Una solicitud con resultado necesita la medición asociada.')
        self._requests[request.id] = request
        self.audit.append({'action': 'update_request', 'actor': actor, 'id': request.id, 'status': request.status})
        return request


class PostgresRepository(Repository):
    """PostgreSQL implementation for the Supabase `aegis` schema.

    `dsn` must point at the project database (Supabase dashboard → Connect). Requires psycopg 3.
    User-facing reads go through `_as_user`, which switches to role `authenticated` with the user's
    claims for the duration of one transaction, so row visibility is decided by RLS, not by Python.
    """

    def __init__(self, dsn: str):
        import psycopg
        from psycopg.rows import dict_row
        def connect():
            try:
                return psycopg.connect(dsn, row_factory=dict_row, autocommit=False, connect_timeout=12)
            except psycopg.Error as error:
                # Driver errors for malformed URLs may echo credentials. Do not expose them.
                raise ConnectionError(f'PostgreSQL connection failed ({type(error).__name__}); connection details suppressed.') from None
        self._connect = connect
        self._user = None

    def for_user(self, user: str):
        """Independent request scope: never mutate the shared service repository."""
        scoped = copy(self)
        scoped._user = str(uuid.UUID(user))
        return scoped

    @staticmethod
    def _set_role(cur, user: str | None, service: bool = False):
        if service:
            # Engine-output tables intentionally have no authenticated INSERT policy.
            cur.execute('set local role service_role')
        elif user is not None:
            cur.execute("select set_config('request.jwt.claims', %s, true)",
                        (json.dumps({'sub': user, 'role': 'authenticated'}),))
            cur.execute('set local role authenticated')

    def _run(self, sql: str, params=(), user: str | None = None, fetch: str = 'all', *, service: bool = False):
        with self._connect() as conn, conn.cursor() as cur:
            self._set_role(cur, user if user is not None else self._user, service)
            cur.execute(sql, params)
            result = cur.fetchall() if fetch == 'all' else cur.fetchone() if fetch == 'one' else None
            conn.commit()
            return result

    @staticmethod
    def _profile(row) -> Profile:
        return Profile(id=str(row['id']), code=row['code'], display_name=row['display_name'], sex=row['sex'],
                       cycle_status=row['cycle_status'], usual_cycle_length_days=row['usual_cycle_length_days'],
                       mission_start=row['mission_start'], is_synthetic=row['is_synthetic'])

    @staticmethod
    def _observation(row) -> Observation:
        return Observation(id=row['id'], astronaut_id=str(row['astronaut_id']), biomarker_id=row['biomarker_id'],
                           unit=row['unit'], value=row['value'], measured_at=row['measured_at'], source=row['source'],
                           method=row['method'], quality=row['quality'], is_synthetic=row['is_synthetic'],
                           context=row['context'] or {}, supersedes_id=row['supersedes_id'],
                           correction_reason=row['correction_reason'])

    def accessible(self, user):
        return [self._profile(r) for r in self._run('select * from aegis.astronauts order by code', user=user)]

    def profile(self, code, user, write=False):
        row = self._run('select a.*, aegis.can_write(a.id) as writable from aegis.astronauts a where code = %s',
                        (code,), user=user, fetch='one')
        if row is None or (write and not row['writable']):
            raise AccessDenied('Sin permiso explícito sobre este expediente.')
        return self._profile(row)

    def profile_by_id(self, astronaut_id):
        row = self._run('select * from aegis.astronauts where id = %s', (astronaut_id,), fetch='one')
        if row is None:
            raise AccessDenied('Sin permiso explícito sobre este expediente.')
        return self._profile(row)

    def observations(self, astronaut_id, until=None, include_superseded=False):
        table = 'aegis.measurements' if include_superseded else 'aegis.current_measurements'
        rows = self._run(f'select * from {table} where astronaut_id = %s and (%s::timestamptz is null or measured_at <= %s) '
                         'order by measured_at', (astronaut_id, until, until))
        return [self._observation(r) for r in rows]

    def observation_chain(self, observation_id):
        rows = self._run('''with recursive back as (
              select * from aegis.measurements where id = %s
              union all select m.* from aegis.measurements m join back b on m.id = b.supersedes_id),
            fwd as (select * from aegis.measurements where id = %s
              union all select m.* from aegis.measurements m join fwd f on m.supersedes_id = f.id)
            select distinct * from (select * from back union select * from fwd) c order by id''',
                         (observation_id, observation_id))
        return [self._observation(r) for r in rows]

    def events(self, astronaut_id, until=None):
        rows = self._run('select * from aegis.mission_events where astronaut_id = %s and '
                         '(%s::timestamptz is null or started_at <= %s) order by started_at', (astronaut_id, until, until))
        return [Event(id=r['id'], astronaut_id=str(r['astronaut_id']), kind=r['kind'], started_at=r['started_at'],
                      severity=r['severity'], details=r['details'] or {}, is_synthetic=r['is_synthetic']) for r in rows]

    def existing_keys(self, astronaut_id):
        rows = self._run('select biomarker_id, measured_at, source from aegis.measurements '
                         'where astronaut_id = %s and supersedes_id is null', (astronaut_id,))
        return {(astronaut_id, r['biomarker_id'], r['measured_at'], r['source']) for r in rows}

    def append_observations(self, rows, actor):
        from psycopg.types.json import Jsonb
        with self._connect() as conn, conn.cursor() as cur:
            self._set_role(cur, self._user)
            ids = []
            for row in rows:
                cur.execute('insert into aegis.measurements (astronaut_id, biomarker_id, unit, value, measured_at, source, '
                            'method, quality, context, is_synthetic, ingested_by) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) '
                            'returning id', (row['astronaut_id'], row['biomarker_id'], row['unit'], row['value'],
                                             row['measured_at'], row['source'], row['method'], row['quality'],
                                             Jsonb(row['context']), row['is_synthetic'], actor))
                ids.append(cur.fetchone()['id'])
            conn.commit()  # one transaction: a failing row rolls back the whole batch
            return ids

    def correct_observation(self, observation_id, value, quality, reason, actor):
        row = self._run('insert into aegis.measurements (astronaut_id, biomarker_id, unit, value, measured_at, source, method, '
                        'quality, context, is_synthetic, supersedes_id, correction_reason, ingested_by) '
                        'select astronaut_id, biomarker_id, unit, %s, measured_at, source, method, %s, context, is_synthetic, '
                        'id, %s, %s from aegis.measurements where id = %s returning id',
                        (value, quality, reason, actor, observation_id), fetch='one')
        return row['id']

    def append_event(self, event):
        from psycopg.types.json import Jsonb
        row = self._run('insert into aegis.mission_events (astronaut_id, kind, started_at, severity, details, source, '
                        'is_synthetic) values (%s,%s,%s,%s,%s,%s,%s) returning id',
                        (event['astronaut_id'], event['kind'], event['started_at'], event.get('severity'),
                         Jsonb(event.get('details', {})), event.get('source', 'aegis'), event['is_synthetic']), fetch='one')
        return row['id']

    def save_baseline(self, astronaut_id, baseline, engine_version):
        latest = self._run('select * from aegis.physiological_baselines where astronaut_id = %s and biomarker_id = %s '
                           'and kind = %s and context_key = %s order by version desc limit 1',
                           (astronaut_id, baseline.biomarker_id, baseline.kind, baseline.context_key), fetch='one')
        if latest and tuple(latest['input_measurement_ids']) == baseline.input_ids:
            return replace(baseline, id=latest['id'], version=latest['version'], parent_id=latest['parent_id'])
        version = (latest['version'] + 1) if latest else 1
        row = self._run('insert into aegis.physiological_baselines (astronaut_id, biomarker_id, kind, context_key, method, '
                        'status, n, center, spread, window_start, window_end, version, parent_id, engine_version, '
                        'input_measurement_ids, is_synthetic) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) '
                        'returning id',
                        (astronaut_id, baseline.biomarker_id, baseline.kind, baseline.context_key, baseline.method,
                         baseline.status, baseline.n, baseline.center, baseline.spread, baseline.window_start,
                         baseline.window_end, version, latest['id'] if latest else None, engine_version,
                         list(baseline.input_ids), baseline.is_synthetic), fetch='one', service=True)
        return replace(baseline, id=row['id'], version=version, parent_id=latest['id'] if latest else None)

    def baselines(self, astronaut_id):
        rows = self._run('select * from aegis.physiological_baselines where astronaut_id = %s order by id', (astronaut_id,))
        return [Baseline(biomarker_id=r['biomarker_id'], kind=r['kind'], context_key=r['context_key'], method=r['method'],
                         status=r['status'], n=r['n'], center=r['center'], spread=r['spread'],
                         window_start=r['window_start'], window_end=r['window_end'],
                         input_ids=tuple(r['input_measurement_ids']), is_synthetic=r['is_synthetic'],
                         version=r['version'], id=r['id'], parent_id=r['parent_id']) for r in rows]

    def save_features(self, astronaut_id, run_id, features, engine_version):
        with self._connect() as conn, conn.cursor() as cur:
            self._set_role(cur, None, service=True)
            cur.executemany('insert into aegis.derived_features (astronaut_id, biomarker_id, feature, window_start, '
                            'window_end, value, n, quality, run_id, engine_version, input_measurement_ids) '
                            'values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                            [(astronaut_id, f.biomarker_id, f.feature, f.window_start, f.window_end, f.value, f.n,
                              f.quality, run_id, engine_version, list(f.input_ids)) for f in features])
            conn.commit()

    def model_version_id(self, name, version):
        return str(self._run('select id from aegis.model_versions where name = %s and version = %s',
                             (name, version), fetch='one')['id'])

    def save_assessment(self, assessment):
        from psycopg.types.json import Jsonb
        row = self._run('insert into aegis.risk_assessments (astronaut_id, risk_id, period_start, period_end, '
                        'model_version_id, produced_by, alert_level, certainty, result, uncertainty, input_quality, '
                        'inputs_used, missing_inputs, evidence_measurement_ids, context, explanation, '
                        'reproducibility_hash, supersedes_id) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) '
                        'returning id',
                        (assessment.astronaut_id, assessment.risk_id, assessment.period_start, assessment.period_end,
                         self.model_version_id(assessment.model_name, assessment.model_version), assessment.produced_by,
                         assessment.alert_level, assessment.certainty, Jsonb(assessment.result),
                         Jsonb(assessment.uncertainty), assessment.input_quality, Jsonb(assessment.inputs_used),
                         assessment.missing_inputs, assessment.evidence_ids, Jsonb(assessment.context),
                         assessment.explanation, assessment.reproducibility_hash, assessment.supersedes_id), fetch='one', service=True)
        return replace(assessment, id=str(row['id']))

    def assessments(self, astronaut_id):
        rows = self._run('select a.*, m.name, m.version from aegis.risk_assessments a join aegis.model_versions m '
                         'on m.id = a.model_version_id where astronaut_id = %s order by created_at', (astronaut_id,))
        return [Assessment(astronaut_id=str(r['astronaut_id']), risk_id=r['risk_id'], period_start=r['period_start'],
                           period_end=r['period_end'], model_name=r['name'], model_version=r['version'],
                           alert_level=r['alert_level'], certainty=r['certainty'], result=r['result'],
                           uncertainty=r['uncertainty'], input_quality=r['input_quality'], inputs_used=r['inputs_used'],
                           missing_inputs=r['missing_inputs'], evidence_ids=r['evidence_measurement_ids'],
                           context=r['context'], explanation=r['explanation'],
                           reproducibility_hash=r['reproducibility_hash'], produced_by=r['produced_by'],
                           supersedes_id=str(r['supersedes_id']) if r['supersedes_id'] else None, id=str(r['id']))
                for r in rows]

    def save_request(self, request):
        row = self._run('insert into aegis.test_requests (astronaut_id, assessment_id, biomarker_id, reason, status) '
                        'values (%s,%s,%s,%s,%s) returning id',
                        (request.astronaut_id, request.assessment_id, request.biomarker_id, request.reason,
                         request.status), fetch='one', service=True)
        return replace(request, id=str(row['id']))

    @staticmethod
    def _request(r) -> TestRequest:
        return TestRequest(astronaut_id=str(r['astronaut_id']), assessment_id=str(r['assessment_id']),
                           biomarker_id=r['biomarker_id'], reason=r['reason'], status=r['status'],
                           result_measurement_id=r['result_measurement_id'],
                           reevaluation_assessment_id=str(r['reevaluation_assessment_id']) if r['reevaluation_assessment_id'] else None,
                           id=str(r['id']))

    def requests(self, astronaut_id):
        return [self._request(r) for r in self._run('select * from aegis.test_requests where astronaut_id = %s '
                                                    'order by requested_at', (astronaut_id,))]

    def request(self, request_id):
        row = self._run('select * from aegis.test_requests where id = %s', (request_id,), fetch='one')
        if row is None:
            raise KeyError(request_id)
        return self._request(row)

    def can_decide_request(self, astronaut_id, user):
        row = self._run('select aegis.is_flight_surgeon(%s) and aegis.can_write(%s) as allowed',
                        (astronaut_id, astronaut_id), user=user, fetch='one')
        return bool(row['allowed'])

    def update_request(self, request, actor):
        row = self._run('update aegis.test_requests set status = %s, result_measurement_id = %s, '
                  'reevaluation_assessment_id = %s, decided_by = coalesce(%s, decided_by), updated_at = now() where id = %s returning id',
                  (request.status, request.result_measurement_id, request.reevaluation_assessment_id, actor, request.id),
                  fetch='one')
        if row is None:
            raise AccessDenied('Sin permiso para decidir esta solicitud.')
        return request
