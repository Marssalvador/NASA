"""Specification data loaded from versioned files. Nothing clinical is hard-coded in Python."""
from dataclasses import dataclass
from functools import cached_property
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'data'
ENGINE_NAME = 'aegis-rules'
ENGINE_VERSION = '0.1.0'


@dataclass(frozen=True)
class Knowledge:
    biomarkers: dict
    risks: list
    protocols: list
    emergency_rules: list
    engine_assumptions: dict
    daily_aggregation: dict
    window_features: dict
    cycle: dict
    source_documents: dict

    @classmethod
    def load(cls, data: Path = DATA) -> 'Knowledge':
        registry = json.loads((data / 'biomarker_registry.json').read_text(encoding='utf-8'))
        catalog = json.loads((data / 'medical' / 'risk_catalog.json').read_text(encoding='utf-8'))
        protocols = json.loads((data / 'medical' / 'protocols.json').read_text(encoding='utf-8'))
        cycle = json.loads((data / 'medical' / 'cycle_modifiers.json').read_text(encoding='utf-8'))
        knowledge = cls(biomarkers={d['id']: d for d in registry}, risks=catalog['risks'],
                        protocols=protocols['protocols'], emergency_rules=protocols['emergency_rules'],
                        engine_assumptions=protocols['engine_assumptions'],
                        daily_aggregation=protocols['daily_aggregation'],
                        window_features=protocols['window_features'], cycle=cycle,
                        source_documents=catalog['source_documents'])
        knowledge.check()
        return knowledge

    def check(self):
        """Every biomarker referenced by a risk or a rule must exist in the registry."""
        referenced = {link['biomarker'] for r in self.risks for link in r['links']}
        for rule in self.protocols + self.emergency_rules:
            referenced |= set(biomarkers_in(rule.get('trigger_rule') or rule.get('rule')))
        unknown = referenced - set(self.biomarkers)
        if unknown:
            raise ValueError(f'Biomarcadores no registrados en la especificación: {sorted(unknown)}')

    @cached_property
    def fingerprint(self) -> str:
        payload = json.dumps([self.biomarkers, self.risks, self.protocols, self.emergency_rules, self.cycle,
                              self.daily_aggregation, self.window_features],
                             sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(payload.encode()).hexdigest()[:16]

    def risk(self, risk_id: str) -> dict:
        return next(r for r in self.risks if r['id'] == risk_id)

    def links(self, risk_id: str, role: str) -> list[str]:
        return [link['biomarker'] for link in self.risk(risk_id)['links'] if link['role'] == role]


def biomarkers_in(node) -> list[str]:
    if not isinstance(node, dict):
        return []
    found = [node['biomarker']] if 'biomarker' in node else []
    for key in ('any', 'all'):
        for child in node.get(key, []):
            found += biomarkers_in(child)
    return found
