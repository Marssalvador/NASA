from datetime import datetime, timedelta, timezone
import math
import pytest
from pydantic import ValidationError
from backend.aegis.analysis import analyze
from backend.aegis.registry import registry
from backend.aegis.schemas import Measurement, PersonalBaseline

NOW = datetime(2026, 11, 14, 12, tzinfo=timezone.utc)
D = registry()['heart_rate']


def measurement(value=70, **overrides):
    return Measurement.model_validate(dict(astronaut_id='crew-01', metric_id=D.id, value=value, unit=D.unit,
        timestamp=NOW, measurement_method='test', source='unit test', quality='good', is_synthetic=True) | overrides)


def baseline(**overrides):
    return PersonalBaseline.model_validate(dict(astronaut_id='crew-01', metric_id=D.id, mean=70, std=2, n=20,
        unit='bpm', start=NOW-timedelta(days=40), end=NOW-timedelta(days=30), is_synthetic=True, source='preflight test') | overrides)


def observations():
    return [measurement(v, timestamp=NOW-timedelta(days=3-i)) for i,v in enumerate([68,70,72,70])]


def test_descriptive_statistics_and_no_unjustified_interval():
    a = analyze(D, observations(), baseline(), NOW)
    assert a.status == 'stable' and a.n == 4
    assert a.mean == 70 and a.median == 70 and a.mad == 1
    assert a.std == pytest.approx(math.sqrt(8/3))
    assert a.ci95 is None and a.prediction_interval_95 is None
    assert a.trend_per_day == pytest.approx(.8)


def test_review_is_personal_heuristic():
    rows = observations()[:-1] + [measurement(80)]
    a = analyze(D, rows, baseline(), NOW)
    assert a.status == 'review' and a.deviation_z == 5


@pytest.mark.parametrize('kind', ['missing','stale','poor_quality','no_baseline','constant','low_n','overlap'])
def test_insufficient_data_never_normal(kind):
    rows, b = observations(), baseline()
    if kind == 'missing': rows.append(measurement(None, quality='missing'))
    if kind == 'stale': rows = [measurement(70, timestamp=NOW-timedelta(days=3))]
    if kind == 'poor_quality': rows.append(measurement(70, quality='questionable'))
    if kind == 'no_baseline': b = None
    if kind == 'constant': b = baseline(std=0)
    if kind == 'low_n': b = baseline(n=2)
    if kind == 'overlap': b = baseline(end=NOW-timedelta(days=1))
    assert analyze(D, rows, b, NOW).status == 'insufficient_data'


def test_real_and_synthetic_never_pooled():
    rows = observations() + [measurement(100, is_synthetic=False)]
    a = analyze(D, rows, baseline(), NOW)
    assert a.n == 1 and a.mean == 100 and a.baseline is None
    assert a.status == 'insufficient_data'
    assert len(a.series) == 1


def test_ci_only_with_explicit_assumptions_and_sufficient_n():
    rows = [measurement(65+i, timestamp=NOW-timedelta(hours=12-i)) for i in range(10)]
    a = analyze(D, rows, baseline(), NOW, independent_normal_samples=True)
    assert a.ci95 and a.ci95[0] < a.mean < a.ci95[1]
    assert analyze(D, rows[:3], baseline(), NOW, independent_normal_samples=True).ci95 is None


@pytest.mark.parametrize('value',[float('nan'),float('inf'),float('-inf')])
def test_nonfinite_rejected(value):
    with pytest.raises(ValidationError): measurement(value)


def test_timezone_required_and_normalized():
    with pytest.raises(ValidationError): measurement(timestamp='2026-11-14T13:00:00')
    assert measurement(timestamp='2026-11-14T13:00:00+01:00').timestamp == NOW


def test_future_measurements_ignored():
    a = analyze(D, [measurement(100,timestamp=NOW+timedelta(days=1))], baseline(), NOW)
    assert a.n == 0 and a.latest is None
