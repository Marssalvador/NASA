import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  Layers,
  Maximize2,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  Upload,
  UserRound,
  X,
} from 'lucide-react';

import { anatomySystems, CAMERA_DURATION_MS, evaluationColor } from './anatomyConfig';
import { buildMarkers, fmt, isDormant, shortName, statusText } from './lib';
import SensingRoute from './SensingRoute';
import type { Analysis } from './types';
import useMission from './useMission';
import SystemIcon from './SystemIcon';
import MissionDialogs from './MissionDialogs';
import type { DialogName } from './MissionDialogs';
import type { LayersState } from './AnatomyViewer';
import SystemMedia from './SystemMedia';
import SystemAssessment from './SystemAssessment';
import { prefetchSection, sectionMedia } from './sectionMedia';
import './anatomy.css';

const TrendPanel = lazy(() => import('./TrendPanel'));
const AnatomyViewer = lazy(() => import('./AnatomyViewer'));
const dataStateText: Record<string, string> = {
  stale: 'Medición caducada',
  missing: 'Medición ausente',
  poor_quality: 'Calidad insuficiente',
};
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
    error,
    refresh,
  } = mission;
  const [region, setRegion] = useState('heart'),
    [metric, setMetric] = useState('heart_rate'),
    [focused, setFocused] = useState(false);
  const [tab, setTab] = useState<'state' | 'trend' | 'detail'>('state'),
    [modal, setModal] = useState<DialogName>(null);
  const [back, setBack] = useState(false),
    [reset, setReset] = useState(0),
    [layersOpen, setLayersOpen] = useState(false);
  const [layers, setLayers] = useState<LayersState>({
    skin: true,
    muscles: true,
    skeleton: true,
    organs: true,
  });
  const system = anatomySystems.find((s) => s.id === region)!;
  const definitions = registry.filter((d) => d.body_region === region);
  const analyses =
    data?.analyses.filter((a) => definitions.some((d) => d.id === a.metric_id)) ?? [];
  const current = data?.analyses.find((a) => a.metric_id === metric),
    definition = registry.find((d) => d.id === metric);
  const regionalStatus = states[region] ?? 'insufficient_data';
  const pathways = data?.pathways ?? [];
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
    () => (data ? buildMarkers(data.analyses, registry, data.pathways) : []),
    [data, registry],
  );
  const markers = useMemo(
    () => (focused ? allMarkers.filter((m) => m.region === region) : allMarkers),
    [allMarkers, focused, region],
  );
  const isAlert = regionalStatus === 'review' || regionalStatus === 'emergency';
  const hasMedia = Boolean(sectionMedia[region]);
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
    setLayersOpen(false);
    setRegion(id);
    setFocused(true);
    setBack(false);
    setMetric(registry.find((d) => d.body_region === id)?.id ?? '');
    setTab('state');
    setReset((r) => r + 1);
  }
  function overview() {
    setFocused(false);
    setBack(false);
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
      ? 'No solicitada · se activa con una señal de capa 1'
      : [
          dataStateText[a.data_state],
          requested ? 'Solicitada por sensado' : null,
          a.latest ? (a.latest.is_synthetic ? 'Simulado' : 'Medido') : null,
          d.sensor_readiness === 'experimental' ? 'Sensor experimental' : null,
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
    <div className={`anatomy-app ${focused ? 'is-focused' : ''}`}>
      <header className="anatomy-topbar">
        <div className="anatomy-identity">
          <a href="/" className="anatomy-wordmark" aria-label="AEGIS inicio">
            AEGIS
          </a>
          <span className="anatomy-identity-divider" />
          <span className="anatomy-tagline">Gemelo fisiológico de misión</span>
        </div>
        <div className="anatomy-astronaut">
          <span>Astronauta</span>
          <label>
            <select
              aria-label="Seleccionar astronauta"
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
                    ? 'A-017'
                    : c.id === 'crew-02'
                      ? 'A-034'
                      : c.id === 'crew-03'
                        ? 'A-051'
                        : c.id}{' '}
                  · {c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={17} />
          </label>
          <button
            className="anatomy-profile-button"
            aria-label="Información del astronauta"
            onClick={() => setModal('model')}
          >
            <UserRound size={23} />
          </button>
        </div>
      </header>
      <section
        className={`anatomy-stage ${focused ? 'focused' : ''} ${focused && hasMedia ? 'has-media' : ''}`}
      >
        <Suspense fallback={<div className="anatomy-loader">Preparando visualización…</div>}>
          <AnatomyViewer
            markers={focused ? [] : markers}
            labels={false}
            selected={region}
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
            <SystemMedia region={region} />
          </div>
        )}
        {!focused && (
          <>
            <div className="anatomy-view-controls">
              <button
                aria-label="Volver al cuerpo completo"
                title="Cuerpo completo"
                onClick={overview}
              >
                <Maximize2 size={17} />
              </button>
              <button
                aria-label={back ? 'Vista anterior' : 'Vista posterior'}
                title={back ? 'Vista anterior' : 'Vista posterior'}
                onClick={() => {
                  setFocused(false);
                  setBack((b) => !b);
                  setReset((r) => r + 1);
                }}
              >
                <RotateCcw size={17} />
              </button>
              <button
                aria-label="Control de capas"
                title="Capas anatómicas"
                aria-expanded={layersOpen}
                onClick={() => setLayersOpen((o) => !o)}
              >
                <Layers size={17} />
              </button>
            </div>
            {layersOpen && (
              <div className="anatomy-layers">
                <div>
                  <strong>Capas anatómicas</strong>
                  <button aria-label="Cerrar capas" onClick={() => setLayersOpen(false)}>
                    <X size={15} />
                  </button>
                </div>
                {Object.entries({
                  skin: 'Piel',
                  muscles: 'Musculatura',
                  skeleton: 'Estructura ósea',
                  organs: 'Órganos y sistema nervioso',
                }).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={layers[key as keyof LayersState]}
                      onChange={(e) => setLayers({ ...layers, [key]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
            <div className="anatomy-gesture">
              <MousePointer2 size={13} />
              <span>Arrastra para girar · selecciona un sistema para acercar</span>
            </div>
          </>
        )}
      </section>
      <aside className="anatomy-navigation" aria-label="Sistemas corporales">
        {focused && (
          <button className="anatomy-back" onClick={overview}>
            <span>
              <ArrowLeft size={19} />
            </span>
            Vista general
          </button>
        )}
        {focused && (
          <label className="section-switch">
            <span>Sistema</span>
            <select
              aria-label="Cambiar sistema"
              value={region}
              onChange={(event) => selectRegion(event.target.value)}
            >
              {anatomySystems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="anatomy-system-buttons">
          {anatomySystems.map((s) => {
            const alert = states[s.id] === 'review' || states[s.id] === 'emergency';
            return (
              <button
                key={s.id}
                className={`anatomy-system ${region === s.id ? 'selected' : ''} ${alert ? 'has-alert' : ''}`}
                aria-pressed={region === s.id}
                onClick={() => selectRegion(s.id)}
                onPointerEnter={() => prefetchSection(s.id)}
                onFocus={() => prefetchSection(s.id)}
              >
                <SystemIcon id={s.id} />
                <span>{s.name}</span>
                {alert && <i style={{ background: evaluationColor[states[s.id]] }} />}
              </button>
            );
          })}
        </div>
        <div className="anatomy-mission-context">
          <span className="anatomy-small-label">MISIÓN ORBITAL-01</span>
          <strong>{data?.astronaut.name ?? 'Conectando…'}</strong>
          <span>
            {data?.astronaut.role} / {astronautCode}
          </span>
          <p className={`anatomy-overall-status ${data?.status ?? ''}`} aria-live="polite">
            {loading
              ? 'Actualizando observaciones…'
              : data
                ? statusText[data.status]
                : 'Preparando datos…'}
          </p>
          <span className="anatomy-demo-label">
            {data?.analyses.some((a) => a.latest && !a.latest.is_synthetic)
              ? 'Incluye mediciones reales · Investigación'
              : 'Datos sintéticos · Investigación'}
          </span>
        </div>
        <div className="anatomy-replay">
          <div>
            <button
              aria-label={playing ? 'Pausar reproducción' : 'Reproducir misión'}
              onClick={() => {
                if (day === 29) setDay(0);
                setPlaying((p) => !p);
              }}
            >
              {playing ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <span>Día {String(day).padStart(2, '0')}</span>
            <input
              aria-label="Día de misión"
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
              aria-label="Volver al presente"
              onClick={() => {
                setDay(29);
                setPlaying(false);
                refresh();
              }}
            >
              <RotateCcw size={13} />
            </button>
          </div>
          <span>Secuencia temporal de misión</span>
        </div>
        <details className="anatomy-data-menu">
          <summary>
            <Database size={14} />
            Datos de la misión
            <ChevronDown size={13} />
          </summary>
          <div>
            <button onClick={() => setModal('import')}>
              <Upload size={14} />
              Importar datos
            </button>
            <button onClick={() => void mission.download('json')}>
              <ArrowDownToLine size={14} />
              Exportar JSON
            </button>
            <button onClick={() => void mission.download('csv')}>
              <ArrowDownToLine size={14} />
              Exportar mediciones CSV
            </button>
            <button onClick={() => setModal('registry')}>
              <Settings2 size={14} />
              Registro de biomarcadores
            </button>
          </div>
        </details>
      </aside>
      <aside
        className={`anatomy-inspector ${focused ? 'focused' : ''}`}
        aria-label={`Información de ${system.name}`}
      >
        <div className="anatomy-system-heading">
          <span className={`anatomy-system-emblem ${isAlert ? 'alert' : ''}`}>
            <SystemIcon id={region} size={39} />
          </span>
          <div>
            <h1>{system.name}</h1>
            <p>{system.subtitle}</p>
          </div>
        </div>
        {error && (
          <div className="anatomy-error" role="alert">
            {error}
            <button onClick={refresh}>Reintentar</button>
          </div>
        )}
        {data?.status === 'emergency' && (
          <button className="anatomy-emergency" role="alert" onClick={() => setModal('protocols')}>
            <TriangleAlert size={19} />
            <span>Emergencia por síntoma declarado</span>
            <ChevronRight size={17} />
          </button>
        )}
        {
          <div className="anatomy-tabs" role="tablist" aria-label="Información del sistema">
            {(['state', 'trend', 'detail'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? 'selected' : ''}
                onClick={() => setTab(t)}
              >
                {t === 'state' ? 'Estado' : t === 'trend' ? 'Tendencia' : 'Detalle'}
              </button>
            ))}
          </div>
        }
        {tab === 'state' && (
          <>
            <div className="anatomy-metrics">
              {([1, 2] as const).map((layer) => {
                const rows = analyses.filter(
                  (a) =>
                    (definitions.find((d) => d.id === a.metric_id)?.sensing_layer ?? 1) === layer,
                );
                if (!rows.length) return null;
                return (
                  <div className="anatomy-metric-group" key={layer}>
                    <h3>
                      {layer === 1 ? 'Capa 1 · Vigilancia continua' : 'Capa 2 · Bajo demanda'}
                    </h3>
                    {rows.map(metricRow)}
                  </div>
                );
              })}
              {!analyses.length && (
                <p className="anatomy-empty">No hay biomarcadores habilitados para este sistema.</p>
              )}
            </div>
            {focused && (
              <SystemAssessment
                region={region}
                status={regionalStatus}
                analyses={analyses.filter((a) => !isDormant(a, registry, pathways))}
                guidance={data?.guidance ?? []}
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
                  <span>Sensado jerárquico</span>
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
          <Suspense fallback={<p className="anatomy-trend-footnote">Cargando gráfica…</p>}>
            <TrendPanel
              definitions={definitions}
              metric={metric}
              setMetric={setMetric}
              current={current}
              definition={definition}
              isAlert={isAlert}
              onDetail={() => setModal('detail')}
            />
          </Suspense>
        )}
        {tab === 'detail' && (
          <div className="anatomy-detail">
            <p>{system.description}</p>
            <div>
              {analyses.map((a) => (
                <button
                  key={a.metric_id}
                  onClick={() => {
                    setMetric(a.metric_id);
                    setModal('detail');
                  }}
                >
                  <span>{definitions.find((d) => d.id === a.metric_id)?.name}</span>
                  <small>
                    {a.latest ? (a.latest.is_synthetic ? 'Sintético' : 'Real') : 'Sin muestra'} ·{' '}
                    {a.data_state === 'stale'
                      ? 'Caducada'
                      : a.data_state === 'missing'
                        ? 'Ausente'
                        : (a.latest?.quality ?? 'Sin datos')}
                  </small>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
            <p>
              Las mallas pertenecen a un atlas genérico. No representan un escáner ni cambios
              anatómicos del astronauta.
            </p>
            <button className="anatomy-outline-button" onClick={() => setModal('model')}>
              Modelo e incertidumbre <ArrowUpRight size={14} />
            </button>
          </div>
        )}
      </aside>
      <footer className="anatomy-footer">
        <span>
          <span className="anatomy-local-dot" />
          Entorno local · Sin validación clínica
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
    </div>
  );
}
