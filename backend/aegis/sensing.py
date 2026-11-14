"""Hierarchical sensing: layer-1 signals decide when layer-2 acquisitions are worth requesting.

Pathways are research design hypotheses loaded from data/risk_pathways.json at request time.
They never produce a diagnosis or probability; they only order which observation to acquire next.
"""
import json
from .registry import ROOT
from .schemas import BiomarkerDefinition, ConfirmationState, RiskPathwayDefinition, RiskPathwayState, StatisticalAnalysis

PATHWAYS_PATH = ROOT / 'data' / 'risk_pathways.json'


def pathways(definitions: dict[str, BiomarkerDefinition]) -> list[RiskPathwayDefinition]:
    items = [RiskPathwayDefinition.model_validate(x) for x in json.loads(PATHWAYS_PATH.read_text(encoding='utf-8'))]
    for item in items:
        unknown = [m for m in item.triggers + item.confirmations if m not in definitions]
        if unknown:
            raise ValueError(f'La ruta {item.id} referencia biomarcadores no registrados: {unknown}')
        if any(definitions[m].sensing_layer != 2 for m in item.confirmations):
            raise ValueError(f'La ruta {item.id} solo puede solicitar mediciones de capa 2.')
    return items


def evaluate(analyses: list[StatisticalAnalysis], definitions: dict[str, BiomarkerDefinition]) -> list[RiskPathwayState]:
    by_id = {a.metric_id: a for a in analyses}
    result = []
    for route in pathways(definitions):
        signals = [by_id[m] for m in route.triggers if m in by_id]
        triggered = [a.metric_id for a in signals if a.status in ('review', 'emergency')]
        confirmations = []
        for metric_id in route.confirmations:
            a = by_id.get(metric_id)
            if a is not None and a.status in ('review', 'emergency'):
                state = 'deviates'
            elif not triggered:
                state = 'not_requested'
            elif a is not None and a.status == 'stable':
                state = 'within_pattern'
            else:
                state = 'requested'
            confirmations.append(ConfirmationState(metric_id=metric_id, state=state))
        states = {c.state for c in confirmations}
        if 'deviates' in states:
            stage = 'review'
        elif 'requested' in states:
            stage = 'requested'
        elif triggered:
            stage = 'not_confirmed'
        elif any(a.status == 'stable' for a in signals):
            stage = 'quiet'
        else:
            stage = 'unmonitored'
        result.append(RiskPathwayState(id=route.id, name=route.name, body_region=route.body_region, stage=stage,
                                       triggered_by=triggered, triggers=route.triggers, confirmations=confirmations,
                                       planned_signals=route.planned_signals, rationale=route.rationale,
                                       evidence=route.evidence, demonstration=route.demonstration))
    return result


def requested(states: list[RiskPathwayState], definitions: dict[str, BiomarkerDefinition]) -> dict[str, str]:
    """Layer-2 acquisitions that a triggered pathway justifies, with the reason shown to the crew."""
    out: dict[str, str] = {}
    for s in states:
        if not s.triggered_by:
            continue
        names = ', '.join(definitions[m].name for m in s.triggered_by)
        for c in s.confirmations:
            if c.state == 'requested':
                out.setdefault(c.metric_id, f'Solicitada por la ruta «{s.name}»: desviación en capa 1 ({names}).')
    return out
