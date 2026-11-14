"""Declared menstrual-cycle phase, used only as a context modifier (never as a diagnosis)."""
from datetime import datetime
from .domain import Event, Profile
from .knowledge import Knowledge

# Phases that share one temperature/HRV reference: the document asks for follicular vs luteal baselines.
BASELINE_GROUP = {'menstrual': 'follicular', 'follicular': 'follicular', 'ovulatory': 'follicular', 'luteal': 'luteal'}


def applies(profile: Profile, knowledge: Knowledge) -> bool:
    rule = knowledge.cycle['applies_when']
    return profile.sex == rule['sex'] and profile.cycle_status == rule['cycle_status']


def phase_at(moment: datetime, profile: Profile, events: list[Event], knowledge: Knowledge) -> str | None:
    """Phase from the last declared menstruation start; None when the module does not apply."""
    if not applies(profile, knowledge):
        return None
    starts = [e.started_at for e in events if e.kind == 'menstruation_start' and e.started_at <= moment]
    if not starts:
        return 'unknown'
    length = profile.usual_cycle_length_days or knowledge.cycle['reference_cycle_days']
    elapsed = (moment - max(starts)).days
    if elapsed >= length + 7:
        return 'unknown'  # no recent declaration: do not guess
    reference = knowledge.cycle['reference_cycle_days']
    day = min(int(elapsed * reference / length) + 1, reference)  # engine assumption: proportional scaling
    for phase in knowledge.cycle['phases']:
        if phase['from_day'] <= day <= phase['to_day']:
            return phase['id']
    return 'unknown'


def modifier(knowledge: Knowledge, biomarker: str, phase: str | None) -> dict | None:
    if phase is None:
        return None
    return next((m for m in knowledge.cycle['modifiers'] if m['biomarker'] == biomarker and m['phase'] == phase), None)
