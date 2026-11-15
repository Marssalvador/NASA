import { useEffect, useState } from 'react';
import type { Analysis, Biomarker } from './types';
import type { MuscleRegion } from './anatomyConfig';
import { muscleRegions } from './anatomyConfig';
import AtlasTile from './AtlasTile';

const EXERCISES: Record<string, string[]> = {
  neck: ['Gentle neck isometric against the hand; no external load'],
  shoulders: ['Light band shoulder external rotation', 'Controlled shoulder raise'],
  chest: ['Cable or ARED chest press, if included in the flight protocol'],
  back: ['Cable or ARED row', 'Hip hinge / deadlift only if approved'],
  upper_arms: ['Cable or band biceps curl', 'Cable or band triceps extension'],
  forearms: ['Grip dynamometer or calibrated device', 'Low-load wrist flexion and extension'],
  hands: ['Isometric dynamometer squeeze', 'Finger extension with a light band'],
  core: ['Seated band Pallof press for trunk stability'],
  hips_glutes: ['ARED or equivalent hip hinge', 'Resisted hip extension'],
  quadriceps: ['ARED or flywheel squat', 'Knee extension if approved equipment is available'],
  hamstrings: ['Romanian deadlift with ARED or flywheel', 'Knee flexion if approved equipment is available'],
  calves: ['Loaded calf raise', 'Plantar flexion measured with a dynamometer'],
};

function readLimit(key: string) {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}
function writeLimit(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch { /* Limits still apply for this session if storage is unavailable. */ }
}

export function ExercisePanel({
  region,
  astronautId,
  analyses,
}: {
  region: MuscleRegion | null;
  astronautId: string;
  analyses: Analysis[];
}) {
  const [approvedLoad, setApprovedLoad] = useState('');
  const [approvedVelocity, setApprovedVelocity] = useState('');
  const key = `aegis.exercise-limits.${astronautId}.${region?.id ?? 'general'}`;
  useEffect(() => {
    setApprovedLoad(readLimit(`${key}.kg`));
    setApprovedVelocity(readLimit(`${key}.mps`));
  }, [key]);
  const plan = region ? EXERCISES[region.id] ?? [] : ['Full-body resistance exercise according to the approved flight plan'];
  const latestLoad = analyses.find((item) => item.metric_id === 'exercise_load_kg')?.latest;
  const latestSpeed = analyses.find((item) => item.metric_id === 'exercise_speed_mps')?.latest;
  const exerciseImageIndex = region ? muscleRegions.findIndex((item) => item.id === region.id) : -1;
  const qualityValue = (value: number | null | undefined, unit: string) =>
    value == null ? 'No measurement' : `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit}`;

  return (
    <div className="performance-panel">
      <p className="performance-scope">
        {region?.scope ?? 'Load and speed are always tied to the recorded exercise and equipment.'}
      </p>
      {region && exerciseImageIndex >= 0 ? (
        <article className="exercise-visual-card">
          <AtlasTile
            className="exercise-visual-tile"
            asset="/media/exercise-motion-atlas.png"
            index={exerciseImageIndex}
            label={`Illustration of ${plan[0]} for ${region.name}`}
          />
          <div><span>EXERCISE DEMONSTRATION · {region.name}</span><strong>{plan[0]}</strong></div>
          <small>Generated visual guide; follow the approved individual protocol.</small>
        </article>
      ) : (
        <p className="exercise-image-prompt">Select a muscle region to view the recommended exercise demonstration.</p>
      )}
      <div className="exercise-options">
        {plan.map((exercise, index) => <article key={exercise}><span>{index === 0 ? 'ILLUSTRATED EXERCISE' : 'ALTERNATIVE TO REVIEW'}</span><strong>{exercise}</strong></article>)}
      </div>
      <div className="exercise-limits">
        <div><span>Latest measured load</span><strong>{qualityValue(latestLoad?.value, 'kg')}</strong></div>
        <div><span>Latest measured speed</span><strong>{qualityValue(latestSpeed?.value, 'm/s')}</strong></div>
      </div>
      <div className="exercise-protocol-fields">
        <label>
          Approved maximum load (kg)
          <input type="number" min="0" step="0.5" value={approvedLoad}
            onChange={(event) => { setApprovedLoad(event.target.value); writeLimit(`${key}.kg`, event.target.value); }} />
        </label>
        <label>
          Approved maximum speed (m/s)
          <input type="number" min="0" step="0.01" value={approvedVelocity}
            onChange={(event) => { setApprovedVelocity(event.target.value); writeLimit(`${key}.mps`, event.target.value); }} />
        </label>
      </div>
      <p className="performance-caution">
        Limits are applied only after entering values from a protocol approved by the strength and conditioning specialist. There is no universal maximum load or speed for every person, exercise, and device. Observed speed is telemetry, not a fatigue threshold.
      </p>
      <a className="performance-source" href="https://www.nasa.gov/ochmo-tb-031-exercise-overview-2/" target="_blank" rel="noreferrer">
        NASA OCHMO: in-flight exercise and individualized load adjustment
      </a>
    </div>
  );
}

