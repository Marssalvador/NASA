import type usePresentation from './usePresentation';
import { fmt, dateTime } from './lib';
export default function MedicalMetricDetail({
  mission,
  id,
}: {
  mission: ReturnType<typeof usePresentation>;
  id?: string;
}) {
  const s = mission.snapshot;
  if (!s || !id) return <p>Datos insuficientes.</p>;
  const m = s.latest.find((m) => m.biomarker_id === id),
    reference = s.references[id];
  const features = s.report.features.filter(
    (f) => f.biomarker_id === id && f.day === s.as_of.slice(0, 10),
  );
  return (
    <>
      <p className="muted">
        Datos sintéticos · expediente {s.code} · motor {s.report.engine}
      </p>
      <dl className="detail-grid">
        {[
          ['Última adquisición', m ? `${fmt(m.value, 3)} ${m.unit}` : 'Sin medición'],
          ['Estado de datos', s.report.data_states[id] ?? 'missing'],
          ['Instante de adquisición', m ? dateTime(m.measured_at) : '—'],
          ['Fuente', m?.source ?? '—'],
          ['Método', m?.method ?? '—'],
          ['Calidad', m?.quality ?? '—'],
          [
            'Referencia personal',
            reference?.status === 'accepted'
              ? `${fmt(reference.center, 3)} · dispersión robusta ${fmt(reference.spread, 3)}`
              : 'Datos insuficientes',
          ],
          [
            'Contexto de referencia',
            reference
              ? `${reference.context_key} · versión ${reference.version} · n=${reference.n}`
              : 'No disponible',
          ],
          [
            'Periodo de referencia',
            reference
              ? `${dateTime(reference.window_start)} — ${dateTime(reference.window_end)}`
              : '—',
          ],
          ['Procedencia', 'Sintética'],
        ].map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h3>Características calculadas por el motor</h3>
      {features.length ? (
        features.map((f) => (
          <p className="small muted" key={f.feature}>
            {f.feature}: {fmt(f.value, 3)} · {f.note}
          </p>
        ))
      ) : (
        <p>Datos insuficientes para calcular características en el día actual.</p>
      )}
      <h3>Incertidumbre</h3>
      <p className="muted">
        Reglas y referencias de investigación. La referencia usa mediana y MAD; no se calculan
        probabilidades de enfermedad ni intervalos sin supuestos verificados.
      </p>
    </>
  );
}
