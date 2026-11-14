"""Presentation orchestration, not a model. Every finding comes from Engine.evaluate.

Replays A-112 into a fresh, explicitly synthetic record. Reset creates a new record;
neither the source nor previous runs are deleted. No schema changes or new thresholds.
"""
from dataclasses import asdict, dataclass, field, replace
from datetime import datetime, timedelta, timezone
import threading
import uuid
import os

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from . import api, features, memory, synthetic
from .domain import Profile
from .engine import Engine
from .repository import InMemoryRepository, PostgresRepository

router = APIRouter(prefix='/api/v2/demo', tags=['synthetic-presentation'])
START_DAY = 21
SAMPLES = {'ctx_i': .52, 'p1np': 70., 'systolic_bp': 140., 'diastolic_bp': 90., 'il6': 3., 'crp': 3.}
SERVICE_LOCK = threading.RLock()


@dataclass
class Run:
    id: str
    code: str
    user: str
    astronaut_id: str
    as_of: datetime
    queue: list[list[dict]]
    report: dict
    storage: str
    storage_note: str
    revision: int = 0
    cursor: int = 0
    last_change: dict = field(default_factory=dict)
    operations: set[str] = field(default_factory=set)
    lock: threading.RLock = field(default_factory=threading.RLock)


class Mutation(BaseModel):
    operation_id: str = Field(min_length=1, max_length=100)
    expected_revision: int = Field(ge=0)


class Manual(Mutation):
    biomarker_id: str
    value: float | None = Field(default=None, allow_inf_nan=False)
    quality: str = 'good'


class Result(Mutation):
    value: float = Field(allow_inf_nan=False)


