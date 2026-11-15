"""FastAPI router for the longitudinal medical record (/api/v2).

Caller identity: `X-AEGIS-User`. In local/offline mode this is a development identity checked
against explicit grants. With the PostgreSQL backend the same identity is passed to the database as
JWT claims so RLS decides visibility; production deployments must derive it from a verified Supabase
JWT before it reaches this router (not implemented in this demonstrator).
"""
import csv
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
import io
import os
from typing import Literal
from fastapi import APIRouter, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator
from . import memory, synthetic, validation
from .domain import LEVEL_ORDER
from .engine import Engine
from .repository import AccessDenied, InMemoryRepository, PostgresRepository

router = APIRouter(prefix='/api/v2', tags=['medical-record'])


def build_services() -> Engine:
    backend = os.environ.get('AEGIS_RECORD_BACKEND', 'memory')
    if backend == 'postgres':
        return Engine(PostgresRepository(os.environ['AEGIS_DATABASE_URL']))
    return Engine(synthetic.build(InMemoryRepository()))


def _engine(request: Request) -> Engine:
    if not hasattr(request.app.state, 'medical'):
        request.app.state.medical = build_services()
    engine = request.app.state.medical
    if isinstance(engine.repo, PostgresRepository):
        try:
            repo = engine.repo.for_user(request.headers.get('X-AEGIS-User', ''))
        except ValueError:
            raise HTTPException(422, 'La identidad de desarrollo debe ser un UUID válido.')
        return Engine(repo, engine.knowledge, engine.adapter)
    return engine


def _profile(engine: Engine, code: str, user: str, write: bool = False):
    try:
        return engine.repo.profile(code, user, write)
    except (AccessDenied, KeyError):
        raise HTTPException(404, 'Expediente no encontrado o sin permiso explícito.')


def _link(measurement_id: int) -> str:
    return f'/api/v2/measurements/{measurement_id}'


def _with_links(report: dict) -> dict:
    for item in report.get('assessments', []):
        item['evidence_links'] = [_link(i) for i in item['evidence_ids']]
    for item in report.get('emergencies', []):
        item['evidence_links'] = [_link(i) for i in item['evidence_ids']]
    return report


@router.get('/astronauts')
def astronauts(request: Request, user: str = Header(alias='X-AEGIS-User')):
    return [asdict(p) for p in _engine(request).repo.accessible(user)]


@router.get('/astronauts/{code}/record')
def record(code: str, request: Request, user: str = Header(alias='X-AEGIS-User')):
    engine = _engine(request)
    profile = _profile(engine, code, user)
    observations = engine.repo.observations(profile.id)
    latest = {}
    for o in sorted(observations, key=lambda o: o.measured_at):
        latest[o.biomarker_id] = o
    knowledge = engine.knowledge
    return {
        'profile': asdict(profile),
        'latest': [{'biomarker_id': b, 'name': knowledge.biomarkers[b]['name'], 'value': o.value, 'unit': o.unit,
                    'measured_at': o.measured_at, 'quality': o.quality, 'is_synthetic': o.is_synthetic,
                    'sensing_layer': knowledge.biomarkers[b].get('sensing_layer', 1), 'context': o.context,
                    'method': o.method, 'source': o.source, 'href': _link(o.id)}
                   for b, o in sorted(latest.items())],
        'events': [asdict(e) for e in engine.repo.events(profile.id)],
        'open_test_requests': [asdict(r) for r in engine.repo.requests(profile.id) if r.status != 'resulted'],
        'baselines': [{**asdict(b), 'input_ids': len(b.input_ids)} for b in engine.repo.baselines(profile.id)],
    }


