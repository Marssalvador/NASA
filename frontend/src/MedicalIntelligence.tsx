import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Activity, AlertTriangle, Check, CircleHelp, Dna, FileHeart, FlaskConical, LoaderCircle, Moon, Plus, ShieldAlert, X } from 'lucide-react';
import './medical-intelligence.css';

type Profile = {
  code: string;
  display_name: string;
  sex: 'female' | 'male' | 'unspecified';
  cycle_status: 'active' | 'suppressed' | 'not_applicable' | 'unknown';
  usual_cycle_length_days: number | null;
  is_synthetic: boolean;
};
type DemoAccount = { code: string; user: string };
type Measurement = {
  biomarker_id: string;
  name: string;
  value: number | null;
  unit: string;
  measured_at: string;
  quality: string;
  is_synthetic: boolean;
  context?: Record<string, unknown>;
};
type RecordData = {
  profile: Profile;
  latest: Measurement[];
  events: { kind: string; started_at: string }[];
  open_test_requests: { id: string; biomarker_id: string; reason: string; status: string }[];
};
type TrendData = { series: { day: string; value: number; n: number }[]; aggregation: string };
type Recommendation = {
  category: string;
  status: string;
  display: string;
  proposed_text: string | null;
  note: string;
  source: string;
};
type RiskAssessment = {
  id: string;
  risk_id: string;
  risk_name: string;
  alert_level: 'green' | 'yellow' | 'orange' | 'red' | 'insufficient_data';
  certainty: string;
  input_quality: string;
  missing_inputs: string[];
  explanation: string;
  recommendations: Recommendation[];
  test_requests: { id: string; biomarker_id: string; reason: string; status: string }[];
};
type Evaluation = {
  engine: string;
  model: { name: string; version: string; validation_status: string };
  cycle_phase: string | null;
  model_error: string | null;
  emergencies: { id: string; title: string; action: string; explanation: string }[];
  assessments: RiskAssessment[];
};

