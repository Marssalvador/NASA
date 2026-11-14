from contextlib import asynccontextmanager
from datetime import datetime, timezone
import csv
import io
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import Field, field_validator
from . import store
from .adapters import load_adapter
from .analysis import analyze
from .demo import seed
from .guidance import GuidanceEngine, EMERGENCY_SYMPTOMS
from .importer import ImportSpec, prepare
from .registry import ROOT, registry
from .schemas import Contract, Astronaut, PersonalBaseline, utc


@asynccontextmanager
async def lifespan(app):
    store.initialize()
    seed()
    app.state.model = load_adapter()
    yield


app = FastAPI(title='AEGIS local research API', version='0.1.0', lifespan=lifespan)


def subject_or_404(subject_id):
    subject = store.get_astronaut(subject_id)
    if subject is None:
        raise HTTPException(404, 'Astronauta desconocido')
    return subject


@app.get('/api/health')
def health():
    return {'status': 'ok', 'mode': 'local', 'clinical_validation': False}


@app.get('/api/registry')
def biomarkers():
    return list(registry().values())


@app.get('/api/astronauts')
def astronauts():
    return store.astronauts()


@app.post('/api/astronauts', status_code=201)
def create_astronaut(subject: Astronaut):
    if store.get_astronaut(subject.id):
        raise HTTPException(409, 'Identificador ya existente')
    store.add_astronaut(subject)
    return subject


@app.post('/api/baselines')
def save_baseline(item: PersonalBaseline):
    subject_or_404(item.astronaut_id)
    definitions = registry()
    if item.metric_id not in definitions or item.unit != definitions[item.metric_id].unit:
        raise HTTPException(422, 'Biomarcador o unidad incompatible')
    store.save_baseline(item)
    return item


@app.get('/api/astronauts/{subject_id}/dashboard')
def dashboard(subject_id: str, as_of: datetime | None = None):
    subject = subject_or_404(subject_id)
    try:
        now = utc(as_of) if as_of else datetime.now(timezone.utc)
    except ValueError as error:
        raise HTTPException(422, str(error))
    definitions = registry()
    rows = store.measurements(subject_id, now)
    personal = store.baselines(subject_id)
    analyses = []
    for d in definitions.values():
        metric_rows = [x for x in rows if x.metric_id == d.id]
        provenance = metric_rows[-1].is_synthetic if metric_rows else True
        baseline = next((b for b in personal if b.metric_id == d.id and b.is_synthetic == provenance), None)
        analyses.append(analyze(d, metric_rows, baseline, now))
    events = store.events(subject_id, now)
    overall, findings, requests, guidance = GuidanceEngine().evaluate(analyses, definitions, events)
    try:
        prediction = app.state.model.predict(analyses)
        model_error = None
    except Exception as error:
        prediction, model_error = None, f'Modelo no disponible: {type(error).__name__}: {error}'
    return {'astronaut': subject, 'as_of': now, 'status': overall, 'analyses': analyses,
            'findings': findings, 'measurement_requests': requests, 'guidance': guidance,
            'prediction': prediction, 'model_error': model_error, 'events': events,
            'demo_start': subject.mission_start, 'demo_end': subject.mission_start.replace() + __import__('datetime').timedelta(days=29)}


@app.post('/api/import/preview')
def preview(spec: ImportSpec):
    try:
        return prepare(spec)[1]
    except (ValueError, TypeError) as error:
        raise HTTPException(422, str(error))


@app.post('/api/import/commit')
def commit_import(spec: ImportSpec):
    try:
        items, report = prepare(spec)
    except (ValueError, TypeError) as error:
        raise HTTPException(422, str(error))
    if not report['valid']:
        raise HTTPException(422, report)
    return {**report, **store.save_measurements(items)}


class SymptomEvent(Contract):
    symptom: str
    timestamp: datetime
    is_synthetic: bool
    _timestamp_utc = field_validator('timestamp')(utc)


@app.post('/api/astronauts/{subject_id}/symptoms')
def symptom(subject_id: str, event: SymptomEvent):
    subject_or_404(subject_id)
    if event.symptom not in EMERGENCY_SYMPTOMS:
        raise HTTPException(422, 'Síntoma no incluido en el conjunto demostrativo de alerta')
    with store.connection() as db:
        db.execute('INSERT OR IGNORE INTO events VALUES (?,?,?,?,NULL)', (subject_id, event.timestamp.isoformat(), event.symptom, int(event.is_synthetic)))
    return {'status': 'emergency', 'message': 'Activar protocolo aprobado de misión. Pendiente de revisión médica en esta demo.'}


@app.get('/api/astronauts/{subject_id}/export')
def export(subject_id: str, format: str = Query('json', pattern='^(json|csv)$')):
    snapshot = dashboard(subject_id)
    if format == 'json':
        return snapshot
    rows = store.measurements(subject_id, datetime.now(timezone.utc))
    output = io.StringIO()
    fields = ['astronaut_id', 'metric_id', 'value', 'unit', 'timestamp', 'measurement_method', 'source', 'quality', 'is_synthetic']
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    for row in rows:
        values = row.model_dump(mode='json')
        # Prevent formula execution when someone opens exported text in a spreadsheet.
        writer.writerow({k: "'"+v if isinstance(v, str) and v.startswith(('=', '+', '-', '@', '\t', '\r')) else v for k,v in values.items()})
    return Response(output.getvalue(), media_type='text/csv', headers={'Content-Disposition': f'attachment; filename="aegis-{subject_id}.csv"'})


dist = ROOT / 'frontend' / 'dist'
if dist.is_dir():
    app.mount('/', StaticFiles(directory=dist, html=True), name='console')
