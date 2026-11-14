import { useEffect, useState } from 'react';
import Modal from './Modal';
import type usePresentation from './usePresentation';
import type { MedicalMeasurement } from './medicalTypes';
export default function MedicalEvidence({
  id,
  mission,
  onClose,
}: {
  id: number;
  mission: ReturnType<typeof usePresentation>;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ versions: MedicalMeasurement[] } | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    mission
      .readMeasurement(id)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id, mission.readMeasurement]);
  return (
    <Modal title={`Evidencia original #${id}`} onClose={onClose}>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p>Cargando medición original…</p>
      ) : (
        data.versions.map((m) => (
          <dl className="detail-grid" key={m.id}>
            {[
              ['Identificador', m.id],
              ['Biomarcador', m.biomarker_id],
              ['Valor', `${m.value ?? 'Sin medición'} ${m.unit}`],
              ['Instante UTC', m.measured_at],
              ['Fuente', m.source],
              ['Calidad', m.quality],
              ['Procedencia', m.is_synthetic ? 'Sintética' : 'Real'],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ))
      )}
    </Modal>
  );
}
