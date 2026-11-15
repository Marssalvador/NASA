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
};
type RecordData = {
  profile: Profile;
  latest: Measurement[];
  events: { kind: string; started_at: string }[];
  open_test_requests: { id: string; biomarker_id: string; reason: string; status: string }[];
};
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
  { id: 'heart_rate', title: 'Frecuencia cardíaca', unit: 'bpm', group: 'Cardiovascular' },
  { id: 'temperature', title: 'Temperatura', unit: '°C', group: 'Temperatura' },
  { id: 'glucose', title: 'Glucosa', unit: 'mg/dL', group: 'Metabolismo' },
  { id: 'sweat_sodium', title: 'Sodio en sudor', unit: 'mmol/L', group: 'Hidratación · experimental' },
  { id: 'sleep', title: 'Sueño', unit: 'h', group: 'Recuperación' },
  { id: 'resistive_exercise_minutes', title: 'Ejercicio resistido', unit: 'min', group: 'Actividad' },
  { id: 'lactate', title: 'Lactato', unit: 'mmol/L', group: 'Recuperación · experimental' },
];
const sourceLinks = [
  ['Datos humanos OSDR · Inspiration4', 'https://osdr.nasa.gov/bio/repo/data/missions/SpaceX%20Inspiration4'],
  ['Solicitud de datos médicos NASA', 'https://www.nasa.gov/directorates/esdmd/hhp/human-health-and-performance-data-sharing/'],
  ['Peligros del HRP', 'https://www.nasa.gov/hrp/hazards/'],
  ['Riesgos del HRP', 'https://www.nasa.gov/hrp/risks/'],
  ['Investigación HRP', 'https://www.nasa.gov/hrp/ongoing-hrp-research/'],
  ['Radiación · CSA', 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp'],
  ['Ciencia en el espacio · CSA', 'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp'],
] as const;
const levelText: Record<RiskAssessment['alert_level'], string> = {
  green: 'Sin señal desviada en las entradas disponibles',
  yellow: 'Revisión de patrón',
  orange: 'Revisión prioritaria',
  red: 'Escalado según protocolo',
  insufficient_data: 'Datos insuficientes',
};
const phaseText: Record<string, string> = {
  menstrual: 'Menstrual', follicular: 'Folicular', ovulatory: 'Ovulatoria', luteal: 'Lútea', unknown: 'Sin fase declarada',
};

const phaseOneSignals = [
  'Frecuencia cardíaca / HRV para tono parasimpático y resistencia cardiovascular.',
  'Temperatura corporal central para detectar riesgo térmico y sobreesfuerzo.',
  'Glucosa e insulina para vigilar resistencia metabólica y gasto energético.',
  'Hidratación y electrolitos (sodio, potasio, magnesio) para preservar función muscular y cardíaca.',
  'Sueño y actividad física para detectar déficit de recuperación y desadaptación.',
  'Lactato y esfuerzo para valorar umbral anaeróbico y capacidad metabólica.',
];

const predictiveRisks = [
  { title: 'Riesgo óseo elevado', detail: 'Densidad mineral ósea, NTX, deoxipiridinolina, 8-OHdG y pérdida estimada >0,5–1 % mensual.' },
  { title: 'Riesgo renal', detail: 'Perfil urinario de 24 h, calcio, oxalato, pH, citrato y riesgo de litiasis renal.' },
  { title: 'Fatiga y sobrecarga acumulada', detail: 'Torque pico isocinético, T2, reclutamiento EMG y caída sostenida del estímulo voluntario.' },
  { title: 'Inflamación y estrés oxidativo', detail: 'IL-1α, IL-1ra, TNF-α, IL-6, IL-8 y malondialdehído.' },
];

const interventionMatrix = [
  { title: 'Nutrición', detail: 'Vitamina D, calcio, electrolitos, proteínas, leucina, carbohidratos y control del balance energético.' },
  { title: 'Ejercicio', detail: 'Ajuste temporal de carga, recuperación activa y priorización de fuerza con ARED.' },
  { title: 'Farmacología', detail: 'Solo bajo indicación médica; melatonina, bisfosfonatos, antibióticos y antihistamínicos solo si procede.' },
];

const femaleContext = [
  'Uso continuado de anticonceptivos orales como estrategia para suprimir la menstruación durante la misión.',
  'Ajuste nutricional específico para folato, vitamina B6, hierro y metabolismo femenino.',
  'Interpretación de termorregulación y hemodinámica en el contexto hormonal femenino.',
  'Consideración de variabilidad individual en la respuesta al entrenamiento y la recuperación.',
];

const conductRules = [
  'Mantener un tono profesional, claro y orientado a la prevención.',
  'Priorizar evidencia biomédica, evolución temporal y contexto fisiológico.',
  'Si aparece riesgo relevante, recomendar medidas preventivas y vigilancia específica.',
  'No sustituir la decisión final del equipo médico ni la supervisión clínica.',
];

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
    const detail = typeof body?.detail === 'string' ? body.detail : `Error HTTP ${response.status}`;
    throw new Error(detail);
  }
  return body as T;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(value)) + ' UTC';
}

