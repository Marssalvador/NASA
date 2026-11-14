import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Presentation } from './medicalTypes';
import { present } from './medicalPresentation';

const KEY = 'pulss.presentation.session';
async function request(path: string, body?: unknown): Promise<Presentation> {
  const response = await fetch(
    '/api/v2/demo/sessions' + path,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: 'No se pudo conectar con el motor.' }));
    throw Object.assign(
      new Error(typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail)),
      { status: response.status },
    );
  }
  return response.json();
}
let starting: Promise<Presentation> | null = null;
async function boot() {
  let id: string | null = null;
  try {
    id = localStorage.getItem(KEY);
  } catch {
    /* local mode without storage */
  }
  if (id) {
    try {
      return await request('/' + id);
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error;
    }
  }
  starting ??= request('', {}).finally(() => {
    starting = null;
  });
  return starting;
}
export default function usePresentation() {
  const [snapshot, setSnapshot] = useState<Presentation | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false);
  const current = useRef<Presentation | null>(null),
    locked = useRef(false),
    mounted = useRef(true),
    play = useRef(false);
  const accept = useCallback((s: Presentation) => {
    if (!mounted.current) return;
    if (
      current.current &&
      current.current.session_id === s.session_id &&
      s.revision < current.current.revision
    )
      return;
    current.current = s;
    setSnapshot(s);
    setError('');
    setLoading(false);
    try {
      localStorage.setItem(KEY, s.session_id);
    } catch {}
  }, []);
  useEffect(() => {
    mounted.current = true;
    boot()
      .then(accept)
      .catch((e) => {
        if (mounted.current) {
          setError(String(e.message));
          setLoading(false);
        }
      });
    return () => {
      mounted.current = false;
      play.current = false;
    };
  }, [accept]);
  const refresh = useCallback(async () => {
    const s = current.current;
    if (locked.current) return;
    try {
      if (!s) {
        accept(await boot());
        return;
      }
      const next = await request('/' + s.session_id);
      if (current.current?.session_id === s.session_id) accept(next);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    }
  }, [accept]);
  useEffect(() => {
    let stopped = false;
    let timer: number;
    const poll = async () => {
      await refresh();
      if (!stopped) timer = window.setTimeout(poll, 2500);
    };
    timer = window.setTimeout(poll, 2500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [refresh]);
  const mutate = useCallback(
    async (path: string, payload: object = {}) => {
      const s = current.current;
      if (!s || locked.current) return false;
      locked.current = true;
      setBusy(true);
      try {
        const next = await request('/' + s.session_id + path, {
          ...payload,
          operation_id: crypto.randomUUID(),
          expected_revision: s.revision,
        });
        if (current.current?.session_id === s.session_id) accept(next);
        return true;
      } catch (e) {
        setError((e as Error).message);
        play.current = false;
        setPlaying(false);
        return false;
      } finally {
        locked.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [accept],
  );
  const pause = useCallback(() => {
    play.current = false;
    setPlaying(false);
  }, []);
  useEffect(() => {
    if (!playing) return;
    play.current = true;
    let timer: number;
    let stopped = false;
    const advance = async () => {
      if (stopped || !play.current) return;
      if (current.current?.complete) {
        pause();
        return;
      }
      await mutate('/step');
      if (!stopped && play.current) timer = window.setTimeout(advance, 1600);
    };
    timer = window.setTimeout(advance, 900);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [playing, mutate, pause]);
  const reset = useCallback(async () => {
    if (locked.current) return;
    pause();
    locked.current = true;
    setBusy(true);
    try {
      accept(await request('', {}));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }, [accept, pause]);
  const view = useMemo(() => (snapshot ? present(snapshot) : null), [snapshot]);
  const readMeasurement = useCallback(async (id: number) => {
    if (!current.current) throw new Error('No hay sesión.');
    const r = await fetch('/api/v2/measurements/' + id, {
      headers: { 'X-AEGIS-User': current.current.user_id },
    });
    if (!r.ok) throw new Error('No se pudo recuperar la evidencia original.');
    return r.json();
  }, []);
  return {
    snapshot,
    data: view?.data ?? null,
    states: view?.states ?? {},
    registry: snapshot?.registry ?? [],
    crew: view ? [view.data.astronaut] : [],
    subject: snapshot?.code ?? 'A-112',
    setSubject: () => {},
    day: snapshot?.day ?? 0,
    playing,
    setPlaying: (value: boolean | ((p: boolean) => boolean)) => {
      const next = typeof value === 'function' ? value(playing) : value;
      play.current = next;
      setPlaying(next);
    },
    pause,
    error,
    loading,
    busy,
    refresh,
    reset,
    step: () => mutate('/step'),
    manual: (payload: object) => mutate('/measurements', payload),
    result: (id: string, value: number) => mutate('/tests/' + id + '/result', { value }),
    readMeasurement,
  };
}
