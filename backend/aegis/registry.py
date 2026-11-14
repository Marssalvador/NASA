import json
from pathlib import Path
from .schemas import BiomarkerDefinition

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / 'data' / 'biomarker_registry.json'


def registry() -> dict[str, BiomarkerDefinition]:
    definitions = [BiomarkerDefinition.model_validate(x) for x in json.loads(REGISTRY_PATH.read_text(encoding='utf-8'))]
    if len({x.id for x in definitions}) != len(definitions):
        raise ValueError('El registro contiene identificadores duplicados.')
    return {x.id: x for x in definitions if x.enabled}