@router.get('/astronauts/{code}/trends')
def trends(code: str, request: Request, biomarker: str, days: int = Query(30, ge=1, le=365),
           user: str = Header(alias='X-AEGIS-User')):
    engine = _engine(request)
    profile = _profile(engine, code, user)
    if biomarker not in engine.knowledge.biomarkers:
        raise HTTPException(422, 'Biomarcador no registrado.')
    observations = engine.repo.observations(profile.id)
    end = max((o.measured_at for o in observations), default=datetime.now(timezone.utc))
    series = memory.daily([o for o in observations if o.measured_at >= end - timedelta(days=days)],
                          engine.knowledge, biomarker)
    references = [asdict(b) | {'input_ids': len(b.input_ids)} for b in engine.repo.baselines(profile.id)
                  if b.biomarker_id == biomarker]
    return {'biomarker': engine.knowledge.biomarkers[biomarker], 'aggregation': 'mediana diaria UTC',
            'series': [{'day': d, 'value': v, 'n': len(ids), 'links': [_link(i) for i in ids]}
                       for d, (v, ids) in series.items()],
            'references': references}


class ImportBody(BaseModel):
    format: Literal['json', 'csv']
    content: str | list[dict]
    is_synthetic: bool
    source: str = Field(min_length=1)


class MissionEventBody(BaseModel):
    kind: Literal['menstruation_start']
    started_at: datetime
    is_synthetic: bool
    severity: str | None = None
    details: dict = Field(default_factory=dict)

    @field_validator('started_at')
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError('El evento necesita zona horaria explícita.')
        return value.astimezone(timezone.utc)


@router.post('/astronauts/{code}/measurements')
def import_measurements(code: str, body: ImportBody, request: Request, user: str = Header(alias='X-AEGIS-User')):
    engine = _engine(request)
    profile = _profile(engine, code, user, write=True)
    if body.format == 'csv':
        if not isinstance(body.content, str):
            raise HTTPException(422, 'CSV requiere texto.')
        rows = list(csv.DictReader(io.StringIO(body.content)))
    else:
        if not isinstance(body.content, list):
            raise HTTPException(422, 'JSON requiere una lista de mediciones.')
        rows = body.content
    rows = [{**r, 'is_synthetic': body.is_synthetic, 'source': r.get('source') or body.source,
             'value': None if r.get('value') in ('', None) else r.get('value')} for r in rows]
    accepted, report = validation.validate(rows, profile.id, engine.knowledge, engine.repo.existing_keys(profile.id))
    if report['rejected']:
        raise HTTPException(422, report)  # atomic: nothing is stored if any row is invalid
    ids = engine.repo.append_observations(accepted, actor=user)
    return {**report, 'ids': ids, 'links': [_link(i) for i in ids]}


@router.post('/astronauts/{code}/events', status_code=201)
def add_event(code: str, body: MissionEventBody, request: Request,
              user: str = Header(alias='X-AEGIS-User')):
    """Store an explicitly declared cycle event; it never infers a phase from physiology."""
    engine = _engine(request)
    profile = _profile(engine, code, user, write=True)
    if profile.sex != 'female' or profile.cycle_status != 'active':
        raise HTTPException(422, 'El perfil no declara un ciclo activo.')
    if body.is_synthetic != profile.is_synthetic:
        raise HTTPException(422, 'El evento debe conservar la procedencia del perfil.')
    if any(e.kind == body.kind and e.started_at == body.started_at
           for e in engine.repo.events(profile.id)):
        raise HTTPException(409, 'Ese evento ya está registrado.')
    event_id = engine.repo.append_event({
        'astronaut_id': profile.id, 'kind': body.kind, 'started_at': body.started_at,
        'severity': body.severity, 'details': body.details, 'is_synthetic': body.is_synthetic,
    })
    return {'id': event_id, 'astronaut': code, 'kind': body.kind, 'started_at': body.started_at}


class CorrectionBody(BaseModel):
    value: float | None
    quality: Literal['good', 'questionable', 'invalid', 'missing'] = 'good'
    reason: str = Field(min_length=3)


@router.post('/measurements/{measurement_id}/corrections')
def correct(measurement_id: int, body: CorrectionBody, request: Request, user: str = Header(alias='X-AEGIS-User')):
    engine = _engine(request)
    chain, _ = _visible_measurement(engine, measurement_id, user, write=True)
    original = next(o for o in chain if o.id == measurement_id)
    new_id = engine.repo.correct_observation(original.id, body.value, body.quality, body.reason, user)
    return {'id': new_id, 'supersedes': original.id, 'href': _link(new_id)}


