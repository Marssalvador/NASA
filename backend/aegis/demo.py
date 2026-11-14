"""Deterministic synthetic fixtures; no human data or clinical safety thresholds.
Baseline samples precede mission observations and are stored separately.
"""
from datetime import datetime, timedelta, timezone
import numpy as np
from . import store
from .registry import registry
from .schemas import Astronaut, Measurement, PersonalBaseline

CENTERS = {'heart_rate': (68, 4), 'hrv': (52, 6), 'spo2': (98, .5), 'temperature': (36.6, .18),
           'glucose': (89, 6), 'sleep': (7.4, .4), 'grip_strength': (43, 3), 'creatinine': (.9, .08),
           'urinary_calcium': (170, 20), 'ctx_i': (.32, .04), 'p1np': (42, 5), 'vitamin_d': (34, 3),
           'il6': (1.4, .2), 'crp': (.8, .15), 'cortisol': (13, 1.5), 'respiratory_rate': (14, 1), 'reaction_time': (245, 15)}


def seed():
    if store.astronauts():
        return
    rng = np.random.default_rng(2026)
    end = datetime.now(timezone.utc).replace(microsecond=0)
    start = end - timedelta(days=29)
    definitions = registry()
    for index, (name, role, scenario) in enumerate([
        ('Elena Vega', 'Comandante', 'stable'), ('Alex Morgan', 'Especialista de misión', 'review'),
        ('Kai Nakamura', 'Ingeniería de vuelo', 'emergency')]):
        subject_id = f'crew-{index+1:02}'
        store.add_astronaut(Astronaut(id=subject_id, name=name, role=role, scenario=scenario,
                                     mission='AEGIS / ORBITAL-01', mission_start=start))
        rows = []
        for metric_id, d in definitions.items():
            center, spread = CENTERS.get(metric_id, (50, 5))
            baseline_samples = rng.normal(center, spread, 24)
            baseline = PersonalBaseline(astronaut_id=subject_id, metric_id=metric_id,
                mean=float(baseline_samples.mean()), std=float(baseline_samples.std(ddof=1)), n=24,
                unit=d.unit, start=start-timedelta(days=25), end=start-timedelta(days=1),
                is_synthetic=True, source='AEGIS seeded preflight simulation / seed 2026')
            store.save_baseline(baseline)
            for day in range(30):
                # Missing and expired acquisition states intentionally demonstrated.
                if scenario == 'review' and metric_id == 'urinary_calcium' and day > 19:
                    continue
                if scenario == 'review' and metric_id == 'il6' and day > 19:
                    continue
                deviation = 0
                if scenario != 'stable' and day >= 20 and metric_id in {'heart_rate', 'ctx_i', 'grip_strength'}:
                    deviation = (4.2 if metric_id != 'grip_strength' else -4.2) * min((day-19)/6, 1)
                value = baseline.mean + baseline.std * (float(rng.uniform(-1.1, 1.1)) + deviation)
                rows.append(Measurement(astronaut_id=subject_id, metric_id=metric_id, value=round(value, 3),
                    unit=d.unit, timestamp=start+timedelta(days=day), measurement_method=d.measurement_method,
                    source='AEGIS · simulación reproducible', quality='good', is_synthetic=True))
            if scenario == 'review' and metric_id == 'il6':
                rows.append(Measurement(astronaut_id=subject_id, metric_id=metric_id, value=None,
                    unit=d.unit, timestamp=end, measurement_method=d.measurement_method,
                    source='AEGIS · simulación de muestra no disponible', quality='missing', is_synthetic=True))
        store.save_measurements(rows)
        if scenario == 'emergency':
            with store.connection() as db:
                db.execute('INSERT INTO events VALUES (?,?,?,?,NULL)', (subject_id, (end-timedelta(days=1)).isoformat(), 'chest_pain', 1))
