"""Temporal features named by the documented rules, each traceable to its input observations."""
from datetime import date, datetime, timedelta
import math
import numpy as np
from . import cycle, memory
from .domain import Baseline, Event, Feature, Observation, Profile
from .knowledge import Knowledge

LOOKBACK_DAYS = 7


def _toward_zero(value: float, tolerance: float) -> float:
    """Shift a deviation toward zero by a documented physiological tolerance, never crossing zero."""
    return math.copysign(max(abs(value) - tolerance, 0.0), value)


def reference_for(day: date, biomarker: str, profile: Profile, events: list[Event], knowledge: Knowledge,
                  baselines: dict[tuple[str, str, str], Baseline]) -> tuple[Baseline | None, dict | None, str | None]:
    """Phase-specific reference when declared and available; otherwise the global one plus the phase modifier."""
    moment = datetime.combine(day, datetime.min.time(), profile.mission_start.tzinfo)
    phase = cycle.phase_at(moment, profile, events, knowledge)
    group = cycle.BASELINE_GROUP.get(phase or '')
    context = baselines.get((biomarker, 'initial_stable', f'cycle_phase={group}')) if group else None
    if context and context.status == 'accepted':
        return context, None, phase
    return baselines.get((biomarker, 'initial_stable', 'all')), cycle.modifier(knowledge, biomarker, phase), phase


def daily_features(profile: Profile, observations: list[Observation], events: list[Event], knowledge: Knowledge,
                   baselines: dict, as_of: datetime) -> list[Feature]:
    out = []
    first_day = max((as_of - timedelta(days=LOOKBACK_DAYS - 1)).date(), profile.mission_start.date())
    for biomarker in sorted({o.biomarker_id for o in observations}):
        series = memory.daily([o for o in observations if o.measured_at <= as_of], knowledge, biomarker)
        for day, (value, ids) in series.items():
            if day < first_day or day > as_of.date():
                continue
            reference, mod, phase = reference_for(day, biomarker, profile, events, knowledge, baselines)
            if not reference or reference.status != 'accepted':
                continue
            window = (datetime.combine(day, datetime.min.time(), as_of.tzinfo),
                      datetime.combine(day, datetime.max.time(), as_of.tzinfo))
            note = f'referencia {reference.context_key} v{reference.version}'
            delta = value - reference.center
            pct = delta / abs(reference.center) * 100 if reference.center else None
            if mod and 'tolerance_delta' in mod:
                delta = _toward_zero(delta, mod['tolerance_delta'])
                note += f' · fase {phase}: tolerancia ±{mod["tolerance_delta"]} ({mod["source"]})'
            if mod and 'tolerance_pct' in mod and pct is not None:
                pct = _toward_zero(pct, mod['tolerance_pct'])
                note += f' · fase {phase}: tolerancia ±{mod["tolerance_pct"]} % ({mod["source"]})'
            values = {'daily_delta_vs_initial': delta, 'daily_pct_change_vs_initial': pct,
                      'daily_robust_z_vs_initial': (value - reference.center) / reference.spread}
            for name, v in values.items():
                if v is not None:
                    out.append(Feature(biomarker, name, day, round(float(v), 4), len(ids), 'complete',
                                       ids, *window, note))
    return out


def latest_values(observations: list[Observation], profile: Profile, as_of: datetime) -> list[Feature]:
    out = []
    for biomarker in sorted({o.biomarker_id for o in observations}):
        rows = [o for o in memory.cohort([o for o in observations if o.biomarker_id == biomarker])
                if profile.mission_start <= o.measured_at <= as_of]
        if rows:
            last = max(rows, key=lambda o: o.measured_at)
            out.append(Feature(biomarker, 'latest_value', last.measured_at.date(), last.value, 1, 'complete',
                               (last.id,), last.measured_at, last.measured_at))
    return out


def window_features(observations: list[Observation], knowledge: Knowledge, profile: Profile,
                    as_of: datetime) -> list[Feature]:
    out = []
    for name, spec in knowledge.window_features.items():
        start = max(as_of - timedelta(days=spec['window_days']), profile.mission_start)
        rows = [o for o in memory.cohort([o for o in observations if o.biomarker_id == spec['biomarker']])
                if start <= o.measured_at <= as_of]
        if spec['kind'] == 'count_days_below':
            days = memory.daily(rows, knowledge, spec['biomarker'])
            values = [v for v, _ in days.values()]
            n = len(values)
            value = float(sum(v < spec['threshold'] for v in values)) if n else None
            quality = 'complete' if n >= spec['window_days'] else 'partial' if n >= 4 else 'insufficient'
        else:
            values = np.array([o.value for o in rows], dtype=float)
            n = len(values)
            if spec['kind'] == 'pct_in_range':
                lo, hi = spec['range']
                value = float(((values >= lo) & (values <= hi)).mean() * 100) if n else None
            elif spec['kind'] == 'pct_below':
                value = float((values < spec['threshold']).mean() * 100) if n else None
            elif spec['kind'] == 'cv_pct':
                value = float(values.std(ddof=1) / values.mean() * 100) if n > 1 and values.mean() else None
            else:
                raise ValueError(f'Tipo de característica desconocido: {spec["kind"]}')
            # Distributional metrics need several samples per day over the window.
            quality = 'complete' if n >= spec['window_days'] * 4 else 'partial' if n >= 10 else 'insufficient'
        if quality == 'insufficient':
            value = None
        out.append(Feature(spec['biomarker'], name, as_of.date(), None if value is None else round(value, 3), n,
                           quality, tuple(sorted(o.id for o in rows)), start, as_of, spec.get('source', '')))
    return out


def compute(profile: Profile, observations: list[Observation], events: list[Event], knowledge: Knowledge,
            baselines: dict, as_of: datetime) -> list[Feature]:
    return (daily_features(profile, observations, events, knowledge, baselines, as_of)
            + latest_values(observations, profile, as_of)
            + window_features(observations, knowledge, profile, as_of))
