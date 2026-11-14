import { ArrowUpRight } from 'lucide-react';
import { shortName } from './lib';
import type {
  Analysis,
  Biomarker,
  ConfirmationStateName,
  Guidance,
  PathwayStage,
  RiskPathway,
} from './types';

const confirmationText: Record<ConfirmationStateName, string> = {
  not_requested: 'No solicitada',
  requested: 'Solicitada',
  within_pattern: 'Dentro del patrón',
  deviates: 'Desviada',
};
const stageText: Record<PathwayStage, string> = {
  quiet: 'Capa 1 estable: no se justifica medir más.',
  unmonitored: 'Capa 1 sin datos suficientes para decidir.',
  requested: 'Señal en capa 1. Falta la medición de capa 2 solicitada.',
  not_confirmed: 'Señal en capa 1 que la capa 2 no confirma.',
  review: 'La capa 2 confirma la desviación de la capa 1.',
};

/**
 * The hierarchical sensing ladder for one risk route:
 * continuous signal → anomaly → triggered acquisition → interpretation → recommendation.
 * Everything shown is computed by the backend; this component only lays it out.
 */
export default function SensingRoute({
  route,
  registry,
  analyses,
  guidance,
  onMetric,
  onProtocols,
}: {
  route: RiskPathway;
  registry: Biomarker[];
  analyses: Analysis[];
  guidance: Guidance[];
  onMetric: (id: string) => void;
  onProtocols: () => void;
}) {
  const name = (id: string) => {
    const d = registry.find((x) => x.id === id);
    return d ? shortName(d) : id;
  };
  const status = (id: string) => analyses.find((a) => a.metric_id === id)?.status;
  const metrics = new Set([...route.triggers, ...route.confirmations.map((c) => c.metric_id)]);
  const reviewed = guidance.find(
    (g) => g.validation_status === 'reviewed' && metrics.has(g.trigger),
  );
  const active = route.stage !== 'quiet' && route.stage !== 'unmonitored';
  return (
    <section className={`sensing-route stage-${route.stage}`} aria-label={`Ruta ${route.name}`}>
      <header>
        <h2>{route.name}</h2>
        {route.demonstration && <span className="sensing-badge">Ruta demostrativa</span>}
      </header>
      <ol>
        <li className={route.triggered_by.length ? 'is-hit' : ''}>
          <span className="sensing-step">Capa 1 · Señal continua</span>
          <div className="sensing-chips">
            {route.triggers.map((id) => (
              <button
                key={id}
                className={`sensing-chip ${route.triggered_by.includes(id) ? 'hit' : ''} ${status(id) === 'insufficient_data' ? 'faint' : ''}`}
                onClick={() => onMetric(id)}
              >
                {name(id)}
              </button>
            ))}
            {route.planned_signals.map((label) => (
              <span key={label} className="sensing-chip planned" title="Propuesta; sin datos">
                {label}
              </span>
            ))}
          </div>
        </li>
        <li className={active ? 'is-hit' : ''}>
          <span className="sensing-step">Anomalía</span>
          <p>
            {route.triggered_by.length
              ? `Desviación del patrón personal en ${route.triggered_by.map(name).join(', ')}.`
              : 'Sin desviación en las señales de capa 1.'}
          </p>
        </li>
        <li className={route.confirmations.some((c) => c.state !== 'not_requested') ? 'is-hit' : ''}>
          <span className="sensing-step">Capa 2 · Medición activada</span>
          <div className="sensing-chips">
            {route.confirmations.map((c) => (
              <button
                key={c.metric_id}
                className={`sensing-chip state-${c.state}`}
                onClick={() => onMetric(c.metric_id)}
              >
                {name(c.metric_id)} <em>{confirmationText[c.state]}</em>
              </button>
            ))}
          </div>
        </li>
        <li className={route.stage === 'review' ? 'is-hit' : ''}>
          <span className="sensing-step">Interpretación</span>
          <p>{stageText[route.stage]}</p>
        </li>
        <li>
          <span className="sensing-step">Recomendación</span>
          <p>{reviewed ? reviewed.suggested_check : 'Pendiente de revisión médica'}</p>
          <button className="sensing-link" onClick={onProtocols}>
            Referencias y autorización <ArrowUpRight size={12} />
          </button>
        </li>
      </ol>
      <p className="sensing-evidence">{route.evidence}</p>
    </section>
  );
}
