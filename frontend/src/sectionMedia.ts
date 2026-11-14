/** Local assets only. Optional videos must have a seamless loop authored into the file. */
export type Theme = 'light' | 'dark';
export interface SectionMedia {
  image: string;
  video?: string;
  alt: string;
}
/**
 * One art direction per theme. Systems without an entry fall back to the 3D camera zoom.
 * Light: warm studio stills and the Sunra heart loop. Dark: Sunra glass anatomy on black.
 */
export const sectionMediaByTheme: Record<Theme, Partial<Record<string, SectionMedia>>> = {
  light: {
    heart: {
      // Sunra (gpt-image-2 still → Kling v3 loop, same start/end frame), slowed ×2 locally.
      image: '/media/systems/heart-loop.webp',
      video: '/media/systems/heart.mp4',
      alt: 'Corazón latiendo dentro de un tórax translúcido',
    },
    kidneys: { image: '/media/systems/kidneys.webp', alt: 'Riñones y vías urinarias' },
    brain: { image: '/media/systems/brain.webp', alt: 'Encéfalo y tronco cerebral' },
    skeleton: { image: '/media/systems/skeleton.webp', alt: 'Pelvis, columna y fémures' },
    metabolic: { image: '/media/systems/metabolic.webp', alt: 'Hígado, páncreas e intestino' },
  },
  dark: {
    heart: { image: '/media/systems-dark/heart.webp', alt: 'Corazón iluminado dentro de un tórax translúcido' },
    lungs: { image: '/media/systems-dark/lungs.webp', alt: 'Pulmones y bronquios' },
    kidneys: { image: '/media/systems-dark/kidneys.webp', alt: 'Riñones y vías urinarias' },
    brain: { image: '/media/systems-dark/brain.webp', alt: 'Encéfalo y tronco cerebral' },
    muscles: { image: '/media/systems-dark/muscles.webp', alt: 'Musculatura del tronco y muslos' },
  },
};
export const sectionMediaFor = (region: string, theme: Theme) => sectionMediaByTheme[theme][region];

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
export function prefetchSection(region: string, theme: Theme) {
  const media = sectionMediaFor(region, theme);
  if (!media || requested.has(media.image)) return;
  requested.add(media.image);
  const image = new Image();
  image.onerror = () => requested.delete(media.image);
  image.src = media.image;
}
