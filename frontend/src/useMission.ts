import { useEffect, useMemo, useState } from 'react';
import { api, isDormant, regionStatus } from './lib';
import { anatomySystems } from './anatomyConfig';
import { createDemoDashboard, demoCrew, demoRegistry } from './demoFallback';
import type { Astronaut, Biomarker, Dashboard, Status } from './types';
import pathwayData from '../../data/risk_pathways.json';

const localRegistryById = new Map(demoRegistry.map((item) => [item.id, item]));
const normalizeRegistry = (items: Biomarker[]) => items.map((item) => {
  const local = localRegistryById.get(item.id);
  return local
    ? { ...item, name: local.name, measurement_method: local.measurement_method }
    : item;
});
const normalizeAstronaut = (astronaut: Astronaut): Astronaut => ({
  ...astronaut,
  role: astronaut.role === 'Comandante' ? 'Commander' : astronaut.role,
});
const englishPathways = new Map(pathwayData.map((pathway) => [pathway.id, pathway]));
const normalizeDashboard = (dashboard: Dashboard): Dashboard => ({
  ...dashboard,
  astronaut: normalizeAstronaut(dashboard.astronaut),
  pathways: dashboard.pathways.map((pathway) => {
    const english = englishPathways.get(pathway.id);
    return english
      ? { ...pathway, name: english.name, rationale: english.rationale, evidence: english.evidence, planned_signals: english.planned_signals }
      : pathway;
  }),
});

export default function useMission() {
  const [crew, setCrew] = useState<Astronaut[]>(demoCrew),
    [registry, setRegistry] = useState<Biomarker[]>(demoRegistry);
  const [subject, setSubject] = useState('crew-01'),
    [data, setData] = useState<Dashboard | null>(() => createDemoDashboard('crew-01'));
  const [usingSimulation, setUsingSimulation] = useState(true);
  const [day, setDay] = useState(29),
    [playing, setPlaying] = useState(false),
    [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<Astronaut[]>('/astronauts', undefined, controller.signal)
      .then((items) => setCrew(items.map(normalizeAstronaut)))
      .catch(() => { /* The selectable local demo crew stays available offline. */ });
    api<Biomarker[]>('/registry', undefined, controller.signal)
      .then((items) => setRegistry(normalizeRegistry(items)))
      .catch(() => { /* The bundled registry is the offline fallback. */ });
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
        setData(normalizeDashboard(d));
        setUsingSimulation(false);
      })
      .catch(() => {
        setData(createDemoDashboard(subject, day));
        setUsingSimulation(true);
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
      if (!response.ok) throw new Error('Could not export data.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `helios-${subject}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch { /* Offline exports are unavailable; keep the display on local demo data. */ }
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
    usingSimulation,
    loading,
    states,
    download,
    refresh: () => setRevision((r) => r + 1),
  };
}
