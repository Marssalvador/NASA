import type { Biomarker } from './types';
export type Level = 'green' | 'yellow' | 'orange' | 'red' | 'insufficient_data';
export interface MedicalMeasurement {
  id: number;
  astronaut_id: string;
  biomarker_id: string;
  value: number | null;
  unit: string;
  measured_at: string;
  source: string;
  method: string;
  quality: string;
  is_synthetic: boolean;
}
export interface MedicalReference {
  id: number;
  biomarker_id: string;
  status: string;
  kind: string;
  context_key: string;
  center: number | null;
  spread: number | null;
  n: number;
  window_start: string;
  window_end: string;
  input_ids: number[];
  version: number;
}
export interface MedicalAssessment {
  id: string;
  risk_id: string;
  risk_name: string;
  body_region: string;
  alert_level: Level;
  certainty: 'observation' | 'suspicion' | 'confirmed_finding';
  input_quality: string;
  missing_inputs: string[];
  explanation: string;
  evidence_ids: number[];
  evidence_links: string[];
  supersedes_id: string | null;
  uncertainty: { statement?: string; coverage?: number };
  confirmations: Record<string, { state: string; fresh?: boolean; measurement_id?: number }>;
  recommendations: {
    display: string;
    proposed_text: string | null;
    category: string;
    note: string;
  }[];
}
export interface MedicalRequest {
  id: string;
  assessment_id: string;
  biomarker_id: string;
  reason: string;
  status: string;
  sample_value: number | null;
  result: MedicalMeasurement | null;
  reevaluation_assessment_id: string | null;
}
export interface Presentation {
  session_id: string;
  revision: number;
  code: string;
  source_code: string;
  user_id: string;
  is_synthetic: true;
  storage: 'local' | 'supabase';
  storage_note: string;
  as_of: string;
  mission_start: string;
  day: number;
  step: number;
  steps: number;
  complete: boolean;
  registry: Biomarker[];
  latest: MedicalMeasurement[];
  references: Record<string, MedicalReference | null>;
  baselines: MedicalReference[];
  series: Record<string, { day: string; value: number; n: number; measurement_ids: number[] }[]>;
  risk_definitions: {
    id: string;
    body_region: string;
    links: { biomarker: string; role: string }[];
  }[];
  measurement_count: number;
  requests: MedicalRequest[];
  report: {
    engine: string;
    model_error: string | null;
    cycle_phase: string | null;
    data_states: Record<string, string>;
    assessments: MedicalAssessment[];
    anomalies: { biomarker_id: string; robust_z: number[] }[];
    features: {
      biomarker_id: string;
      feature: string;
      value: number;
      day: string | null;
      note: string;
    }[];
    emergencies: { id: string; title: string; action: string; explanation?: string }[];
  };
  last_change: {
    kind?: string;
    ids?: number[];
    measurement_id?: number;
    previous_assessment_id?: string;
    reevaluation_id?: string;
  };
}
