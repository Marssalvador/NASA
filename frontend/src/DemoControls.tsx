import { Pause, Play, Plus, RotateCcw } from 'lucide-react';
import type usePresentation from './usePresentation';
export default function DemoControls({
  mission,
  onManual,
}: {
  mission: ReturnType<typeof usePresentation>;
  onManual: () => void;
}) {
  const s = mission.snapshot;
  return (
    <section className="demo-controls" aria-label="Controles de demostración">
      <div className="demo-clock">
        <strong>A-112 · Día {s?.day ?? '—'}</strong>
        <span>
          {s
            ? new Date(s.as_of).toLocaleString('es-ES', {
                timeZone: 'UTC',
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              }) + ' UTC'
            : 'Conectando con el motor…'}
        </span>
      </div>
      <div className="demo-actions">
        <button
          className="demo-primary"
          disabled={!s || s.complete || mission.loading}
          onClick={() => (mission.playing ? mission.pause() : mission.setPlaying(true))}
        >
          {mission.playing ? <Pause size={15} /> : <Play size={15} />}{' '}
          {mission.playing ? 'Pausar' : 'Iniciar simulación'}
        </button>
        <button
          disabled={!s || mission.busy}
          onClick={() => {
            mission.pause();
            onManual();
          }}
        >
          <Plus size={15} /> Introducir medición
        </button>
        <button disabled={mission.busy || mission.loading} onClick={() => void mission.reset()}>
          <RotateCcw size={14} /> Reiniciar escenario
        </button>
      </div>
      <p role="status">
        {mission.busy
          ? 'Procesando con el motor médico…'
          : s?.complete
            ? 'Secuencia terminada · puedes introducir mediciones o reiniciar'
            : `Tiempo acelerado · ${s?.step ?? 0}/${s?.steps ?? 6} pasos · cada paso añade un día`}
      </p>
      <small>
        {s?.storage === 'supabase' ? 'Supabase' : 'Almacenamiento local'} · Motor real /api/v2 ·{' '}
        <b>Datos sintéticos</b>
      </small>
      {s?.storage_note && <small>{s.storage_note}</small>}
      {mission.error && (
        <div className="demo-error" role="alert">
          {mission.error}
          <button onClick={() => void mission.refresh()}>Reintentar</button>
        </div>
      )}
    </section>
  );
}