def _visible_measurement(engine: Engine, measurement_id: int, user: str, write: bool = False):
    for profile in engine.repo.accessible(user):
        chain = [o for o in engine.repo.observations(profile.id, include_superseded=True) if o.id == measurement_id]
        if chain:
            _profile(engine, profile.code, user, write)
            return engine.repo.observation_chain(measurement_id), profile
    raise HTTPException(404, 'Medición no encontrada o sin permiso explícito.')


@router.get('/measurements/{measurement_id}')
def measurement(measurement_id: int, request: Request, user: str = Header(alias='X-AEGIS-User')):
    chain, profile = _visible_measurement(_engine(request), measurement_id, user)
    return {'astronaut': profile.code, 'requested': measurement_id,
            'versions': [asdict(o) for o in chain], 'current': asdict(chain[-1])}


@router.post('/astronauts/{code}/evaluations')
def run_evaluation(code: str, request: Request, as_of: datetime | None = None,
                   user: str = Header(alias='X-AEGIS-User')):
    engine = _engine(request)
    profile = _profile(engine, code, user)
    if as_of is not None and (as_of.tzinfo is None or as_of.utcoffset() is None):
        raise HTTPException(422, 'as_of necesita zona horaria.')
    return _with_links(engine.evaluate(profile.id, as_of))


@router.get('/astronauts/{code}/evaluations')
def evaluations(code: str, request: Request, user: str = Header(alias='X-AEGIS-User')):
    engine = _engine(request)
    profile = _profile(engine, code, user)
    return [asdict(a) | {'evidence_links': [_link(i) for i in a.evidence_ids]} for a in engine.repo.assessments(profile.id)]


class ResultBody(BaseModel):
    value: float | None
    unit: str
    measured_at: datetime
    source: str = Field(min_length=1)
    is_synthetic: bool
    quality: Literal['good', 'questionable', 'invalid', 'missing'] = 'good'


@router.post('/test-requests/{request_id}/result')
def test_result(request_id: str, body: ResultBody, request: Request, user: str = Header(alias='X-AEGIS-User')):
    engine = _engine(request)
    try:
        test = engine.repo.request(request_id)
    except KeyError:
        raise HTTPException(404, 'Solicitud no encontrada.')
    profile = engine.repo.profile_by_id(test.astronaut_id)
    _profile(engine, profile.code, user, write=True)
    if not engine.repo.can_decide_request(profile.id, user):
        raise HTTPException(403, 'Registrar un resultado requiere permiso de médico de vuelo con escritura.')
    try:
        outcome = engine.record_test_result(request_id, body.model_dump(), actor=user)
    except ValueError as error:
        raise HTTPException(422, str(error))
    outcome['reevaluation']['evidence_links'] = [_link(i) for i in outcome['reevaluation']['evidence_ids']]
    outcome['measurement_href'] = _link(outcome['measurement_id'])
    return outcome


@router.get('/astronauts/{code}/body-systems')
def body_systems(code: str, request: Request, user: str = Header(alias='X-AEGIS-User')):
    """Latest assessment per risk, grouped by body region, for highlighting in the frontend."""
    engine = _engine(request)
    profile = _profile(engine, code, user)
    latest = {}
    for a in engine.repo.assessments(profile.id):
        latest[a.risk_id] = a
    regions: dict[str, dict] = {}
    for a in latest.values():
        region = engine.knowledge.risk(a.risk_id)['body_region']
        entry = regions.setdefault(region, {'region': region, 'alert_level': 'insufficient_data', 'findings': []})
        if LEVEL_ORDER.index(a.alert_level) > LEVEL_ORDER.index(entry['alert_level']):
            entry['alert_level'] = a.alert_level
        entry['findings'].append({'risk_id': a.risk_id, 'alert_level': a.alert_level, 'certainty': a.certainty,
                                  'explanation': a.explanation, 'assessment_id': a.id,
                                  'evidence_links': [_link(i) for i in a.evidence_ids]})
    return {'astronaut': profile.code, 'regions': sorted(regions.values(), key=lambda r: -LEVEL_ORDER.index(r['alert_level'])),
            'highlight': [r for r in regions if regions[r]['alert_level'] in ('yellow', 'orange', 'red')]}
