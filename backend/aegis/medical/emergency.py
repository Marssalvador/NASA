"""Emergency escalation from documented rules and declared events.

Runs before and independently of any predictive model: an emergency is never delayed, softened or
filtered by a model output, and it does not depend on baselines being available.
"""
from datetime import datetime
from . import rules
from .domain import Event, Feature
from .knowledge import Knowledge

ACTION = 'Escalar inmediatamente a supervisión humana (médico de vuelo). Protocolo independiente de la IA predictiva.'


def evaluate(knowledge: Knowledge, features: list[Feature], events: list[Event], as_of: datetime) -> list[dict]:
    found = []
    for rule in knowledge.emergency_rules:
        outcome = rules.evaluate(rule['rule'], features, events, as_of)
        if outcome.matched:
            found.append({'id': rule['id'], 'title': rule['title'], 'action': ACTION,
                          'evidence_ids': sorted(outcome.evidence_ids), 'explanation': '; '.join(outcome.explanations),
                          'source_document': rule['source_document'],
                          'level_source': rule.get('level_source', 'document')})
    for event in events:
        if event.severity == 'emergency' and event.started_at <= as_of and not any(
                f['id'] == f'declared.{event.id}' for f in found):
            found.append({'id': f'declared.{event.id}', 'title': 'Emergencia declarada', 'action': ACTION,
                          'evidence_ids': [], 'explanation': f'Evento declarado: {event.details.get("code", event.kind)}',
                          'source_document': 'declaración de la tripulación', 'level_source': 'declared'})
    return found
