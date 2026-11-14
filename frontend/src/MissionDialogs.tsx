import Modal from './Modal';
import ImportDialog from './ImportDialog';
import AnalysisDetail from './AnalysisDetail';
import type useMission from './useMission';
import type { Analysis, Biomarker } from './types';
export type DialogName =
  'import' | 'registry' | 'protocols' | 'model' | 'detail' | 'credits' | null;
export default function MissionDialogs({
  modal,
  onClose,
  mission,
  current,
  definition,
}: {
  modal: DialogName;
  onClose: () => void;
  mission: ReturnType<typeof useMission>;
  current?: Analysis;
  definition?: Biomarker;
}) {
  const { crew, subject, registry, data, refresh, setDay } = mission;
  if (modal === 'import')
    return (
      <ImportDialog
        crew={crew}
        subjectId={subject}
        registry={registry}
        onClose={onClose}
        onImported={() => {
          setDay(29);
          refresh();
        }}
      />
    );
  if (modal === 'detail')
    return (
      <Modal title={definition?.name ?? 'Análisis estadístico'} onClose={onClose}>
        {current ? <AnalysisDetail a={current} d={definition} /> : <p>Sin análisis disponible.</p>}
      </Modal>
    );
  if (modal === 'registry')
    return (
      <Modal title="Registro de biomarcadores" wide onClose={onClose}>
        <p className="muted">
          {registry.length} variables habilitadas. Edita data/biomarker_registry.json y actualiza el
          registro para incorporar nuevas variables.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Variable</th>
                <th>ID / unidad</th>
                <th>Sistema</th>
                <th>Método</th>
                <th>Frecuencia</th>
              </tr>
            </thead>
            <tbody>
              {registry.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>
                    <code>{d.id}</code>
                    <br />
                    {d.unit}
                  </td>
                  <td>{d.body_system}</td>
                  <td>{d.measurement_method}</td>
                  <td>{d.expected_frequency} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Las frecuencias son configuración de adquisición, no límites de seguridad. Las referencias
          del registro son contexto de investigación, sin validación clínica de esta aplicación.
        </p>
        <button className="button primary" onClick={refresh}>
          Actualizar registro
        </button>
      </Modal>
    );
  if (modal === 'protocols' && data)
    return (
      <Modal title="Hallazgos y comprobaciones" wide onClose={onClose}>
        {data.events.length > 0 && (
          <div className="emergency-box">
            Emergencia por síntoma declarado:{' '}
            {data.events
              .map((e) => `${e.symptom} (${e.is_synthetic ? 'sintético' : 'real'})`)
              .join(', ')}
            . Activar el protocolo aprobado de misión; esta demo no incluye un protocolo clínico
            validado.
          </div>
        )}
        <p className="muted">
          Alertas estadísticas de investigación, independientes de diagnósticos. Las intervenciones
          médicas requieren un protocolo local revisado.
        </p>
        {data.findings.length === 0 && (
          <div className="success-box">
            Sin hallazgos estadísticos en las observaciones disponibles.
          </div>
        )}
        {data.findings.map((f, i) => (
          <article className="protocol-card" key={f.id}>
            <h3>{f.title}</h3>
            <p>{f.explanation}</p>
            <p>
              {data.measurement_requests.find((r) => r.metric_id === f.metric_id)?.how_to_measure}
            </p>
            <p className="amber">{data.guidance[i]?.suggested_check}</p>
            <div className="protocol-meta">
              <span>Referencia: {data.guidance[i]?.reference}</span>
              <span>Autorización: {data.guidance[i]?.authorization_level}</span>
              <span>Validación: {data.guidance[i]?.validation_status}</span>
            </div>
          </article>
        ))}
      </Modal>
    );
  if (modal === 'model' && data)
    return (
      <Modal title="Motor de IA local" onClose={onClose}>
        <p>
          <strong>{data.prediction?.model_id ?? 'No disponible'}</strong> ·{' '}
          {data.prediction?.model_version}
        </p>
        <p>{data.prediction?.explanation ?? data.model_error}</p>
        <dl className="detail-grid">
          <div>
            <dt>Tipo de salida</dt>
            <dd>{data.prediction?.prediction_kind}</dd>
          </div>
          <div>
            <dt>Validación</dt>
            <dd>{data.prediction?.validation_status}</dd>
          </div>
          <div>
            <dt>Calidad de entrada</dt>
            <dd>{data.prediction?.input_quality}</dd>
          </div>
          <div>
            <dt>Incertidumbre</dt>
            <dd>{data.prediction?.uncertainty ?? 'No estimada'}</dd>
          </div>
        </dl>
        <h3>Variables sin evaluar</h3>
        <p>{data.prediction?.missing_variables.join(', ') || 'Ninguna'}</p>
        <pre>{JSON.stringify(data.prediction?.prediction, null, 2)}</pre>
        <p className="small muted">
          No es una probabilidad clínica. Adaptador configurable mediante AEGIS_MODEL_MODULE.
        </p>
      </Modal>
    );
  if (modal === 'credits')
    return (
      <Modal title="Atlas, fuentes y licencia" onClose={onClose}>
        <p>
          La escena utiliza geometría anatómica real. Las imágenes de referencia orientan la
          composición y los materiales; no forman parte del modelo ni se usan como texturas.
        </p>
        <h3>Z-Anatomy / BodyParts3D</h3>
        <p>
          Atlas: Gauthier Kervyn y colaboradores; geometría original de Kousaku Okubo / The Database
          Center for Life Science. Exportaciones GLB de pernelluvsya/atlas-proto, bajo CC BY-SA 4.0.
        </p>
        <p>
          La piel y los riñones proceden directamente de BodyParts3D 4.0, © The Database Center for
          Life Science, bajo CC BY 4.0. Se han excluido del atlas las piezas de oído y riñón con
          excepciones de licencia y las adiciones no utilizadas.
        </p>
        <p>
          AEGIS adapta selección, agrupación, materiales y compresión. Las mallas derivadas del
          atlas se distribuyen bajo CC BY-SA 4.0. Créditos, cambios y hashes:
          assets/models/ATTRIBUTION.md y source-manifest.json.
        </p>
        <p>
          <a
            href="https://github.com/Z-Anatomy/Models-of-human-anatomy"
            target="_blank"
            rel="noreferrer"
          >
            Z-Anatomy ↗
          </a>{' '}
          ·{' '}
          <a
            href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
            target="_blank"
            rel="noreferrer"
          >
            BodyParts3D ↗
          </a>{' '}
          ·{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer"
          >
            CC BY-SA 4.0 ↗
          </a>
        </p>
        <p className="muted">
          Atlas genérico educativo; no es un escáner del astronauta. Datos sintéticos, sin
          validación clínica. Los colores describen la evaluación de mediciones, no daño anatómico.
        </p>
      </Modal>
    );
  return null;
}
