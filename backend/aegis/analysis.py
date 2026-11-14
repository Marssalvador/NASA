"""Descriptive statistics and personal deviation; no diagnostic inference.

Three standard deviations is an explicit research visualization heuristic.
It is not a safety limit, clinical cut-off or disease probability.
"""
from datetime import datetime
import numpy as np
from scipy import stats
from .schemas import BiomarkerDefinition, Measurement, PersonalBaseline, StatisticalAnalysis

MIN_BASELINE_N = 8
REVIEW_Z = 3.0


def analyze(definition: BiomarkerDefinition, observations: list[Measurement], baseline: PersonalBaseline | None,
            now: datetime, *, independent_normal_samples: bool = False) -> StatisticalAnalysis:
    rows = sorted((x for x in observations if x.metric_id == definition.id and x.timestamp <= now), key=lambda x: x.timestamp)
    result = StatisticalAnalysis(metric_id=definition.id)
    if not rows:
        return result
    latest = rows[-1]
    # The latest acquisition's provenance selects the cohort. Never pool real and synthetic values.
    cohort = [x for x in rows if x.is_synthetic == latest.is_synthetic]
    result.latest = latest
    result.series = cohort
    good = [x for x in cohort if x.value is not None and x.quality == 'good']
    result.n = len(good)
    result.excluded = len(cohort) - len(good)
    if result.excluded:
        result.quality_flags.append('Observaciones ausentes o de calidad no aceptada excluidas.')
    if len(cohort) != len(rows):
        result.quality_flags.append('Datos reales y sintéticos separados; se usa el origen de la última adquisición.')
    if baseline and baseline.is_synthetic == latest.is_synthetic and baseline.unit == definition.unit and baseline.end < cohort[0].timestamp:
        result.baseline = baseline
    else:
        result.quality_flags.append('Sin baseline previo compatible con el origen y la unidad.')
    if good:
        values = np.array([x.value for x in good], dtype=float)
        result.mean = float(values.mean())
        result.std = float(values.std(ddof=1)) if len(values) >= 2 else None
        result.median = float(np.median(values))
        result.mad = float(np.median(np.abs(values - np.median(values))))
        days = np.array([(x.timestamp - good[0].timestamp).total_seconds() / 86400 for x in good])
        if len(values) >= 3 and len(np.unique(days)) >= 3:
            result.trend_per_day = float(stats.linregress(days, values).slope)
        # Time-series independence is NOT assumed or inferred from a normality p-value.
        if independent_normal_samples and len(values) >= MIN_BASELINE_N:
            radius = stats.t.ppf(.975, len(values)-1) * stats.sem(values)
            result.ci95 = [float(values.mean()-radius), float(values.mean()+radius)]
            result.uncertainty = 'IC 95 % de la media bajo independencia y normalidad declaradas; no es un intervalo clínico.'
        else:
            result.uncertainty = 'IC no estimado: independencia y distribución no verificadas en esta serie temporal. Sin intervalo de predicción validado.'
    if latest.value is None:
        result.data_state = 'missing'
    elif latest.quality != 'good':
        result.data_state = 'poor_quality'
    elif (now - latest.timestamp).total_seconds() > definition.expected_frequency * 3600:
        result.data_state = 'stale'
    else:
        result.data_state = 'available'
    if result.data_state != 'available':
        return result
    if not result.baseline or result.baseline.n < MIN_BASELINE_N or len(good) < 3:
        return result
    if result.baseline.std == 0:
        result.quality_flags.append('Baseline constante: no se puede estandarizar una desviación.')
        return result
    result.deviation_z = (latest.value - result.baseline.mean) / result.baseline.std
    result.status = 'review' if abs(result.deviation_z) >= REVIEW_Z else 'stable'
    return result
