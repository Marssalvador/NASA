-- AEGIS longitudinal physiological record.
--
-- Design rules (see docs/MEDICAL_RECORD_ARCHITECTURE.md):
--   * Private schema `aegis`: not exposed to the Data/GraphQL API; reached through the AEGIS API.
--   * Original observations are append-only. A correction is a new row that `supersedes` the old one
--     and states a reason; nothing is overwritten or deleted.
--   * Every evaluation is immutable and stores model version, inputs, evidence ids, uncertainty and a
--     reproducibility hash. The engine can never record a clinical diagnosis or a disease probability.
--   * Units are bound to the catalogue through a composite foreign key: a unit change needs a migration.

create schema if not exists aegis;
revoke all on schema aegis from public;
comment on schema aegis is 'AEGIS astronaut physiological record. Private: synthetic data only in development.';

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Shared guards
-- ---------------------------------------------------------------------------------------------
create function aegis.forbid_mutation() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'AEGIS: % is append-only; record a new version or correction instead', tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

create table aegis.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_key text not null,
  astronaut_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_row jsonb,
  new_row jsonb,
  actor uuid default auth.uid(),
  at timestamptz not null default now()
);
create index audit_log_astronaut_at on aegis.audit_log (astronaut_id, at desc);

create function aegis.write_audit() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  payload jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into aegis.audit_log (table_name, row_key, astronaut_id, action, old_row, new_row)
  values (
    tg_table_name,
    coalesce(payload ->> 'id', payload ->> 'user_id' || ':' || (payload ->> 'astronaut_id')),
    nullif(coalesce(payload ->> 'astronaut_id', case when tg_table_name = 'astronauts' then payload ->> 'id' end), '')::uuid,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Identity and history
-- ---------------------------------------------------------------------------------------------
create table aegis.astronauts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]-[0-9]{3}$'),
  display_name text not null,
  sex text not null check (sex in ('female', 'male', 'unspecified')),
  -- Declared by the astronaut; the cycle module is a context modifier only when 'active'.
  cycle_status text not null default 'not_applicable'
    check (cycle_status in ('active', 'suppressed', 'not_applicable', 'unknown')),
  usual_cycle_length_days smallint check (usual_cycle_length_days between 20 and 45),
  is_synthetic boolean not null,
  created_at timestamptz not null default now(),
  constraint cycle_only_declared_for_female check (sex = 'female' or cycle_status = 'not_applicable')
);
comment on column aegis.astronauts.usual_cycle_length_days is
  'Declared usual cycle length. Phase is estimated from the last menstruation_start event plus this value.';

create table aegis.medical_history (
  id bigint generated always as identity primary key,
  astronaut_id uuid not null references aegis.astronauts (id) on delete restrict,
  category text not null check (category in ('condition', 'surgery', 'allergy', 'medication', 'family', 'other')),
  description text not null check (length(description) > 0),
  onset_date date,
  resolved_date date,
  source text not null check (length(source) > 0),
  recorded_by uuid references auth.users (id),
  recorded_at timestamptz not null default now(),
  is_synthetic boolean not null,
  check (resolved_date is null or onset_date is null or resolved_date >= onset_date)
);
create index medical_history_astronaut on aegis.medical_history (astronaut_id);

-- ---------------------------------------------------------------------------------------------
-- Catalogues (seeded from versioned data files, read-only for clients)
-- ---------------------------------------------------------------------------------------------
create table aegis.biomarker_definitions (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  unit text not null,
  body_system text not null,
  body_region text not null check (body_region in ('heart', 'lungs', 'kidneys', 'muscles', 'skeleton', 'brain', 'metabolic')),
  sensing_layer smallint not null check (sensing_layer in (1, 2)),
  sample_type text not null,
  measurement_method text not null,
  expected_frequency_hours numeric check (expected_frequency_hours > 0),
  sensor_readiness text not null check (sensor_readiness in ('validated', 'experimental')),
  reference_source text not null,
  enabled boolean not null default true,
  unique (id, unit)
);

create table aegis.risk_definitions (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text not null,
  body_region text not null,
  criteria text not null,
  source_document text not null,
  validation_status text not null check (validation_status in ('design_hypothesis', 'literature_supported', 'validated'))
);

