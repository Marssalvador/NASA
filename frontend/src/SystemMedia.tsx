import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { sectionMedia } from './sectionMedia';

/** Decoded stills replace WebGL in a system view; videos are opt-in local assets. */
export default function SystemMedia({
  region,
  compact = false,
}: {
  region: string;
  compact?: boolean;
}) {
  const media = sectionMedia[region];
  const [frame, setFrame] = useState<{ image: string; alt: string } | null>(null);
  const [previous, setPrevious] = useState<typeof frame>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [paused, setPaused] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const current = useRef<typeof frame>(null);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setVideoFailed(false);
    const image = new Image();
    image.src = media.image;
    image
      .decode()
      .then(() => {
        if (cancelled) return;
        setPrevious(current.current);
        const next = { image: media.image, alt: media.alt };
        current.current = next;
        setFrame(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [media.image, media.alt, attempt]);

  useEffect(() => {
    const timer = window.setTimeout(() => setPrevious(null), 650);
    return () => window.clearTimeout(timer);
  }, [frame]);

  const showVideo =
    !compact && !!media.video && !videoFailed && !reduced && frame?.image === media.image;
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    // Motion is authored in the clip; very low playback rates can stutter on mobile.
    if (paused || document.hidden) element.pause();
    else void element.play().catch(() => setPaused(true));
    const visibility = () => {
      if (document.hidden || paused) element.pause();
      else void element.play().catch(() => setPaused(true));
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      element.pause();
    };
  }, [showVideo, paused, media.video]);

  return (
    <div
      className={`system-media ${compact ? 'compact' : ''}`}
      data-testid="system-media"
      data-system={region}
    >
      {previous && !failed && (
        <img className="system-media-previous" src={previous.image} alt="" aria-hidden="true" />
      )}
      {frame && !(failed && frame.image !== media.image) && (
        <img
          key={frame.image}
          className="system-media-current"
          src={frame.image}
          alt={frame.alt}
          decoding="async"
        />
      )}
      {showVideo && (
        <video
          ref={video}
          key={media.video}
          className="system-media-video"
          src={media.video}
          poster={media.image}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={media.alt}
          onError={() => setVideoFailed(true)}
        />
      )}
      {!frame && !failed && (
        <div className="anatomy-loader" role="status">
          Preparando imagen anatómica…
        </div>
      )}
      {failed && (
        <div className="system-media-error" role="status">
          No se pudo cargar la imagen.
          <button onClick={() => setAttempt((n) => n + 1)}>Reintentar</button>
        </div>
      )}
      {!compact && (
        <div className="system-media-caption">
          <span>
            Ilustración generada · no representa al astronauta
            {showVideo ? ' · Secuencia en bucle' : ''}
          </span>
          {showVideo && (
            <button
              aria-label={paused ? 'Reproducir vídeo anatómico' : 'Pausar vídeo anatómico'}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
