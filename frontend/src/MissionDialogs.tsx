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
      <Modal title={definition?.name ?? 'Statistical analysis'} onClose={onClose}>
        {current ? <AnalysisDetail a={current} d={definition} /> : <p>No analysis available.</p>}
      </Modal>
    );
  if (modal === 'registry')
    return (
      <Modal title="Biomarker registry" wide onClose={onClose}>
        <p className="muted">
          {registry.length} variables enabled. Edit data/biomarker_registry.json and refresh the
          registry to add new variables.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Variable</th>
                <th>ID / unit</th>
                <th>System</th>
                <th>Method</th>
                <th>Frequency</th>
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
          Frequencies configure data acquisition; they are not safety limits. Registry references
          provide research context and are not clinically validated by this application.
        </p>
        <button className="button primary" onClick={refresh}>
          Refresh registry
        </button>
      </Modal>
    );
  if (modal === 'protocols' && data)
    return (
      <Modal title="Findings and checks" wide onClose={onClose}>
        {data.events.length > 0 && (
          <div className="emergency-box">
            Emergency based on reported symptoms:{' '}
            {data.events
              .map((e) => `${e.symptom} (${e.is_synthetic ? 'synthetic' : 'real'})`)
              .join(', ')}
            . Follow the approved mission protocol; this demo does not include a clinically
            validated protocol.
          </div>
        )}
        <p className="muted">
          Research statistical alerts, separate from diagnoses. Medical interventions require a
          locally reviewed protocol.
        </p>
        {data.findings.length === 0 && (
          <div className="success-box">
            No statistical findings in the available observations.
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
              <span>Reference: {data.guidance[i]?.reference}</span>
              <span>Authorization: {data.guidance[i]?.authorization_level}</span>
              <span>Validation: {data.guidance[i]?.validation_status}</span>
            </div>
          </article>
        ))}
      </Modal>
    );
  if (modal === 'model' && data)
    return (
      <Modal title="Local AI engine" onClose={onClose}>
        <p>
          <strong>{data.prediction?.model_id ?? 'Not available'}</strong> ·{' '}
          {data.prediction?.model_version}
        </p>
        <p>{data.prediction?.explanation ?? data.model_error}</p>
        <dl className="detail-grid">
          <div>
            <dt>Output type</dt>
            <dd>{data.prediction?.prediction_kind}</dd>
          </div>
          <div>
            <dt>Validation</dt>
            <dd>{data.prediction?.validation_status}</dd>
          </div>
          <div>
            <dt>Input quality</dt>
            <dd>{data.prediction?.input_quality}</dd>
          </div>
          <div>
            <dt>Uncertainty</dt>
            <dd>{data.prediction?.uncertainty ?? 'Not estimated'}</dd>
          </div>
        </dl>
        <h3>Unevaluated variables</h3>
        <p>{data.prediction?.missing_variables.join(', ') || 'None'}</p>
        <pre>{JSON.stringify(data.prediction?.prediction, null, 2)}</pre>
        <p className="small muted">
          This is not a clinical probability. Configure the adapter with HELIOS_MODEL_MODULE.
        </p>
      </Modal>
    );
  if (modal === 'credits')
    return (
      <Modal title="Atlas, sources, and license" onClose={onClose}>
        <p>
          The scene uses real anatomical geometry. Reference images guide the composition and
          materials; they are not part of the model and are not used as textures.
        </p>
        <h3>Z-Anatomy / BodyParts3D</h3>
        <p>
          Atlas: Gauthier Kervyn et al.; original geometry by Kousaku Okubo / The Database
          Center for Life Science. Exportaciones GLB de pernelluvsya/atlas-proto, bajo CC BY-SA 4.0.
        </p>
        <p>
          Skin and kidneys come directly from BodyParts3D 4.0, © The Database Center for Life Science,
          under CC BY 4.0. Ear and kidney parts with licensing exceptions, and unused additions,
          have been excluded from the atlas.
        </p>
        <p>
          HELIOS adapts selection, grouping, materials, and compression. Meshes derived from the
          atlas are distributed under CC BY-SA 4.0. Credits, changes, and hashes:
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
          Generic educational atlas; not a scan of the astronaut. Synthetic data, not clinically
          validated. Colors describe measurement assessments, not anatomical damage.
        </p>
      </Modal>
    );
  return null;
}
