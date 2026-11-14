import type { Status } from './types';

export const anatomySystems = [
  {
    id: 'heart',
    name: 'Cardiovascular',
    subtitle: 'Estado y respuesta fisiológica',
    description: 'Frecuencia y variabilidad respecto al patrón individual.',
    code: '01',
  },
  {
    id: 'lungs',
    name: 'Respiratorio',
    subtitle: 'Oxigenación y dinámica respiratoria',
    description: 'Seguimiento de las mediciones respiratorias disponibles.',
    code: '02',
  },
  {
    id: 'kidneys',
    name: 'Renal',
    subtitle: 'Equilibrio y función renal',
    description: 'Seguimiento de muestras bioquímicas y adquisiciones pendientes.',
    code: '03',
  },
  {
    id: 'brain',
    name: 'Neurológico',
    subtitle: 'Descanso y rendimiento cognitivo',
    description: 'Sueño y respuesta psicomotora en contexto de misión.',
    code: '04',
  },
  {
    id: 'skeleton',
    name: 'Óseo',
    subtitle: 'Metabolismo y estructura ósea',
    description: 'Marcadores de remodelado y baseline individual.',
    code: '05',
  },
  {
    id: 'muscles',
    name: 'Muscular',
    subtitle: 'Fuerza y respuesta muscular',
    description: 'Mediciones de rendimiento y evolución personal.',
    code: '06',
  },
  {
    id: 'metabolic',
    name: 'Metabólico e inmune',
    subtitle: 'Contexto metabólico e inmunitario',
    description: 'Variables metabólicas, inflamatorias y disponibilidad de datos.',
    code: '07',
  },
];
export const evaluationColor: Record<Status, string> = {
  stable: '#5f735e',
  review: '#b92925',
  emergency: '#b92925',
  insufficient_data: '#908b84',
};
export const cameraTargets: Record<
  string,
  { target: [number, number, number]; position: [number, number, number] }
> = {
  overview: { target: [0, 0.86, 0], position: [0.015, 0.88, 3.05] },
  heart: { target: [0.025, 1.3, 0.02], position: [0.05, 1.33, 0.94] },
  lungs: { target: [0, 1.31, 0], position: [0, 1.34, 1.18] },
  kidneys: { target: [0, 1.1, 0], position: [-0.15, 1.13, -0.9] },
  brain: { target: [0, 1.61, 0.015], position: [0.21, 1.63, 0.72] },
  skeleton: { target: [0, 1.24, 0], position: [0.2, 1.28, 1.42] },
  muscles: { target: [0, 1.05, 0], position: [-0.32, 1.1, 1.85] },
  metabolic: { target: [0, 1.12, 0], position: [0.05, 1.15, 1.05] },
};
export const CAMERA_DURATION_MS = 600;
export const cameraEase = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Anatomical vocabulary → point on the atlas (metres, model space, +z anterior).
 * Points were sampled from the shipped overview mesh. They only place a visual marker;
 * they say nothing about where a measurement is taken or about tissue damage.
 */
export interface BodySite {
  label: string;
  point: [number, number, number];
  radius: number;
}
export const bodySites: Record<string, BodySite> = {
  heart: { label: 'Corazón', point: [0.025, 1.29, 0.035], radius: 0.085 },
  lungs: { label: 'Pulmones', point: [-0.075, 1.36, 0.02], radius: 0.11 },
  brain: { label: 'Encéfalo', point: [0, 1.63, -0.005], radius: 0.09 },
  kidneys: { label: 'Riñones', point: [0.06, 1.1, -0.015], radius: 0.075 },
  adrenal: { label: 'Suprarrenales', point: [-0.055, 1.16, -0.02], radius: 0.05 },
  liver: { label: 'Hígado', point: [-0.055, 1.18, 0.04], radius: 0.08 },
  abdomen: { label: 'Abdomen', point: [0.0, 1.04, 0.06], radius: 0.1 },
  core: { label: 'Tronco', point: [0.0, 1.22, 0.02], radius: 0.13 },
  forearm: { label: 'Antebrazo', point: [-0.24, 0.98, 0.0], radius: 0.09 },
  hip: { label: 'Cadera y fémur proximal', point: [0.1, 0.9, 0.015], radius: 0.11 },
  thigh: { label: 'Muslo', point: [-0.09, 0.62, 0.03], radius: 0.1 },
};
/** Fallback site for each selectable system when a definition declares none. */
export const regionSites: Record<string, string> = {
  heart: 'heart',
  lungs: 'lungs',
  kidneys: 'kidneys',
  brain: 'brain',
  skeleton: 'hip',
  muscles: 'thigh',
  metabolic: 'abdomen',
};
