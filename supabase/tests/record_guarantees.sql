-- Verifies isolation and record guarantees on a live database. Everything runs inside one
-- transaction that is rolled back: no users, astronauts or measurements remain afterwards.
-- Returns one JSON row: {check_name: observed_result}.
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'astro.a@aegis.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'astro.b@aegis.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'surgeon@aegis.invalid', '{}', '{}', now(), now());

insert into aegis.astronauts (id, code, display_name, sex, cycle_status, usual_cycle_length_days, is_synthetic) values
  ('10000000-0000-4000-a000-00000000000a', 'T-901', 'Synthetic A', 'female', 'active', 28, true),
  ('10000000-0000-4000-a000-00000000000b', 'T-902', 'Synthetic B', 'male', 'not_applicable', null, true);

insert into aegis.astronaut_access (user_id, astronaut_id, role, can_write) values
  ('00000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-00000000000a', 'self', true),
  ('00000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-00000000000b', 'self', true),
  ('00000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-00000000000a', 'flight_surgeon', false);

insert into aegis.measurements (astronaut_id, biomarker_id, unit, value, measured_at, source, method, quality, is_synthetic) values
  ('10000000-0000-4000-a000-00000000000a', 'hrv', 'ms', 52, '2026-11-01T07:00Z', 'probe', 'RMSSD', 'good', true),
  ('10000000-0000-4000-a000-00000000000b', 'hrv', 'ms', 61, '2026-11-01T07:00Z', 'probe', 'RMSSD', 'good', true);

-- Runs a statement as the current role and reports 'ok' or the SQLSTATE, without aborting.
create function aegis.probe(stmt text) returns text
language plpgsql security invoker set search_path = '' as $$
begin
  execute stmt;
  return 'ok';
exception when others then
  return sqlstate;
end;
$$;
grant execute on function aegis.probe(text) to authenticated;

create temporary table results (name text, observed text) on commit drop;
grant insert, select on results to authenticated;

-- As astronaut A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}', true);
insert into results values
  ('a_sees_astronauts', (select string_agg(code, ',' order by code) from aegis.astronauts)),
  ('a_sees_measurements_of', (select string_agg(distinct a.code, ',') from aegis.measurements m join aegis.astronauts a on a.id = m.astronaut_id)),
  ('a_inserts_own', aegis.probe($$insert into aegis.measurements (astronaut_id, biomarker_id, unit, value, measured_at, source, method, quality, is_synthetic, ingested_by) values ('10000000-0000-4000-a000-00000000000a','hrv','ms',50,'2026-11-02T07:00Z','probe','RMSSD','good',true,'00000000-0000-4000-a000-000000000001')$$)),
  ('a_inserts_for_b', aegis.probe($$insert into aegis.measurements (astronaut_id, biomarker_id, unit, value, measured_at, source, method, quality, is_synthetic, ingested_by) values ('10000000-0000-4000-a000-00000000000b','hrv','ms',50,'2026-11-02T07:00Z','probe','RMSSD','good',true,'00000000-0000-4000-a000-000000000001')$$)),
  ('a_grants_itself_b', aegis.probe($$insert into aegis.astronaut_access (user_id, astronaut_id, role) values ('00000000-0000-4000-a000-000000000001','10000000-0000-4000-a000-00000000000b','self')$$)),
  ('a_updates_measurement', aegis.probe($$update aegis.measurements set value = 1 where astronaut_id = '10000000-0000-4000-a000-00000000000a'$$));

-- As astronaut B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}', true);
insert into results values
  ('b_sees_astronauts', (select string_agg(code, ',' order by code) from aegis.astronauts)),
  ('b_sees_a_measurements', (select count(*)::text from aegis.measurements where astronaut_id = '10000000-0000-4000-a000-00000000000a'));

-- Anonymous callers cannot even resolve the schema.
reset role;
insert into results values
  ('anon_schema_usage', has_schema_privilege('anon', 'aegis', 'USAGE')::text),
  ('anon_select_measurements', has_table_privilege('anon', 'aegis.measurements', 'SELECT')::text);

-- Integrity guarantees, even for the service owner
reset role;
insert into results values
  ('owner_updates_measurement', aegis.probe($$update aegis.measurements set value = 1$$)),
  ('owner_deletes_measurement', aegis.probe($$delete from aegis.measurements$$)),
  ('nan_value', aegis.probe($$insert into aegis.measurements (astronaut_id, biomarker_id, unit, value, measured_at, source, method, quality, is_synthetic) values ('10000000-0000-4000-a000-00000000000a','hrv','ms','NaN','2026-11-03T07:00Z','probe','RMSSD','good',true)$$)),
  ('wrong_unit', aegis.probe($$insert into aegis.measurements (astronaut_id, biomarker_id, unit, value, measured_at, source, method, quality, is_synthetic) values ('10000000-0000-4000-a000-00000000000a','hrv','s',0.05,'2026-11-03T07:00Z','probe','RMSSD','good',true)$$)),
  ('duplicate_original', aegis.probe($$insert into aegis.measurements (astronaut_id, biomarker_id, unit, value, measured_at, source, method, quality, is_synthetic) values ('10000000-0000-4000-a000-00000000000a','hrv','ms',52,'2026-11-01T07:00Z','probe','RMSSD','good',true)$$)),
  ('correction_with_reason', aegis.probe($$insert into aegis.measurements (astronaut_id, biomarker_id, unit, value, measured_at, source, method, quality, is_synthetic, supersedes_id, correction_reason) select astronaut_id, biomarker_id, unit, 53, measured_at, source, method, 'good', true, id, 'transcription error' from aegis.measurements where astronaut_id = '10000000-0000-4000-a000-00000000000a' and value = 52$$)),
  ('engine_diagnosis', aegis.probe($$insert into aegis.risk_assessments (astronaut_id, risk_id, period_start, period_end, model_version_id, produced_by, alert_level, certainty, result, uncertainty, input_quality, inputs_used, evidence_measurement_ids, explanation, reproducibility_hash) select '10000000-0000-4000-a000-00000000000a','bone_resorption',now(),now(),id,'engine','green','clinical_diagnosis','{}','{}','complete','{}','{}','x','h' from aegis.model_versions limit 1$$)),
  ('disease_probability', aegis.probe($$insert into aegis.risk_assessments (astronaut_id, risk_id, period_start, period_end, model_version_id, produced_by, alert_level, certainty, result, uncertainty, input_quality, inputs_used, evidence_measurement_ids, explanation, reproducibility_hash) select '10000000-0000-4000-a000-00000000000a','bone_resorption',now(),now(),id,'engine','green','observation','{"disease_probability":0.4}','{}','complete','{}','{}','x','h' from aegis.model_versions limit 1$$)),
  ('audit_rows_for_a', (select count(*)::text from aegis.audit_log where astronaut_id = '10000000-0000-4000-a000-00000000000a'));

-- Separate statement: a statement only sees rows committed by earlier statements.
insert into results values
  ('current_view_hides_superseded', (select string_agg(value::text, ',' order by value) from aegis.current_measurements where astronaut_id = '10000000-0000-4000-a000-00000000000a'));

-- Revoking access removes visibility immediately
update aegis.astronaut_access set revoked_at = now() where user_id = '00000000-0000-4000-a000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}', true);
insert into results values ('a_after_revocation', (select count(*)::text from aegis.astronauts));
reset role;

select jsonb_object_agg(name, observed) as checks from results;
rollback;