class Demo:
    def __init__(self, engine: Engine):
        self.engine = engine
        self.runs: dict[str, Run] = {}
        self.lock = threading.RLock()
        self.storage_note = ''

    def start(self) -> dict:
        with self.lock:
            try:
                source = self.engine.repo.profile_by_id(synthetic.A112)
                observations = self.engine.repo.observations(source.id, include_superseded=True)
                events = self.engine.repo.events(source.id)
            except (ConnectionError, OSError):
                # Only before a run exists: never silently discard an active remote run.
                if self.runs:
                    raise HTTPException(503, 'Supabase no disponible. La sesión se conserva; reintenta al recuperar la conexión.')
                self.engine = Engine(synthetic.build(InMemoryRepository()))
                self.storage_note = 'Supabase no disponible al iniciar: almacenamiento local del motor existente.'
                source = self.engine.repo.profile_by_id(synthetic.A112)
                observations = self.engine.repo.observations(source.id)
                events = self.engine.repo.events(source.id)
            if not source.is_synthetic:
                raise HTTPException(409, 'La demostración solo admite un origen sintético.')
            observations = sorted((o for o in observations if o.is_synthetic and o.source == synthetic.SOURCE
                                   and o.supersedes_id is None), key=lambda o: o.measured_at)
            if not observations:
                raise HTTPException(409, 'Faltan las mediciones sintéticas originales de A-112.')
            identifier, user, run_id = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
            repo = self.engine.repo
            moment = source.mission_start + timedelta(days=START_DAY, hours=23, minutes=59)
            if isinstance(repo, PostgresRepository):
                with repo._connect() as conn:
                    row = conn.execute("select 'P-' || lpad(n::text,3,'0') as code from generate_series(0,999) n "
                                       "where not exists (select 1 from aegis.astronauts a where a.code='P-' || lpad(n::text,3,'0')) limit 1").fetchone()
                    if not row:
                        raise HTTPException(409, 'No quedan identificadores de demostración libres.')
                    code = row['code']
                    conn.execute("insert into auth.users (id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) "
                                 "values (%s,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',%s,'{}','{}',now(),now())",
                                 (user, f'presentation.{run_id}@aegis.invalid'))
                    conn.execute('insert into aegis.astronauts (id,code,display_name,sex,cycle_status,usual_cycle_length_days,is_synthetic,mission_start) '
                                 'values (%s,%s,%s,%s,%s,%s,true,%s)',
                                 (identifier, code, 'A-112 · copia sintética de presentación', source.sex, source.cycle_status,
                                  source.usual_cycle_length_days, source.mission_start))
                    conn.execute("insert into aegis.astronaut_access (user_id,astronaut_id,role,can_write) values (%s,%s,'flight_surgeon',true)", (user, identifier))
                    conn.execute('insert into aegis.measurements (astronaut_id,biomarker_id,unit,value,measured_at,source,method,quality,context,is_synthetic) '
                                 'select %s,biomarker_id,unit,value,measured_at,source,method,quality,context,true from aegis.measurements '
                                 'where astronaut_id=%s and is_synthetic and supersedes_id is null and source=%s and measured_at<=%s',
                                 (identifier, source.id, synthetic.SOURCE, moment))
                    conn.execute('insert into aegis.mission_events (astronaut_id,kind,started_at,severity,details,source,is_synthetic) '
                                 'select %s,kind,started_at,severity,details,source,true from aegis.mission_events '
                                 'where astronaut_id=%s and is_synthetic and started_at<=%s', (identifier, source.id, moment))
                scoped = repo.for_user(user)
            else:
                used = {p.code for p in repo._profiles.values()}
                code = next(f'P-{n:03d}' for n in range(1000) if f'P-{n:03d}' not in used)
                repo.add_profile(replace(source, id=identifier, code=code, display_name='A-112 · copia sintética de presentación'))
                repo.grant(user, identifier, 'flight_surgeon', can_write=True)
                scoped = repo
            engine = Engine(scoped, self.engine.knowledge, self.engine.adapter)
            rows = [{**asdict(o), 'astronaut_id': identifier} for o in observations]
            for row in rows:
                for key in ('id', 'supersedes_id', 'correction_reason'):
                    row.pop(key, None)
            initial = [row for row in rows if row['measured_at'] <= moment]
            if isinstance(repo, InMemoryRepository):
                repo.append_observations(initial, user)
                for event in events:
                    if event.is_synthetic and event.started_at <= moment:
                        event_row = {**asdict(event), 'astronaut_id': identifier}
                        event_row.pop('id')
                        repo.append_event(event_row)
            queue = []
            for day in range(START_DAY + 1, synthetic.MISSION_DAYS):
                start = source.mission_start + timedelta(days=day)
                batch = [row for row in rows if start <= row['measured_at'] < start + timedelta(days=1)]
                if batch:
                    queue.append(batch)
            run = Run(run_id, code, user, identifier, moment, queue, {},
                      'supabase' if isinstance(repo, PostgresRepository) else 'local', self.storage_note)
            self.runs[run.id] = run
            run.report = engine.evaluate(identifier, moment)
            return self.snapshot(run)

    def engine_for(self, run):
        repo = self.engine.repo
        return Engine(repo.for_user(run.user) if isinstance(repo, PostgresRepository) else repo,
                      self.engine.knowledge, self.engine.adapter)

    def get(self, run_id):
        if run_id not in self.runs:
            raise HTTPException(404, 'La sesión no existe en este servidor. Inicia un escenario nuevo.')
        return self.runs[run_id]

    def snapshot(self, run):
        engine = self.engine_for(run)
        observations = engine.repo.observations(run.astronaut_id, until=run.as_of)
        latest = {}
        for o in observations:
            if o.biomarker_id not in latest or latest[o.biomarker_id].measured_at < o.measured_at:
                latest[o.biomarker_id] = o
        baselines = engine.repo.baselines(run.astronaut_id)
        profile = engine.repo.profile(run.code, run.user)
        events = engine.repo.events(run.astronaut_id, until=run.as_of)
        by_reference = {(b.biomarker_id, b.kind, b.context_key): b for b in baselines}
        registry = list(engine.knowledge.biomarkers.values())
        references = {}
        for definition in registry:
            reference, _, _ = features.reference_for(run.as_of.date(), definition['id'], profile, events,
                                                      engine.knowledge, by_reference)
            references[definition['id']] = asdict(reference) if reference else None
        series = {d['id']: [{'day': day, 'value': value, 'n': len(ids), 'measurement_ids': ids}
                            for day, (value, ids) in memory.daily(observations, engine.knowledge, d['id']).items()]
                  for d in registry}
        requests = []
        by_id = {o.id: o for o in observations}
        for item in engine.repo.requests(run.astronaut_id):
            requests.append({**asdict(item), 'sample_value': SAMPLES.get(item.biomarker_id),
                             'result': asdict(by_id[item.result_measurement_id]) if item.result_measurement_id in by_id else None})
        return {'session_id': run.id, 'revision': run.revision, 'code': run.code, 'source_code': 'A-112',
                'user_id': run.user, 'is_synthetic': True, 'storage': run.storage, 'storage_note': run.storage_note,
                'as_of': run.as_of, 'mission_start': synthetic.MISSION_START,
                'day': (run.as_of - synthetic.MISSION_START).days + 1,
                'step': run.cursor, 'steps': len(run.queue), 'complete': run.cursor >= len(run.queue),
                'registry': registry, 'latest': [asdict(o) for o in latest.values()],
                'baselines': [asdict(b) for b in baselines], 'references': references, 'series': series,
                'risk_definitions': engine.knowledge.risks,
                'report': api._with_links(run.report), 'requests': requests,
                'measurement_count': len(observations), 'last_change': run.last_change}

    def mutate(self, run, operation: Mutation, action):
        with run.lock:
            if operation.operation_id in run.operations:
                return self.snapshot(run)
            if operation.expected_revision != run.revision:
                raise HTTPException(409, 'La sesión ha cambiado. Actualiza antes de continuar.')
            action()
            run.operations.add(operation.operation_id)
            run.revision += 1
            return self.snapshot(run)

    def ingest(self, run, rows):
        engine = self.engine_for(run)
        body = api.ImportBody(format='json', content=rows, is_synthetic=True, source=f'PULSS demo {run.id}')
        profile = engine.repo.profile(run.code, run.user, write=True)
        imported = api.ingest(engine, profile, body, run.user)
        moment = max(run.as_of, max(datetime.fromisoformat(row['measured_at']) for row in rows))
        report = engine.evaluate(run.astronaut_id, moment)
        run.as_of, run.report = moment, report
        run.last_change = {'kind': 'measurements', 'ids': imported['ids'], 'accepted': imported['accepted']}


