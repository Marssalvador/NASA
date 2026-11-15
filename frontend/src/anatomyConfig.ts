import type { Status } from './types';

export const anatomySystems = [
  {
    id: 'muscles',
    name: 'Muscular',
    subtitle: 'Muscle strength and response',
    description: 'Performance measurements and individual change.',
    code: '01',
  },
];

/**
 * Detailed selectable sites. The shipped atlas only separates broad mesh zones;
 * point anchors localize the selection while atlasZones controls the mesh highlight.
 */
export interface MuscleRegion {
  id: string;
  name: string;
  target: string;
  site: string;
  atlasZones: readonly string[];
  metricIds: readonly string[];
  scope: string;
}
export const muscleRegions: MuscleRegion[] = [
  { id: 'neck', name: 'Neck', target: 'neck', site: 'muscle_neck', atlasZones: ['head_center'], metricIds: [], scope: 'The atlas groups the cervical muscles with the head; no cervical muscle biomarkers are enabled.' },
  { id: 'shoulders', name: 'Shoulders', target: 'shoulders', site: 'shoulders', atlasZones: ['thorax_left', 'thorax_right'], metricIds: [], scope: 'The atlas represents the shoulders within the torso; no shoulder-specific measurements are enabled.' },
  { id: 'chest', name: 'Chest', target: 'chest', site: 'chest', atlasZones: ['thorax_center'], metricIds: [], scope: 'No pectoral muscle measurements are enabled.' },
  { id: 'back', name: 'Back', target: 'back', site: 'back', atlasZones: ['thorax_center'], metricIds: [], scope: 'No back muscle measurements are enabled.' },
  { id: 'upper_arms', name: 'Upper arms', target: 'upper_arms', site: 'upper_arm', atlasZones: ['thorax_left', 'thorax_right'], metricIds: [], scope: 'The atlas does not separate the arm from the torso, and no arm muscle biomarkers are enabled.' },
  { id: 'forearms', name: 'Forearms', target: 'forearms', site: 'forearm', atlasZones: ['thorax_left', 'thorax_right'], metricIds: ['grip_strength'], scope: 'Grip strength informs hand and forearm function; it does not directly measure muscle mass.' },
  { id: 'hands', name: 'Hands and grip', target: 'hands', site: 'hands', atlasZones: ['thorax_left', 'thorax_right'], metricIds: ['grip_strength'], scope: 'Grip dynamometry is a functional measure, not a direct measure of hand muscle mass.' },
  { id: 'core', name: 'Abdomen and core', target: 'core', site: 'core', atlasZones: ['pelvis_center', 'thorax_center'], metricIds: [], scope: 'No core-specific muscle biomarkers are enabled.' },
  { id: 'hips_glutes', name: 'Hips and glutes', target: 'hips_glutes', site: 'hip', atlasZones: ['pelvis_center', 'pelvis_left', 'pelvis_right'], metricIds: ['hip_extensor_force'], scope: 'Hip extensor force assesses regional function; it does not isolate a specific muscle.' },
  { id: 'quadriceps', name: 'Quadriceps', target: 'quadriceps', site: 'thigh_front', atlasZones: ['legs_center', 'legs_left', 'legs_right'], metricIds: ['knee_extensor_force', 'vastus_lateralis_thickness', 'eim_resistance_thigh', 'eim_reactance_thigh', 'eim_phase_angle_thigh', 'creatine_kinase'], scope: 'Available measurements cover the knee or thigh and do not isolate the quadriceps.' },
  { id: 'hamstrings', name: 'Hamstrings', target: 'hamstrings', site: 'thigh_back', atlasZones: ['legs_center', 'legs_left', 'legs_right'], metricIds: ['hip_extensor_force', 'eim_resistance_thigh', 'eim_reactance_thigh', 'eim_phase_angle_thigh', 'creatine_kinase'], scope: 'Available measurements cover the hip or thigh and do not isolate the hamstrings.' },
  { id: 'calves', name: 'Calves', target: 'calves', site: 'calf', atlasZones: ['legs_center', 'legs_left', 'legs_right'], metricIds: ['ankle_plantarflexor_force'], scope: 'Plantar-flexor force assesses ankle function; the atlas does not separate individual calf muscles.' },
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
  muscle_head: { target: [0, 1.59, 0], position: [0.05, 1.62, 0.7] },
  muscle_thorax: { target: [0, 1.28, 0], position: [0.04, 1.3, 1.25] },
  muscle_pelvis: { target: [0, 0.91, 0], position: [0.04, 0.94, 1.1] },
  muscle_legs: { target: [0, 0.5, 0], position: [0.04, 0.53, 1.35] },
  muscle_neck: { target: [0, 1.46, 0.02], position: [0.02, 1.48, 0.62] },
  muscle_shoulders: { target: [0, 1.4, 0.02], position: [0.05, 1.42, 0.85] },
  muscle_chest: { target: [0, 1.3, 0.04], position: [0.02, 1.32, 0.95] },
  muscle_back: { target: [0, 1.3, -0.02], position: [0.02, 1.32, -0.95] },
  muscle_upper_arms: { target: [-0.2, 1.2, 0], position: [-0.18, 1.22, 0.76] },
  muscle_forearms: { target: [-0.24, 1.0, 0], position: [-0.22, 1.02, 0.7] },
  muscle_hands: { target: [-0.27, 0.88, 0.02], position: [-0.25, 0.9, 0.58] },
  muscle_core: { target: [0, 1.04, 0.04], position: [0.02, 1.06, 0.8] },
  muscle_hips_glutes: { target: [0, 0.91, -0.01], position: [0.02, 0.93, -0.8] },
  muscle_quadriceps: { target: [0, 0.62, 0.03], position: [0.02, 0.64, 0.78] },
  muscle_hamstrings: { target: [0, 0.62, -0.02], position: [0.02, 0.64, -0.78] },
  muscle_calves: { target: [0, 0.3, 0.02], position: [0.02, 0.32, 0.7] },
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
  heart: { label: 'Heart', point: [0.025, 1.29, 0.035], radius: 0.085 },
  neck: { label: 'Venas yugulares · zona cervical', point: [0.015, 1.45, 0.025], radius: 0.055 },
  muscle_neck: { label: 'Cuello', point: [0.015, 1.46, 0.045], radius: 0.05 },
  shoulders: { label: 'Hombros', point: [0.19, 1.39, 0.035], radius: 0.07 },
  chest: { label: 'Pecho', point: [0, 1.3, 0.075], radius: 0.085 },
  back: { label: 'Espalda', point: [0, 1.3, -0.04], radius: 0.085 },
  upper_arm: { label: 'Brazo', point: [-0.22, 1.2, 0.02], radius: 0.07 },
  hands: { label: 'Manos', point: [-0.27, 0.88, 0.025], radius: 0.045 },
  lungs: { label: 'Pulmones', point: [-0.075, 1.36, 0.02], radius: 0.11 },
  brain: { label: 'Brain', point: [0, 1.63, -0.005], radius: 0.09 },
  kidneys: { label: 'Kidneys', point: [0.06, 1.1, -0.015], radius: 0.075 },
  adrenal: { label: 'Suprarrenales', point: [-0.055, 1.16, -0.02], radius: 0.05 },
  liver: { label: 'Liver', point: [-0.055, 1.18, 0.04], radius: 0.08 },
  abdomen: { label: 'Abdomen', point: [0.0, 1.04, 0.06], radius: 0.1 },
  core: { label: 'Tronco', point: [0.0, 1.22, 0.02], radius: 0.13 },
  forearm: { label: 'Antebrazo', point: [-0.24, 0.98, 0.0], radius: 0.09 },
  hip: { label: 'Hip and proximal femur', point: [0.1, 0.9, 0.015], radius: 0.11 },
  thigh: { label: 'Thigh', point: [-0.09, 0.62, 0.03], radius: 0.1 },
  thigh_front: { label: 'Quadriceps', point: [-0.09, 0.62, 0.07], radius: 0.08 },
  thigh_back: { label: 'Hamstrings', point: [-0.09, 0.62, -0.045], radius: 0.08 },
  calf: { label: 'Calf', point: [-0.075, 0.3, 0.035], radius: 0.065 },
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
