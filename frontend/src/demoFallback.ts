import registryData from '../../data/biomarker_registry.json';
import type { Astronaut, Biomarker, Dashboard } from './types';

export const demoRegistry = (registryData as Biomarker[]).filter((item) => item.enabled);

export const demoCrew: Astronaut[] = [
  {
    id: 'crew-01', name: 'Elena Vega', role: 'Commander', mission: 'HELIOS / ORBITAL-01',
    scenario: 'stable', sex: 'female', cycle_status: 'active', usual_cycle_length_days: 28,
    mission_start: new Date(Date.now() - 29 * 86400000).toISOString(), is_synthetic: true,
  },
  {
    id: 'crew-02', name: 'Alex Morgan', role: 'Mission Specialist', mission: 'HELIOS / ORBITAL-01',
    scenario: 'review', sex: 'male', cycle_status: 'not_applicable', mission_start: new Date(Date.now() - 29 * 86400000).toISOString(), is_synthetic: true,
  },
];

const CENTERS: Record<string, number> = {
  heart_rate: 58.5, hrv: 52, spo2: 99, temperature: 36.97, glucose: 93.77,
  sleep: 7.4, grip_strength: 42.6, creatinine: 0.9, urinary_calcium: 170,
  urinary_citrate: 450, urine_ph: 6, ctx_i: 0.32, p1np: 42, vitamin_d: 34,
  il6: 1.4, crp: 0.8, cortisol: 13, respiratory_rate: 14, reaction_time: 245,
  systolic_bp: 117, sweat_rate: 0.46, skin_temperature: 33.1, lactate: 1.18,
  beta_hydroxybutyrate: 0.19, vastus_lateralis_thickness: 22.3, exercise_load_kg: 36,
  exercise_speed_mps: 0.43, knee_extensor_force: 410, hip_extensor_force: 360,
  ankle_plantarflexor_force: 145, eim_resistance_thigh: 35, eim_reactance_thigh: 8,
  eim_phase_angle_thigh: 13, jugular_flow_velocity: 24, jugular_stasis_reported: 0,
  jugular_thrombus_suspected_reported: 0,
};

export function createDemoDashboard(astronautId: string, day = 29): Dashboard {
  const astronaut = demoCrew.find((item) => item.id === astronautId) ?? demoCrew[0];
  const start = new Date(astronaut.mission_start);
  const asOf = new Date(start.getTime() + Math.max(0, Math.min(29, day)) * 86400000);
  const baselineStart = new Date(start.getTime() - 25 * 86400000);
  const analyses = demoRegistry.map((definition) => {
    const center = CENTERS[definition.id] ?? 50;
    const spread = Math.max(Math.abs(center) * 0.035, 0.01);
    const muscleDrift = definition.id === 'vastus_lateralis_thickness'
      ? (astronaut.id === 'crew-02' ? -0.045 : 0.006)
      : 0;
    const series = Array.from({ length: 30 }, (_, index) => {
      const timestamp = new Date(start.getTime() + index * 86400000);
      const value = center * (1 + muscleDrift * index / 29) + Math.sin(index * 0.83 + astronaut.id.length) * spread * 0.32;
      return {
        astronaut_id: astronaut.id, metric_id: definition.id, value: Number(value.toFixed(3)),
        unit: definition.unit, timestamp: timestamp.toISOString(), measurement_method: definition.measurement_method,
        source: 'HELIOS · local simulation', quality: 'good', is_synthetic: true,
      };
    });
    // Keep the selected replay day as the current sample, including when loading offline.
    const latest = { ...series[Math.max(0, Math.min(29, day))], timestamp: asOf.toISOString() };
    const baseline = center;
    return {
      metric_id: definition.id,
      status: 'stable' as const,
      data_state: 'available',
      n: 30,
      excluded: 0,
      mean: center,
      std: spread,
      median: center,
      mad: spread * 0.67,
      trend_per_day: muscleDrift ? center * muscleDrift / 29 : 0,
      baseline: {
        mean: baseline, std: spread, n: 24,
        start: baselineStart.toISOString(), end: start.toISOString(),
        source: 'HELIOS · simulated baseline', is_synthetic: true,
      },
      deviation_z: 0,
      ci95: [center - spread, center + spread],
        uncertainty: 'Local simulation; not a clinical assessment.',
      quality_flags: [],
      latest,
      series: [...series.slice(0, Math.max(0, day)), latest],
    };
  });
  return {
    astronaut, as_of: asOf.toISOString(), status: 'stable', analyses, findings: [],
    measurement_requests: [], pathways: [], guidance: [], prediction: null, model_error: null,
    events: [], demo_start: baselineStart.toISOString(), demo_end: asOf.toISOString(),
  };
}
