/** Local assets only. Optional videos must have a seamless loop authored into the file. */
/** Systems without an entry fall back to the 3D camera zoom on the atlas. */
export const sectionMedia: Partial<Record<string, { image: string; video?: string; alt: string }>> = {
  heart: {
    image: '/media/systems/heart.webp',
    alt: 'Corazón iluminado dentro de un tórax translúcido',
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
  muscles: {
    image: '/media/systems/muscles.webp',
    alt: 'Ilustración anatómica de la musculatura del tronco y muslos',
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