const accounts: DemoAccount[] = [
  { code: 'A-112', user: 'user-a112' },
  { code: 'A-113', user: 'user-a113' },
];
const basics = [
  { id: 'heart_rate', title: 'Heart rate', unit: 'bpm', group: 'Continuous monitoring' },
  { id: 'glucose', title: 'Glucose concentration', unit: 'mg/dL', group: 'Glucose' },
  { id: 'sweat_rate', title: 'Local sweat rate', unit: 'mg/cm2/min', group: 'Experimental patch' },
  { id: 'skin_temperature', title: 'Skin temperature', unit: 'degC', group: 'Experimental patch' },
  { id: 'lactate', title: 'Lactate concentration', unit: 'mmol/L', group: 'Exercise metabolism' },
  { id: 'beta_hydroxybutyrate', title: 'Beta-hydroxybutyrate (BHB)', unit: 'mmol/L', group: 'Metabolic lab test' },
  { id: 'jugular_flow_velocity', title: 'Jugular flow velocity', unit: 'cm/s', group: 'Jugular Doppler' },
  { id: 'jugular_stasis_reported', title: 'Reported stasis', unit: 'flag', group: 'Jugular Doppler', binary: true },
  { id: 'jugular_thrombus_suspected_reported', title: 'Reported possible thrombus', unit: 'flag', group: 'Jugular Doppler', binary: true },
  { id: 'hip_extensor_force', title: 'Hip extensor force', unit: 'N', group: 'Dynamometry' },
  { id: 'knee_extensor_force', title: 'Knee extensor force', unit: 'N', group: 'Dynamometry' },
  { id: 'ankle_plantarflexor_force', title: 'Ankle plantar-flexor force', unit: 'N', group: 'Dynamometry' },
  { id: 'eim_resistance_thigh', title: 'Thigh EIM · resistance', unit: 'ohm', group: 'EIM · experimental' },
  { id: 'eim_reactance_thigh', title: 'Thigh EIM · reactance', unit: 'ohm', group: 'EIM · experimental' },
  { id: 'eim_phase_angle_thigh', title: 'Thigh EIM · phase angle', unit: 'degree', group: 'EIM · experimental' },
  { id: 'creatine_kinase', title: 'Creatine kinase (CK)', unit: 'U/L', group: 'Lab test · clinical review' },
  { id: 'vitamin_d', title: 'Vitamin D · 25(OH)D', unit: 'ng/mL', group: 'Nutrition' },
  { id: 'serum_sodium', title: 'Serum sodium', unit: 'mmol/L', group: 'Nutritional lab test' },
  { id: 'serum_potassium', title: 'Serum potassium', unit: 'mmol/L', group: 'Nutritional lab test' },
  { id: 'dietary_protein_g', title: 'Recorded dietary protein', unit: 'g/day', group: 'Nutrition · self-report' },
  { id: 'exercise_session_minutes', title: 'Resistance exercise session duration', unit: 'min', group: 'Exercise session' },
  { id: 'grip_strength', title: 'Grip strength', unit: 'kg', group: 'Dynamometry' },
  { id: 'vastus_lateralis_thickness', title: 'Vastus lateralis ultrasound thickness', unit: 'mm', group: 'Muscle ultrasound' },
  { id: 'exercise_load_kg', title: 'Device-recorded load', unit: 'kg', group: 'Exercise telemetry' },
  { id: 'exercise_speed_mps', title: 'Device-recorded speed', unit: 'm/s', group: 'Exercise telemetry' },
];
const sourceLinks = [
  ['OSDR human data · Inspiration4', 'https://osdr.nasa.gov/bio/repo/data/missions/SpaceX%20Inspiration4'],
  ['NASA medical data request', 'https://www.nasa.gov/directorates/esdmd/hhp/human-health-and-performance-data-sharing/'],
  ['HRP hazards', 'https://www.nasa.gov/hrp/hazards/'],
  ['HRP risks', 'https://www.nasa.gov/hrp/risks/'],
  ['HRP research', 'https://www.nasa.gov/hrp/ongoing-hrp-research/'],
  ['Radiation · CSA', 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp'],
  ['Space science · CSA', 'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp'],
] as const;
const levelText: Record<RiskAssessment['alert_level'], string> = {
  green: 'No deviations in available inputs', yellow: 'Pattern review', orange: 'Priority review',
  red: 'Escalate according to protocol', insufficient_data: 'Insufficient data',
};
const phaseText: Record<string, string> = {
  menstrual: 'Menstrual', follicular: 'Follicular', ovulatory: 'Ovulatory', luteal: 'Luteal', unknown: 'No phase reported',
};

const phaseOneSignals = [
  'External jugular Doppler: flow direction and velocity, stasis, reported findings, and report quality.',
  'Standardized dynamometry by muscle group, side, posture, and equipment.',
  'EIM/Myolex mScan: resistance, reactance, phase angle, and frequency by muscle site.',
  'Additional lab tests: vitamin D, electrolytes, and CK only when requested by the medical team.',
];

const predictiveRisks = [
  { title: 'Bone health / osteoporosis risk', detail: 'Monitors available bone-turnover markers and tests; this is not an osteoporosis diagnosis.' },
  { title: 'Sarcopenia / muscle function', detail: 'Relates serial ultrasound, strength, and EIM when available; it does not estimate grams lost or diagnose sarcopenia.' },
  { title: 'Kidney stone risk', detail: 'Requires urine testing and clinical review; the system cannot detect stones from sweat or hydration.' },
  { title: 'Venous thrombosis', detail: 'Records clinician-transcribed findings from Doppler reports only. It does not interpret images or rule out thrombosis.' },
];

const interventionMatrix = [
  { title: 'Approved exercise', detail: 'The library links exercises, available equipment, muscle groups, restrictions, and protocols approved by flight medicine.' },
  { title: 'Repeat and compare', detail: 'Record new tests with documented method and quality to assess changes against the individual baseline.' },
  { title: 'Medical review', detail: 'The system does not prescribe anticoagulants, medication, supplements, or therapeutic training.' },
];

const femaleContext = [
  'Record cycle, hormonal contraception, and medication only with consent and authorized access.',
  'Contextualize individual variation by the reported phase; do not infer a phase or change safety thresholds.',
  'Compare strength, EIM, and recovery with the personal baseline and mission context.',
  'Hormonal, nutrition, and exercise decisions belong to the medical team.',
];

const conductRules = [
  'Use a clear, professional, prevention-focused tone.',
  'Prioritize biomedical evidence, changes over time, and physiological context.',
  'When a relevant risk appears, suggest preventive measures and targeted monitoring.',
  "Do not replace the medical team's final decision or clinical supervision.",
];

const pullsRiskIds = new Set(['bone_resorption', 'renal_stones', 'jugular_doppler_review', 'muscle_function_monitoring']);

function accountFor(code: string) {
  return accounts.find((item) => item.code === code) ?? accounts[0];
}

async function medicalFetch<T>(path: string, account: DemoAccount, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v2${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-AEGIS-User': account.user, ...init.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body?.detail === 'string' ? body.detail : `HTTP error ${response.status}`;
    throw new Error(detail);
  }
  return body as T;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(value)) + ' UTC';
}