export default function MedicalIntelligence({ onClose }: { onClose: () => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [code, setCode] = useState('A-112');
  const [record, setRecord] = useState<RecordData | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [testId, setTestId] = useState('heart_rate');
  const [value, setValue] = useState('');
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
      setNotice(`Expediente actualizado: ${latest.latest.length} señales disponibles. Evaluación recalculada con los datos recibidos por AEGIS.`);
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
          format: 'json', is_synthetic: true, source: 'Registro manual de demostración AEGIS',
          content: [{ biomarker_id: testId, unit: selectedTest.unit, value: Number(value),
            measured_at: new Date(measuredAt).toISOString(), method: 'Registro manual de demostración', quality: 'good',
            context: { entered_in: 'medical_intelligence_panel' } }],
        }) },
      );
      if (result.rejected.length) throw new Error(result.rejected.map((item) => item.error).join(' · '));
      await loadRecord(code);
      setNotice(result.accepted ? 'Medición sintética guardada con marca de procedencia.' : 'La medición ya estaba registrada.');
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
      setNotice('Inicio de menstruación registrado como evento declarado; vuelve a evaluar para actualizar la fase.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  const requests = record?.open_test_requests ?? [];

  return (
    <div className="mi-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="mi-dialog" role="dialog" aria-modal="true" aria-labelledby="mi-title">
        <header className="mi-header">
          <div className="mi-brand"><span><FileHeart size={20} /></span><div><small>AEGIS · APOYO FISIOLÓGICO</small><h1 id="mi-title">Inteligencia médica de misión</h1></div></div>
          <button className="mi-close" aria-label="Cerrar módulo" onClick={onClose}><X size={20} /></button>
        </header>

        <div className="mi-scroll">
          <div className="mi-intro">
            <div>
              <span className="mi-eyebrow">BATERÍA INICIAL · TESTS BÁSICOS</span>
              <p>Hola, astronauta. Esta evaluación forma parte del cribado fisiológico del Gemelo Digital de Salud Humana y está diseñada para detectar cambios precoces, contextualizar la evolución de los biomarcadores y apoyar decisiones preventivas del equipo médico.</p>
              <p>Primero realizaremos pruebas básicas para medir frecuencia cardíaca, HRV, temperatura, glucosa, hidratación, electrolitos, sueño, actividad física y lactato. El motor mostrará patrones que el equipo médico puede revisar para valorar ajustes de entrenamiento, nutrición, descanso o vigilancia clínica; no establece diagnósticos.</p>
              {lastRefresh && <small className="mi-refresh-time">Última revisión: {lastRefresh.toLocaleTimeString('es-ES')} · {record?.latest.length ?? 0} señales disponibles</small>}
            </div>
            <button className="mi-run" disabled={busy || loading || !record} onClick={reviewData}>
              {busy ? <LoaderCircle className="mi-spin" size={16} /> : <Activity size={16} />}
              {busy ? 'Revisando…' : 'Revisar datos'}
            </button>
          </div>

          {error && <div className="mi-alert error" role="alert"><AlertTriangle size={16} />{error}</div>}
          {notice && <div className="mi-alert success" role="status"><Check size={16} />{notice}</div>}

          <section className="mi-profile-card">
            <div className="mi-profile-left"><span className="mi-avatar"><Dna size={19} /></span><div><span className="mi-eyebrow">PERFIL DE DEMOSTRACIÓN · DATOS SINTÉTICOS</span>
              <label className="mi-select-label"><select aria-label="Seleccionar perfil fisiológico" value={code} onChange={(event) => { setCode(event.target.value); setEvaluation(null); setRecord(null); setError(''); }}>
                {profiles.map((profile) => <option key={profile.code} value={profile.code}>{profile.code} · {profile.sex === 'female' ? 'Mujer' : 'Hombre'} · {profile.display_name}</option>)}
              </select></label>
            </div></div>
            <div className="mi-profile-meta"><span className={`mi-sex-badge ${selectedProfile?.sex ?? ''}`}>{selectedProfile?.sex === 'female' ? 'Perfil femenino' : selectedProfile?.sex === 'male' ? 'Perfil masculino' : 'Perfil'}</span>
              <small>{selectedProfile?.cycle_status === 'active' ? 'Ciclo declarado activo' : 'Sin modificador menstrual'}</small></div>
          </section>

          <div className="mi-model-note"><CircleHelp size={15} /><span>El atlas 3D principal es una referencia anatómica genérica compartida; este repositorio no incluye una malla corporal femenina alternativa. Sexo y ciclo contextualizan la evaluación, no cambian la anatomía del atlas.</span></div>

          <section className="mi-section">
            <div className="mi-section-heading">
              <div>
                <span className="mi-eyebrow">FASE 1 · CRIBADO FISIOLÓGICO</span>
                <h2>Parámetros básicos</h2>
              </div>
            </div>
            <div className="mi-phase-grid">
              {phaseOneSignals.map((signal) => (
                <article className="mi-phase-card" key={signal}>
                  <span className="mi-pill">Monitorización</span>
                  <p>{signal}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mi-section">
            <div className="mi-section-heading">
              <div>
                <span className="mi-eyebrow">FASE 2 · ANÁLISIS PREDICTIVO</span>
                <h2>Grandes áreas de riesgo</h2>
              </div>
            </div>
            <div className="mi-phase-grid">
              {predictiveRisks.map((risk) => (
                <article className="mi-phase-card" key={risk.title}>
                  <span className="mi-pill risk-pill">Riesgo</span>
                  <h3>{risk.title}</h3>
                  <p>{risk.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mi-section">
            <div className="mi-section-heading">
              <div>
                <span className="mi-eyebrow">MATRIZ DE SOLUCIONES</span>
                <h2>Medidas preventivas adaptadas</h2>
              </div>
            </div>
            <div className="mi-phase-grid">
              {interventionMatrix.map((item) => (
                <article className="mi-phase-card" key={item.title}>
                  <span className="mi-pill accent-pill">Inervación</span>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mi-section">
            <div className="mi-section-heading">
              <div>
                <span className="mi-eyebrow">PERFIL FEMENINO</span>
                <h2>Contexto endocrino y reproductivo</h2>
              </div>
            </div>
            <div className="mi-phase-grid">
              {femaleContext.map((point) => (
                <article className="mi-phase-card" key={point}>
                  <span className="mi-pill accent-pill">Mujer</span>
                  <p>{point}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mi-section">
            <div className="mi-section-heading">
              <div>
                <span className="mi-eyebrow">REGLAS DE CONDUCTA</span>
                <h2>Operación del asistente</h2>
              </div>
            </div>
            <ul className="mi-rule-list">
              {conductRules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
          </section>

          <section className="mi-section">
            <div className="mi-section-heading"><div><span className="mi-eyebrow">CAPA 1 · AUTOCONTROL</span><h2>Señales básicas</h2></div><span className="mi-provenance"><span /> Simulado</span></div>
            {loading ? <div className="mi-loading"><LoaderCircle className="mi-spin" size={18} />Cargando expediente sintético…</div> : <div className="mi-metrics">
              {basics.map((test) => {
                const latest = latestById.get(test.id);
                return <article className="mi-metric" key={test.id}>
                  <div><span>{test.title}</span><small>{test.group}</small></div>
                  <strong>{latest?.value == null ? '—' : Number(latest.value).toLocaleString('es-ES', { maximumFractionDigits: 2 })}<small>{latest ? ` ${latest.unit}` : ''}</small></strong>
                  <em>{latest ? `${latest.quality} · ${latest.is_synthetic ? 'sintético' : 'medido'}` : 'sin dato'}</em>
                </article>;
              })}
            </div>}
            <form className="mi-entry" onSubmit={saveMeasurement}>
              <div><span className="mi-eyebrow">REGISTRAR UNA MEDICIÓN DE PRUEBA</span><div className="mi-entry-fields">
                <label>Señal<select value={testId} onChange={(event) => setTestId(event.target.value)}>{basics.map((test) => <option key={test.id} value={test.id}>{test.title} ({test.unit})</option>)}</select></label>
                <label>Valor<input required type="number" step="any" value={value} onChange={(event) => setValue(event.target.value)} /></label>
                <label>Fecha y hora<input required type="datetime-local" value={measuredAt} onChange={(event) => setMeasuredAt(event.target.value)} /></label>
              </div></div>
              <button className="mi-secondary" disabled={busy}><Plus size={15} />Guardar sintético</button>
            </form>
          </section>

          <section className="mi-cycle-card">
            <div className="mi-cycle-icon"><Moon size={18} /></div>
            <div className="mi-cycle-content"><span className="mi-eyebrow">CONTEXTO HORMONAL DECLARADO</span><h2>{selectedProfile?.sex === 'female' && selectedProfile.cycle_status === 'active' ? `Ciclo: ${phaseText[evaluation?.cycle_phase ?? 'unknown'] ?? 'Sin evaluar'}` : 'Sin modificador menstrual activo'}</h2>
              <p>{selectedProfile?.sex === 'female' && selectedProfile.cycle_status === 'active' ? 'La fase se calcula desde una fecha declarada. Puede ayudar a contextualizar cambios personales de temperatura, HRV y frecuencia cardíaca; no confirma causas ni relaja medidas de seguridad.' : 'Al cambiar a un perfil femenino con ciclo activo, el motor muestra la fase declarada y usa solo los modificadores documentados.'}</p></div>
            {selectedProfile?.sex === 'female' && selectedProfile.cycle_status === 'active' && <form onSubmit={saveCycleEvent} className="mi-cycle-form"><label>Inicio declarado<input type="date" value={cycleDate} onChange={(event) => setCycleDate(event.target.value)} /></label><button className="mi-secondary" disabled={busy}><Plus size={14} />Registrar</button></form>}
          </section>

          <section className="mi-section mi-risk-section">
            <div className="mi-section-heading"><div><span className="mi-eyebrow">CAPA 2 · COMPROBACIONES ESPECÍFICAS</span><h2>Riesgos a vigilar</h2></div><span className="mi-source-chip">{evaluation?.model.name ?? 'Motor AEGIS'} · {evaluation?.model.version ?? 'reglas locales'}</span></div>
            {evaluation ? <>
              <div className="mi-engine-note"><FlaskConical size={15} /><span>Reglas transparentes, no modelo entrenado. Sin probabilidades de enfermedad ni diagnóstico. Calidad del modelo: {evaluation.model.validation_status.replaceAll('_', ' ')}.</span></div>
              {evaluation.emergencies?.length > 0 && <div className="mi-alert error"><ShieldAlert size={16} /><div><strong>Alerta declarada</strong>{evaluation.emergencies.map((item, index) => <p key={`${item.id}-${index}`}><strong>{item.title}:</strong> {item.explanation} {item.action}</p>)}</div></div>}
              <div className="mi-risks">{evaluation.assessments.map((assessment) => <article className={`mi-risk level-${assessment.alert_level}`} key={assessment.id}>
                <div className="mi-risk-title"><span className="mi-level-mark" /><div><h3>{assessment.risk_name}</h3><span>{levelText[assessment.alert_level]} · {assessment.certainty.replaceAll('_', ' ')}</span></div></div>
                <p>{assessment.explanation}</p>
                {assessment.missing_inputs.length > 0 && <small className="mi-missing">Faltan: {assessment.missing_inputs.join(', ')}</small>}
                {assessment.test_requests.length > 0 && <div className="mi-request"><strong><FlaskConical size={14} /> Comprobación sugerida</strong>{assessment.test_requests.map((item) => <p key={item.id}>{item.biomarker_id}: {item.reason}</p>)}</div>}
                {assessment.recommendations.length > 0 && <div className="mi-recommendations"><strong>Contramedidas documentales · pendientes de revisión médica</strong>{assessment.recommendations.map((item, index) => <p key={`${item.category}-${index}`}><b>{item.category === 'nutrition' ? 'Nutrición' : item.category === 'exercise' ? 'Ejercicio' : item.category}</b>{item.proposed_text ? ` · ${item.proposed_text}` : ` · ${item.display}`}<small>{item.note}</small></p>)}</div>}
              </article>)}</div>
            </> : <div className="mi-empty"><FlaskConical size={19} /><p>Ejecuta la evaluación para comparar señales con las referencias personales y mostrar qué comprobaciones hacen falta.</p></div>}
            {requests.length > 0 && <div className="mi-open-requests"><strong>Solicitudes abiertas</strong>{requests.map((item) => <p key={item.id}><span>{item.biomarker_id}</span> {item.status.replaceAll('_', ' ')} · {item.reason}</p>)}</div>}
            <div className="mi-medication-note"><ShieldAlert size={16} /><p><strong>Medicamentos:</strong> el sistema no recomienda melatonina, hipnóticos, antibióticos ni antihistamínicos. Cualquier fármaco requiere decisión del médico de vuelo y un protocolo revisado.</p></div>
          </section>

          <section className="mi-evidence">
            <div><span className="mi-eyebrow">DATOS ABIERTOS Y CONTEXTO · NO ENTRENAMIENTO CLÍNICO</span><p>OSDR publica estudios humanos de Inspiration4 con cuatro participantes y muestras de laboratorio de una misión de tres días; sirven para investigación exploratoria, pero no aportan volumen ni etiquetas diagnósticas suficientes para entrenar un modelo clínico de enfermedades. El acceso a datos médicos protegidos de NASA requiere solicitud y revisión. HRP y CSA aportan contexto, no etiquetas diagnósticas.</p></div>
            <div>{sourceLinks.map(([label, href]) => <a href={href} key={href} target="_blank" rel="noreferrer">{label}<span>↗</span></a>)}</div>
          </section>
          <p className="mi-footer-note">«Revisar datos» obtiene las pruebas que el backend ya haya recibido; todavía no se conecta directamente a analizadores o dispositivos. Los expedientes A-112/A-113 son sintéticos. Las entradas manuales se guardan como sintéticas y no se mezclan con datos reales. Esta herramienta no diagnostica ni sustituye al equipo médico de la misión.</p>
        </div>
      </section>
    </div>
  );
}
