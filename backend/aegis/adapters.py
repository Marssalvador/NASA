"""Replaceable local-only model contract. Plugins are trusted local Python code."""
from abc import ABC, abstractmethod
import importlib
import os
from .schemas import Prediction, StatisticalAnalysis


class ModelAdapter(ABC):
    @abstractmethod
    def load(self): ...
    @abstractmethod
    def validate_input(self, analyses: list[StatisticalAnalysis]) -> dict: ...
    @abstractmethod
    def predict(self, analyses: list[StatisticalAnalysis]) -> Prediction: ...
    @abstractmethod
    def explain(self) -> str: ...
    @abstractmethod
    def get_metadata(self) -> dict: ...


class MockModelAdapter(ModelAdapter):
    def load(self):
        return self

    def validate_input(self, analyses):
        return {'used': [a.metric_id for a in analyses if a.deviation_z is not None and a.status != 'insufficient_data'],
                'missing': [a.metric_id for a in analyses if a.deviation_z is None or a.status == 'insufficient_data']}

    def predict(self, analyses):
        quality = self.validate_input(analyses)
        scores = [abs(a.deviation_z) for a in analyses if a.metric_id in quality['used']]
        return Prediction(model_id='aegis-mock', model_version='0.1.0',
                          prediction={'max_absolute_z': max(scores) if scores else None},
                          prediction_kind='anomaly_score' if scores else 'unavailable', uncertainty=None,
                          input_quality='incomplete' if quality['missing'] else 'complete',
                          variables_used=quality['used'], missing_variables=quality['missing'],
                          explanation=self.explain(), validation_status='demo_unvalidated', is_synthetic=True)

    def explain(self):
        return 'Demo determinista: máximo |z| respecto al baseline personal. Sin entrenamiento, calibración ni significado clínico. No es una probabilidad.'

    def get_metadata(self):
        return {'model_id': 'aegis-mock', 'version': '0.1.0', 'validated': False, 'calibrated': False, 'local': True}


class LocalModelAdapter(ModelAdapter):
    def __init__(self, module_name: str):
        self.module_name = module_name
        self.delegate = None

    def load(self):
        self.delegate = importlib.import_module(self.module_name).create_adapter()
        if not isinstance(self.delegate, ModelAdapter):
            raise TypeError('create_adapter() debe devolver un ModelAdapter.')
        self.delegate.load()
        return self

    def validate_input(self, analyses):
        return self.delegate.validate_input(analyses)

    def predict(self, analyses):
        self.validate_input(analyses)
        result = Prediction.model_validate(self.delegate.predict(analyses))
        metadata = self.get_metadata()
        if result.prediction_kind == 'validated_disease_probability':
            if not (metadata.get('validated') and metadata.get('calibrated') and metadata.get('validation_reference') and result.validation_status == 'validated'):
                raise ValueError('Probabilidad clínica bloqueada: falta calibración, validación o referencia.')
            probability = result.prediction.get('probability')
            if not isinstance(probability, (int, float)) or isinstance(probability, bool) or not 0 <= probability <= 1:
                raise ValueError('La probabilidad debe estar entre 0 y 1.')
        return result

    def explain(self):
        return self.delegate.explain()

    def get_metadata(self):
        return self.delegate.get_metadata()


def load_adapter():
    module = os.environ.get('AEGIS_MODEL_MODULE')
    return LocalModelAdapter(module).load() if module else MockModelAdapter().load()
