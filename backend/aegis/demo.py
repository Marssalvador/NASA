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
           'il6': (1.4, .2), 'crp': (.8, .15), 'cortisol': (13, 1.5), 'respiratory_rate': (14, 1), 'reaction_time': (245, 15),
           'systolic_bp': (117, 6), 'sweat_rate': (.45, .12), 'skin_temperature': (33.4, .25),
           'lactate': (1.25, .2), 'beta_hydroxybutyrate': (.2, .05),
           'vastus_lateralis_thickness': (22, .6)}
DEVICE_DEMO_METRICS = {
    'sweat_rate', 'skin_temperature', 'lactate', 'beta_hydroxybutyrate',
    'vastus_lateralis_thickness',
}


def seed():
    existing_profiles = store.astronauts()
    if existing_profiles:
        _seed_new_device_metrics(existing_profiles)
        return
    rng = np.random.default_rng(2026)
    end = datetime.now(timezone.utc).replace(microsecond=0)
    start = end - timedelta(days=29)
    definitions = registry()
    for index, (name, role, scenario) in enumerate([
        ('Elena Vega', 'Comandante', 'stable'), ('Alex Morgan', 'Especialista de misión', 'review'),
        ('Kai Nakamura', 'Ingeniería de vuelo', 'emergency')]):
        subject_id = f'crew-{index+1:02}'
        sex = 'female' if subject_id == 'crew-01' else 'male' if subject_id == 'crew-02' else 'unspecified'
        store.add_astronaut(Astronaut(id=subject_id, name=name, role=role, scenario=scenario,
                                     mission='AEGIS / ORBITAL-01', mission_start=start, sex=sex,
                                     cycle_status='active' if sex == 'female' else 'not_applicable',
                                     usual_cycle_length_days=28 if sex == 'female' else None))
        rows = []
        for metric_id, d in definitions.items():
            if metric_id in DEVICE_DEMO_METRICS or metric_id in {'exercise_load_kg', 'exercise_speed_mps'}:
                continue
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
                # Layer-2 acquisitions exist only after a layer-1 signal requested them.
                if d.sensing_layer == 2 and metric_id == 'systolic_bp' and (scenario == 'stable' or day < 25):
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
    _seed_new_device_metrics(store.astronauts())


def _seed_new_device_metrics(profiles):
    """Backfill explicitly synthetic sensor demonstrations into an existing local database."""
    definitions = registry()
    for profile in profiles:
        if not profile.is_synthetic:
            continue
        as_of = datetime.now(timezone.utc)
        existing = {row.metric_id for row in store.measurements(profile.id, as_of)}
        rng = np.random.default_rng(sum(ord(c) for c in profile.id) + 62026)
        for metric_id in DEVICE_DEMO_METRICS - existing:
            definition = definitions.get(metric_id)
            if definition is None:
                continue
            center, spread = CENTERS[metric_id]
            baseline_values = rng.normal(center, spread, 24)
            store.save_baseline(PersonalBaseline(
                astronaut_id=profile.id, metric_id=metric_id,
                mean=float(baseline_values.mean()), std=float(baseline_values.std(ddof=1)), n=24,
                unit=definition.unit,
                start=profile.mission_start - timedelta(days=25),
                end=profile.mission_start - timedelta(days=1),
                is_synthetic=True, source='AEGIS seeded device simulation / seed 2026',
            ))
            rows = []
            for day in range(30):
                drift = -0.06 * day / 29 if metric_id == 'vastus_lateralis_thickness' and profile.scenario == 'review' else 0
                value = center * (1 + drift) + float(rng.normal(0, spread * 0.22))
                rows.append(Measurement(
                    astronaut_id=profile.id, metric_id=metric_id, value=round(value, 3),
                    unit=definition.unit, timestamp=profile.mission_start + timedelta(days=day),
                    measurement_method=definition.measurement_method,
                    source='AEGIS synthetic device demonstration', quality='good', is_synthetic=True,
                ))
            store.save_measurements(rows)
