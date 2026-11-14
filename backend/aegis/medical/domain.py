"""Value objects shared by every module. Timestamps are timezone-aware UTC."""
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal

AlertLevel = Literal['green', 'yellow', 'orange', 'red', 'insufficient_data']
Certainty = Literal['observation', 'suspicion', 'confirmed_finding', 'clinical_diagnosis']
LEVEL_ORDER = ['insufficient_data', 'green', 'yellow', 'orange', 'red']
CERTAINTY_ORDER = ['observation', 'suspicion', 'confirmed_finding', 'clinical_diagnosis']


@dataclass(frozen=True)
class Profile:
    id: str
    code: str
    display_name: str
    sex: Literal['female', 'male', 'unspecified']
    cycle_status: Literal['active', 'suppressed', 'not_applicable', 'unknown']
    usual_cycle_length_days: int | None
    mission_start: datetime
    is_synthetic: bool


@dataclass(frozen=True)
class Observation:
    id: int
    astronaut_id: str
    biomarker_id: str
    unit: str
    value: float | None
    measured_at: datetime
    source: str
    method: str
    quality: Literal['good', 'questionable', 'invalid', 'missing']
    is_synthetic: bool
    context: dict = field(default_factory=dict)
    supersedes_id: int | None = None
    correction_reason: str | None = None


@dataclass(frozen=True)
class Event:
    id: int
    astronaut_id: str
    kind: str
    started_at: datetime
    severity: str | None = None
    details: dict = field(default_factory=dict)
    is_synthetic: bool = True


@dataclass(frozen=True)
class Baseline:
    biomarker_id: str
    kind: Literal['initial_stable', 'recent']
    context_key: str
    method: str
    status: Literal['accepted', 'insufficient']
    n: int
    center: float | None
    spread: float | None
    window_start: datetime
    window_end: datetime
    input_ids: tuple[int, ...]
    is_synthetic: bool
    version: int = 1
    id: int | None = None
    parent_id: int | None = None


@dataclass(frozen=True)
class Feature:
    biomarker_id: str | None
    feature: str
    day: date | None
    value: float | None
    n: int
    quality: Literal['complete', 'partial', 'insufficient']
    input_ids: tuple[int, ...]
    window_start: datetime
    window_end: datetime
    note: str = ''


@dataclass
class Assessment:
    astronaut_id: str
    risk_id: str
    period_start: datetime
    period_end: datetime
    model_name: str
    model_version: str
    alert_level: AlertLevel
    certainty: Certainty
    result: dict[str, Any]
    uncertainty: dict[str, Any]
    input_quality: Literal['complete', 'partial', 'insufficient']
    inputs_used: dict[str, Any]
    missing_inputs: list[str]
    evidence_ids: list[int]
    context: dict[str, Any]
    explanation: str
    reproducibility_hash: str
    produced_by: Literal['engine', 'clinician'] = 'engine'
    supersedes_id: str | None = None
    id: str | None = None


@dataclass
class TestRequest:
    astronaut_id: str
    assessment_id: str
    biomarker_id: str
    reason: str
    status: Literal['proposed', 'approved', 'collected', 'resulted', 'cancelled'] = 'proposed'
    result_measurement_id: int | None = None
    reevaluation_assessment_id: str | None = None
    id: str | None = None
