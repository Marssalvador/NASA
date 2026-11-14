import type { Presentation, Level, MedicalMeasurement } from './medicalTypes';
import type { Analysis, Dashboard, Measurement, Status } from './types';
import { anatomySystems } from './anatomyConfig';
export const levelStatus = (level?: Level): Status =>
  level === 'green'
    ? 'stable'
    : level === 'red'
      ? 'review'
      : level === 'yellow' || level === 'orange'
        ? 'review'
        : 'insufficient_data';
export const measurement = (m: MedicalMeasurement): Measurement => ({
  astronaut_id: m.astronaut_id,
  metric_id: m.biomarker_id,
  value: m.value,
  unit: m.unit,
  timestamp: m.measured_at,
  measurement_method: m.method,
  source: m.source,
  quality: m.quality,
  is_synthetic: m.is_synthetic,
});
/** Presentation mapping only: no thresholds, fabricated findings or clinical calculations. */
export function present(s: Presentation): { data: Dashboard; states: Record<string, Status> } {
  const states = Object.fromEntries(
    anatomySystems.map((system) => {
      const assessments = s.report.assessments.filter((a) => a.body_region === system.id);
      const status: Status = assessments.some((a) => levelStatus(a.alert_level) === 'review')
        ? 'review'
        : assessments.some((a) => a.alert_level === 'green')
          ? 'stable'
          : 'insufficient_data';
      return [system.id, status];
    }),
  ) as Record<string, Status>;
  const analyses: Analysis[] = s.registry.map((d) => {
    const latest = s.latest.find((m) => m.biomarker_id === d.id);
    const reference = s.references[d.id];
    const series = s.series[d.id] ?? [];
    const anomaly = s.report.anomalies.find((a) => a.biomarker_id === d.id);
    const confirmed = s.report.assessments.some(
      (a) => a.confirmations[d.id]?.state === 'deviates' && a.confirmations[d.id]?.fresh,
    );
    const dataState = s.report.data_states[d.id] ?? 'missing';
    return {
      metric_id: d.id,
      status:
        dataState !== 'available' || !reference || reference.status !== 'accepted'
          ? 'insufficient_data'
          : anomaly || confirmed
            ? 'review'
            : 'stable',
      data_state: dataState,
      n: series.reduce((n, p) => n + p.n, 0),
      excluded: 0,
      mean: null,
      std: null,
      median: series.at(-1)?.value ?? null,
      mad: null,
      trend_per_day: null,
      ci95: null,
      baseline:
        reference?.status === 'accepted' && reference.center != null && reference.spread != null
          ? {
              mean: reference.center,
              std: reference.spread,
              n: reference.n,
              start: reference.window_start,
              end: reference.window_end,
              source: `Referencia personal ${reference.context_key} · v${reference.version} · mediana/MAD`,
              is_synthetic: true,
            }
          : null,
      deviation_z: anomaly?.robust_z.at(-1) ?? null,
      uncertainty:
        'Motor por reglas demostrativo, sin calibración clínica. La referencia es mediana y MAD; no una probabilidad.',
      quality_flags: dataState === 'available' ? [] : [dataState],
      latest: latest ? measurement(latest) : null,
      series: series.map((p) => ({
        astronaut_id: s.code,
        metric_id: d.id,
        value: p.value,
        unit: d.unit,
        timestamp: p.day + 'T12:00:00Z',
        measurement_method: 'Mediana diaria UTC calculada por el motor',
        source: 'Motor médico /api/v2',
        quality: 'good',
        is_synthetic: true,
      })),
    };
  });
  const status: Status = s.report.emergencies.length
    ? 'emergency'
    : Object.values(states).includes('review')
      ? 'review'
      : s.report.assessments.some((a) => a.alert_level === 'green')
        ? 'stable'
        : 'insufficient_data';
  return {
    states,
    data: {
      astronaut: {
        id: s.code,
        name: 'A-112 · Lena Ortiz (sintética)',
        role: 'Presentación PULSS',
        mission: 'ORBITAL-01',
        scenario: s.session_id,
        mission_start: s.mission_start,
        is_synthetic: true,
      },
      as_of: s.as_of,
      status,
      analyses,
      findings: s.report.assessments.map((a) => ({
        id: a.id,
        metric_id: null,
        status: levelStatus(a.alert_level),
        title: a.risk_name,
        explanation: a.explanation,
      })),
      measurement_requests: s.requests
        .filter((r) => r.status !== 'resulted')
        .map((r) => ({
          metric_id: r.biomarker_id,
          reason: r.reason,
          how_to_measure: s.registry.find((d) => d.id === r.biomarker_id)?.measurement_method ?? '',
        })),
      pathways: [],
      guidance: [],
      prediction: {
        model_id: s.report.engine,
        model_version: '0.1.0',
        prediction: { assessments: s.report.assessments },
        prediction_kind: 'Reglas documentadas · sin probabilidades',
        uncertainty: null,
        input_quality: 'Ver calidad por hallazgo',
        variables_used: s.latest.map((m) => m.biomarker_id),
        missing_variables: Object.keys(s.report.data_states).filter(
          (id) => s.report.data_states[id] !== 'available',
        ),
        explanation: 'Resultados reales del motor médico existente.',
        validation_status: 'demo_unvalidated',
        is_synthetic: true,
      },
      model_error: s.report.model_error,
      events: [],
      demo_start: s.mission_start,
      demo_end: s.as_of,
    },
  };
}
