import json
from datetime import datetime, timezone
import pytest
from backend.aegis import sensing
from backend.aegis.guidance import GuidanceEngine
from backend.aegis.registry import registry
from backend.aegis.schemas import StatisticalAnalysis

D = registry()


def analyses(**status):
    return [StatisticalAnalysis(metric_id=m, status=status.get(m, 'stable'), data_state='available') for m in D]


def route(states, pathway_id):
    return next(s for s in states if s.id == pathway_id)


def test_registry_declares_two_sensing_layers_and_sites():
    assert {d.sensing_layer for d in D.values()} == {1, 2}
    assert all(d.body_site for d in D.values())
    assert D['heart_rate'].sensing_layer == 1 and D['ctx_i'].sensing_layer == 2


def test_quiet_layer_one_does_not_request_layer_two():
    states = sensing.evaluate(analyses(), D)
    assert all(s.stage == 'quiet' for s in states)
    assert sensing.requested(states, D) == {}


def test_layer_one_deviation_requests_unsampled_confirmation():
    items = analyses(heart_rate='review', systolic_bp='insufficient_data')
    states = sensing.evaluate(items, D)
    cardio = route(states, 'cardiovascular_orthostatic')
    assert cardio.stage == 'requested' and cardio.triggered_by == ['heart_rate']
    assert sensing.requested(states, D)['systolic_bp'].startswith('Solicitada por la ruta')


def test_confirmation_outcomes():
    states = sensing.evaluate(analyses(grip_strength='review', ctx_i='review'), D)
    assert route(states, 'bone_resorption').stage == 'review'
    states = sensing.evaluate(analyses(grip_strength='review'), D)
    assert route(states, 'bone_resorption').stage == 'not_confirmed'


def test_unrequested_missing_layer_two_is_not_a_data_gap():
    items = analyses(systolic_bp='insufficient_data')
    next(a for a in items if a.metric_id == 'systolic_bp').data_state = 'missing'
    overall, findings, requests, _ = GuidanceEngine().evaluate(items, D, [])
    assert overall == 'stable' and not findings and not requests
    overall, findings, requests, _ = GuidanceEngine().evaluate(items, D, [], {'systolic_bp': 'Solicitada por la ruta X'})
    assert overall == 'insufficient_data'
    assert requests[0].metric_id == 'systolic_bp' and requests[0].reason == 'Solicitada por la ruta X'


def test_pathways_reject_unknown_or_layer_one_confirmations(tmp_path, monkeypatch):
    path = tmp_path / 'routes.json'
    base = json.loads(sensing.PATHWAYS_PATH.read_text(encoding='utf-8'))[0]
    monkeypatch.setattr(sensing, 'PATHWAYS_PATH', path)
    path.write_text(json.dumps([base | {'confirmations': ['heart_rate']}]), encoding='utf-8')
    with pytest.raises(ValueError, match='capa 2'):
        sensing.pathways(D)
    path.write_text(json.dumps([base | {'triggers': ['unknown']}]), encoding='utf-8')
    with pytest.raises(ValueError, match='no registrados'):
        sensing.pathways(D)


def test_dashboard_exposes_demonstration_route(client):
    d = client.get('/api/astronauts/crew-02/dashboard').json()
    bone = next(p for p in d['pathways'] if p['id'] == 'bone_resorption')
    assert bone['demonstration'] is True and bone['stage'] == 'review'
    stable = client.get('/api/astronauts/crew-01/dashboard').json()
    assert stable['status'] == 'stable'
    assert all(p['stage'] in ('quiet', 'unmonitored') for p in stable['pathways'])
    assert len(client.get('/api/pathways').json()) == 4
