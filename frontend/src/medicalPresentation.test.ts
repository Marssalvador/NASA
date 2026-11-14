import { describe, it, expect } from 'vitest';
import { present } from './medicalPresentation';
import type { Presentation } from './medicalTypes';
const snapshot = () =>
  ({
    code: 'P-000',
    session_id: 'run',
    mission_start: '2026-10-15T00:00:00Z',
    as_of: '2026-11-07T20:01:00Z',
    registry: [{ id: 'systolic_bp', unit: 'mmHg', body_region: 'heart' }],
    latest: [{ id: 9, biomarker_id: 'systolic_bp', value: 140, is_synthetic: true }],
    references: { systolic_bp: { status: 'accepted', center: 114, spread: 3, n: 11 } },
    series: {},
    requests: [],
    report: {
      engine: 'aegis-rules',
      model_error: null,
      data_states: { systolic_bp: 'available' },
      anomalies: [],
      assessments: [
        {
          id: 'a',
          body_region: 'heart',
          alert_level: 'yellow',
          explanation: 'Motor',
          confirmations: { systolic_bp: { state: 'deviates', fresh: true } },
        },
      ],
      emergencies: [],
    },
  }) as unknown as Presentation;
describe('medical presentation is a mapping of backend findings', () => {
  it('highlights the deviating secondary measurement confirmed by the engine', () => {
    const view = present(snapshot());
    expect(view.data.analyses[0].status).toBe('review');
    expect(view.states.heart).toBe('review');
    expect(view.states.brain).toBe('insufficient_data');
  });
  it('does not turn unavailable observations into normal readings', () => {
    const s = snapshot();
    s.report.data_states.systolic_bp = 'poor_quality';
    expect(present(s).data.analyses[0].status).toBe('insufficient_data');
    s.report.data_states.systolic_bp = 'stale';
    expect(present(s).data.analyses[0].status).toBe('insufficient_data');
  });
});
