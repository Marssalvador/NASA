"""Acceptance of incoming observations. Rejected rows are reported, never silently repaired."""
from datetime import datetime, timezone
import math
from .knowledge import Knowledge

QUALITIES = {'good', 'questionable', 'invalid', 'missing'}


def parse_time(raw) -> datetime:
    value = raw if isinstance(raw, datetime) else datetime.fromisoformat(str(raw).replace('Z', '+00:00'))
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError('el instante necesita zona horaria explícita (Z o ±HH:MM)')
    return value.astimezone(timezone.utc)


def validate(rows: list[dict], astronaut_id: str, knowledge: Knowledge, existing: set[tuple]) -> tuple[list[dict], dict]:
    """Returns accepted rows (normalised to UTC) and a report with one entry per rejection."""
    accepted, errors, duplicates, seen = [], [], 0, set()
    for index, raw in enumerate(rows, 1):
        try:
            biomarker = knowledge.biomarkers.get(raw.get('biomarker_id'))
            if biomarker is None:
                raise ValueError(f"biomarcador no registrado: {raw.get('biomarker_id')!r}")
            if raw.get('unit') != biomarker['unit']:
                raise ValueError(f"unidad {raw.get('unit')!r} incompatible; el registro exige {biomarker['unit']!r}")
            if not isinstance(raw.get('is_synthetic'), bool):
                raise ValueError('is_synthetic debe declararse explícitamente (true/false)')
            source = str(raw.get('source') or '').strip()
            if not source:
                raise ValueError('falta la fuente de la medición')
            quality = raw.get('quality', 'good')
            if quality not in QUALITIES:
                raise ValueError(f'calidad desconocida: {quality!r}')
            value = raw.get('value')
            if value is not None:
                value = float(value)
                if not math.isfinite(value):
                    raise ValueError('valor no finito')
            if (value is None) != (quality == 'missing'):
                raise ValueError('un valor vacío requiere quality=missing y viceversa')
            measured_at = parse_time(raw.get('measured_at'))
            key = (astronaut_id, biomarker['id'], measured_at, source)
            if key in existing or key in seen:
                duplicates += 1
                continue
            seen.add(key)
            accepted.append({'astronaut_id': astronaut_id, 'biomarker_id': biomarker['id'], 'unit': biomarker['unit'],
                             'value': value, 'measured_at': measured_at, 'source': source,
                             'method': raw.get('method') or biomarker['measurement_method'], 'quality': quality,
                             'context': raw.get('context') or {}, 'is_synthetic': raw['is_synthetic']})
        except (TypeError, ValueError) as error:
            errors.append({'row': index, 'error': str(error)})
    provenance = {r['is_synthetic'] for r in accepted}
    return accepted, {'received': len(rows), 'accepted': len(accepted), 'duplicates': duplicates,
                      'rejected': errors, 'mixed_provenance': len(provenance) > 1,
                      'note': 'Las cohortes real y sintética se almacenan y analizan por separado.'}