export default function MedicalIntelligence({ onClose, initialCode = 'A-112' }: { onClose: () => void; initialCode?: string }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [code, setCode] = useState(initialCode);
  const [record, setRecord] = useState<RecordData | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [testId, setTestId] = useState('jugular_flow_velocity');
  const [value, setValue] = useState('');
  const [measurementQuality, setMeasurementQuality] = useState('good');
  const [laterality, setLaterality] = useState('left');
  const [flowDirection, setFlowDirection] = useState('antegrade');
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseEquipment, setExerciseEquipment] = useState('ARED');
  const [eimFrequency, setEimFrequency] = useState('50');
  const [trendId, setTrendId] = useState('hip_extensor_force');
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [trendError, setTrendError] = useState('');
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [cycleDate, setCycleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const selectedAccount = accountFor(code);
  const selectedProfile = profiles.find((profile) => profile.code === code) ?? record?.profile ?? null;
  const selectedTest = basics.find((test) => test.id === testId)!;
  const latestById = useMemo(() => new Map((record?.latest ?? []).map((item) => [item.biomarker_id, item])), [record]);

  const loadRecord = useCallback(async (selectedCode: string, signal?: AbortSignal) => {
    const account = accountFor(selectedCode);
    const next = await medicalFetch<RecordData>(`/astronauts/${selectedCode}/record`, account, { signal });
    setRecord(next);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all(accounts.map((account) => medicalFetch<Profile[]>(`/astronauts`, account)))
      .then((lists) => {
        if (!active) return;
        const unique = new Map(lists.flat().map((profile) => [profile.code, profile]));
        setProfiles([...unique.values()].sort((a, b) => a.code.localeCompare(b.code)));
        return loadRecord(code);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [code, loadRecord]);

  useEffect(() => {
    let active = true;
    const account = accountFor(code);
    medicalFetch<TrendData>(`/astronauts/${code}/trends?biomarker=${encodeURIComponent(trendId)}&days=90`, account)
      .then((result) => { if (active) { setTrend(result); setTrendError(''); } })
      .catch((cause: unknown) => { if (active) { setTrend(null); setTrendError(cause instanceof Error ? cause.message : String(cause)); } });
    return () => { active = false; };
  }, [code, trendId, lastRefresh]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function reviewData() {
    setBusy(true); setError(''); setNotice('');
    try {
      // Read the latest measurements already ingested by the API before evaluating them.
      const latest = await loadRecord(code);
      const result = await medicalFetch<Evaluation>(`/astronauts/${code}/evaluations`, selectedAccount, { method: 'POST' });
      setEvaluation(result);
      await loadRecord(code);
      setLastRefresh(new Date());
      setNotice(`Record updated: ${latest.latest.length} signals available. assessment recalculated using data received by HELIOS.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  async function saveMeasurement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await medicalFetch<{ accepted: number; duplicates: number; rejected: { error: string }[] }>(
        `/astronauts/${code}/measurements`, selectedAccount,
        { method: 'POST', body: JSON.stringify({
          format: 'json', is_synthetic: true, source: 'HELIOS manual demo entry',
          content: [{ biomarker_id: testId, unit: selectedTest.unit, value: Number(value),
            measured_at: new Date(measuredAt).toISOString(), method: 'Manual demo entry', quality: measurementQuality,
            context: {
              entered_in: 'medical_intelligence_panel',
              ...(selectedTest.group === 'Jugular Doppler' ? { laterality, flow_direction: flowDirection } : {}),
              ...(['Dynamometry', 'EIM · experimental'].includes(selectedTest.group)
                ? { laterality, muscle_group: selectedTest.title } : {}),
              ...(selectedTest.group === 'EIM · experimental' ? { eim_frequency_khz: Number(eimFrequency) } : {}),
              ...(selectedTest.group === 'Exercise session'
                ? { exercise_name: exerciseName, equipment: exerciseEquipment, approved_protocol_id: null } : {}),
            } }],
        }) },
      );
      if (result.rejected.length) throw new Error(result.rejected.map((item) => item.error).join(' · '));
      await loadRecord(code);
      setLastRefresh(new Date());
      setNotice(result.accepted ? 'Synthetic measurement saved with provenance metadata.' : 'This measurement was already recorded.');
      setValue('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  async function saveCycleEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      await medicalFetch(`/astronauts/${code}/events`, selectedAccount, {
        method: 'POST', body: JSON.stringify({ kind: 'menstruation_start',
          started_at: new Date(`${cycleDate}T08:00:00Z`).toISOString(), is_synthetic: true,
          severity: 'declared', details: { declared_by: 'astronaut', entered_in: 'medical_intelligence_panel' } }),
      });
      setEvaluation(null);
      await loadRecord(code);
      setNotice('Reported menstruation start saved; run the assessment again to update the phase.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  const requests = record?.open_test_requests ?? [];
  const visibleAssessments = evaluation?.assessments.filter((assessment) => pullsRiskIds.has(assessment.risk_id)) ?? [];
  const chartValues = trend?.series ?? [];
  const chartMin = Math.min(...chartValues.map((point) => point.value), 0);
  const chartMax = Math.max(...chartValues.map((point) => point.value), 1);
  const chartSpan = chartMax - chartMin || 1;
  const chartPath = chartValues.map((point, index) => {
    const x = chartValues.length <= 1 ? 140 : 8 + (index * 264) / (chartValues.length - 1);
    const y = 78 - ((point.value - chartMin) / chartSpan) * 64;
    return `${index ? 'L' : 'M'} ${x} ${y}`;
  }).join(' ');

  return (
    <div className="mi-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="mi-dialog" role="dialog" aria-modal="true" aria-labelledby="mi-title">
        <header className="mi-header">
          <div className="mi-brand"><span><FileHeart size={20} /></span><div><small>HELIOS · PHYSIOLOGICAL SUPPORT</small><h1 id="mi-title">Mission health intelligence</h1></div></div>
          <button className="mi-close" aria-label="Close module" onClick={onClose}><X size={20} /></button>
        </header>

        <div className="mi-scroll">
          <div className="mi-intro">
            <div>
              <span className="mi-eyebrow">INITIAL SCREENING · BASIC TESTS</span>
              <p>Hello, astronaut. This assessment is part of the Human Health Digital Twin physiological screening. It is designed to detect early changes, put biomarker trends in context, and support preventive decisions by the medical team.</p>
              <p>The initial tests measure heart rate, HRV, temperature, glucose, hydration, electrolytes, sleep, physical activity, and lactate. The engine highlights patterns for the medical team to review when considering training, nutrition, rest, or clinical monitoring; it does not diagnose conditions.</p>
              {lastRefresh && <small className="mi-refresh-time">Last reviewed: {lastRefresh.toLocaleTimeString('en-US')} · {record?.latest.length ?? 0} signals available</small>}
            </div>
            <button className="mi-run" disabled={busy || loading || !record} onClick={reviewData}>
              {busy ? <LoaderCircle className="mi-spin" size={16} /> : <Activity size={16} />}
              {busy ? 'Revisando…' : 'Review data'}
            </button>
          </div>

          {error && <div className="mi-alert error" role="alert"><AlertTriangle size={16} />{error}</div>}
          {notice && <div className="mi-alert success" role="status"><Check size={16} />{notice}</div>}

          <section className="mi-profile-card">
            <div className="mi-profile-left"><span className="mi-avatar"><Dna size={19} /></span><div><span className="mi-eyebrow">DEMO PROFILE · SYNTHETIC DATA</span>
              <label className="mi-select-label"><select aria-label="Select physiological profile" value={code} onChange={(event) => { setCode(event.target.value); setEvaluation(null); setRecord(null); setError(''); }}>
                {profiles.map((profile) => <option key={profile.code} value={profile.code}>{profile.code} · {profile.sex === 'female' ? 'Female' : 'Male'} · {profile.display_name}</option>)}
              </select></label>
            </div></div>
            <div className="mi-profile-meta"><span className={`mi-sex-badge ${selectedProfile?.sex ?? ''}`}>{selectedProfile?.sex === 'female' ? 'Female profile' : selectedProfile?.sex === 'male' ? 'Male profile' : 'Profile'}</span>
              <small>{selectedProfile?.cycle_status === 'active' ? 'Reported active cycle' : 'No menstrual modifier'}</small></div>
          </section>

          <div className="mi-model-note"><CircleHelp size={15} /><span>The main 3D atlas is a shared generic anatomical reference; this repository does not include an alternate female body mesh. Sex and cycle provide assessment context and do not change atlas anatomy.</span></div>

          <section className="mi-section">
            <div className="mi-section-heading">
              <div>
                <span className="mi-eyebrow">PHASE 1 · PHYSIOLOGICAL SCREENING</span>
                <h2>Basic parameters</h2>
              </div>
            </div>
            <div className="mi-phase-grid">
              {phaseOneSignals.map((signal) => (
                <article className="mi-phase-card" key={signal}>
                  <span className="mi-pill">Monitoring</span>
                  <p>{signal}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mi-section">
            <div className="mi-section-heading">
              <div>
                <span className="mi-eyebrow">PHASE 2 · PREDICTIVE REVIEW</span>
                <h2>Key risk areas</h2>
              </div>
            </div>
            <div className="mi-phase-grid">
              {predictiveRisks.map((risk) => (
                <article className="mi-phase-card" key={risk.title}>
                  <span className="mi-pill risk-pill">Risk</span>
                  <h3>{risk.title}</h3>
                  <p>{risk.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mi-section">
            <div className="mi-section-heading">
              <div>
                <span className="mi-eyebrow">RESPONSE OPTIONS</span>
                <h2>Tailored preventive measures</h2>
              </div>
            </div>
            <div className="mi-phase-grid">
              {interventionMatrix.map((item) => (
                <article className="mi-phase-card" key={item.title}>
                  <span className="mi-pill accent-pill">Intervention</span>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mi-section">
            <div className="mi-section-heading">
              <div>
                <span className="mi-eyebrow">FEMALE PROFILE</span>
                <h2>Endocrine and reproductive context</h2>
              </div>
            </div>
            <div className="mi-phase-grid">
              {femaleContext.map((point) => (
                <article className="mi-phase-card" key={point}>
                  <span className="mi-pill accent-pill">Female</span>
                  <p>{point}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mi-section">
            <div className="mi-section-heading">
              <div>
                <span className="mi-eyebrow">OPERATING PRINCIPLES</span>
                <h2>Assistant operation</h2>
              </div>
            </div>
            <ul className="mi-rule-list">
              {conductRules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
          </section>

          <section className="mi-section">
            <div className="mi-section-heading"><div><span className="mi-eyebrow">LAYER 1 · SELF-MONITORING</span><h2>Basic signals</h2></div><span className="mi-provenance"><span /> Simulated</span></div>
            {loading ? <div className="mi-loading"><LoaderCircle className="mi-spin" size={18} />Loading synthetic record…</div> : <div className="mi-metrics">
              {basics.map((test) => {
                const latest = latestById.get(test.id);
                return <article className="mi-metric" key={test.id}>
                  <div><span>{test.title}</span><small>{test.group}</small></div>
                  <strong>{latest?.value == null ? '—' : Number(latest.value).toLocaleString('en-US', { maximumFractionDigits: 2 })}<small>{latest ? ` ${latest.unit}` : ''}</small></strong>
                  <em>{latest ? `${latest.quality} · ${latest.is_synthetic ? 'synthetic' : 'measured'} · ${displayDate(latest.measured_at)}` : 'no data'}</em>
                  {latest?.context?.laterality != null && <small>Side: {latest.context.laterality === 'left' ? 'left' : 'right'}</small>}
                  {latest?.context?.exercise_name != null && <small>{String(latest.context.exercise_name)} · {String(latest.context.equipment ?? '')}</small>}
                </article>;
              })}
            </div>}
            <form className="mi-entry" onSubmit={saveMeasurement}>
              <div><span className="mi-eyebrow">RECORD A TEST MEASUREMENT</span><div className="mi-entry-fields">
                <label>Signal<select value={testId} onChange={(event) => setTestId(event.target.value)}>{basics.map((test) => <option key={test.id} value={test.id}>{test.title} ({test.unit})</option>)}</select></label>
                <label>Value{selectedTest.binary ? <select required value={value} onChange={(event) => setValue(event.target.value)}><option value="">Select…</option><option value="0">Not reported</option><option value="1">Reported</option></select> : <input required type="number" step="any" value={value} onChange={(event) => setValue(event.target.value)} />}</label>
                <label>Date and time<input required type="datetime-local" value={measuredAt} onChange={(event) => setMeasuredAt(event.target.value)} /></label>
                <label>Quality<select value={measurementQuality} onChange={(event) => setMeasurementQuality(event.target.value)}><option value="good">Good</option><option value="questionable">Questionable</option><option value="invalid">Invalid</option></select></label>
                {selectedTest.group === 'Jugular Doppler' && <>
                  <label>Side<select value={laterality} onChange={(event) => setLaterality(event.target.value)}><option value="left">Left</option><option value="right">Right</option></select></label>
                  <label>Flow direction<select value={flowDirection} onChange={(event) => setFlowDirection(event.target.value)}><option value="antegrade">Antegrade</option><option value="retrograde">Retrograde</option><option value="not_measurable">Not measurable / not reported</option></select></label>
                </>}
                {['Dynamometry', 'EIM · experimental'].includes(selectedTest.group) && <label>Side evaluado<select value={laterality} onChange={(event) => setLaterality(event.target.value)}><option value="left">Left</option><option value="right">Right</option></select></label>}
                {selectedTest.group === 'EIM · experimental' && <label>EIM frequency (kHz)<input required type="number" min="0" step="any" value={eimFrequency} onChange={(event) => setEimFrequency(event.target.value)} /></label>}
                {selectedTest.group === 'Exercise session' && <>
                  <label>Recorded exercise<input required value={exerciseName} onChange={(event) => setExerciseName(event.target.value)} placeholder="Name from approved plan" /></label>
                  <label>Equipment<select value={exerciseEquipment} onChange={(event) => setExerciseEquipment(event.target.value)}><option>ARED</option><option>Bungee</option><option>Resistance band</option><option>Other equipment</option></select></label>
                  <small className="mi-field-note">This entry documents a session; it does not prescribe exercise or confirm authorization.</small>
                </>}
              </div></div>
              <button className="mi-secondary" disabled={busy}><Plus size={15} />Save synthetic entry</button>
            </form>
          </section>

          <section className="mi-cycle-card">
            <div className="mi-cycle-icon"><Moon size={18} /></div>
            <div className="mi-cycle-content"><span className="mi-eyebrow">CONTEXTO HORMONAL DECLARADO</span><h2>{selectedProfile?.sex === 'female' && selectedProfile.cycle_status === 'active' ? `Cycle: ${phaseText[evaluation?.cycle_phase ?? 'unknown'] ?? 'Not evaluated'}` : 'No menstrual modifier is active'}</h2>
              <p>{selectedProfile?.sex === 'female' && selectedProfile.cycle_status === 'active' ? 'The phase is estimated from a reported date. It may help contextualize personal temperature, HRV, and heart-rate changes; it does not establish cause or relax safety measures.' : 'When a female profile with an active cycle is selected, the engine displays the reported phase and uses documented modifiers only.'}</p></div>
            {selectedProfile?.sex === 'female' && selectedProfile.cycle_status === 'active' && <form onSubmit={saveCycleEvent} className="mi-cycle-form"><label>Reported start date<input type="date" value={cycleDate} onChange={(event) => setCycleDate(event.target.value)} /></label><button className="mi-secondary" disabled={busy}><Plus size={14} />Record</button></form>}
          </section>

          <section className="mi-section mi-timeline">
            <div className="mi-section-heading"><div><span className="mi-eyebrow">HEALTH TIMELINE · UP TO 90 DAYS</span><h2>Individual trends</h2></div>
              <label className="mi-trend-select">Metric<select value={trendId} onChange={(event) => setTrendId(event.target.value)}>
                {basics.filter((item) => item.group === 'Dynamometry' || item.group.startsWith('EIM') || item.group === 'Jugular Doppler').map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select></label>
            </div>
            {chartValues.length > 0 ? <div className="mi-chart-wrap"><svg className="mi-chart" viewBox="0 0 280 88" role="img" aria-label={`Trend for ${basics.find((item) => item.id === trendId)?.title ?? trendId}`}>
              <line x1="8" y1="78" x2="272" y2="78" /><line x1="8" y1="14" x2="8" y2="78" />
              <path d={chartPath} />{chartValues.map((point, index) => {
                const x = chartValues.length <= 1 ? 140 : 8 + (index * 264) / (chartValues.length - 1);
                const y = 78 - ((point.value - chartMin) / chartSpan) * 64;
                return <circle key={`${point.day}-${index}`} cx={x} cy={y} r="2.7"><title>{point.day}: {point.value} (n={point.n})</title></circle>;
              })}
              </svg><div className="mi-chart-labels"><span>{chartValues[0].day}</span><span>{chartValues[chartValues.length - 1].day}</span></div><small>{trend?.aggregation} · each point shows the available daily median. {trendId.startsWith('jugular_') ? 'This series cannot determine whether a clot is present or absent.' : 'This series is not a muscle-mass measurement.'}</small></div> : <div className="mi-empty"><p>{trendError ? 'Could not load the trend.' : 'There are no serial measurements to plot yet. Add tests to view changes over time.'}</p></div>}
          </section>

          <section className="mi-section mi-risk-section">
            <div className="mi-section-heading"><div><span className="mi-eyebrow">LAYER 2 · TARGETED CHECKS</span><h2>Risks to monitor</h2></div><span className="mi-source-chip">{evaluation?.model.name ?? 'HELIOS engine'} · {evaluation?.model.version ?? 'local rules'}</span></div>
            {evaluation ? <>
              <div className="mi-engine-note"><FlaskConical size={15} /><span>Transparent rules, not a trained model. No disease probabilities or diagnosis. Model validation status: {evaluation.model.validation_status.replaceAll('_', ' ')}.</span></div>
              {evaluation.emergencies?.length > 0 && <div className="mi-alert error"><ShieldAlert size={16} /><div><strong>Alerta declarada</strong>{evaluation.emergencies.map((item, index) => <p key={`${item.id}-${index}`}><strong>{item.title}:</strong> {item.explanation} {item.action}</p>)}</div></div>}
              <div className="mi-risks">{visibleAssessments.map((assessment) => <article className={`mi-risk level-${assessment.alert_level}`} key={assessment.id}>
                <div className="mi-risk-title"><span className="mi-level-mark" /><div><h3>{assessment.risk_name}</h3><span>{levelText[assessment.alert_level]} · {assessment.certainty.replaceAll('_', ' ')}</span></div></div>
                <p>{assessment.explanation}</p>
                {assessment.missing_inputs.length > 0 && <small className="mi-missing">Missing: {assessment.missing_inputs.join(', ')}</small>}
                {assessment.test_requests.length > 0 && <div className="mi-request"><strong><FlaskConical size={14} /> Suggested check</strong>{assessment.test_requests.map((item) => <p key={item.id}>{item.biomarker_id}: {item.reason}</p>)}</div>}
                {assessment.recommendations.length > 0 && <div className="mi-recommendations"><strong>Documented countermeasures · pending medical review</strong>{assessment.recommendations.map((item, index) => <p key={`${item.category}-${index}`}><b>{item.category === 'nutrition' ? 'Nutrition' : item.category === 'exercise' ? 'Exercise' : item.category}</b>{item.proposed_text ? ` · ${item.proposed_text}` : ` · ${item.display}`}<small>{item.note}</small></p>)}</div>}
              </article>)}</div>
              {visibleAssessments.length === 0 && <div className="mi-empty"><p>The assessment has not generated results for jugular Doppler or muscle monitoring yet.</p></div>}
            </> : <div className="mi-empty"><FlaskConical size={19} /><p>Run the assessment to compare signals with personal references and show which checks may be needed.</p></div>}
            {requests.length > 0 && <div className="mi-open-requests"><strong>Open requests</strong>{requests.map((item) => <p key={item.id}><span>{item.biomarker_id}</span> {item.status.replaceAll('_', ' ')} · {item.reason}</p>)}</div>}
            <div className="mi-medication-note"><ShieldAlert size={16} /><p><strong>Medication:</strong> the system does not recommend melatonin, hypnotics, antibiotics, or antihistamines. Any medication requires a flight physician's decision under a reviewed protocol.</p></div>
          </section>

          <section className="mi-evidence">
            <div><span className="mi-eyebrow">OPEN DATA AND CONTEXT · NOT CLINICAL TRAINING</span><p>OSDR publishes human Inspiration4 studies with four participants and laboratory samples from a three-day mission. These support exploratory research but do not provide enough volume or diagnostic labels to train a clinical disease model. Access to NASA protected medical data requires an application and review. HRP and CSA provide context, not diagnostic labels.</p></div>
            <div>{sourceLinks.map(([label, href]) => <a href={href} key={href} target="_blank" rel="noreferrer">{label}<span>↗</span></a>)}</div>
          </section>
          <p className="mi-footer-note">'Review data' retrieves tests already received by the backend; it is not yet connected directly to analyzers or devices. Records A-112/A-113 are synthetic. Manual entries are stored as synthetic and are not mixed with real data. This tool does not diagnose or replace the mission medical team.</p>
        </div>
      </section>
    </div>
  );
}
