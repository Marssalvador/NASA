/** Local assets only. Optional videos must have a seamless loop authored into the file. */
export const sectionMedia: Record<string, { image: string; video?: string; alt: string }> = {
  heart: {
    // Sunra (gpt-image-2 still → Kling v3 loop, same start/end frame), slowed ×2 locally.
    image: '/media/systems/heart-loop.webp',
    video: '/media/systems/heart.mp4',
    alt: 'Ilustración generada del corazón latiendo dentro de un tórax translúcido',
  },
  lungs: {
    image: '/media/systems/lungs.webp',
    alt: 'Ilustración anatómica de los pulmones y bronquios',
  },
  kidneys: {
    image: '/media/systems/kidneys.webp',
    alt: 'Ilustración anatómica de los riñones y vías urinarias',
  },
  brain: {
    image: '/media/systems/brain.webp',
    alt: 'Ilustración anatómica del encéfalo y tronco cerebral',
  },
  skeleton: {
    image: '/media/systems/skeleton.webp',
    alt: 'Ilustración anatómica de pelvis, columna y fémures',
  },
  muscles: {
    image: '/media/systems/muscles.webp',
    alt: 'Ilustración anatómica de la musculatura del tronco y muslos',
  },
  metabolic: {
    image: '/media/systems/metabolic.webp',
    alt: 'Ilustración anatómica del hígado, páncreas e intestino',
  },
};

/** Context from the user's technical brief; these descriptions are not clinical rules. */
export const monitoringContext: Record<string, string> = {
  heart:
    'Seguimiento de frecuencia cardíaca, HRV e hidratación. Presión arterial bajo demanda según la ruta de sensado.',
  lungs: 'Seguimiento de oxigenación y frecuencia respiratoria con las mediciones disponibles.',
  kidneys:
    'Seguimiento de hidratación y equilibrio renal. Perfil urinario bajo demanda según la ruta de sensado.',
  brain:
    'Seguimiento de sueño, ritmo circadiano y rendimiento psicomotor en el contexto de carga de trabajo.',
  skeleton:
    'Seguimiento de actividad resistida y remodelado óseo. CTX-I bajo demanda según la ruta de sensado.',
  muscles:
    'Seguimiento de fuerza, actividad y recuperación. Lactato propuesto en el documento; sin medición continua validada en esta demo.',
  metabolic:
    'Seguimiento de glucosa, temperatura y contexto de estrés e inflamación. La personalización hormonal sigue pendiente de validación.',
};

const requested = new Set<string>();
export function prefetchSection(region: string) {
  const media = sectionMedia[region];
  if (!media || requested.has(media.image)) return;
  requested.add(media.image);
  const image = new Image();
  image.onerror = () => requested.delete(media.image);
  image.src = media.image;
}
