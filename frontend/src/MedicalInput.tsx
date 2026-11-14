import { useState } from 'react';
import Modal from './Modal';
import type usePresentation from './usePresentation';
import type { MedicalRequest } from './medicalTypes';
export default function MedicalInput({
  mission,
  test,
  onClose,
}: {
  mission: ReturnType<typeof usePresentation>;
  test?: MedicalRequest;
  onClose: () => void;
}) {
  const definitions = mission.registry.filter((d) =>
    test ? d.id === test.biomarker_id : d.sensing_layer === 1 && d.enabled,
  );
  const [metric, setMetric] = useState(test?.biomarker_id ?? 'heart_rate');
  const latest = mission.snapshot?.latest.find((m) => m.biomarker_id === metric);
  const [value, setValue] = useState(String(test?.sample_value ?? latest?.value ?? ''));
  const [quality, setQuality] = useState('good');
  const definition = definitions.find((d) => d.id === metric);
  return (
    <Modal
      title={test ? 'Registrar prueba secundaria' : 'Introducir medición sintética'}
      onClose={onClose}
    >
      <p className="muted">
        Datos sintéticos · la lectura se guardará en el expediente de esta demostración y se
        evaluará con el motor existente.
      </p>
      <form
        className="medical-input"
        onSubmit={async (event) => {
          event.preventDefault();
          const ok = test
            ? await mission.result(test.id, Number(value))
            : await mission.manual({
                biomarker_id: metric,
                value: quality === 'missing' ? null : Number(value),
                quality,
              });
          if (ok) onClose();
        }}
      >
        <label>
          Biomarcador
          <select
            aria-label="Biomarcador de la medición"
            value={metric}
            disabled={!!test}
            onChange={(e) => {
              setMetric(e.target.value);
              setValue(
                String(
                  mission.snapshot?.latest.find((m) => m.biomarker_id === e.target.value)?.value ??
                    '',
                ),
              );
            }}
          >
            {definitions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Valor ({definition?.unit})
          <input
            aria-label="Valor de la medición"
            type="number"
            step="any"
            required={quality !== 'missing'}
            disabled={quality === 'missing'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        {!test && (
          <label>
            Calidad
            <select
              aria-label="Calidad de la medición"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
            >
              <option value="good">Válida para la simulación</option>
              <option value="questionable">Calidad insuficiente</option>
              <option value="missing">Sin medición</option>
            </select>
          </label>
        )}
        {test && <p>{test.reason}</p>}
        <p className="small muted">
          Instante virtual siguiente. Las reglas que requieren varios días no se activan
          necesariamente con una sola lectura. Los valores de ejemplo no son umbrales clínicos.
        </p>
        {mission.error && (
          <p className="amber" role="alert">
            {mission.error}
          </p>
        )}
        <button className="button primary" type="submit" disabled={mission.busy}>
          {mission.busy
            ? 'Evaluando…'
            : test
              ? 'Guardar resultado y reevaluar'
              : 'Guardar y evaluar'}
        </button>
      </form>
    </Modal>
  );
}
