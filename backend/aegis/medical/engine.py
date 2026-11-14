"""Evaluation pipeline.

1. measurement validation (validation.py, at ingestion) and data-state classification
2. temporal feature extraction           (features.py)
3. individual anomaly detection           (memory.py baselines + robust z)
4. multivariate pattern per risk          (ModelAdapter; default RuleEngineAdapter)
5. documented rules and protocols         (rules.py over data/medical/protocols.json)
6. justified additional test requests     (layer-2 confirmations)
7. re-evaluation once results arrive      (Engine.record_test_result)

Emergencies (emergency.py) are evaluated first and independently of the model.
Certainty vocabulary: observation < suspicion < confirmed_finding. A clinical diagnosis is recorded
only by a professional (assessment_feedback), never by this engine.
"""
from datetime import datetime, timedelta, timezone
from dataclasses import asdict
import hashlib
import json
import uuid
from . import cycle, emergency, features as featurelib, memory, rules, validation
from .adapter import ModelInput, guard, load_adapter
from .domain import CERTAINTY_ORDER, LEVEL_ORDER, Assessment, Feature, TestRequest
from .knowledge import ENGINE_NAME, ENGINE_VERSION, Knowledge
from .repository import Repository

ANOMALY_Z = 3.0
ANOMALY_DAYS = 2
PENDING = 'Pendiente de revisión médica'


def _hash(payload) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def data_states(knowledge: Knowledge, observations, as_of: datetime, wanted: set[str]) -> dict[str, str]:
    """available / stale / missing / poor_quality per biomarker of interest."""
    states = {}
    for biomarker in sorted(wanted):
        rows = [o for o in observations if o.biomarker_id == biomarker and o.measured_at <= as_of]
        if not rows:
            states[biomarker] = 'missing'
            continue
        latest = max(rows, key=lambda o: o.measured_at)
        freq = knowledge.biomarkers[biomarker]['expected_frequency']
        if latest.quality == 'missing' or latest.value is None:
            states[biomarker] = 'missing'
        elif latest.quality != 'good':
            states[biomarker] = 'poor_quality'
        elif (as_of - latest.measured_at) > timedelta(hours=freq):
            states[biomarker] = 'stale'
        else:
            states[biomarker] = 'available'
    return states


def anomalies(feature_rows: list[Feature]) -> list[dict]:
    """Robust |z| >= 3 on the last two consecutive daily values: a research heuristic, not a clinical limit."""
    found = []
    for biomarker in sorted({f.biomarker_id for f in feature_rows if f.feature == 'daily_robust_z_vs_initial'}):
        days = sorted((f for f in feature_rows if f.biomarker_id == biomarker and f.feature == 'daily_robust_z_vs_initial'),
                      key=lambda f: f.day)[-ANOMALY_DAYS:]
        consecutive = len(days) == ANOMALY_DAYS and all((b.day - a.day).days == 1 for a, b in zip(days, days[1:]))
        if consecutive and all(abs(f.value) >= ANOMALY_Z for f in days) and len({f.value > 0 for f in days}) == 1:
            found.append({'biomarker_id': biomarker, 'robust_z': [f.value for f in days],
                          'direction': 'up' if days[-1].value > 0 else 'down',
                          'evidence_ids': sorted({i for f in days for i in f.input_ids})})
    return found


