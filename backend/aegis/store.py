"""SQLite repository; explicit transactions, no mixing subjects or demo provenance."""
import os
import sqlite3
from contextlib import contextmanager
from .registry import ROOT
from .schemas import Astronaut, Measurement, PersonalBaseline

DB_PATH = os.environ.get('AEGIS_DB_PATH', str(ROOT / 'data' / 'aegis.sqlite'))


@contextmanager
def connection():
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    try:
        with db:
            yield db
    finally:
        db.close()


def initialize():
    with connection() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS astronauts(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS measurements(
          astronaut_id TEXT NOT NULL REFERENCES astronauts(id), metric_id TEXT NOT NULL,
          timestamp TEXT NOT NULL, measurement_method TEXT NOT NULL, is_synthetic INTEGER NOT NULL,
          payload TEXT NOT NULL,
          UNIQUE(astronaut_id,metric_id,timestamp,measurement_method,is_synthetic));
        CREATE INDEX IF NOT EXISTS measurement_lookup ON measurements(astronaut_id,timestamp,metric_id);
        CREATE TABLE IF NOT EXISTS baselines(
          astronaut_id TEXT NOT NULL REFERENCES astronauts(id), metric_id TEXT NOT NULL,
          is_synthetic INTEGER NOT NULL, payload TEXT NOT NULL,
          PRIMARY KEY(astronaut_id,metric_id,is_synthetic));
        CREATE TABLE IF NOT EXISTS events(
          astronaut_id TEXT NOT NULL REFERENCES astronauts(id), timestamp TEXT NOT NULL,
          symptom TEXT NOT NULL, is_synthetic INTEGER NOT NULL, resolved_at TEXT,
          UNIQUE(astronaut_id,timestamp,symptom));
        ''')


def astronauts():
    with connection() as db:
        return [Astronaut.model_validate_json(r[0]) for r in db.execute('SELECT payload FROM astronauts ORDER BY id')]


def get_astronaut(subject_id):
    return next((x for x in astronauts() if x.id == subject_id), None)


def add_astronaut(subject: Astronaut):
    with connection() as db:
        db.execute('INSERT INTO astronauts VALUES (?,?)', (subject.id, subject.model_dump_json()))


def save_measurements(items: list[Measurement], dry_run=False):
    inserted = duplicates = 0
    with connection() as db:
        for item in items:
            key = (item.astronaut_id, item.metric_id, item.timestamp.isoformat(), item.measurement_method, int(item.is_synthetic))
            exists = db.execute('SELECT 1 FROM measurements WHERE astronaut_id=? AND metric_id=? AND timestamp=? AND measurement_method=? AND is_synthetic=?', key).fetchone()
            if exists:
                duplicates += 1
            else:
                db.execute('INSERT INTO measurements VALUES (?,?,?,?,?,?)', (*key, item.model_dump_json()))
                inserted += 1
        if dry_run:
            db.rollback()
    return {'inserted': inserted, 'duplicates': duplicates}


def measurements(subject_id, as_of):
    with connection() as db:
        return [Measurement.model_validate_json(r[0]) for r in db.execute(
            'SELECT payload FROM measurements WHERE astronaut_id=? AND timestamp<=? ORDER BY timestamp,is_synthetic DESC',
            (subject_id, as_of.isoformat()))]


def save_baseline(item: PersonalBaseline):
    with connection() as db:
        db.execute('INSERT OR REPLACE INTO baselines VALUES (?,?,?,?)', (item.astronaut_id, item.metric_id, int(item.is_synthetic), item.model_dump_json()))


def baselines(subject_id):
    with connection() as db:
        return [PersonalBaseline.model_validate_json(r[0]) for r in db.execute('SELECT payload FROM baselines WHERE astronaut_id=?', (subject_id,))]


def events(subject_id, as_of):
    with connection() as db:
        return [dict(r) for r in db.execute('SELECT * FROM events WHERE astronaut_id=? AND timestamp<=? AND (resolved_at IS NULL OR resolved_at>?)', (subject_id, as_of.isoformat(), as_of.isoformat()))]