create table aegis.biomarker_risk_links (
  risk_id text not null references aegis.risk_definitions (id),
  biomarker_id text not null references aegis.biomarker_definitions (id),
  role text not null check (role in ('trigger', 'confirmation', 'context', 'modifier')),
  rationale text not null,
  source_document text not null,
  evidence_level text not null check (evidence_level in ('document_orientative', 'literature', 'validated')),
  primary key (risk_id, biomarker_id, role)
);
create index biomarker_risk_links_biomarker on aegis.biomarker_risk_links (biomarker_id);

create table aegis.model_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  kind text not null check (kind in ('statistical_rules', 'ml_model')),
  description text not null,
  training_data text,
  validation_status text not null
    check (validation_status in ('demo_unvalidated', 'unvalidated', 'internally_validated', 'externally_validated')),
  validated_by text,
  validated_at timestamptz,
  reference text,
  created_at timestamptz not null default now(),
  unique (name, version),
  constraint validated_models_have_evidence check (
    validation_status in ('demo_unvalidated', 'unvalidated')
    or (validated_by is not null and validated_at is not null and reference is not null)
  )
);

create table aegis.clinical_protocols (
  id text primary key check (id ~ '^[a-z][a-z0-9_.-]*$'),
  risk_id text references aegis.risk_definitions (id),
  title text not null,
  -- Machine-readable trigger: biomarker, feature, comparison and window, from the source document.
  trigger_rule jsonb not null,
  alert_level text not null check (alert_level in ('green', 'yellow', 'orange', 'red')),
  category text not null check (category in ('nutritional', 'exercise', 'pharmacological', 'escalation', 'monitoring')),
  recommendation text not null,
  applies_to jsonb not null default '{}'::jsonb,
  source_document text not null,
  validation_status text not null check (validation_status in ('pending_medical_review', 'reviewed')),
  reviewer text,
  reviewed_at timestamptz,
  reference text,
  constraint reviewed_protocols_have_evidence check (
    validation_status = 'pending_medical_review'
    or (reviewer is not null and reviewed_at is not null and reference is not null)
  )
);
create index clinical_protocols_risk on aegis.clinical_protocols (risk_id);

-- ---------------------------------------------------------------------------------------------
-- Observations (append-only)
-- ---------------------------------------------------------------------------------------------
create table aegis.measurements (
  id bigint generated always as identity primary key,
  astronaut_id uuid not null references aegis.astronauts (id) on delete restrict,
  biomarker_id text not null,
  unit text not null,
  value double precision,
  measured_at timestamptz not null,
  source text not null check (length(source) > 0),
  method text not null check (length(method) > 0),
  quality text not null check (quality in ('good', 'questionable', 'invalid', 'missing')),
  -- Activity, posture, sleep state, time of day, cycle phase as recorded at acquisition.
  context jsonb not null default '{}'::jsonb,
  is_synthetic boolean not null,
  import_batch_id uuid,
  supersedes_id bigint references aegis.measurements (id),
  correction_reason text,
  ingested_by uuid references auth.users (id),
  ingested_at timestamptz not null default now(),
  foreign key (biomarker_id, unit) references aegis.biomarker_definitions (id, unit),
  constraint finite_value check (value is null or (value <> 'NaN'::float8 and value not in ('Infinity'::float8, '-Infinity'::float8))),
  constraint missing_means_no_value check ((value is null) = (quality = 'missing')),
  constraint corrections_state_reason check ((supersedes_id is null) = (correction_reason is null))
);
-- Duplicate originals are rejected; a correction is linear (one successor per row).
create unique index measurements_original_unique
  on aegis.measurements (astronaut_id, biomarker_id, measured_at, source) where supersedes_id is null;
create unique index measurements_single_successor
  on aegis.measurements (supersedes_id) where supersedes_id is not null;
create index measurements_series on aegis.measurements (astronaut_id, biomarker_id, measured_at desc);
create trigger measurements_append_only
  before update or delete on aegis.measurements
  for each row execute function aegis.forbid_mutation();

create function aegis.check_correction() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  original aegis.measurements%rowtype;
begin
  if new.supersedes_id is null then
    return new;
  end if;
  select * into original from aegis.measurements where id = new.supersedes_id;
  if original.astronaut_id <> new.astronaut_id or original.biomarker_id <> new.biomarker_id
     or original.is_synthetic <> new.is_synthetic then
    raise exception 'AEGIS: a correction must keep astronaut, biomarker and provenance of the original';
  end if;
  return new;