def service(request: Request):
    with SERVICE_LOCK:
        if not hasattr(request.app.state, 'presentation'):
            # Source reads use the existing backend. No separate clinical engine or response mock.
            if not hasattr(request.app.state, 'medical'):
                if os.environ.get('AEGIS_RECORD_BACKEND') == 'postgres' and not os.environ.get('AEGIS_DATABASE_URL'):
                    request.app.state.medical = Engine(synthetic.build(InMemoryRepository()))
                    request.app.state.presentation = Demo(request.app.state.medical)
                    request.app.state.presentation.storage_note = 'Supabase sin conexión configurada: almacenamiento local del motor existente.'
                    return request.app.state.presentation
                request.app.state.medical = api.build_services()
            request.app.state.presentation = Demo(request.app.state.medical)
    return request.app.state.presentation


@router.post('/sessions')
def start(request: Request):
    demo = service(request)
    snapshot = demo.start()
    request.app.state.medical = demo.engine
    return snapshot


@router.get('/sessions/{run_id}')
def state(run_id: str, request: Request):
    demo = service(request)
    run = demo.get(run_id)
    with run.lock:
        return demo.snapshot(run)


@router.post('/sessions/{run_id}/step')
def step(run_id: str, body: Mutation, request: Request):
    demo = service(request)
    run = demo.get(run_id)
    def action():
        if run.cursor >= len(run.queue):
            raise HTTPException(409, 'La secuencia ha terminado. Puedes introducir mediciones o reiniciar el escenario.')
        batch = run.queue[run.cursor]
        rows = [{**row, 'measured_at': row['measured_at'].isoformat()} for row in batch if row['measured_at'] > run.as_of]
        if rows:
            demo.ingest(run, rows)
        run.cursor += 1
    return demo.mutate(run, body, action)


@router.post('/sessions/{run_id}/measurements')
def manual(run_id: str, body: Manual, request: Request):
    demo = service(request)
    run = demo.get(run_id)
    definition = demo.engine.knowledge.biomarkers.get(body.biomarker_id)
    if not definition:
        raise HTTPException(422, 'Biomarcador no registrado.')
    if definition.get('sensing_layer', 1) == 2:
        raise HTTPException(422, 'Registra los marcadores de capa 2 desde su solicitud de prueba.')
    def action():
        demo.ingest(run, [{'biomarker_id': body.biomarker_id, 'value': body.value, 'unit': definition['unit'],
                          'quality': body.quality, 'measured_at': (run.as_of + timedelta(minutes=1)).isoformat(),
                          'method': definition['measurement_method'], 'is_synthetic': True}])
    return demo.mutate(run, body, action)


@router.post('/sessions/{run_id}/tests/{test_id}/result')
def result(run_id: str, test_id: str, body: Result, request: Request):
    demo = service(request)
    run = demo.get(run_id)
    engine = demo.engine_for(run)
    try:
        test = engine.repo.request(test_id)
    except KeyError:
        raise HTTPException(404, 'Solicitud no encontrada.')
    if test.astronaut_id != run.astronaut_id:
        raise HTTPException(404, 'Solicitud de otro expediente.')
    def action():
        definition = engine.knowledge.biomarkers[test.biomarker_id]
        moment = run.as_of + timedelta(minutes=1)
        try:
            outcome = engine.record_test_result(test_id, {'value': body.value, 'unit': definition['unit'],
                'measured_at': moment.isoformat(), 'source': f'PULSS demo {run.id} · prueba sintética',
                'is_synthetic': True, 'method': definition['measurement_method']}, run.user)
        except ValueError as error:
            raise HTTPException(422, str(error))
        run.as_of = moment
        run.report = outcome['evaluation']
        run.last_change = {'kind': 'test_result', 'request_id': test_id, 'measurement_id': outcome['measurement_id'],
                           'previous_assessment_id': outcome['previous_assessment_id'], 'reevaluation_id': outcome['reevaluation']['id']}
    return demo.mutate(run, body, action)
