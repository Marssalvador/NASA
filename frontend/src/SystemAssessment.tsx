import { Activity, ShieldCheck } from 'lucide-react';
import type { Analysis, Guidance, Status } from './types';
import { statusText } from './lib';
import { monitoringContext } from './sectionMedia';

export default function SystemAssessment({
  region,
  status,
  analyses,
  guidance,
}: {
  region: string;
  status: Status;
  analyses: Analysis[];
  guidance: Guidance[];
}) {
  const ids = new Set(analyses.map((a) => a.metric_id));
  const reviewed = guidance.filter((g) => ids.has(g.trigger) && g.validation_status === 'reviewed');
  const missing = analyses.filter((a) => a.status === 'insufficient_data').length;
  return (
    <section className="system-assessment" aria-label="Interpretación del sistema">
      <div>
        <Activity size={22} strokeWidth={1.4} />
        <div>
          <h2>Interpretación</h2>
          <p>
            {statusText[status]}.{' '}
            {status === 'review'
              ? 'Las mediciones requieren revisión respecto al patrón individual.'
              : status === 'emergency'
                ? 'Hay síntomas declarados que requieren consultar el protocolo de emergencia.'
                : status === 'insufficient_data'
                  ? 'Faltan observaciones suficientes para evaluar este sistema.'
                  : 'Las mediciones evaluables no muestran desviaciones del patrón individual.'}
          </p>
          {missing > 0 && status !== 'insufficient_data' && (
            <p>
              {missing}{' '}
              {missing === 1
                ? 'variable sin evaluación suficiente'
                : 'variables sin evaluación suficiente'}
              .
            </p>
          )}
        </div>
      </div>
      <div>
        <ShieldCheck size={22} strokeWidth={1.4} />
        <div>
          <h2>Recomendación</h2>
          <p>
            {reviewed.length
              ? reviewed.map((g) => g.suggested_check).join(' ')
              : 'Pendiente de revisión médica'}
          </p>
        </div>
      </div>
      <details>
        <summary>Qué se vigila en este sistema</summary>
        <p>{monitoringContext[region]}</p>
        <small>
          Contexto de diseño del documento de monitorización. Las rutas y señales propuestas no
          constituyen un diagnóstico validado.
        </small>
      </details>
    </section>
  );
}
