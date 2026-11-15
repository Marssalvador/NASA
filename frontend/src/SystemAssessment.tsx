import { Activity, ShieldCheck } from 'lucide-react';
import type { Analysis, Biomarker, Guidance, Status } from './types';
import type { MuscleRegion } from './anatomyConfig';
import { fmt } from './lib';
import { monitoringContext } from './sectionMedia';

const muscleIndicatorIds = [
  'vastus_lateralis_thickness', 'hip_extensor_force', 'knee_extensor_force',
  'ankle_plantarflexor_force', 'grip_strength', 'eim_resistance_thigh',
  'eim_reactance_thigh', 'eim_phase_angle_thigh',
];

export default function SystemAssessment({
  region,
  status,
  analyses,
  guidance,
  registry,
  selectedRegion,
}: {
  region: string;
  status: Status;
  analyses: Analysis[];
  guidance: Guidance[];
  registry: Biomarker[];
  selectedRegion: MuscleRegion | null;
}) {
  const directIds = selectedRegion?.metricIds ?? registry
    .filter((item) => item.body_region === region)
    .map((item) => item.id);
  const direct = analyses.filter((item) => directIds.includes(item.metric_id));
  const availableDirect = direct.filter((item) => item.latest?.value != null);
  const muscleContext = region === 'muscles';
  const reference = muscleContext
    ? analyses.filter((item) => muscleIndicatorIds.includes(item.metric_id) && item.latest?.value != null)
    : [];
  const displayed = availableDirect.length ? availableDirect : reference;
  const isProxy = availableDirect.length === 0 && reference.length > 0;
  const flags = availableDirect.filter((item) => item.status === 'review' || item.status === 'emergency');
  const effectiveStatus: Status = flags.some((item) => item.status === 'emergency')
    ? 'emergency'
    : flags.length ? 'review'
      : availableDirect.length ? (status === 'review' || status === 'emergency' ? status : 'stable')
        : 'insufficient_data';
  const selectedIds = new Set(availableDirect.map((item) => item.metric_id));
  const reviewed = guidance.filter((item) => selectedIds.has(item.trigger) && item.validation_status === 'reviewed');
  const regionName = selectedRegion?.name ?? 'this system';
  const configuredDirect = selectedRegion ? selectedRegion.metricIds.length > 0 : directIds.length > 0;

  let interpretation: string;
  if (availableDirect.length) {
    const changes = availableDirect.filter((item) => item.deviation_z != null && Math.abs(item.deviation_z!) >= 2);
    const flaggedCount = availableDirect.filter((item) => item.status === 'review' || item.status === 'emergency').length;
    interpretation = flaggedCount
      ? `${flaggedCount} available ${flaggedCount === 1 ? 'measurement is' : 'measurements are'} flagged for review against the personal baseline. This is a monitoring signal, not a diagnosis.`
      : changes.length
        ? `${changes.length} available ${changes.length === 1 ? 'measurement differs' : 'measurements differ'} from the personal baseline and should be reviewed. This is a monitoring signal, not a diagnosis.`
        : `${availableDirect.length} ${availableDirect.length === 1 ? 'regional measurement is' : 'regional measurements are'} available. No current statistical deviation is flagged against the personal baseline.`;
  } else if (isProxy) {
    interpretation = `No direct measurement is configured for ${regionName}. Whole-body or other-region muscle indicators are shown for context and cannot quantify this area.`;
  } else {
    interpretation = configuredDirect
      ? `No current measurements are available for ${regionName}. Add a test to establish or update the personal baseline.`
      : `No region-specific sensor is configured for ${regionName}. A validated local strength or ultrasound measurement is needed before this area can be assessed.`;
  }

  const recommendation = reviewed.length
    ? reviewed.map((item) => item.suggested_check).join(' ')
    : availableDirect.length
      ? 'Repeat measurements with the same method and equipment. Use the Exercise tab for zone-specific options and follow the approved mission exercise plan.'
      : `Record a region-specific strength or ultrasound test when available. Use the Exercise tab for approved options; do not infer local muscle loss from measurements taken elsewhere.`;

  return (
    <section className="system-assessment" aria-label="Regional muscle interpretation">
      <div className={`assessment-summary status-${effectiveStatus}`}>
        <Activity size={22} strokeWidth={1.4} />
        <div>
          <h2>Interpretation · {regionName}</h2>
          <p>{interpretation}</p>
          {displayed.length > 0 && (
            <div className="assessment-readings" aria-label="Available muscle indicators">
              {displayed.slice(0, 5).map((item) => {
                const definition = registry.find((entry) => entry.id === item.metric_id);
                const change = item.deviation_z != null ? `Baseline deviation: ${fmt(item.deviation_z, 1)} SD` : 'No personal comparison';
                return (
                  <div className="assessment-reading" key={item.metric_id}>
                    <span>{definition?.name ?? item.metric_id}{isProxy ? ' · reference' : ''}</span>
                    <strong>{fmt(item.latest?.value, 2)} {definition?.unit ?? item.latest?.unit}</strong>
                    <small>{change} · {item.latest?.is_synthetic ? 'synthetic data' : 'measured data'}</small>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="assessment-recommendation">
        <ShieldCheck size={22} strokeWidth={1.4} />
        <div>
          <h2>Recommended next step</h2>
          <p>{recommendation}</p>
        </div>
      </div>
      <details>
        <summary>What this system monitors</summary>
        <p>{monitoringContext[region]}</p>
        <small>
          Monitoring design context. Available measurements and suggestions do not constitute a validated diagnosis.
        </small>
      </details>
    </section>
  );
}
