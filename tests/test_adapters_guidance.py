import sys
import types
import pytest
from pydantic import ValidationError
from backend.aegis.adapters import LocalModelAdapter, MockModelAdapter
from backend.aegis.schemas import GuidanceProtocol


def test_mock_contract_with_missing_variables():
    result=MockModelAdapter().load().predict([])
    assert result.prediction_kind=='unavailable' and result.uncertainty is None
    assert result.is_synthetic and result.validation_status=='demo_unvalidated'


def test_real_plugin_loading_and_calibration_gate(monkeypatch):
    class Unsafe(MockModelAdapter):
        def predict(self,a):
            return super().predict(a).model_copy(update={'prediction_kind':'validated_disease_probability','prediction':{'probability':.7}})
    module=types.ModuleType('aegis_test_plugin');module.create_adapter=lambda:Unsafe()
    monkeypatch.setitem(sys.modules,'aegis_test_plugin',module)
    adapter=LocalModelAdapter('aegis_test_plugin').load()
    assert adapter.get_metadata()['local']
    with pytest.raises(ValueError,match='bloqueada'):adapter.predict([])


def test_reviewed_protocol_requires_reviewer_and_reference():
    with pytest.raises(ValidationError):
        GuidanceProtocol(id='unsafe',trigger='emergency',explanation='x',suggested_check='x',how_to_measure='x',reference='',authorization_level='medical',validation_status='reviewed')
