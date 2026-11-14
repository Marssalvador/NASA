"""Contract for external trained models.

Every output carries astronaut, period, inputs used, input quality, result, uncertainty, model version
and evidence references. A model can be swapped by configuration (AEGIS_MEDICAL_MODEL=module:Class)
without touching the database schema or the API. Unvalidated models may not emit probabilities.
Models are never retrained automatically after each measurement: a new version is registered,
validated offline and then selected explicitly.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
import importlib
import os
from .domain import Feature
from .knowledge import ENGINE_NAME, ENGINE_VERSION, Knowledge

VALIDATED = {'internally_validated', 'externally_validated'}


@dataclass(frozen=True)
class ModelInput:
    astronaut_id: str
    period_start: datetime
    period_end: datetime
    features: list[Feature]
    anomalies: list[dict]
    available_biomarkers: set[str]
    context: dict = field(default_factory=dict)


@dataclass(frozen=True)
class ModelOutput:
    risk_id: str
    astronaut_id: str
    period_start: datetime
    period_end: datetime
    model_name: str
    model_version: str
    validation_status: str
    inputs_used: dict
    input_quality: str
    result: dict
    uncertainty: dict
    evidence_ids: list[int]


class ModelAdapter(ABC):
    name: str
    version: str
    validation_status: str

    @abstractmethod
    def predict(self, model_input: ModelInput) -> list[ModelOutput]: ...


def _keys(value) -> list[str]:
    if isinstance(value, dict):
        return [k for key, item in value.items() for k in [str(key), *_keys(item)]]
    if isinstance(value, list):
        return [k for item in value for k in _keys(item)]
    return []


def guard(output: ModelOutput, model_input: ModelInput) -> ModelOutput:
    """Rejects outputs that break the contract instead of displaying them."""
    if output.astronaut_id != model_input.astronaut_id:
        raise ValueError('El modelo devolvió un resultado de otro astronauta.')
    if output.period_start != model_input.period_start or output.period_end != model_input.period_end:
        raise ValueError('El modelo devolvió un periodo distinto del solicitado.')
    if output.input_quality not in {'complete', 'partial', 'insufficient'}:
        raise ValueError('Calidad de entrada no declarada.')
    if not output.uncertainty:
        raise ValueError('Todo resultado debe declarar su incertidumbre.')
    if output.validation_status not in VALIDATED and any('probab' in k.lower() for k in _keys(output.result)):
        raise ValueError('Un modelo no validado no puede emitir probabilidades.')
    if any('disease' in k.lower() and 'probab' in k.lower() for k in _keys(output.result)):
        raise ValueError('AEGIS no almacena probabilidades de enfermedad.')
    return output


class RuleEngineAdapter(ModelAdapter):
    """Default, transparent model: counts deviating documented trigger signals per risk."""
    name, version, validation_status = ENGINE_NAME, ENGINE_VERSION, 'demo_unvalidated'

    def __init__(self, knowledge: Knowledge):
        self.knowledge = knowledge

    def predict(self, model_input: ModelInput) -> list[ModelOutput]:
        deviating = {a['biomarker_id']: a for a in model_input.anomalies}
        outputs = []
        for risk in self.knowledge.risks:
            triggers = self.knowledge.links(risk['id'], 'trigger')
            available = [b for b in triggers if b in model_input.available_biomarkers]
            hits = [b for b in available if b in deviating]
            quality = 'complete' if len(available) == len(triggers) else 'partial' if available else 'insufficient'
            outputs.append(ModelOutput(
                risk_id=risk['id'], astronaut_id=model_input.astronaut_id, period_start=model_input.period_start,
                period_end=model_input.period_end, model_name=self.name, model_version=self.version,
                validation_status=self.validation_status,
                inputs_used={'triggers_available': available, 'triggers_missing': [b for b in triggers if b not in available]},
                input_quality=quality,
                result={'triggers_deviating': hits, 'triggers_total': len(triggers),
                        'pattern': f'{len(hits)} de {len(available)} señales disparadoras disponibles desviadas'},
                uncertainty={'kind': 'qualitative', 'coverage': round(len(available) / len(triggers), 2) if triggers else 0,
                             'statement': 'Recuento de señales frente al patrón personal; sin entrenamiento ni '
                                          'calibración. No es una probabilidad.'},
                evidence_ids=sorted({i for b in hits for i in deviating[b]['evidence_ids']})))
        return outputs


def load_adapter(knowledge: Knowledge) -> ModelAdapter:
    target = os.environ.get('AEGIS_MEDICAL_MODEL')
    if not target:
        return RuleEngineAdapter(knowledge)
    module, _, cls = target.partition(':')
    adapter = getattr(importlib.import_module(module), cls)(knowledge)
    if not isinstance(adapter, ModelAdapter):
        raise TypeError('AEGIS_MEDICAL_MODEL debe implementar ModelAdapter.')
    return adapter