const RISKS = [
  { id: 'bone', title: 'Bone / osteoporosis risk', metrics: ['ctx_i', 'p1np', 'vitamin_d', 'urinary_calcium', 'vastus_lateralis_thickness'], note: 'Bone markers and calcium support monitoring; they do not replace densitometry or diagnose osteoporosis.' },
  { id: 'muscle', title: 'Sarcopenia risk', metrics: ['vastus_lateralis_thickness', 'grip_strength', 'hip_extensor_force', 'knee_extensor_force', 'eim_resistance_thigh', 'eim_reactance_thigh', 'eim_phase_angle_thigh'], note: 'Combines ultrasound thickness, strength, and EIM when available. It does not calculate total muscle mass or establish a diagnosis.' },
  { id: 'renal', title: 'Kidney stone risk', metrics: ['urinary_calcium', 'urinary_citrate', 'urine_ph', 'creatinine'], note: 'Requires urine testing and clinical assessment; sweat or hydration alone cannot detect stones.' },
  { id: 'thrombosis', title: 'Thrombosis monitoring', metrics: ['jugular_flow_velocity', 'jugular_stasis_reported', 'jugular_thrombus_suspected_reported'], note: 'Shows only Doppler data recorded by a professional. It does not interpret images or rule out thrombosis.' },
];

export function RiskParametersPanel({ analyses, registry }: { analyses: Analysis[]; registry: Biomarker[] }) {
  return (
    <div className="risk-parameters">
      <p className="performance-caution">Monitoring indicators, not clinical probabilities or diagnoses. Data quality, synthetic provenance, and missing tests remain visible.</p>
      {RISKS.map((risk) => {
        const relevant = analyses.filter((item) => risk.metrics.includes(item.metric_id));
        const available = relevant.filter((item) => item.latest?.value != null && item.data_state === 'available');
        const flagged = available.filter((item) => item.status === 'review' || item.status === 'emergency');
        const dopplerPositive = risk.id === 'thrombosis' && available.some((item) =>
          ['jugular_stasis_reported', 'jugular_thrombus_suspected_reported'].includes(item.metric_id) && item.latest?.value === 1,
        );
        const status = dopplerPositive || flagged.length
          ? 'Review with the medical team'
          : available.length
            ? 'No statistical deviation detected'
            : 'Insufficient data';
        const missing = risk.metrics.filter((id) => !available.some((item) => item.metric_id === id));
        return (
          <article className="risk-parameter-card" key={risk.id}>
            <header><strong>{risk.title}</strong><span className={flagged.length || dopplerPositive ? 'review' : available.length ? 'stable' : 'missing'}>{status}</span></header>
          <p>{risk.note}</p>
            <small>{available.length} / {risk.metrics.length} indicators with current values</small>
            {available.length > 0 && (
              <small>
                Readings: {available.map((item) => {
                  const label = registry.find((definition) => definition.id === item.metric_id);
                  return `${label?.name ?? item.metric_id}: ${item.latest?.value ?? '—'} ${label?.unit ?? ''}`;
                }).join(' · ')}
              </small>
            )}
            {missing.length > 0 && <small>Missing: {missing.map((id) => registry.find((item) => item.id === id)?.name ?? id).join(', ')}</small>}
            {available.some((item) => item.latest?.is_synthetic) && <small>Includes synthetic demonstration data.</small>}
          </article>
        );
      })}
    </div>
  );
}
