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
  not_requested: 'Not requested',
  requested: 'Requested',
  within_pattern: 'Within pattern',
  deviates: 'Deviates',
};
const stageText: Record<PathwayStage, string> = {
  quiet: 'Layer 1 is stable; no additional measurement is indicated.',
  unmonitored: 'Layer 1 does not have enough data to decide.',
  requested: 'Layer 1 signal detected. The requested Layer 2 measurement is pending.',
  not_confirmed: 'Layer 2 did not confirm the Layer 1 signal.',
  review: 'Layer 2 confirms the Layer 1 deviation.',
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
    <section className={`sensing-route stage-${route.stage}`} aria-label={`Pathway ${route.name}`}>
      <header>
        <h2>{route.name}</h2>
        {route.demonstration && <span className="sensing-badge">Demonstration pathway</span>}
      </header>
      <ol>
        <li className={route.triggered_by.length ? 'is-hit' : ''}>
          <span className="sensing-step">Layer 1 · Continuous signal</span>
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
              <span key={label} className="sensing-chip planned" title="Proposed; no data">
                {label}
              </span>
            ))}
          </div>
        </li>
        <li className={active ? 'is-hit' : ''}>
          <span className="sensing-step">Anomaly</span>
          <p>
            {route.triggered_by.length
              ? `Deviation from the personal pattern in ${route.triggered_by.map(name).join(', ')}.`
              : 'No deviation in Layer 1 signals.'}
          </p>
        </li>
        <li className={route.confirmations.some((c) => c.state !== 'not_requested') ? 'is-hit' : ''}>
          <span className="sensing-step">Layer 2 · Triggered measurement</span>
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
          <span className="sensing-step">Interpretation</span>
          <p>{stageText[route.stage]}</p>
        </li>
        <li>
          <span className="sensing-step">Recommendation</span>
          <p>{reviewed ? reviewed.suggested_check : 'Pending medical review'}</p>
          <button className="sensing-link" onClick={onProtocols}>
            References and authorization <ArrowUpRight size={12} />
          </button>
        </li>
      </ol>
      <p className="sensing-evidence">{route.evidence}</p>
    </section>
  );
}
