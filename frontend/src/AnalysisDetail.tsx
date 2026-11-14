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
          ['Última adquisición', `${fmt(a.latest?.value, 3)} ${d?.unit ?? ''}`],
          ['Estado de datos', a.data_state],
          ['Muestras aceptadas', a.n],
          ['Muestras excluidas', a.excluded],
          ['Media', fmt(a.mean, 3)],
          ['Desviación estándar', fmt(a.std, 3)],
          ['Mediana', fmt(a.median, 3)],
          ['MAD', fmt(a.mad, 3)],
          ['Tendencia / día', fmt(a.trend_per_day, 3)],
          [
            'Desviación personal',
            a.deviation_z == null ? 'No estimable' : `${fmt(a.deviation_z, 2)} σ`,
          ],
          [
            'Baseline previo',
            a.baseline
              ? `${fmt(a.baseline.mean, 3)} ± ${fmt(a.baseline.std, 3)} · n=${a.baseline.n}`
              : 'No disponible',
          ],
          ['Origen', a.latest?.source ?? 'Sin adquisición'],
          ['Calidad', a.latest?.quality ?? 'Sin adquisición'],
          [
            'Procedencia',
            a.latest ? (a.latest.is_synthetic ? 'Sintética' : 'Real') : 'Sin adquisición',
          ],
        ].map(([k, v]) => (
          <div key={String(k)}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <h3>Incertidumbre</h3>
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
          Método: {a.latest.measurement_method}
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
