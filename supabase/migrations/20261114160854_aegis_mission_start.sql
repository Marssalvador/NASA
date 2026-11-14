-- The initial stable reference is built only from observations before mission start and is
-- never inferred from the evaluation window. Mission start is therefore part of the profile.
alter table aegis.astronauts add column mission_start timestamptz;
comment on column aegis.astronauts.mission_start is
  'Start of the evaluated mission period. Observations before it feed the initial stable baseline.';
