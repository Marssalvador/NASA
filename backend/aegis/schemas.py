"""Public contracts. Numeric observations are finite and timestamps are always UTC."""
from datetime import datetime, timezone
from typing import Literal, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Status = Literal['stable', 'review', 'emergency', 'insufficient_data']
SYSTEMS = Literal['cardiovascular', 'muscular', 'skeletal', 'renal', 'immune', 'neurological', 'metabolic']


class Contract(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


def utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError('El timestamp necesita zona horaria (Z o +HH:MM).')
    return value.astimezone(timezone.utc)


class Astronaut(Contract):
    id: str
    name: str
    role: str
    mission: str
    scenario: Literal['stable', 'review', 'emergency']
    is_synthetic: bool = True
    mission_start: datetime


class BiomarkerDefinition(Contract):
    id: str = Field(pattern=r'^[a-z][a-z0-9_]*$')
    name: str
    unit: str
    body_system: SYSTEMS
    body_region: Literal['heart', 'lungs', 'kidneys', 'muscles', 'skeleton', 'brain', 'metabolic']
    sample_type: str
    measurement_method: str
    expected_frequency: float = Field(gt=0, description='Hours; acquisition configuration, not a safety limit')
    reference_source: str
    enabled: bool = True


class Measurement(Contract):
    astronaut_id: str
    metric_id: str
    value: float | None
    unit: str
    timestamp: datetime
    measurement_method: str = Field(min_length=1)
    source: str = Field(min_length=1)
    quality: Literal['good', 'questionable', 'invalid', 'missing'] = 'good'
    is_synthetic: bool

    _timestamp_utc = field_validator('timestamp')(utc)

    @model_validator(mode='after')
    def check_missing(self):
        if self.value is None and self.quality != 'missing':
            raise ValueError('Un valor vacío debe tener quality=missing.')
        if self.value is not None and self.quality == 'missing':
            raise ValueError('quality=missing requiere un valor vacío.')
        return self


class PersonalBaseline(Contract):
    astronaut_id: str
    metric_id: str
    mean: float
    std: float = Field(ge=0)
    n: int = Field(ge=2)
    unit: str
    start: datetime
    end: datetime
    is_synthetic: bool
    source: str = Field(min_length=1)
    _dates_utc = field_validator('start', 'end')(utc)

    @model_validator(mode='after')
    def check_dates(self):
        if self.start >= self.end:
            raise ValueError('El baseline requiere start < end.')
        return self


class StatisticalAnalysis(Contract):
    metric_id: str
    status: Status = 'insufficient_data'
    data_state: Literal['available', 'missing', 'stale', 'poor_quality'] = 'missing'
    n: int = 0
    excluded: int = 0
    mean: float | None = None
    std: float | None = None
    median: float | None = None
    mad: float | None = None
    trend_per_day: float | None = None
    baseline: PersonalBaseline | None = None
    deviation_z: float | None = None
    ci95: list[float] | None = None
    prediction_interval_95: list[float] | None = None
    uncertainty: str = 'Información insuficiente.'
    quality_flags: list[str] = Field(default_factory=list)
    latest: Measurement | None = None
    series: list[Measurement] = Field(default_factory=list)


class Prediction(Contract):
    model_id: str
    model_version: str
    prediction: dict[str, Any]
    prediction_kind: Literal['anomaly_score', 'validated_disease_probability', 'unavailable']
    uncertainty: float | None = Field(default=None, ge=0, le=1)
    input_quality: str
    variables_used: list[str]
    missing_variables: list[str]
    explanation: str
    validation_status: Literal['demo_unvalidated', 'unvalidated', 'validated']
    is_synthetic: bool


class Finding(Contract):
    id: str
    metric_id: str | None = None
    status: Status
    title: str
    explanation: str


class MeasurementRequest(Contract):
    metric_id: str
    reason: str
    how_to_measure: str
    status: str = 'pending'


class GuidanceProtocol(Contract):
    id: str
    trigger: str
    explanation: str
    suggested_check: str
    how_to_measure: str
    reference: str
    authorization_level: str
    validation_status: Literal['pending_medical_review', 'reviewed']
    reviewer: str | None = None
    reviewed_at: datetime | None = None

    @model_validator(mode='after')
    def reviewed_requires_evidence(self):
        if self.validation_status == 'reviewed' and (not self.reviewer or not self.reviewed_at or not self.reference):
            raise ValueError('Un protocolo revisado requiere revisor, fecha y referencia.')
        if self.reviewed_at:
            self.reviewed_at = utc(self.reviewed_at)
        return self
