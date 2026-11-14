import { useEffect, useMemo, useState } from 'react';
import { api, isDormant, regionStatus } from './lib';
import { anatomySystems } from './anatomyConfig';
import type { Astronaut, Biomarker, Dashboard, Status } from './types';

export default function useMission() {
  const [crew, setCrew] = useState<Astronaut[]>([]),
    [registry, setRegistry] = useState<Biomarker[]>([]);
  const [subject, setSubject] = useState('crew-02'),
    [data, setData] = useState<Dashboard | null>(null);
  const [day, setDay] = useState(29),
    [playing, setPlaying] = useState(false),
    [revision, setRevision] = useState(0);
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api<Astronaut[]>('/astronauts', undefined, controller.signal),
      api<Biomarker[]>('/registry', undefined, controller.signal),
    ])
      .then(([c, r]) => {
        setCrew(c);
        setRegistry(r);
        setError('');
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(String(e));
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const astronaut = crew.find((c) => c.id === subject);
    if (!astronaut) return;
    const controller = new AbortController();
    setLoading(true);
    const time = new Date(
      new Date(astronaut.mission_start).getTime() + day * 86400000,
    ).toISOString();
    api<Dashboard>(
      `/astronauts/${subject}/dashboard${day === 29 ? '' : `?as_of=${encodeURIComponent(time)}`}`,
      undefined,
      controller.signal,
    )
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(String(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [crew, subject, day, revision]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () =>
        setDay((d) => {
          if (d >= 29) {
            setPlaying(false);
            return 29;
          }
          return d + 1;
        }),
      1300,
    );
    return () => clearInterval(timer);
  }, [playing]);
  const states = useMemo(
    () =>
      Object.fromEntries(
        anatomySystems.map((s) => [
          s.id,
          regionStatus(
            data?.analyses.filter(
              (a) =>
                registry.find((d) => d.id === a.metric_id)?.body_region === s.id &&
                !isDormant(a, registry, data.pathways),
            ) ?? [],
          ),
        ]),
      ) as Record<string, Status>,
    [data, registry],
  );
  async function download(format: 'json' | 'csv') {
    try {
      const asOf = day < 29 && data ? `&as_of=${encodeURIComponent(data.as_of)}` : '';
      const response = await fetch(`/api/astronauts/${subject}/export?format=${format}${asOf}`);
      if (!response.ok) throw new Error('No se pudo exportar.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `aegis-${subject}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    }
  }
  return {
    crew,
    registry,
    subject,
    setSubject,
    data,
    day,
    setDay,
    playing,
    setPlaying,
    error,
    loading,
    states,
    download,
    refresh: () => setRevision((r) => r + 1),
  };
}