end;
$$;
create trigger measurements_correction_scope
  before insert on aegis.measurements
  for each row execute function aegis.check_correction();

-- Latest version of every observation (originals without a successor).
create view aegis.current_measurements with (security_invoker = true) as
select m.*
from aegis.measurements m
where not exists (select 1 from aegis.measurements c where c.supersedes_id = m.id);

create table aegis.mission_events (
  id bigint generated always as identity primary key,
  astronaut_id uuid not null references aegis.astronauts (id) on delete restrict,
  kind text not null check (kind in (
    'exercise', 'resistive_exercise', 'sleep', 'symptom', 'eva', 'medication',
    'menstruation_start', 'countermeasure', 'other')),
  started_at timestamptz not null,
  ended_at timestamptz,
  severity text check (severity in ('info', 'mild', 'moderate', 'severe', 'emergency')),
  details jsonb not null default '{}'::jsonb,
  source text not null,
  is_synthetic boolean not null,
  recorded_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index mission_events_timeline on aegis.mission_events (astronaut_id, started_at desc);
create trigger mission_events_append_only
  before update or delete on aegis.mission_events
  for each row execute function aegis.forbid_mutation();

-- ---------------------------------------------------------------------------------------------
-- Physiological memory and derived features (versioned, append-only)
-- ---------------------------------------------------------------------------------------------
create table aegis.physiological_baselines (
  id bigint generated always as identity primary key,
  astronaut_id uuid not null references aegis.astronauts (id) on delete restrict,
  biomarker_id text not null references aegis.biomarker_definitions (id),
  kind text not null check (kind in ('initial_stable', 'recent')),
  -- 'all', or a declared context such as 'cycle_phase=luteal' or 'time_of_day=morning'.
  context_key text not null default 'all',
  method text not null,
  status text not null check (status in ('accepted', 'insufficient')),
  n integer not null check (n >= 0),
  center double precision,
  spread double precision check (spread is null or spread >= 0),
  mean double precision,
  sd double precision check (sd is null or sd >= 0),
  window_start timestamptz not null,
  window_end timestamptz not null,
  version integer not null check (version >= 1),
  parent_id bigint references aegis.physiological_baselines (id),
  engine_version text not null,
  input_measurement_ids bigint[] not null,
  is_synthetic boolean not null,
  created_at timestamptz not null default now(),
  check (window_end > window_start),
  check (status = 'insufficient' or (center is not null and spread is not null)),
  unique (astronaut_id, biomarker_id, kind, context_key, version)
);
create index baselines_lookup on aegis.physiological_baselines (astronaut_id, biomarker_id, kind, context_key, version desc);
create trigger baselines_append_only
  before update or delete on aegis.physiological_baselines
  for each row execute function aegis.forbid_mutation();

create table aegis.derived_features (
  id bigint generated always as identity primary key,
  astronaut_id uuid not null references aegis.astronauts (id) on delete restrict,
  biomarker_id text references aegis.biomarker_definitions (id),
  feature text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  value double precision,
  n integer not null check (n >= 0),
  quality text not null check (quality in ('complete', 'partial', 'insufficient')),
  run_id uuid not null,
  engine_version text not null,
  input_measurement_ids bigint[] not null,
  computed_at timestamptz not null default now(),
  constraint finite_feature check (value is null or (value <> 'NaN'::float8 and value not in ('Infinity'::float8, '-Infinity'::float8)))
);
create index derived_features_series on aegis.derived_features (astronaut_id, feature, window_end desc);
create trigger derived_features_append_only
  before update or delete on aegis.derived_features
  for each row execute function aegis.forbid_mutation();

-- ---------------------------------------------------------------------------------------------
-- Evaluations, requests and human review
-- ---------------------------------------------------------------------------------------------
create table aegis.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  astronaut_id uuid not null references aegis.astronauts (id) on delete restrict,
  risk_id text not null references aegis.risk_definitions (id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  model_version_id uuid not null references aegis.model_versions (id),
  produced_by text not null check (produced_by in ('engine', 'clinician')),
  alert_level text not null check (alert_level in ('green', 'yellow', 'orange', 'red', 'insufficient_data')),
  certainty text not null check (certainty in ('observation', 'suspicion', 'confirmed_finding', 'clinical_diagnosis')),
  result jsonb not null,
  uncertainty jsonb not null,
  input_quality text not null check (input_quality in ('complete', 'partial', 'insufficient')),
  inputs_used jsonb not null,
  missing_inputs text[] not null default '{}',
  evidence_measurement_ids bigint[] not null,
  context jsonb not null default '{}'::jsonb,
  explanation text not null check (length(explanation) > 0),
  reproducibility_hash text not null,
  supersedes_id uuid references aegis.risk_assessments (id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  -- Only a professional records a diagnosis; no stored output may carry a disease probability.
  constraint engine_never_diagnoses check (certainty <> 'clinical_diagnosis' or produced_by = 'clinician'),
  constraint no_unvalidated_probability check (not (result ? 'disease_probability'))
);
create index risk_assessments_timeline on aegis.risk_assessments (astronaut_id, risk_id, period_end desc);
create trigger risk_assessments_append_only
  before update or delete on aegis.risk_assessments
  for each row execute function aegis.forbid_mutation();

create table aegis.test_requests (
  id uuid primary key default gen_random_uuid(),
  astronaut_id uuid not null references aegis.astronauts (id) on delete restrict,
  assessment_id uuid not null references aegis.risk_assessments (id),
  biomarker_id text not null references aegis.biomarker_definitions (id),
  reason text not null check (length(reason) > 0),
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'collected', 'resulted', 'cancelled')),
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users (id),
  result_measurement_id bigint references aegis.measurements (id),
  reevaluation_assessment_id uuid references aegis.risk_assessments (id),
  updated_at timestamptz not null default now(),
  check (status <> 'resulted' or result_measurement_id is not null)
);
create index test_requests_open on aegis.test_requests (astronaut_id, status, requested_at desc);
create trigger test_requests_audit
  after insert or update or delete on aegis.test_requests
  for each row execute function aegis.write_audit();