class Engine:
    def __init__(self, repository: Repository, knowledge: Knowledge | None = None, adapter=None):
        self.repo = repository
        self.knowledge = knowledge or Knowledge.load()
        self.adapter = adapter or load_adapter(self.knowledge)

    # -------------------------------------------------------------------------------------------
    def evaluate(self, astronaut_id: str, as_of: datetime | None = None, supersedes: dict[str, str] | None = None) -> dict:
        k = self.knowledge
        profile = self.repo.profile_by_id(astronaut_id)
        as_of = (as_of or datetime.now(timezone.utc)).astimezone(timezone.utc)
        observations = self.repo.observations(astronaut_id, until=as_of)
        events = self.repo.events(astronaut_id, until=as_of)
        period_start = max(profile.mission_start, as_of - timedelta(days=featurelib.LOOKBACK_DAYS))
        run_id = str(uuid.uuid4())

        # Physiological memory (versioned; identical inputs reuse the stored version).
        stored = [self.repo.save_baseline(astronaut_id, b, ENGINE_VERSION)
                  for b in memory.build(profile, observations, events, k, as_of)]
        baselines = {(b.biomarker_id, b.kind, b.context_key): b for b in stored}
        shifts = [s for b in {b.biomarker_id for b in stored} if (s := memory.persistent_shift(
            baselines.get((b, 'initial_stable', 'all')), baselines.get((b, 'recent', 'all'))))]

        feature_rows = featurelib.compute(profile, observations, events, k, baselines, as_of)
        self.repo.save_features(astronaut_id, run_id, feature_rows, ENGINE_VERSION)
        found = anomalies(feature_rows)
        emergencies = emergency.evaluate(k, feature_rows, events, as_of)

        matches = []
        for protocol in k.protocols:
            outcome = rules.evaluate(protocol['trigger_rule'], feature_rows, events, as_of)
            level = protocol['alert_level']
            escalate = protocol.get('escalate_to_red_if_symptom')
            if outcome.matched and escalate and rules.evaluate({'symptom_any': escalate}, [], events, as_of).matched:
                level = 'red'
            matches.append({'protocol': protocol, 'outcome': outcome, 'level': level})

        involved = {link['biomarker'] for r in k.risks for link in r['links']}
        states = data_states(k, observations, as_of, involved | {o.biomarker_id for o in observations})
        available = {b for b, s in states.items() if s in ('available', 'stale')}
        model_input = ModelInput(astronaut_id, period_start, as_of, feature_rows, found, available,
                                 {'cycle_phase': cycle.phase_at(as_of, profile, events, k)})
        # A failing or contract-breaking model never blocks emergencies or the data report.
        try:
            outputs = {o.risk_id: guard(o, model_input) for o in self.adapter.predict(model_input)}
            model_error = None
        except Exception as error:  # noqa: BLE001 - reported to the caller, not swallowed
            outputs, model_error = {}, f'{type(error).__name__}: {error}'

        open_requests = [r for r in self.repo.requests(astronaut_id) if r.status in ('proposed', 'approved', 'collected')]
        report_assessments = []
        for risk in (k.risks if outputs else []):
            report_assessments.append(self._assess(risk, profile, observations, baselines, feature_rows, found, matches,
                                                   outputs[risk['id']], states, open_requests, as_of, period_start,
                                                   (supersedes or {}).get(risk['id']), model_input.context))

        return {
            'astronaut': {'id': profile.id, 'code': profile.code, 'is_synthetic': profile.is_synthetic},
            'as_of': as_of, 'run_id': run_id, 'engine': f'{ENGINE_NAME} {ENGINE_VERSION}',
            'knowledge_fingerprint': k.fingerprint, 'model': {'name': self.adapter.name, 'version': self.adapter.version,
                                                               'validation_status': self.adapter.validation_status},
            'cycle_phase': model_input.context['cycle_phase'],
            'model_error': model_error,
            'emergencies': emergencies, 'data_states': states, 'persistent_shifts': shifts, 'anomalies': found,
            'features': [asdict(f) for f in feature_rows],
            'protocol_matches': [{'id': m['protocol']['id'], 'level': m['level'],
                                  'level_source': m['protocol']['level_source'],
                                  'explanations': m['outcome'].explanations,
                                  'evidence_ids': sorted(m['outcome'].evidence_ids)}
                                 for m in matches if m['outcome'].matched],
            'assessments': report_assessments,
        }

    # -------------------------------------------------------------------------------------------
    def _assess(self, risk, profile, observations, baselines, feature_rows, found, matches, output, states,
                open_requests, as_of, period_start, supersedes_id, context) -> dict:
        k = self.knowledge
        triggers = k.links(risk['id'], 'trigger')
        confirmations = k.links(risk['id'], 'confirmation')
        matched = [m for m in matches if m['outcome'].matched and m['protocol']['risk_id'] == risk['id']]
        deviating = output.result['triggers_deviating']

        confirmation_state = {}
        for biomarker in confirmations:
            rows = [o for o in memory.cohort([o for o in observations if o.biomarker_id == biomarker])
                    if o.measured_at >= profile.mission_start]
            reference = baselines.get((biomarker, 'initial_stable', 'all'))
            if not rows:
                confirmation_state[biomarker] = {'state': 'not_available'}
                continue
            last = max(rows, key=lambda o: o.measured_at)
            fresh = (as_of - last.measured_at) <= timedelta(hours=k.biomarkers[biomarker]['expected_frequency'])
            if not reference or reference.status != 'accepted':
                confirmation_state[biomarker] = {'state': 'no_reference', 'measurement_id': last.id}
                continue
            z = (last.value - reference.center) / reference.spread
            confirmation_state[biomarker] = {'state': 'deviates' if abs(z) >= ANOMALY_Z else 'within_pattern',
                                             'robust_z': round(z, 2), 'measurement_id': last.id, 'fresh': fresh}

        confirmed = [b for b, s in confirmation_state.items() if s['state'] == 'deviates']
        if matched:
            level = max((m['level'] for m in matched), key=LEVEL_ORDER.index)
            level_source = 'document' if all(m['protocol']['level_source'] == 'document' for m in matched) else 'engine_assumption'
        elif len(deviating) >= 2:
            level, level_source = 'yellow', 'engine_assumption'
        elif output.input_quality == 'insufficient':
            level, level_source = 'insufficient_data', 'data_state'
        else:
            level, level_source = 'green', 'no_rule_matched'

        if confirmed and (deviating or matched):
            certainty = 'confirmed_finding'
        elif matched or len(deviating) >= 2 or confirmed:
            certainty = 'suspicion'
        else:
            certainty = 'observation'

        evidence = sorted({i for m in matched for i in m['outcome'].evidence_ids} | set(output.evidence_ids)
                          | {s['measurement_id'] for s in confirmation_state.values() if 'measurement_id' in s})
        missing = sorted(set(output.inputs_used['triggers_missing'])
                         | {b for b in confirmations if confirmation_state[b]['state'] == 'not_available'})
        explanation = self._explain(risk, level, certainty, deviating, matched, confirmation_state, missing)
        baseline_versions = {f'{b.biomarker_id}|{b.context_key}': b.version for b in baselines.values()
                             if b.kind == 'initial_stable'}
        digest = _hash({'astronaut': profile.id, 'risk': risk['id'], 'as_of': as_of.isoformat(),
                        'engine': ENGINE_VERSION, 'model': [output.model_name, output.model_version],
                        'knowledge': k.fingerprint, 'evidence': evidence, 'level': level, 'certainty': certainty,
                        'baselines': baseline_versions})
        assessment = self.repo.save_assessment(Assessment(
            astronaut_id=profile.id, risk_id=risk['id'], period_start=period_start, period_end=as_of,
            model_name=output.model_name, model_version=output.model_version, alert_level=level, certainty=certainty,
            result={**output.result, 'protocols_matched': [m['protocol']['id'] for m in matched],
                    'confirmations': confirmation_state, 'level_source': level_source},
            uncertainty=output.uncertainty, input_quality=output.input_quality, inputs_used=output.inputs_used,
            missing_inputs=missing, evidence_ids=evidence,
            context=dict(context),
            explanation=explanation, reproducibility_hash=digest, supersedes_id=supersedes_id))

        requests = []
        if certainty == 'suspicion':
            for biomarker in confirmations:
                state = confirmation_state[biomarker]
                needed = state['state'] in ('not_available', 'no_reference') or not state.get('fresh', False)
                already = any(r.biomarker_id == biomarker for r in open_requests)
                if needed and not already and k.biomarkers[biomarker].get('sensing_layer') == 2:
                    names = ', '.join(k.biomarkers[b]['name'] for b in deviating) or 'reglas documentadas'
                    request = self.repo.save_request(TestRequest(
                        astronaut_id=profile.id, assessment_id=assessment.id, biomarker_id=biomarker,
                        reason=f'{risk["name"]}: sospecha por {names}. Medición de confirmación de capa 2 '
                               f'({risk["criteria"].split("Medición activada:")[-1].strip()}).'))
                    open_requests.append(request)
                    requests.append(request)

        recommendations = []
        for m in matched:
            for c in m['protocol']['countermeasures']:
                withheld = c['category'] == 'pharmacological'
                recommendations.append({
                    'protocol': f"{m['protocol']['id']}.{c['category']}", 'category': c['category'],
                    'status': 'pending_medical_review', 'display': PENDING,
                    'proposed_text': None if withheld else c['text'],
                    'note': 'Contenido farmacológico retenido hasta revisión médica.' if withheld else
                            'Propuesta documental no revisada; no constituye una indicación.',
                    'source': m['protocol']['source_document']})
        return {'id': assessment.id, 'risk_id': risk['id'], 'risk_name': risk['name'], 'body_region': risk['body_region'],
                'alert_level': level, 'level_source': level_source, 'certainty': certainty,
                'input_quality': output.input_quality, 'missing_inputs': missing, 'explanation': explanation,
                'evidence_ids': evidence, 'uncertainty': output.uncertainty, 'confirmations': confirmation_state,
                'reproducibility_hash': digest, 'supersedes_id': supersedes_id, 'recommendations': recommendations,
                'test_requests': [{'id': r.id, 'biomarker_id': r.biomarker_id, 'reason': r.reason, 'status': r.status}
                                  for r in requests]}

    def _explain(self, risk, level, certainty, deviating, matched, confirmations, missing) -> str:
        names = lambda ids: ', '.join(self.knowledge.biomarkers[b]['name'] for b in ids)
        level_name = {'green': 'verde', 'yellow': 'amarillo', 'orange': 'naranja', 'red': 'rojo', 'insufficient_data': 'datos insuficientes'}[level]
        certainty_name = {'observation': 'observación', 'suspicion': 'sospecha', 'confirmed_finding': 'hallazgo confirmado'}[certainty]
        parts = [f'{risk["name"]}: nivel {level_name}, {certainty_name}.']
        if deviating:
            parts.append(f'Señales desviadas respecto al patrón personal: {names(deviating)}.')
        for m in matched:
            parts.append(f'Regla «{m["protocol"]["title"]}» ({m["protocol"]["source_document"]}): '
                         + '; '.join(m['outcome'].explanations) + '.')
        deviates = [b for b, s in confirmations.items() if s['state'] == 'deviates']
        if deviates:
            parts.append(f'Confirmación de capa 2 desviada: {names(deviates)}.')
        if missing:
            parts.append(f'Entradas no disponibles: {names(missing)}.')
        parts.append('Estimación de apoyo; no es un diagnóstico.')
        return ' '.join(parts)

    # -------------------------------------------------------------------------------------------
    def record_test_result(self, request_id: str, raw: dict, actor: str | None) -> dict:
        """Stores the requested layer-2 result and re-evaluates; the new assessment supersedes the old one."""
        request = self.repo.request(request_id)
        if request.status in ('resulted', 'cancelled'):
            raise ValueError(f'La solicitud ya está en estado {request.status}.')
        if raw.get('biomarker_id', request.biomarker_id) != request.biomarker_id:
            raise ValueError('El resultado no corresponde al biomarcador solicitado.')
        rows, report = validation.validate([{**raw, 'biomarker_id': request.biomarker_id}], request.astronaut_id,
                                           self.knowledge, self.repo.existing_keys(request.astronaut_id))
        if not rows:
            raise ValueError(f'Resultado rechazado: {report}')
        [measurement_id] = self.repo.append_observations(rows, actor)
        original = next(a for a in self.repo.assessments(request.astronaut_id) if a.id == request.assessment_id)
        request.status, request.result_measurement_id = 'resulted', measurement_id
        self.repo.update_request(request, actor)
        evaluation = self.evaluate(request.astronaut_id, as_of=max(rows[0]['measured_at'], original.period_end),
                                   supersedes={original.risk_id: original.id})
        new = next(a for a in evaluation['assessments'] if a['risk_id'] == original.risk_id)
        request.reevaluation_assessment_id = new['id']
        self.repo.update_request(request, actor)
        return {'request_id': request.id, 'measurement_id': measurement_id, 'reevaluation': new,
                'previous_assessment_id': original.id, 'evaluation': evaluation}
