-- Explicit, per-astronaut access. Nobody sees an astronaut's record without a grant row.
--
-- The `aegis` schema is not exposed to the Data API. The AEGIS API runs each request inside a
-- transaction as role `authenticated` with the caller's JWT claims, so these policies apply to it
-- too. Grants are managed only by the service role (no client policy can create or widen access).

create table aegis.astronaut_access (
  user_id uuid not null references auth.users (id) on delete cascade,
  astronaut_id uuid not null references aegis.astronauts (id) on delete cascade,
  role text not null check (role in ('self', 'flight_surgeon', 'researcher', 'data_engineer')),
  can_write boolean not null default false,
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, astronaut_id),
  check (revoked_at is null or revoked_at >= granted_at)
);
create index astronaut_access_astronaut on aegis.astronaut_access (astronaut_id);
create trigger astronaut_access_audit after insert or update or delete on aegis.astronaut_access
  for each row execute function aegis.write_audit();

-- Helpers run as the caller (SECURITY INVOKER): they only see the caller's own grant rows.
create function aegis.can_read(target uuid) returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select exists (
    select 1 from aegis.astronaut_access a
    where a.astronaut_id = target and a.user_id = (select auth.uid()) and a.revoked_at is null
  );
$$;

create function aegis.can_write(target uuid) returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select exists (
    select 1 from aegis.astronaut_access a
    where a.astronaut_id = target and a.user_id = (select auth.uid()) and a.revoked_at is null and a.can_write
  );
$$;

create function aegis.is_flight_surgeon(target uuid) returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select exists (
    select 1 from aegis.astronaut_access a
    where a.astronaut_id = target and a.user_id = (select auth.uid()) and a.revoked_at is null
      and a.role = 'flight_surgeon'
  );
$$;

revoke all on all functions in schema aegis from public, anon;
grant execute on function aegis.can_read(uuid), aegis.can_write(uuid), aegis.is_flight_surgeon(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security on every table
-- ---------------------------------------------------------------------------------------------
alter table aegis.astronaut_access enable row level security;
alter table aegis.astronauts enable row level security;
alter table aegis.medical_history enable row level security;
alter table aegis.biomarker_definitions enable row level security;
alter table aegis.risk_definitions enable row level security;
alter table aegis.biomarker_risk_links enable row level security;
alter table aegis.model_versions enable row level security;
alter table aegis.clinical_protocols enable row level security;
alter table aegis.measurements enable row level security;
alter table aegis.mission_events enable row level security;
alter table aegis.physiological_baselines enable row level security;
alter table aegis.derived_features enable row level security;
alter table aegis.risk_assessments enable row level security;
alter table aegis.test_requests enable row level security;
alter table aegis.assessment_feedback enable row level security;
alter table aegis.audit_log enable row level security;

create policy "own grants are visible" on aegis.astronaut_access for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "granted astronauts are readable" on aegis.astronauts for select to authenticated
  using ((select aegis.can_read(id)));

create policy "history readable with grant" on aegis.medical_history for select to authenticated
  using ((select aegis.can_read(astronaut_id)));
create policy "history writable with write grant" on aegis.medical_history for insert to authenticated
  with check ((select aegis.can_write(astronaut_id)) and recorded_by = (select auth.uid()));

-- Catalogues: readable by signed-in users, written only by the service role through migrations.
create policy "catalogue readable" on aegis.biomarker_definitions for select to authenticated using (true);
create policy "catalogue readable" on aegis.risk_definitions for select to authenticated using (true);
create policy "catalogue readable" on aegis.biomarker_risk_links for select to authenticated using (true);
create policy "catalogue readable" on aegis.model_versions for select to authenticated using (true);
create policy "catalogue readable" on aegis.clinical_protocols for select to authenticated using (true);

create policy "measurements readable with grant" on aegis.measurements for select to authenticated
  using ((select aegis.can_read(astronaut_id)));
create policy "measurements insertable with write grant" on aegis.measurements for insert to authenticated
  with check ((select aegis.can_write(astronaut_id)) and ingested_by = (select auth.uid()));

create policy "events readable with grant" on aegis.mission_events for select to authenticated
  using ((select aegis.can_read(astronaut_id)));
create policy "events insertable with write grant" on aegis.mission_events for insert to authenticated
  with check ((select aegis.can_write(astronaut_id)));

-- Engine outputs are written by the service-side engine; clients only read them.
create policy "baselines readable with grant" on aegis.physiological_baselines for select to authenticated
  using ((select aegis.can_read(astronaut_id)));
create policy "features readable with grant" on aegis.derived_features for select to authenticated
  using ((select aegis.can_read(astronaut_id)));
create policy "assessments readable with grant" on aegis.risk_assessments for select to authenticated
  using ((select aegis.can_read(astronaut_id)));

create policy "requests readable with grant" on aegis.test_requests for select to authenticated
  using ((select aegis.can_read(astronaut_id)));
create policy "requests decided by flight surgeon" on aegis.test_requests for update to authenticated
  using ((select aegis.is_flight_surgeon(astronaut_id)))
  with check ((select aegis.is_flight_surgeon(astronaut_id)) and decided_by = (select auth.uid()));

create policy "feedback readable with grant" on aegis.assessment_feedback for select to authenticated
  using ((select aegis.can_read(astronaut_id)));
create policy "feedback by reviewers" on aegis.assessment_feedback for insert to authenticated
  with check (
    reviewer_user_id = (select auth.uid())
    and exists (
      select 1 from aegis.astronaut_access a
      where a.astronaut_id = assessment_feedback.astronaut_id and a.user_id = (select auth.uid())
        and a.revoked_at is null and a.role = assessment_feedback.reviewer_role
    )
  );

create policy "audit readable with grant" on aegis.audit_log for select to authenticated
  using (astronaut_id is not null and (select aegis.can_read(astronaut_id)));

-- ---------------------------------------------------------------------------------------------
-- Privileges: nothing for anon; least privilege for authenticated; full for the service role.
-- ---------------------------------------------------------------------------------------------
grant usage on schema aegis to authenticated, service_role;
grant select on all tables in schema aegis to authenticated;
grant insert on aegis.medical_history, aegis.measurements, aegis.mission_events, aegis.assessment_feedback
  to authenticated;
grant update (status, decided_by, result_measurement_id, reevaluation_assessment_id, updated_at)
  on aegis.test_requests to authenticated;
grant all on all tables in schema aegis to service_role;
grant usage on all sequences in schema aegis to authenticated, service_role;
revoke all on all tables in schema aegis from anon;

-- The audit trigger must append even when the writer has no INSERT right on audit_log.
-- Trigger functions cannot be called directly, and `aegis` is not an exposed schema.
alter function aegis.write_audit() security definer;
revoke all on function aegis.write_audit() from public, anon, authenticated;