create table aegis.assessment_feedback (
  id bigint generated always as identity primary key,
  assessment_id uuid not null references aegis.risk_assessments (id),
  astronaut_id uuid not null references aegis.astronauts (id),
  reviewer_user_id uuid not null references auth.users (id),
  reviewer_role text not null check (reviewer_role in ('flight_surgeon', 'researcher')),
  verdict text not null check (verdict in ('agree', 'disagree', 'needs_more_data')),
  certainty_assigned text check (certainty_assigned in ('observation', 'suspicion', 'confirmed_finding', 'clinical_diagnosis')),
  notes text,
  created_at timestamptz not null default now(),
  constraint diagnosis_only_by_flight_surgeon check (
    certainty_assigned is distinct from 'clinical_diagnosis' or reviewer_role = 'flight_surgeon')
);
create index assessment_feedback_assessment on aegis.assessment_feedback (assessment_id);
create index assessment_feedback_astronaut on aegis.assessment_feedback (astronaut_id);
create trigger assessment_feedback_append_only
  before update or delete on aegis.assessment_feedback
  for each row execute function aegis.forbid_mutation();

-- Trace changes to mutable identity, history and catalogue rows.
create trigger astronauts_audit after insert or update or delete on aegis.astronauts
  for each row execute function aegis.write_audit();
create trigger medical_history_audit after insert or update or delete on aegis.medical_history
  for each row execute function aegis.write_audit();
create trigger model_versions_audit after insert or update or delete on aegis.model_versions
  for each row execute function aegis.write_audit();
create trigger clinical_protocols_audit after insert or update or delete on aegis.clinical_protocols
  for each row execute function aegis.write_audit();

-- A request or a review always belongs to the same astronaut as the assessment it refers to.
create function aegis.check_assessment_owner() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from aegis.risk_assessments a where a.id = new.assessment_id and a.astronaut_id = new.astronaut_id
  ) then
    raise exception 'AEGIS: assessment % does not belong to astronaut %', new.assessment_id, new.astronaut_id;
  end if;
  return new;
end;
$$;
create trigger test_requests_owner before insert or update on aegis.test_requests
  for each row execute function aegis.check_assessment_owner();
create trigger assessment_feedback_owner before insert on aegis.assessment_feedback
  for each row execute function aegis.check_assessment_owner();
