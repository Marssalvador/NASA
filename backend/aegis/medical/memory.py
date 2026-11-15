"""Physiological memory: individual references per biomarker.

* initial_stable: built only from the preflight period (before mission start). It is never updated by
  mission data, so a progressive pathological change cannot be normalised into the reference.
* recent: the last days of the mission, used to describe the current pattern.
* context references (e.g. cycle_phase=luteal) when the declared context module applies.

Values are aggregated per UTC day (median) so that high-frequency sensors do not outweigh daily ones;
only `good` quality observations from one provenance cohort (synthetic or real, never mixed) are used.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
import math
import numpy as np
from . import cycle
from .domain import Baseline, Event, Observation, Profile
from .knowledge import Knowledge

MAD_TO_SD = 1.4826
INITIAL_MIN_DAYS = 8
CONTEXT_MIN_DAYS = 5
RECENT_DAYS = 7
RECENT_MIN_DAYS = 4
PERSISTENT_Z = 2.0
METHOD = 'daily_median · median/MAD robust'


def cohort(observations: list[Observation]) -> list[Observation]:
    """Usable observations of the latest provenance cohort. Real and synthetic data never pool."""
    usable = [o for o in observations if o.quality == 'good' and o.value is not None and math.isfinite(o.value)]
    if not usable:
        return []
    latest = max(usable, key=lambda o: o.measured_at)
    return [o for o in usable if o.is_synthetic == latest.is_synthetic]


def daily(observations: list[Observation], knowledge: Knowledge, biomarker: str) -> dict[date, tuple[float, tuple[int, ...]]]:
    """UTC-day median per biomarker, honouring documented same-time-of-day comparisons."""
    wanted = knowledge.daily_aggregation.get(biomarker, {}).get('context', {})
    groups: dict[date, list[Observation]] = defaultdict(list)
    for o in cohort([o for o in observations if o.biomarker_id == biomarker]):
        if all(o.context.get(k) == v for k, v in wanted.items()):
            groups[o.measured_at.date()].append(o)
    return {d: (float(np.median([o.value for o in rows])), tuple(sorted(o.id for o in rows)))
            for d, rows in sorted(groups.items())}


def robust(days: dict[date, tuple[float, tuple[int, ...]]], biomarker: str, kind: str, context_key: str,
           start: datetime, end: datetime, min_days: int, synthetic: bool) -> Baseline:
    values = np.array([v for v, _ in days.values()], dtype=float)
    ids = tuple(i for _, group in days.values() for i in group)
    center = spread = None
    status = 'insufficient'
    if len(values) >= min_days:
        center = float(np.median(values))
        spread = MAD_TO_SD * float(np.median(np.abs(values - center)))
        if spread == 0 and len(values) > 1:
            spread = float(values.std(ddof=1))
        status = 'accepted' if spread and math.isfinite(spread) and spread > 0 else 'insufficient'
    return Baseline(biomarker_id=biomarker, kind=kind, context_key=context_key, method=METHOD, status=status,
                    n=len(values), center=center, spread=spread if status == 'accepted' else None,
                    window_start=start, window_end=end, input_ids=ids, is_synthetic=synthetic)


def build(profile: Profile, observations: list[Observation], events: list[Event], knowledge: Knowledge,
          as_of: datetime) -> list[Baseline]:
    baselines = []
    preflight_start = min((o.measured_at for o in observations), default=profile.mission_start - timedelta(days=1))
    for biomarker in sorted({o.biomarker_id for o in observations}):
        series = daily([o for o in observations if o.measured_at <= as_of], knowledge, biomarker)
        if not series:
            continue
        synthetic = cohort([o for o in observations if o.biomarker_id == biomarker])[0].is_synthetic
        before = {d: v for d, v in series.items() if d < profile.mission_start.date()}
        baseline_min_days = int(knowledge.biomarkers[biomarker].get('baseline_min_days', INITIAL_MIN_DAYS))
        baselines.append(robust(before, biomarker, 'initial_stable', 'all', preflight_start, profile.mission_start,
                                baseline_min_days, synthetic))
        if cycle.applies(profile, knowledge) and any(
                m['biomarker'] == biomarker and m.get('separate_baseline') for m in knowledge.cycle['modifiers']):
            for group in sorted(set(cycle.BASELINE_GROUP.values())):
                in_phase = {d: v for d, v in before.items() if cycle.BASELINE_GROUP.get(
                    cycle.phase_at(datetime.combine(d, datetime.min.time(), profile.mission_start.tzinfo),
                                   profile, events, knowledge) or '') == group}
                baselines.append(robust(in_phase, biomarker, 'initial_stable', f'cycle_phase={group}',
                                        preflight_start, profile.mission_start, CONTEXT_MIN_DAYS, synthetic))
        window_start = max(as_of - timedelta(days=RECENT_DAYS), profile.mission_start)
        recent = {d: v for d, v in series.items() if window_start.date() <= d <= as_of.date()
                  and d >= profile.mission_start.date()}
        if window_start < as_of:
            baselines.append(robust(recent, biomarker, 'recent', 'all', window_start, as_of, RECENT_MIN_DAYS, synthetic))
    return baselines


def persistent_shift(initial: Baseline | None, recent: Baseline | None) -> dict | None:
    """A sustained displacement of the recent pattern. Reported, never absorbed into the reference."""
    if not initial or not recent or initial.status != 'accepted' or recent.status != 'accepted':
        return None
    z = (recent.center - initial.center) / initial.spread
    if abs(z) < PERSISTENT_Z:
        return None
    return {'biomarker_id': initial.biomarker_id, 'robust_z': round(z, 2), 'recent_center': recent.center,
            'initial_center': initial.center,
            'note': 'Cambio persistente respecto a la referencia inicial. No se incorpora automáticamente a la '
                    'referencia: una nueva referencia requiere decisión explícita y revisión.'}
