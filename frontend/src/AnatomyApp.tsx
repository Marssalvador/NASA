import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Droplet,
  FlaskConical,
  HeartPulse,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  FileHeart,
  Maximize2,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  Thermometer,
  Upload,
  Moon,
  Sun,
  UserRound,
  X,
} from 'lucide-react';

import { anatomySystems, CAMERA_DURATION_MS, evaluationColor, muscleRegions } from './anatomyConfig';
import { buildMarkers, fmt, isDormant, shortName, statusText } from './lib';
import MedicalIntelligence from './MedicalIntelligence';
import SensingRoute from './SensingRoute';
import type { Analysis } from './types';
import useMission from './useMission';
import SystemIcon from './SystemIcon';
import MissionDialogs from './MissionDialogs';
import type { DialogName } from './MissionDialogs';
import type { LayersState } from './AnatomyViewer';
import SystemMedia from './SystemMedia';
import SystemAssessment from './SystemAssessment';
import { sectionMediaFor } from './sectionMedia';
import { ExercisePanel, RiskParametersPanel } from './PerformancePanels';
import AtlasTile from './AtlasTile';
import type { Theme } from './sectionMedia';
import './anatomy.css';

const AnatomyViewer = lazy(() => import('./AnatomyViewer'));
const THEME_KEY = 'helios.theme';
/** Saved choice first; new installations open in the mission dark theme. */
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* private mode or blocked storage: keep the dark default */
  }
  return 'dark';
}
const dataStateText: Record<string, string> = {
  stale: 'Stale measurement',
  missing: 'Missing measurement',
  poor_quality: 'Insufficient quality',
};
const continuousSignals = new Set([
  'heart_rate', 'glucose', 'sweat_rate', 'skin_temperature', 'lactate', 'beta_hydroxybutyrate',
]);
export default function AnatomyApp() {
  const mission = useMission();
  const {
    crew,
    registry,
    subject,
    setSubject,
    data,
    states,
    day,
    setDay,
    playing,
    setPlaying,
    loading,
    usingSimulation,
    refresh,
  } = mission;
  const [region, setRegion] = useState('muscles'),
    [metric, setMetric] = useState('grip_strength'),
    [focused, setFocused] = useState(false);
  // Start with the whole-body overview; regional exercise illustrations appear after a region is selected.
  const [muscleZone, setMuscleZone] = useState<string | null>(null);
  const [tab, setTab] = useState<'state' | 'trend' | 'detail'>('detail'),
    [modal, setModal] = useState<DialogName>(null);
  const [back, setBack] = useState(false),
    [reset, setReset] = useState(0),
    [medicalOpen, setMedicalOpen] = useState(false);
  const layers: LayersState = {
    skin: false,
    muscles: true,
    skeleton: false,
    organs: false,
  };
  const system = anatomySystems.find((s) => s.id === region)!;
  const selectedCrew = crew.find((astronaut) => astronaut.id === subject);
  const selectedSex = selectedCrew?.sex ?? (subject === 'crew-01' ? 'female' : subject === 'crew-02' ? 'male' : 'unspecified');
  const medicalProfileCode = selectedSex === 'female' ? 'A-112' : 'A-113';
  const selectedMuscleRegion = muscleRegions.find((item) => item.id === muscleZone);
  const muscleAtlasIndex = selectedMuscleRegion
    ? muscleRegions.findIndex((item) => item.id === selectedMuscleRegion.id)
    : -1;
  const definitions = registry.filter(
    (d) =>
      continuousSignals.has(d.id) ||
      (d.body_region === region &&
        (!selectedMuscleRegion || selectedMuscleRegion.metricIds.includes(d.id))),
  );
  const analyses =
    data?.analyses.filter((a) => definitions.some((d) => d.id === a.metric_id)) ?? [];
  const current = data?.analyses.find((a) => a.metric_id === metric),
    definition = registry.find((d) => d.id === metric);
  const ultrasound = data?.analyses.find((a) => a.metric_id === 'vastus_lateralis_thickness');
  const signalRows = [
    { id: 'sweat_rate', name: 'Sweat rate', Icon: Droplet, digits: 2 },
    { id: 'temperature', name: 'Core temperature', Icon: Thermometer, digits: 2 },
    { id: 'skin_temperature', name: 'Skin temperature', Icon: Thermometer, digits: 2 },
    { id: 'heart_rate', name: 'Heart rate', Icon: HeartPulse, digits: 1 },
    { id: 'glucose', name: 'Glucose concentration', Icon: FlaskConical, digits: 2 },
    { id: 'lactate', name: 'Lactate concentration', Icon: FlaskConical, digits: 2 },
    { id: 'beta_hydroxybutyrate', name: 'β-hydroxybutyrate', Icon: FlaskConical, digits: 2 },
  ];
  const thicknessChangePct =
    ultrasound?.baseline?.mean && ultrasound.latest?.value != null
      ? ((ultrasound.latest.value - ultrasound.baseline.mean) / ultrasound.baseline.mean) * 100
      : null;
  const zoneAnalyses = selectedMuscleRegion
    ? analyses.filter((a) => selectedMuscleRegion.metricIds.includes(a.metric_id))
    : analyses;
  const regionalStatus = selectedMuscleRegion
    ? zoneAnalyses.some((a) => a.status === 'emergency')
      ? 'emergency'
      : zoneAnalyses.some((a) => a.status === 'review')
        ? 'review'
        : zoneAnalyses.length
          ? 'stable'
          : 'insufficient_data'
    : states[region] ?? 'insufficient_data';
  const pathways = data?.pathways ?? [];
  useEffect(() => {
    if (!selectedMuscleRegion || selectedMuscleRegion.metricIds.includes(metric) || continuousSignals.has(metric)) return;
    setMetric(selectedMuscleRegion.metricIds[0] ?? 'heart_rate');
  }, [selectedMuscleRegion, metric]);
  // Routes touching this system: its own first, then the ones currently asking for data.
  const activeStage = (stage: string) => (stage === 'quiet' || stage === 'unmonitored' ? 1 : 0);
  const routes = pathways
    .filter(
      (p) =>
        p.body_region === region ||
        [...p.triggers, ...p.confirmations.map((c) => c.metric_id)].some((id) =>
          definitions.some((d) => d.id === id),
        ),
    )
    .sort(
      (a, b) =>
        Number(b.body_region === region) - Number(a.body_region === region) ||
        activeStage(a.stage) - activeStage(b.stage),
    );
  const allMarkers = useMemo(
    () =>
      data
        ? buildMarkers(data.analyses, registry, data.pathways).filter((marker) => marker.region === 'muscles')
        : [],
    [data, registry],
  );
  const markers = useMemo(
    () => (focused ? allMarkers.filter((m) => m.region === region) : allMarkers),
    [allMarkers, focused, region],
  );
  const isAlert = regionalStatus === 'review' || regionalStatus === 'emergency';
  const [theme, setTheme] = useState<Theme>(initialTheme);
  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* the choice still applies to this session */
    }
  }
  const hasMedia = region !== 'muscles' && Boolean(sectionMediaFor(region, theme));
  // Section entry: the 3D camera zooms to the system, holds briefly, then the media fades in.
  const [mediaShown, setMediaShown] = useState(false);
  useEffect(() => {
    setMediaShown(false);
    if (!focused) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setMediaShown(true), reduce ? 0 : 30);
    return () => window.clearTimeout(timer);
  }, [focused, region]);
  function selectRegion(id: string) {
    setRegion(id);
    setFocused(true);
    setBack(false);
    setMetric(registry.find((d) => d.body_region === id)?.id ?? '');
    setTab('state');
    setReset((r) => r + 1);
  }
  function selectMuscleZone(id: string) {
    setMuscleZone(id);
    selectRegion('muscles');
    const next = muscleRegions.find((item) => item.id === id);
    setMetric(next?.metricIds[0] ?? 'heart_rate');
  }
  function overview() {
    setFocused(false);
    setBack(false);
    setMuscleZone(null);
    setReset((r) => r + 1);
  }
  const astronautCode =
    subject === 'crew-01'
      ? 'A-017'
      : subject === 'crew-02'
        ? 'A-034'
        : subject === 'crew-03'
          ? 'A-051'
          : subject;

  function metricRow(a: Analysis) {
    const d = definitions.find((x) => x.id === a.metric_id)!;
    const dormant = isDormant(a, registry, pathways);
    const requested = pathways.some((p) =>
      p.confirmations.some((c) => c.metric_id === a.metric_id && c.state === 'requested'),
    );
    const deviation =
      a.baseline && a.latest?.value != null && a.baseline.mean !== 0
        ? ((a.latest.value - a.baseline.mean) / Math.abs(a.baseline.mean)) * 100
        : null;
    const caption = dormant
      ? 'Not requested · activates after a Layer 1 signal'
      : [
          dataStateText[a.data_state],
          requested ? 'Requested by sensing pathway' : null,
          a.latest ? (a.latest.is_synthetic ? 'Simulated' : 'Measured') : null,
          d.sensor_readiness === 'experimental' ? 'Experimental sensor' : null,
        ]
          .filter(Boolean)
          .join(' · ');
    return (
      <button
        className={`anatomy-metric ${dormant ? 'dormant' : ''}`}
        key={a.metric_id}
        onClick={() => {
          setMetric(a.metric_id);
          setModal('detail');
        }}
      >
        <span className="anatomy-metric-icon">
          <Activity size={22} strokeWidth={1.3} />
        </span>
        <span className="anatomy-metric-name">
          <span>{shortName(d)}</span>
          {caption && <small className="anatomy-metric-caption">{caption}</small>}
        </span>
        <span className="anatomy-metric-reading">
          {fmt(a.latest?.value, d.unit === 'ng/mL' ? 2 : 1)} <small>{d.unit}</small>
        </span>
        {deviation != null && a.status === 'review' ? (
          <span className="anatomy-deviation">
            {deviation > 0 ? '▲ +' : '▼ '}
            {fmt(deviation, 0)} %
          </span>
        ) : (
          <span
            className="anatomy-status-indicator"
            style={{ background: dormant ? 'transparent' : evaluationColor[a.status] }}
            title={dormant ? 'No solicitada' : statusText[a.status]}
          />
        )}
      </button>
    );
  }

  return (
    <div className={`anatomy-app ${focused ? 'is-focused' : ''}`} data-theme={theme}>
      <header className="anatomy-topbar">
        <div className="anatomy-identity">
          <a href="/" className="anatomy-wordmark" aria-label="HELIOS inicio">
            HELIOS
          </a>
          <span className="anatomy-identity-divider" />
          <span className="anatomy-tagline">Physiological mission twin</span>
        </div>
        <div className="anatomy-astronaut">
            <span>Astronaut</span>
          <label>
            <select
              aria-label="Select astronaut"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setDay(29);
                setPlaying(false);
              }}
            >
              {crew.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id === 'crew-01'
                    ? 'A-017 · Woman'
                    : c.id === 'crew-02'
                      ? 'A-034 · Man'
                      : c.id === 'crew-03'
                        ? `A-051 · ${c.sex === 'female' ? 'Woman' : c.sex === 'male' ? 'Man' : 'Sex not specified'}`
                        : c.id}{' '}
                  · {c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={17} />
          </label>
          <button
            className="anatomy-theme-toggle"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            className="anatomy-profile-button"
            aria-label="Astronaut information"
            onClick={() => setModal('model')}
          >
            <UserRound size={23} />
          </button>
          <button
            className="anatomy-medical-button"
            aria-label="Open mission medical intelligence"
            onClick={() => setMedicalOpen(true)}
          >
            <FileHeart size={18} />
            <span>Medical AI</span>
          </button>
        </div>
      </header>
      <section
        className={`anatomy-stage ${focused ? 'focused' : ''} ${focused && hasMedia ? 'has-media' : ''}`}
      >
        <Suspense fallback={<div className="anatomy-loader">Preparing visualization…</div>}>
          <AnatomyViewer
            markers={focused ? [] : markers}
            labels={false}
            theme={theme}
            selected={region}
            cameraFocus={
              focused && muscleZone
                ? `muscle_${muscleRegions.find((item) => item.id === muscleZone)?.target}`
                : undefined
            }
            selectedMuscleZone={muscleZone}
            focused={focused && !hasMedia}
            isolate={false}
            states={states}
            onSelect={selectRegion}
            layers={layers}
            back={back}
            reset={reset}
          />
        </Suspense>
        {focused && hasMedia && (
          <div
            className={`stage-media ${mediaShown ? 'shown' : ''}`}
            aria-hidden={!mediaShown}
            data-shown={mediaShown}
          >
            <SystemMedia key={theme} region={region} theme={theme} />
          </div>
        )}
        {!focused && (
          <>
            <div className="anatomy-view-controls">
              <button
                aria-label="Return to full body view"
                title="Full body"
                onClick={overview}
              >
                <Maximize2 size={17} />
              </button>
              <button
                aria-label={back ? 'Front view' : 'Back view'}
                title={back ? 'Front view' : 'Back view'}
                onClick={() => {
                  setFocused(false);
                  setBack((b) => !b);
                  setReset((r) => r + 1);
                }}
              >
                <RotateCcw size={17} />
              </button>
            </div>
            <div className="anatomy-gesture">
              <MousePointer2 size={13} />
              <span>Drag to rotate · select a region to zoom in</span>
            </div>
          </>
        )}
      </section>
      <aside className="anatomy-navigation" aria-label="Body systems">
        {focused && (
          <button className="anatomy-back" onClick={overview}>
            <span>
              <ArrowLeft size={19} />
            </span>
            Overview
          </button>
        )}
        <section className="anatomy-signal-panel" aria-label="Physiological parameters">
          <div className="anatomy-signal-heading">
            <span>PARAMETERS</span>
            <small>{usingSimulation ? 'LOCAL SIMULATION' : 'DATA RECEIVED'}</small>
          </div>
          {signalRows.map(({ id, name, Icon, digits }) => {
            const analysis = data?.analyses.find((item) => item.metric_id === id);
            const marker = registry.find((item) => item.id === id);
            const value = analysis?.latest?.value;
            return (
              <button className="anatomy-signal-row" key={id} onClick={() => { setMetric(id); setModal('detail'); }}>
                <Icon size={19} aria-hidden="true" />
                <span className="anatomy-signal-copy">
                  <small>{name}</small>
                  <strong>{value == null ? '—' : fmt(value, digits)} <em>{marker?.unit ?? ''}</em></strong>
                  {value == null && <i>No measurement</i>}
                </span>
                <ChevronRight size={15} />
              </button>
            );
          })}
        </section>
        <details className="anatomy-zone-picker" open>
          <summary><span>Muscle regions</span><ChevronDown size={14} /></summary>
          <div className="anatomy-system-buttons">
          {muscleRegions.map((s) => {
            const alert = states.muscles === 'review' || states.muscles === 'emergency';
            return (
              <button
                key={s.id}
                className={`anatomy-system ${muscleZone === s.id ? 'selected' : ''} ${alert ? 'has-alert' : ''}`}
                aria-pressed={muscleZone === s.id}
                onClick={() => selectMuscleZone(s.id)}
              >
                <SystemIcon id="muscles" />
                <span>{s.name}</span>
                {alert && <i style={{ background: evaluationColor[states.muscles] }} />}
              </button>
            );
          })}
          </div>
        </details>
        <div className="anatomy-mission-context">
          <span className="anatomy-small-label">MISSION ORBITAL-01</span>
          <strong>{data?.astronaut.name ?? 'Connecting…'}</strong>
          <span>
            {data?.astronaut.role} / {astronautCode}
          </span>
          {selectedSex === 'female' && (
            <span className="anatomy-cycle-note">Female profile · cycle declared in Medical AI</span>
          )}
          <p className={`anatomy-overall-status ${data?.status ?? ''}`} aria-live="polite">
            {loading
              ? 'Updating observations…'
              : data
                ? statusText[data.status]
                : 'Preparing data…'}
          </p>
          <span className="anatomy-demo-label">
            {data?.analyses.some((a) => a.latest && !a.latest.is_synthetic)
              ? 'Includes real measurements · Research'
              : 'Synthetic data · Research'}
          </span>
        </div>
        <div className="anatomy-replay">
          <div>
            <button
              aria-label={playing ? 'Pause playback' : 'Play mission'}
              onClick={() => {
                if (day === 29) setDay(0);
                setPlaying((p) => !p);
              }}
            >
              {playing ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <span>Day {String(day).padStart(2, '0')}</span>
            <input
              aria-label="Mission day"
              type="range"
              min="0"
              max="29"
              value={day}
              onChange={(e) => {
                setPlaying(false);
                setDay(Number(e.target.value));
              }}
            />
            <button
              aria-label="Return to present"
              onClick={() => {
                setDay(29);
                setPlaying(false);
                refresh();
              }}
            >
              <RotateCcw size={13} />
            </button>
          </div>
          <span>Mission timeline</span>
        </div>
        <details className="anatomy-data-menu">
          <summary>
            <Database size={14} />
            Mission data
            <ChevronDown size={13} />
          </summary>
          <div>
            <button onClick={() => setModal('import')}>
              <Upload size={14} />
              Import data
            </button>
            <button onClick={() => void mission.download('json')}>
              <ArrowDownToLine size={14} />
              Export JSON
            </button>
            <button onClick={() => void mission.download('csv')}>
              <ArrowDownToLine size={14} />
              Export measurements CSV
            </button>
            <button onClick={() => setModal('registry')}>
              <Settings2 size={14} />
              Biomarker registry
            </button>
          </div>
        </details>
      </aside>
      <aside
        className={`anatomy-inspector ${focused ? 'focused' : ''}`}
        aria-label={`Information for ${selectedMuscleRegion?.name ?? system.name}`}
      >
        <div className="anatomy-system-heading">
          <span className={`anatomy-system-emblem ${isAlert ? 'alert' : ''}`}>
            <SystemIcon id={region} size={39} />
          </span>
          <div>
            <h1>{tab === 'detail' ? 'Conditions to assess' : selectedMuscleRegion?.name ?? system.name}</h1>
            <p>{tab === 'detail' ? 'Risks and follow-up tests' : system.subtitle}</p>
          </div>
        </div>
        {selectedMuscleRegion && muscleAtlasIndex >= 0 && (
          <section className="anatomy-selected-region-visual" aria-label={`Illustration of ${selectedMuscleRegion.name}`}>
            <div className="anatomy-selected-region-visual-heading">
              <span>{selectedMuscleRegion.name} anatomy</span>
              <small>Illustrative view</small>
            </div>
            <AtlasTile
              className="anatomy-selected-region-tile"
              asset="/media/muscle-radiograph-atlas.png"
              index={muscleAtlasIndex}
              label={`Illustrative anatomy of ${selectedMuscleRegion.name}`}
            />
          </section>
        )}
        {data?.status === 'emergency' && (
          <button className="anatomy-emergency" role="alert" onClick={() => setModal('protocols')}>
            <TriangleAlert size={19} />
            <span>Emergency based on a reported symptom</span>
            <ChevronRight size={17} />
          </button>
        )}
        {
          <div className="anatomy-tabs" role="tablist" aria-label="System information">
            {(['state', 'trend', 'detail'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? 'selected' : ''}
                onClick={() => setTab(t)}
              >
                {t === 'state' ? 'Status' : t === 'trend' ? 'Exercise' : 'Parameters'}
              </button>
            ))}
          </div>
        }
        {tab === 'state' && (
          <>
            <section className="anatomy-mass-card" aria-label="Muscle change by ultrasound">
              <div className="anatomy-ultrasound-frame">
                <img className="anatomy-ultrasound-image" src="/media/ultrasound-muscle-demo.png" alt="Fictional muscle ultrasound for demonstration" />
                <span>Fictional ultrasound · demonstration</span>
              </div>
              <div>
                <span className="anatomy-small-label">MUSCLE CHANGE · ULTRASOUND</span>
                <strong className={thicknessChangePct != null && thicknessChangePct < 0 ? 'loss' : ''}>
                  {thicknessChangePct == null
                    ? 'No ultrasound available'
                    : `${thicknessChangePct > 0 ? '+' : ''}${fmt(thicknessChangePct, 1)}%`}
                </strong>
              </div>
              <p>
                {thicknessChangePct == null
                  ? 'Record vastus lateralis thickness using the same protocol for comparison.'
                  : `${thicknessChangePct < 0 ? 'Decrease' : thicknessChangePct > 0 ? 'Increase' : 'No change'} in ultrasound thickness versus the personal baseline. This is a regional indicator, not total body muscle mass.`}
              </p>
              <small>
                {ultrasound?.latest?.is_synthetic ? 'Synthetic demonstration series' : 'Longitudinal ultrasound'}
                {' · '}EIM and strength complement the assessment but do not estimate muscle mass in grams on their own.
              </small>
            </section>
            <div className="anatomy-metrics">
              {selectedMuscleRegion && (
                <p className="anatomy-region-scope">{selectedMuscleRegion.scope}</p>
              )}
              {([1, 2] as const).map((layer) => {
                const rows = analyses.filter(
                  (a) =>
                    (definitions.find((d) => d.id === a.metric_id)?.sensing_layer ?? 1) === layer,
                );
                if (!rows.length) return null;
                return (
                  <div className="anatomy-metric-group" key={layer}>
                    <h3>
                      {layer === 1 ? 'Layer 1 · Continuous monitoring' : 'Layer 2 · On demand'}
                    </h3>
                    {rows.map(metricRow)}
                  </div>
                );
              })}
              {!analyses.length && (
                <p className="anatomy-empty">
                  {selectedMuscleRegion
                    ? 'No measurements are available for this region.'
                    : 'No biomarkers are enabled for this system.'}
                </p>
              )}
            </div>
            {focused && (
              <SystemAssessment
                region={region}
                status={regionalStatus}
                analyses={data?.analyses ?? []}
                guidance={data?.guidance ?? []}
                registry={registry}
                selectedRegion={selectedMuscleRegion ?? null}
              />
            )}
            {routes.length > 0 &&
              (focused ? (
                <div className="sensing-routes">
                  {routes.map((r) => (
                    <SensingRoute
                      key={r.id}
                      route={r}
                      registry={registry}
                      analyses={data?.analyses ?? []}
                      guidance={data?.guidance ?? []}
                      onMetric={(id) => {
                        setMetric(id);
                        setModal('detail');
                      }}
                      onProtocols={() => setModal('protocols')}
                    />
                  ))}
                </div>
              ) : (
                <button
                  className="sensing-summary"
                  onClick={() => {
                    setFocused(true);
                    setReset((r) => r + 1);
                  }}
                >
                  <span>Hierarchical sensing</span>
                  {routes.map((r) => (
                    <strong key={r.id} className={`stage-${r.stage}`}>
                      {r.name}
                    </strong>
                  ))}
                  <ChevronRight size={15} />
                </button>
              ))}
          </>
        )}
        {tab === 'trend' && (
          <ExercisePanel region={selectedMuscleRegion ?? null} astronautId={subject} analyses={data?.analyses ?? []} />
        )}
        {tab === 'detail' && (
          <div className="anatomy-detail">
            <RiskParametersPanel analyses={data?.analyses ?? []} registry={registry} />
            <p>The 3D atlas is a generic anatomical reference; it is not an ultrasound or a scan of the astronaut.</p>
          </div>
        )}
      </aside>
      <footer className="anatomy-footer">
        <span>
          <span className="anatomy-local-dot" />
          Local environment · Not clinically validated
        </span>
        <button onClick={() => setModal('credits')}>
          Z-Anatomy / BodyParts3D <CircleHelp size={12} />
        </button>
      </footer>
      <MissionDialogs
        modal={modal}
        onClose={() => setModal(null)}
        mission={mission}
        current={current}
        definition={definition}
      />
      {medicalOpen && <MedicalIntelligence initialCode={medicalProfileCode} onClose={() => setMedicalOpen(false)} />}
    </div>
  );
}
