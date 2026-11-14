import { Activity, ChevronRight, FlaskConical } from 'lucide-react';
import type { MedicalRequest } from './medicalTypes';
import type usePresentation from './usePresentation';
export const certaintyText = {
  observation: 'Observación',
  suspicion: 'Sospecha · pendiente de confirmar',
  confirmed_finding: 'Hallazgo confirmado · no diagnóstico',
};
export default function MedicalFindings({
  mission,
  region,
  onTest,
  onEvidence,
}: {
  mission: ReturnType<typeof usePresentation>;
  region: string;
  onTest: (test: MedicalRequest) => void;
  onEvidence: (id: number) => void;
}) {
  const s = mission.snapshot;
  if (!s) return null;
  const assessments = s.report.assessments.filter((a) => a.body_region === region);
  const links = s.risk_definitions
    .filter((risk) => risk.body_region === region)
    .flatMap((risk) =>
      risk.links.filter((link) => link.role === 'confirmation').map((link) => link.biomarker),
    );
  const tests = s.requests.filter((r) => links.includes(r.biomarker_id));
  return (
    <section className="medical-findings" aria-label="Hallazgos del motor">
      <h2>
        <Activity size={17} /> Análisis del motor
      </h2>
      {!assessments.length && (
        <p className="medical-empty">
          Datos insuficientes para concluir sobre este sistema: el motor no dispone de una ruta de
          evaluación específica. Las mediciones disponibles se muestran arriba.
        </p>
      )}
      {s.report.model_error && (
        <p role="alert">
          El motor no pudo completar la evaluación. Se conservan las mediciones y las alertas de
          emergencia.
        </p>
      )}
      {assessments.map((a) => (
        <article
          className={`medical-finding level-${a.alert_level}`}
          key={a.id}
          data-testid="medical-finding"
          data-certainty={a.certainty}
        >
          <span className="medical-certainty">{certaintyText[a.certainty]}</span>
          <h3>{a.risk_name}</h3>
          <p>{a.explanation}</p>
          <small>
            Cobertura de señales iniciales: {a.input_quality} · {a.uncertainty.statement}
          </small>
          {a.missing_inputs.length > 0 && (
            <details>
              <summary>Entradas no disponibles ({a.missing_inputs.length})</summary>
              <p>
                {a.missing_inputs
                  .map((id) => s.registry.find((d) => d.id === id)?.name ?? id)
                  .join(', ')}
              </p>
            </details>
          )}
          {a.supersedes_id && (
            <p className="medical-reevaluation" data-testid="reevaluation">
              Reevaluación enlazada a {a.supersedes_id.slice(0, 8)} · evaluación actual{' '}
              {a.id.slice(0, 8)}
            </p>
          )}
          <details>
            <summary>Evidencias originales ({a.evidence_ids.length})</summary>
            <div className="medical-evidence-links">
              {a.evidence_ids.map((id) => (
                <button key={id} onClick={() => onEvidence(id)}>
                  Medición #{id}
                </button>
              ))}
            </div>
            <small>Evaluación {a.id}</small>
          </details>
          {a.recommendations.length > 0 && (
            <p className="medical-recommendation">
              Recomendaciones: {a.recommendations[0].display}
            </p>
          )}
        </article>
      ))}
      {tests.length > 0 && (
        <div className="medical-tests">
          <h2>
            <FlaskConical size={17} /> Pruebas adicionales
          </h2>
          {tests.map((test) => (
            <div className="medical-test" key={test.id} data-testid="medical-test">
              <div>
                <strong>{s.registry.find((d) => d.id === test.biomarker_id)?.name}</strong>
                <span>
                  {test.status === 'resulted'
                    ? `Resultado sintético: ${test.result?.value} ${test.result?.unit}`
                    : 'Medición adicional pendiente'}
                </span>
              </div>
              {test.status !== 'resulted' ? (
                <button
                  disabled={mission.busy}
                  onClick={() => {
                    mission.pause();
                    onTest(test);
                  }}
                  aria-label={`Registrar resultado de ${s.registry.find((d) => d.id === test.biomarker_id)?.name}`}
                >
                  Registrar resultado <ChevronRight size={14} />
                </button>
              ) : (
                <button onClick={() => test.result && onEvidence(test.result.id)}>
                  Ver evidencia
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
