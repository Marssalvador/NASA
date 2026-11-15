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
      alt: 'Beating heart inside a translucent chest',
    },
    kidneys: { image: '/media/systems/kidneys.webp', alt: 'Kidneys and urinary tract' },
    brain: { image: '/media/systems/brain.webp', alt: 'Brain and brainstem' },
    skeleton: { image: '/media/systems/skeleton.webp', alt: 'Pelvis, spine, and femurs' },
    metabolic: { image: '/media/systems/metabolic.webp', alt: 'Liver, pancreas, and intestine' },
  },
  dark: {
    heart: { image: '/media/systems-dark/heart.webp', alt: 'Illuminated heart inside a translucent chest' },
    lungs: { image: '/media/systems-dark/lungs.webp', alt: 'Lungs and bronchi' },
    kidneys: { image: '/media/systems-dark/kidneys.webp', alt: 'Kidneys and urinary tract' },
    brain: { image: '/media/systems-dark/brain.webp', alt: 'Brain and brainstem' },
    muscles: { image: '/media/systems-dark/muscles.webp', alt: 'Torso and thigh muscles' },
  },
};
export const sectionMediaFor = (region: string, theme: Theme) => sectionMediaByTheme[theme][region];

/** Context from the user's technical brief; these descriptions are not clinical rules. */
export const monitoringContext: Record<string, string> = {
  heart:
    'Monitor heart rate, HRV, and hydration. Blood pressure is measured on demand when requested by the sensing pathway.',
  lungs: 'Monitor oxygenation and respiratory rate using available measurements.',
  kidneys:
    'Monitor hydration and renal balance. Urinalysis is acquired on demand when requested by the sensing pathway.',
  brain:
    'Monitor sleep, circadian rhythm, and psychomotor performance in the context of workload.',
  skeleton:
    'Monitor resistance exercise and bone remodeling. CTX-I is acquired on demand when requested by the sensing pathway.',
  muscles:
    'Monitor strength, activity, and recovery. Lactate monitoring is proposed, but continuous measurement is not validated in this demo.',
  metabolic:
    'Monitor glucose, temperature, and stress and inflammation context. Hormonal personalization still requires validation.',
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
