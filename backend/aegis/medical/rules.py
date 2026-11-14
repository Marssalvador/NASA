"""Evaluation of documented trigger rules (data/medical/protocols.json) against computed features.

A rule node is either a combinator ({"any": [...]}, {"all": [...]}), a symptom check
({"symptom_any": [...]}) or a leaf on one feature with one comparison. Each evaluation returns
True / False / None (not evaluable: missing or insufficient inputs) plus the evidence used.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from .domain import Event, Feature

SYMPTOM_WINDOW = timedelta(hours=72)


@dataclass
class Outcome:
    matched: bool | None
    evidence_ids: set[int] = field(default_factory=set)
    explanations: list[str] = field(default_factory=list)
    missing: set[str] = field(default_factory=set)


def compare(value: float, leaf: dict) -> bool:
    if 'between' in leaf:
        lo, hi = sorted(leaf['between'])
        return lo <= value <= hi
    if 'above' in leaf:
        return value > leaf['above']
    if 'below' in leaf:
        return value < leaf['below']
    if 'at_least' in leaf:
        return value >= leaf['at_least']
    raise ValueError(f'Comparación no soportada: {leaf}')


def describe(leaf: dict) -> str:
    for key, text in (('between', 'entre {0[0]} y {0[1]}'), ('above', '> {0}'), ('below', '< {0}'), ('at_least', '≥ {0}')):
        if key in leaf:
            return text.format(leaf[key])
    return ''


def leaf(node: dict, features: list[Feature]) -> Outcome:
    rows = [f for f in features if f.biomarker_id == node['biomarker'] and f.feature == node['feature']]
    label = f"{node['biomarker']}.{node['feature']} {describe(node)}"
    days = node.get('sustained_days')
    if days:
        rows = sorted((f for f in rows if f.value is not None), key=lambda f: f.day)[-days:]
        if len(rows) < days or any((b.day - a.day).days != 1 for a, b in zip(rows, rows[1:])):
            return Outcome(None, missing={f"{node['biomarker']} ({days} días consecutivos)"})
        hit = all(compare(f.value, node) for f in rows)
        detail = ', '.join(f'{f.value:g}' for f in rows)
        return Outcome(hit, {i for f in rows for i in f.input_ids},
                       [f'{label} durante {days} días ({detail}; {rows[-1].note})'] if hit else [])
    rows = [f for f in rows if f.value is not None and f.quality != 'insufficient']
    if not rows:
        return Outcome(None, missing={node['biomarker']})
    latest = max(rows, key=lambda f: (f.window_end, f.day))
    hit = compare(latest.value, node)
    return Outcome(hit, set(latest.input_ids), [f'{label} (valor {latest.value:g})'] if hit else [])


def evaluate(node: dict, features: list[Feature], events: list[Event], as_of: datetime) -> Outcome:
    if 'symptom_any' in node:
        recent = [e for e in events if e.kind == 'symptom' and as_of - SYMPTOM_WINDOW <= e.started_at <= as_of
                  and e.details.get('code') in node['symptom_any']]
        return Outcome(bool(recent), set(), [f"síntoma declarado: {e.details['code']}" for e in recent])
    if 'biomarker' in node:
        return leaf(node, features)
    children = [evaluate(child, features, events, as_of) for child in node.get('any') or node.get('all')]
    merged = Outcome(None)
    for child in children:
        merged.missing |= child.missing
    if 'any' in node:
        hits = [c for c in children if c.matched]
        if hits:
            merged.matched = True
        elif all(c.matched is False for c in children):
            merged.matched = False
        for c in hits:
            merged.evidence_ids |= c.evidence_ids
            merged.explanations += c.explanations
        return merged
    if any(c.matched is False for c in children):
        merged.matched = False
    elif all(c.matched for c in children):
        merged.matched = True
        for c in children:
            merged.evidence_ids |= c.evidence_ids
            merged.explanations += c.explanations
    return merged
