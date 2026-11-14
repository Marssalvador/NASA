"""Preview and transactional import for long or wide CSV/JSON datasets."""
import csv
import io
import json
import pandas as pd
from pydantic import Field, ValidationError
from .schemas import Contract, Measurement
from .registry import registry
from . import store


class ImportSpec(Contract):
    astronaut_id: str
    format: str = Field(pattern='^(csv|json)$')
    content: str = Field(max_length=2_000_000)
    timestamp_column: str = 'timestamp'
    metric_column: str = 'metric_id'
    value_column: str = 'value'
    unit_column: str = 'unit'
    mapping: dict[str, str] = Field(default_factory=dict, description='Wide format: source column -> metric id')
    units: dict[str, str] = Field(default_factory=dict)
    source: str = Field(default='Importación local', min_length=1)
    is_synthetic: bool = False


# Only deterministic dimension-preserving conversions. No inferred unit aliases.
CONVERSIONS = {('mmol/L', 'mg/dL', 'glucose'): lambda x: x * 18.0182,
               ('°F', '°C', 'temperature'): lambda x: (x-32)*5/9}


def parse_rows(spec: ImportSpec):
    if spec.format == 'json':
        rows = json.loads(spec.content)
        if not isinstance(rows, list) or any(not isinstance(r, dict) for r in rows):
            raise ValueError('JSON debe contener un array de objetos.')
    else:
        try:
            dialect = csv.Sniffer().sniff(spec.content[:4096], delimiters=',;\t')
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(io.StringIO(spec.content.lstrip('\ufeff')), dialect=dialect)
        if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames):
            raise ValueError('Cabeceras vacías o duplicadas.')
        rows = list(reader)
    if not rows or len(rows) > 5000:
        raise ValueError('El archivo debe contener entre 1 y 5000 filas.')
    return rows


def prepare(spec: ImportSpec):
    if not store.get_astronaut(spec.astronaut_id):
        raise ValueError('Astronauta desconocido.')
    rows, items, errors, seen = parse_rows(spec), [], [], set()
    definitions = registry()
    for number, row in enumerate(rows, 2 if spec.format == 'csv' else 1):
        try:
            if row.get('astronaut_id') and row['astronaut_id'] != spec.astronaut_id:
                raise ValueError('La fila pertenece a otra persona; importar por astronauta explícito.')
            # UTC offsets are mandatory; never infer local time or silently localize.
            raw_date = row.get(spec.timestamp_column)
            if not raw_date:
                raise ValueError('Falta timestamp.')
            stamp = pd.Timestamp(raw_date)
            if stamp.tzinfo is None:
                raise ValueError('Timestamp sin zona horaria.')
            stamp = stamp.tz_convert('UTC').to_pydatetime()
            columns = spec.mapping.items() if spec.mapping else [(spec.value_column, row.get(spec.metric_column, ''))]
            row_items = []
            for column, metric_id in columns:
                if metric_id not in definitions:
                    raise ValueError(f'Biomarcador no habilitado: {metric_id}')
                definition = definitions[metric_id]
                raw = row.get(column)
                value = None if raw is None or str(raw).strip().lower() in {'', 'null', 'none', 'na'} else float(raw)
                unit = spec.units.get(metric_id) or (row.get(spec.unit_column) if not spec.mapping else None)
                if not unit:
                    raise ValueError(f'Unidad explícita requerida para {metric_id}.')
                if unit != definition.unit:
                    conversion = CONVERSIONS.get((unit, definition.unit, metric_id))
                    if not conversion:
                        raise ValueError(f'Unidad incompatible: {unit}; esperada {definition.unit}.')
                    if value is not None:
                        value = conversion(value)
                item = Measurement(astronaut_id=spec.astronaut_id, metric_id=metric_id, value=value,
                    unit=definition.unit, timestamp=stamp, measurement_method=row.get('measurement_method') or definition.measurement_method,
                    source=spec.source, quality=row.get('quality') or ('missing' if value is None else 'good'), is_synthetic=spec.is_synthetic)
                # If provenance exists in a file it must agree with the explicit import choice.
                if 'is_synthetic' in row and str(row['is_synthetic']).lower() not in {str(spec.is_synthetic).lower(), '1' if spec.is_synthetic else '0'}:
                    raise ValueError('is_synthetic del archivo no coincide con la selección explícita.')
                key = (metric_id, item.timestamp, item.measurement_method)
                if key in seen:
                    raise ValueError('Medición duplicada dentro del archivo.')
                seen.add(key)
                row_items.append(item)
            items.extend(row_items)
        except (ValueError, TypeError, OverflowError, ValidationError) as error:
            errors.append({'row': number, 'message': str(error)})
    duplicate_report = store.save_measurements(items, dry_run=True) if not errors else {'inserted': 0, 'duplicates': 0}
    return items, {'rows': len(rows), 'columns': list(rows[0]), 'preview': rows[:5],
                   'measurements': [i.model_dump(mode='json') for i in items[:5]],
                   'valid': not errors, 'errors': errors[:100], **duplicate_report}
