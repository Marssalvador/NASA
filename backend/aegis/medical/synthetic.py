"""Deterministic synthetic astronauts for development. No real person and no clinical safety limits.

A-112 (female, active declared cycle): 21-day preflight reference, then 28 mission days in which
resistive exercise halves from mission day 10 and HRV drops / resting HR rises from day 22 (follicular
phase), while the morning temperature rises physiologically in the luteal phase. Layer-2 markers are
measured in preflight only, so the engine must request them.
A-113 (male): stable, used to verify isolation between records.
"""
from datetime import datetime, timedelta, timezone
import numpy as np
from .domain import Profile
from .repository import InMemoryRepository

MISSION_START = datetime(2026, 10, 15, tzinfo=timezone.utc)
PREFLIGHT_DAYS = 21
MISSION_DAYS = 28
AS_OF = MISSION_START + timedelta(days=MISSION_DAYS - 1, hours=23)
SOURCE = 'AEGIS · simulación sintética reproducible'
A112 = '7a1c0000-0000-4000-a000-000000000112'
A113 = '7a1c0000-0000-4000-a000-000000000113'
MENSTRUATION_DAYS = (-38, -10, 18)  # relative to mission start
SPARSE = {'ctx_i': (0.30, 0.02), 'p1np': (45, 3), 'urinary_calcium': (170, 15), 'creatinine': (0.9, 0.05),
          'urine_ph': (6.2, 0.15), 'il6': (1.4, 0.15), 'crp': (0.8, 0.1), 'systolic_bp': (114, 3),
          'diastolic_bp': (72, 2), 'vitamin_d': (34, 2)}
UNITS = {'heart_rate': 'bpm', 'hrv': 'ms', 'temperature': '°C', 'glucose': 'mg/dL', 'sleep': 'h',
         'sleep_efficiency': '%', 'resistive_exercise_minutes': 'min', 'eda': 'µS', 'lactate': 'mmol/L',
         'sweat_sodium': 'mmol/L', 'ctx_i': 'ng/mL', 'p1np': 'ng/mL', 'urinary_calcium': 'mg/24h',
         'creatinine': 'mg/dL', 'urine_ph': 'pH', 'il6': 'pg/mL', 'crp': 'mg/L', 'systolic_bp': 'mmHg',
         'diastolic_bp': 'mmHg', 'vitamin_d': 'ng/mL'}


def _luteal(day: int) -> bool:
    start = max(s for s in MENSTRUATION_DAYS if s <= day)
    return day - start + 1 >= 15


def rows_for(astronaut_id: str, scenario: str, seed: int) -> list[dict]:
    rng = np.random.default_rng(seed)
    rows = []

    def add(biomarker, moment, value, **context):
        rows.append({'astronaut_id': astronaut_id, 'biomarker_id': biomarker, 'unit': UNITS[biomarker],
                     'value': round(float(value), 3), 'measured_at': moment, 'source': SOURCE,
                     'method': 'synthetic', 'quality': 'good', 'context': context, 'is_synthetic': True})

    for day in range(-PREFLIGHT_DAYS, MISSION_DAYS):
        base = MISSION_START + timedelta(days=day)
        drift = scenario == 'review'
        luteal = drift and _luteal(day)
        add('heart_rate', base + timedelta(hours=7), 58 + rng.normal(0, 1) + (3.6 if drift and day >= 22 else 0))
        add('hrv', base + timedelta(hours=7, minutes=5),
            55 * (1 - (0.08 if luteal else 0) - (0.20 if drift and day >= 22 else 0)) + rng.normal(0, 1.2))
        add('temperature', base + timedelta(hours=6, minutes=30),
            36.5 + (0.4 if luteal else 0) + rng.normal(0, 0.05), time_of_day='morning')
        add('temperature', base + timedelta(hours=19), 36.8 + rng.normal(0, 0.08), time_of_day='evening')
        for hour in (2, 8, 14, 20):
            add('glucose', base + timedelta(hours=hour), 95 + rng.normal(0, 12))
        add('sleep', base + timedelta(hours=6), 7.2 + rng.normal(0, 0.25))
        add('sleep_efficiency', base + timedelta(hours=6, minutes=1), 88 + rng.normal(0, 1.5))
        add('resistive_exercise_minutes', base + timedelta(hours=18),
            (30 if drift and day >= 10 else 60) + rng.normal(0, 3))
        add('eda', base + timedelta(hours=12), 4 + rng.normal(0, 0.3))
        add('lactate', base + timedelta(hours=7, minutes=30), 1.1 + rng.normal(0, 0.08))
        add('sweat_sodium', base + timedelta(hours=17), 45 + rng.normal(0, 3))
        if day < 0 and (day + PREFLIGHT_DAYS) % 2 == 0 and day >= -PREFLIGHT_DAYS:
            for biomarker, (center, sd) in SPARSE.items():
                add(biomarker, base + timedelta(hours=8), center + rng.normal(0, sd))
    return rows


def build(repo: InMemoryRepository | None = None) -> InMemoryRepository:
    repo = repo or InMemoryRepository()
    for astronaut_id, code, name, sex, cycle_status, scenario, seed in (
            (A112, 'A-112', 'Lena Ortiz (sintética)', 'female', 'active', 'review', 112),
            (A113, 'A-113', 'Ivan Petrov (sintético)', 'male', 'not_applicable', 'stable', 113)):
        repo.add_profile(Profile(id=astronaut_id, code=code, display_name=name, sex=sex, cycle_status=cycle_status,
                                 usual_cycle_length_days=28 if sex == 'female' else None, mission_start=MISSION_START,
                                 is_synthetic=True))
        repo.append_observations(rows_for(astronaut_id, scenario, seed), actor='synthetic-seed')
        if sex == 'female':
            for day in MENSTRUATION_DAYS:
                repo.append_event({'astronaut_id': astronaut_id, 'kind': 'menstruation_start',
                                   'started_at': MISSION_START + timedelta(days=day), 'severity': 'info',
                                   'details': {'declared_by': 'astronaut'}, 'is_synthetic': True})
    # Development grants: one user per astronaut, plus a flight surgeon for A-112 only.
    repo.grant('user-a112', A112, 'self', can_write=True)
    repo.grant('user-a113', A113, 'self', can_write=True)
    repo.grant('surgeon-1', A112, 'flight_surgeon', can_write=True)
    return repo
