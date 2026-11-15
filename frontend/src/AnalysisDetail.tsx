import type { Analysis, Biomarker } from './types';
import { statusText, fmt, dateTime } from './lib';
export default function AnalysisDetail({ a, d }: { a: Analysis; d?: Biomarker }) {
  return (
    <>
      <div className={`evaluation ${a.status}`}>
        <span className="status-dot" />
        {statusText[a.status]}
      </div>
      <dl className="detail-grid">
        {[
          ['Latest reading', `${fmt(a.latest?.value, 3)} ${d?.unit ?? ''}`],
          ['Data state', a.data_state],
          ['Accepted samples', a.n],
          ['Excluded samples', a.excluded],
          ['Mean', fmt(a.mean, 3)],
          ['Standard deviation', fmt(a.std, 3)],
          ['Median', fmt(a.median, 3)],
          ['MAD', fmt(a.mad, 3)],
          ['Trend / day', fmt(a.trend_per_day, 3)],
          [
            'Personal deviation',
            a.deviation_z == null ? 'Not estimable' : `${fmt(a.deviation_z, 2)} σ`,
          ],
          [
            'Previous baseline',
            a.baseline
              ? `${fmt(a.baseline.mean, 3)} ± ${fmt(a.baseline.std, 3)} · n=${a.baseline.n}`
              : 'Not available',
          ],
          ['Source', a.latest?.source ?? 'No acquisition'],
          ['Quality', a.latest?.quality ?? 'No acquisition'],
          [
            'Provenance',
            a.latest ? (a.latest.is_synthetic ? 'Synthetic' : 'Real') : 'No acquisition',
          ],
        ].map(([k, v]) => (
          <div key={String(k)}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <h3>Uncertainty</h3>
      <p className="muted">{a.uncertainty}</p>
      {a.quality_flags.map((q) => (
        <p className="amber small" key={q}>
          {q}
        </p>
      ))}
      {a.latest && (
        <p className="small muted">
          Timestamp: {dateTime(a.latest.timestamp)}
          <br />
          Method: {a.latest.measurement_method}
        </p>
      )}
      {a.baseline && (
        <p className="small muted">
          Baseline: {dateTime(a.baseline.start)} — {dateTime(a.baseline.end)}
          <br />
          {a.baseline.source}
        </p>
      )}
    </>
  );
}
