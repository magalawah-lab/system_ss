-- ============================================================================
-- 003_seed_relational_from_state.sql
--
-- PHASE A of the school_state (JSONB blob) -> relational migration.
-- Run this in the Supabase SQL editor. Nothing else has to be deployed.
--
-- WHAT IT DOES
--   Copies the single ~900 KB public.school_state row into:
--     academic_years, terms, classes, streams, subjects, stream_subjects,
--     students, assessments, scores
--   using the same deterministic UUID mapping as server/supabase-db.ts
--   (stableId() = sha256 of "<prefix>:<value>", rendered as a v5-shaped UUID),
--   so a later read/write switch maps client-side string ids to the exact same
--   rows this script created.
--
-- SAFETY
--   * It never deletes from and never rewrites public.school_state, so the blob
--     stays the source of truth and the rollback is "do nothing".
--   * Idempotent. Every write is an UPSERT on the primary key `id`, so re-running
--     is a no-op instead of a duplicate-key error.
--   * One exception to "additive", added by decision: a student or assessment
--     deleted in the app is hard deleted here along with its marks, because the
--     blob is the source of truth for deletions too. Only the two tables that
--     carry blob_id are touched, which is the only mapping that can tell an
--     app deletion apart from a row that predates the seed. This is the one
--     irreversible statement in the file - read the `deletes` block before
--     running, and take a fresh /api/backup first. Everything is reported.
--   * Fails loudly (and the whole transaction rolls back) when the data cannot be
--     mapped safely: duplicate derived student UUIDs, duplicate derived ids among
--     academic years/terms/classes/streams/assessments, admission-number
--     collisions, or student admission numbers already owned by a different id.
--     It never picks a winner between two rows that would merge into one. Nor
--     does it delete anything when the blob has lost a whole table, since that
--     is a blob fault rather than a deletion.
--   * No checksum writes, no triggers, no functions left in the write path. The
--     earlier `school_state_relational_sync` trigger is NOT recreated.
--
-- DELIBERATELY EXCLUDED
--   * public.teachers / public.catalog are left untouched. public.teachers is tied
--     to Supabase Auth accounts, so seeding blob teachers whose ids are not real
--     auth users can trip a foreign key. Neither table is on the mark-entry path.
--   * scores are copied, but nothing reads them yet. That is Phase B/C.
--
-- ADMISSION-NUMBER POLICY (agreed)
--   the 3 duplicate pairs (S1B097, S1C091, S1B096) -> first row in deterministic
--   UUID order keeps the number, later rows become "<number>-2", "<number>-3".
--   the 8 blank numbers                          -> "PENDING-<8 hex of row UUID>".
--   Every adjusted row is listed in the returned report so it can be corrected in
--   the UI and re-seeded. Nothing is silently dropped.
--
-- TWO CALLERS OF THE SEED FUNCTION
--   1. Phase A (this file, STEP 2 / STEP 5) - seed_relational_from_state() with no
--      argument, i.e. the full seed *including* marks. Run by hand in the SQL
--      editor. STEP 5 runs it and then prints the report plus the parity checks.
--   2. Release 1 (server/supabase-db.ts) - through the gate function
--      public.sync_relational_structure(fingerprint), which calls the seed with
--      p_include_scores = false, i.e. structure only, no public.scores write. It
--      runs over PostgREST RPC with the service-role key after a save whose
--      structure actually changed, so a class or student created in the app also
--      exists as relational rows for Release 2's mark writes to attach to, and a
--      student deleted in the app loses its row and its marks here as well. The
--      relational tables are otherwise a frozen seed-time snapshot and their only
--      other writer (insertRelationalClasses) is dead code.
--      This path never writes marks and the read path still reads the blob, so
--      Release 1 on its own changes no user-visible behaviour - except that a
--      deletion now also removes that student's seeded marks immediately. No
--      reader sees them either way, and after Release 2 both would.
--      The fingerprint is computed in TypeScript, so the first save after this
--      file is run does one structural sync (the fingerprint row is still empty)
--      and thereafter only structural saves do.
--
-- HOW TO RUN
--   0. Run migrations/004_scores_numeric.sql first. It retypes scores.score and
--      assessments.max_score from integer to numeric, which this file needs in
--      order to keep the blob's fractional marks (13,343 of 31,553) intact.
--      Without it this seed would silently round every fractional mark again.
--   1. Snapshot first:   GET <app-url>/api/backup   (downloads school-backup-*.json)
--      Now load-bearing, not just good practice: the seed hard deletes students
--      and assessments the blob no longer has, and the tables hold the only
--      surviving copy of the marks of a student the blob has lost.
--   2. Run this whole file in the Supabase SQL editor. The last statement returns
--      one JSON report - read `adjusted_admission_numbers` and the count deltas.
--      Run the WHOLE file, not just STEP 5: STEP 0b is what adds the blob_id
--      columns, and the seed writes them.
--   3. Compare `blob_counts` with `table_counts` in that report. `students`,
--      `scores` and `assessments` are the ones that matter.
--   4. STEP 5 at the bottom is the statement to run: it re-runs the seed and
--      returns the report, the blob-vs-table parity and the invariants in one
--      JSON row. STEP 3 / STEP 4 are the same checks broken out individually.
--      Send STEP 5's output before Phase B.
--      On a healthy run: every `delta` is 0, `table_counts_before` equals
--      `table_counts_after` (that is the idempotency proof),
--      `scores_with_fractional_value` is 13343, `orphan_scores` is 0, and the
--      only non-zero invariant is `pending_placeholders` (8).
--      Phase B1 (STEP 0b) adds the blob_id mapping. On the run that first fills
--      it, expect `blob_id_mapping.students_with_blob_id` 1729,
--      `students_relinked_by_blob_id` 0 (nothing is relinked until an admission
--      number is corrected), and `duplicate_blob_student_ids` /
--      `stale_blob_id_rows` both 0.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- STEP 0 - schema guard.
-- `create table if not exists` is a no-op on the live project (these tables
-- already exist); it only makes this file runnable end to end on a fresh one.
-- No table and no column is ever dropped or retyped here. STEP 0b below adds two
-- columns and two indexes to tables that already exist, plus one new table.
-- ---------------------------------------------------------------------------
create table if not exists public.academic_years (
  id uuid primary key,
  name text not null default '',
  start_date date,
  end_date date,
  is_active boolean not null default false
);

create table if not exists public.terms (
  id uuid primary key,
  academic_year_id uuid,
  name text not null default '',
  number integer,
  start_date date,
  end_date date,
  is_active boolean not null default false
);

create table if not exists public.classes (
  id uuid primary key,
  name text not null default '',
  level text
);

create table if not exists public.streams (
  id uuid primary key,
  class_id uuid,
  name text not null default '',
  class_teacher_id uuid
);

create table if not exists public.subjects (
  id uuid primary key,
  name text not null default '',
  level text,
  category text
);

create table if not exists public.stream_subjects (
  id uuid primary key,
  stream_id uuid,
  subject_id uuid,
  teacher_id uuid,
  papers text[] not null default '{}'::text[]
);

create table if not exists public.students (
  id uuid primary key,
  stream_id uuid,
  student_id text not null default '',
  first_name text not null default '',
  second_name text not null default '',
  other_names text,
  gender text,
  subjects text[] not null default '{}'::text[],
  optional_subjects text[] not null default '{}'::text[],
  blob_id text
);

create table if not exists public.assessments (
  id uuid primary key,
  class_id uuid,
  name text not null default '',
  date date,
  max_score numeric,
  academic_year_id uuid,
  term_id uuid,
  blob_id text
);

create table if not exists public.scores (
  id uuid primary key,
  assessment_id uuid,
  student_id uuid,
  subject_name text not null default '',
  paper_name text not null default '',
  score numeric
);

-- Column names/types below were verified against the live project's
-- information_schema.columns on 2026-11-19. Three things the earlier drafts got
-- wrong and that are NOT worked around with add-column fallbacks:
--   * terms uses `number`, not `term_number` (adding term_number just created a
--     second, always-empty column next to the real one).
--   * stream_subjects.papers, students.subjects and students.optional_subjects
--     are text[], not jsonb.
--   * scores.score and assessments.max_score were integer; 42% of the blob's
--     marks are fractional, so both were retyped to numeric by migrations/004.
--     This file inserts the exact value it read - it does NOT round.
-- Do not re-run migrations/002; it is superseded.

-- ---------------------------------------------------------------------------
-- STEP 0b - the two columns this file introduces (Phase B1).
-- These are deliberate and new, not the guessed add-column fallbacks that used
-- to live here: the seed below fills both, so nothing is speculative.
--
-- WHY THEY EXIST
--   The relational ids are DERIVED (edges are not UUIDs in the blob: student ids
--   look like "stuv5qx5b1"), so the tables currently hold no record of which
--   blob row a row came from. A write that names one mark - assessmentId +
--   studentId as the client sends them - cannot find its row without either
--   re-deriving the hash or looking it up. Re-deriving is not stable: the
--   student hash includes studentID, and that is one of the 11 admission
--   numbers on the correction list. blob_id makes the mapping data, not code.
--
--   Verified read-only before adding: every blob student id is unique, so these
--   are safe as keys. The check is repeated in the report
--   (duplicate_blob_student_ids) so it stays proven on every run.
-- ---------------------------------------------------------------------------
alter table public.students    add column if not exists blob_id text;
alter table public.assessments add column if not exists blob_id text;

-- Plain indexes, not unique: a unique index would turn "the blob has a duplicate
-- id" from a reported number into an aborted transaction. Uniqueness is asserted
-- by the guards and reported instead.
create index if not exists students_blob_id_idx on public.students (blob_id) where blob_id is not null;
create index if not exists assessments_blob_id_idx on public.assessments (blob_id) where blob_id is not null;

-- ---------------------------------------------------------------------------
-- STEP 0c - Release 1's gate state: one row remembering the fingerprint of the
-- structure the relational tables were last built from.
--
-- WHY IT EXISTS
--   The seed is additive and nothing keeps the tables current, so a structural
--   save has to re-materialise them. But until Release 2 moves mark entry off
--   this path, marks are still saved through the same POST /classes as the
--   structure - so without a distinguishing signal every mark keystroke would
--   rebuild all of it, which is more work per save than the blob write it is
--   meant to replace.
--
--   The fingerprint is a sha256 computed in TypeScript (structuralFingerprint()
--   in server/supabase-db.ts) over the structural part of the blob with the three
--   mark maps removed. Typing a mark therefore produces the same fingerprint as
--   the last structural save, and the gate does nothing.
-- ---------------------------------------------------------------------------
create table if not exists public.relational_sync_state (
  id text primary key,
  classes_fingerprint text,
  updated_at timestamptz not null default now()
);

-- Server-only. Supabase's default privileges would otherwise grant anon and
-- authenticated access to a freshly created table; RLS with no policy denies
-- both, and service_role bypasses RLS. The browser never reads this row.
alter table public.relational_sync_state enable row level security;

-- ---------------------------------------------------------------------------
-- STEP 1 - helpers. Mirrors of the TypeScript helpers in server/supabase-db.ts.
-- ---------------------------------------------------------------------------
do $$
begin
  create extension if not exists pgcrypto with schema extensions;
exception
  when others then
    begin
      create extension if not exists pgcrypto;
    exception when others then null;
    end;
end $$;

-- Same acceptance test as isUuid() in server/supabase-db.ts.
create or replace function public.blob_is_uuid(value text)
returns boolean
language sql
immutable
as $$
  select value is not null
     and value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
$$;

-- Byte-for-byte reproduction of stableId(prefix, value) in server/supabase-db.ts:
--   hex = sha256("<prefix>:<value>")
--   id  = hex[0:8]-hex[8:12]-"5"+hex[13:16]-"8"+hex[17:20]-hex[20:32]
-- (JS slices are 0-based, substring() is 1-based, and hex[12]/hex[16] are skipped.)
create or replace function public.blob_stable_id(prefix text, value text)
returns uuid
language sql
immutable
set search_path = public, extensions
as $$
  select (
    substring(h.hex, 1, 8) || '-' ||
    substring(h.hex, 9, 4) || '-5' ||
    substring(h.hex, 14, 3) || '-8' ||
    substring(h.hex, 18, 3) || '-' ||
    substring(h.hex, 21, 12)
  )::uuid
  from (
    select encode(digest(prefix || ':' || coalesce(value, ''), 'sha256'), 'hex') as hex
  ) h;
$$;

-- JSONB readers that never raise on a missing / wrongly-typed value.
create or replace function public.blob_array(value jsonb)
returns jsonb
language sql
immutable
as $$
  select case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end;
$$;

create or replace function public.blob_object(value jsonb)
returns jsonb
language sql
immutable
as $$
  select case when jsonb_typeof(value) = 'object' then value else '{}'::jsonb end;
$$;

-- jsonb array of strings -> text[]. Non-string elements are dropped rather than
-- coerced, so a malformed `papers` entry cannot abort the whole seed.
-- stream_subjects.papers is text[] on the live schema, not jsonb.
create or replace function public.blob_text_array(value jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(elem #>> '{}' order by ord), array[]::text[])
  from jsonb_array_elements(
         case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end
       ) with ordinality as t(elem, ord)
  where jsonb_typeof(elem) = 'string';
$$;

-- Blob scores are number | string | null; anything else means "no mark".
create or replace function public.blob_score_value(value jsonb)
returns numeric
language sql
immutable
as $$
  select case
    when value is null or jsonb_typeof(value) = 'null' then null
    when jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric
    when jsonb_typeof(value) = 'string'
     and (value #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (value #>> '{}')::numeric
    else null
  end;
$$;

-- 'YYYY-MM-DD' or NULL. Guards against partial / non-ISO dates in the blob.
create or replace function public.blob_date(value text)
returns date
language sql
immutable
as $$
  select case
    when coalesce(value, '') ~ '^\d{4}-\d{2}-\d{2}$' then (value)::date
    else null
  end;
$$;

-- Blob-side score-entry count, used by the verification query.
create or replace function public.blob_score_count(classes jsonb)
returns bigint
language sql
immutable
as $$
  select coalesce(sum(
      (select count(*) from jsonb_object_keys(public.blob_object(a->'scores')))
    + (select coalesce(sum((select count(*) from jsonb_object_keys(public.blob_object(ss)))), 0)
         from jsonb_each(public.blob_object(a->'subjectScores')) se(k, ss))
    + (select coalesce(sum((select coalesce(sum((select count(*) from jsonb_object_keys(public.blob_object(ps)))), 0)
           from jsonb_each(public.blob_object(papers)) pp(pn, ps))), 0)
         from jsonb_each(public.blob_object(a->'paperScores')) pe(sn, papers))
  ), 0)
  from jsonb_array_elements(public.blob_array(classes)) c
  cross join lateral jsonb_array_elements(public.blob_array(c->'assessments')) a;
$$;


-- ---------------------------------------------------------------------------
-- Drop the previous overloads of the seed first. Read this before deleting it.
--
-- `create or replace function` matches on the argument-type list, not on the
-- name. Changing the parameter list from () to (boolean) therefore did NOT
-- replace the old function - it created a second one next to it. A zero-argument
-- call, which is what STEP 2 and STEP 5 make, then has two candidates and
-- Postgres refuses to guess:
--
--   ERROR: 42725: function public.seed_relational_from_state() is not unique
--
-- Dropping both signatures before recreating leaves exactly one function. The
-- grants are re-issued further down, and the drop runs in the same transaction
-- as the create, so the function is never absent outside this run.
-- ---------------------------------------------------------------------------
drop function if exists public.seed_relational_from_state();
drop function if exists public.seed_relational_from_state(boolean);


-- ---------------------------------------------------------------------------
-- The seed. Idempotent + single transaction. Structurally additive, but with one
-- deliberate exception: it hard deletes a student/assessment the app deleted.
--
-- p_include_scores = true   the full Phase A seed, what STEP 5 runs.
-- p_include_scores = false  structure only: everything except public.scores.
--   The server reaches this through the gate function further down, never
--   directly. It skips the 31,553 score upserts on purpose: for a structural save
--   they are both the expensive half and the pointless one, and marks are still
--   written to the blob until Release 2 ships the per-mark endpoint.
--   The deletes are NOT skipped on this path - a deletion is structural, and its
--   marks go with it, which is why the same call also removes those score rows.
--
-- The structure half is not duplicated anywhere. Putting the sync behind this
-- same function is what keeps one implementation of the id derivation: a second
-- copy in TypeScript would drift from these guards and produce students that do
-- not match the rows this function created.
-- ---------------------------------------------------------------------------
create or replace function public.seed_relational_from_state(p_include_scores boolean default true)
returns jsonb
language plpgsql
set search_path = public, extensions
as $fn$
declare
  state_row jsonb;
  before_counts jsonb;
  dup_count integer;
  collision_count integer;
  report jsonb;
  v_scores bigint;
  v_scores_skipped bigint;
  v_fractional bigint;
  v_deleted_scores bigint;
  v_deleted_students bigint;
  v_deleted_assessments bigint;
begin
  select jsonb_build_object(
           'classes', public.blob_array(classes),
           'academic_years', public.blob_array(academic_years)
         )
    into state_row
  from public.school_state
  where id = 'default';

  if state_row is null then
    raise exception 'public.school_state row with id = ''default'' was not found; nothing to seed';
  end if;

  before_counts := jsonb_build_object(
    'academic_years', (select count(*) from public.academic_years),
    'terms', (select count(*) from public.terms),
    'classes', (select count(*) from public.classes),
    'streams', (select count(*) from public.streams),
    'subjects', (select count(*) from public.subjects),
    'stream_subjects', (select count(*) from public.stream_subjects),
    'students', (select count(*) from public.students),
    'assessments', (select count(*) from public.assessments),
    'scores', (select count(*) from public.scores)
  );

  -- ============================================================ academic years
  drop table if exists pg_temp.t_year;
  create temporary table t_year on commit drop as
  select
    ye.idx,
    ye.y->>'id' as blob_id,
    case
      when public.blob_is_uuid(ye.y->>'id') then (ye.y->>'id')::uuid
      else coalesce(
        (select ay.id from public.academic_years ay
          where ay.name = coalesce(ye.y->>'name', '')
          order by ay.name
          limit 1),
        public.blob_stable_id('academic-year', coalesce(ye.y->>'id', ye.idx::text))
      )
    end as rel_id,
    coalesce(ye.y->>'name', 'Academic Year') as name,
    public.blob_date(ye.y->>'startDate') as start_date,
    public.blob_date(ye.y->>'endDate') as end_date,
    coalesce((ye.y->>'isActive')::boolean, false) as is_active
  from jsonb_array_elements(state_row->'academic_years') with ordinality as ye(y, idx);

  drop table if exists pg_temp.t_term;
  create temporary table t_term on commit drop as
  select
    ty.idx as year_idx,
    te.idx as idx,
    te.t->>'id' as blob_id,
    ty.rel_id as year_rel_id,
    case
      when public.blob_is_uuid(te.t->>'id') then (te.t->>'id')::uuid
      else coalesce(
        (select tm.id from public.terms tm
          where tm.academic_year_id = ty.rel_id
            and coalesce(tm.name, '') = coalesce(te.t->>'name', '')
          limit 1),
        public.blob_stable_id('term', ty.rel_id::text || ':' || coalesce(te.t->>'id', te.idx::text))
      )
    end as rel_id,
    coalesce(te.t->>'name', 'Term') as name,
    greatest(1, least(3, coalesce((te.t->>'number')::integer, 1))) as term_number,
    public.blob_date(te.t->>'startDate') as start_date,
    public.blob_date(te.t->>'endDate') as end_date,
    coalesce((te.t->>'isActive')::boolean, false) as is_active
  from jsonb_array_elements(state_row->'academic_years') with ordinality as ye(y, idx)
  join t_year ty on ty.idx = ye.idx
  cross join lateral jsonb_array_elements(public.blob_array(ye.y->'terms')) with ordinality as te(t, idx);

  -- ================================================================== classes
  drop table if exists pg_temp.t_class;
  create temporary table t_class on commit drop as
  select
    ce.c_idx::text as path,
    ce.c->>'id' as blob_id,
    case
      when public.blob_is_uuid(ce.c->>'id') then (ce.c->>'id')::uuid
      else public.blob_stable_id(
        'class',
        coalesce(ce.c->>'name', 'Unnamed') || ':' || coalesce(ce.c->>'level', 'O')
      )
    end as rel_id,
    coalesce(ce.c->>'name', 'Unnamed') as name,
    case when ce.c->>'level' = 'A' then 'A' else 'O' end as level
  from jsonb_array_elements(state_row->'classes') with ordinality as ce(c, c_idx);

  -- ================================================================== streams
  drop table if exists pg_temp.t_stream;
  create temporary table t_stream on commit drop as
  select
    cls.rel_id as class_rel_id,
    ce.c_idx::text || '/' || se.s_idx::text as path,
    se.s->>'id' as blob_id,
    case
      when public.blob_is_uuid(se.s->>'id') then (se.s->>'id')::uuid
      else public.blob_stable_id('stream', cls.rel_id::text || ':' || coalesce(se.s->>'name', 'A'))
    end as rel_id,
    coalesce(se.s->>'name', 'A') as name,
    se.s->>'classTeacherId' as class_teacher_raw,
    -- A teacher id in the blob is only usable if public.teachers actually has
    -- that row (it is Auth-backed). Otherwise the FK rejects the insert, so carry
    -- the link across only when it resolves, and report the drops.
    case
      when public.blob_is_uuid(se.s->>'classTeacherId')
       and exists (select 1 from public.teachers t where t.id = (se.s->>'classTeacherId')::uuid)
      then (se.s->>'classTeacherId')::uuid
      else null
    end as class_teacher_id
  from jsonb_array_elements(state_row->'classes') with ordinality as ce(c, c_idx)
  join t_class cls on cls.path = ce.c_idx::text
  cross join lateral jsonb_array_elements(public.blob_array(ce.c->'streams')) with ordinality as se(s, s_idx);

  -- ================================================================= students
  drop table if exists pg_temp.t_student_raw;
  create temporary table t_student_raw on commit drop as
  select
    st.rel_id as stream_rel_id,
    ce.c_idx as c_idx,
    se.s_idx as s_idx,
    ste.idx as stu_idx,
    ste.s->>'id' as blob_id,
    d.derived_id,
    -- Phase B1: prefer an id that already exists for this blob student over a
    -- freshly derived one. The hash below includes studentID, and that is one of
    -- the 11 admission numbers on the correction list - so without this branch,
    -- correcting a number would change the hash, insert a SECOND row for the
    -- same student and orphan the first one along with its marks. Scoped to blob
    -- ids that are present; they were verified unique read-only, and both
    -- duplicate_blob_student_ids in the report and the guard below keep it true.
    case
      when public.blob_is_uuid(ste.s->>'id') then (ste.s->>'id')::uuid
      when coalesce(ste.s->>'id', '') <> ''
        then coalesce(
          (select s.id from public.students s where s.blob_id = ste.s->>'id' limit 1),
          d.derived_id
        )
      else d.derived_id
    end as rel_id,
    coalesce(ste.s->>'studentID', '') as admission_raw,
    coalesce(ste.s->>'firstName', '') as first_name,
    coalesce(ste.s->>'secondName', '') as second_name,
    nullif(ste.s->>'otherNames', '') as other_names,
    case when ste.s->>'gender' = 'Female' then 'Female' else 'Male' end as gender,
    public.blob_text_array(ste.s->'subjects') as subjects,
    public.blob_text_array(ste.s->'optionalSubjects') as optional_subjects
  from jsonb_array_elements(state_row->'classes') with ordinality as ce(c, c_idx)
  cross join lateral jsonb_array_elements(public.blob_array(ce.c->'streams')) with ordinality as se(s, s_idx)
  join t_stream st on st.path = ce.c_idx::text || '/' || se.s_idx::text
  cross join lateral jsonb_array_elements(public.blob_array(se.s->'students')) with ordinality as ste(s, idx)
  -- The pure derivation, kept alongside the id actually used so the report can
  -- show how many students were relinked to a pre-existing row rather than
  -- re-derived. Computed once here instead of inline three times.
  cross join lateral (
    select public.blob_stable_id(
      'student',
      st.rel_id::text || ':' ||
      coalesce(ste.s->>'studentID', '') || ':' ||
      coalesce(ste.s->>'firstName', '') || ':' ||
      coalesce(ste.s->>'secondName', '')
    ) as derived_id
  ) d;

  -- Two blob students must never collapse onto one internal id: score rows would
  -- silently merge and the corruption is not reversible. Checked on the id that
  -- is actually used (t_student_raw.rel_id), which is the derived hash except
  -- where the lookup above reused an existing row.
  select count(*) into dup_count
  from (select rel_id from t_student_raw group by rel_id having count(*) > 1) d;
  if dup_count > 0 then
    raise exception 'Aborting: % duplicate derived student UUID(s). Two blob students hash to the same id - fix the source rows in the app before seeding.', dup_count;
  end if;

  -- The lookup above is only unambiguous while a blob student id identifies one
  -- student. The guard directly above does NOT cover this: the student hash
  -- includes stream_rel_id, so the same student sitting in two streams derives
  -- two different ids and passes it, yet both rows would carry one blob_id and
  -- every later lookup would pick a row arbitrarily. Abort instead.
  select count(*) into dup_count
  from (
    select blob_id from t_student_raw
    where coalesce(blob_id, '') <> ''
    group by blob_id having count(*) > 1
  ) d;
  if dup_count > 0 then
    raise exception 'Aborting: % blob student id(s) occur more than once in the blob, so blob_id no longer identifies one student and the mapping is ambiguous. Fix the duplicate student ids in the app before seeding.', dup_count;
  end if;

  drop table if exists pg_temp.t_student;
  create temporary table t_student on commit drop as
  select
    r.*,
    case
      when r.admission_raw = '' then 'PENDING-' || substring(md5(r.rel_id::text), 1, 8)
      when row_number() over (partition by r.admission_raw order by r.rel_id) = 1 then r.admission_raw
      else r.admission_raw || '-' || row_number() over (partition by r.admission_raw order by r.rel_id)
    end as admission_final
  from t_student_raw r;

  select count(*) into collision_count
  from (select admission_final from t_student group by admission_final having count(*) > 1) c;
  if collision_count > 0 then
    raise exception 'Aborting: % admission number collision(s) survived de-duplication. Resolve them in the app before seeding.', collision_count;
  end if;

  -- An earlier attempt may have written students under a different id. Those rows
  -- would block the UNIQUE index on students.student_id.
  select count(*) into collision_count
  from public.students s
  join t_student t on t.admission_final = s.student_id and t.rel_id <> s.id;
  if collision_count > 0 then
    raise exception 'Aborting: % student admission number(s) already exist in public.students under a different id. Report this before seeding.', collision_count;
  end if;

  drop table if exists pg_temp.t_student_map;
  create temporary table t_student_map on commit drop as
  select distinct on (blob_id) blob_id, rel_id
  from t_student_raw
  where coalesce(blob_id, '') <> ''
  order by blob_id, c_idx desc, s_idx desc, stu_idx desc;

  -- ===================================== subjects + per-stream subject links
  drop table if exists pg_temp.t_stream_subject_raw;
  create temporary table t_stream_subject_raw on commit drop as
  select
    st.rel_id as stream_rel_id,
    cls.level as level,
    case
      when jsonb_typeof(sub.s) = 'string' then sub.s #>> '{}'
      else coalesce(sub.s->>'name', '')
    end as subject_name,
    case
      when jsonb_typeof(sub.s) <> 'string' and (sub.s->>'category') in ('compulsory', 'optional')
        then sub.s->>'category'
      else 'optional'
    end as category,
    case
      when jsonb_typeof(sub.s) <> 'string' then sub.s->>'teacherId'
      else null
    end as teacher_id,
    case
      when jsonb_typeof(sub.s) = 'string' then array[]::text[]
      else public.blob_text_array(sub.s->'papers')
    end as papers
  from jsonb_array_elements(state_row->'classes') with ordinality as ce(c, c_idx)
  join t_class cls on cls.path = ce.c_idx::text
  cross join lateral jsonb_array_elements(public.blob_array(ce.c->'streams')) with ordinality as se(s, s_idx)
  join t_stream st on st.path = ce.c_idx::text || '/' || se.s_idx::text
  cross join lateral jsonb_array_elements(public.blob_array(se.s->'subjects')) with ordinality as sub(s, sub_idx)
  where case
          when jsonb_typeof(sub.s) = 'string' then sub.s #>> '{}'
          else coalesce(sub.s->>'name', '')
        end <> '';

  -- One row per (level, name). Reuses an id that already exists for that
  -- (level, name) pair, exactly like insertRelationalClasses() does.
  drop table if exists pg_temp.t_subject;
  create temporary table t_subject on commit drop as
  select
    r.level,
    r.subject_name,
    coalesce(
      (select s.id from public.subjects s
        where coalesce(s.level, '') = r.level and coalesce(s.name, '') = r.subject_name
        order by s.name
        limit 1),
      public.blob_stable_id('subject', r.level || ':' || r.subject_name)
    ) as rel_id,
    -- `category` lives per stream-subject in the blob but only once per
    -- (level, name) here. min() picks 'compulsory' over 'optional'
    -- alphabetically, so it is deterministic and never null.
    min(r.category) as category
  from t_stream_subject_raw r
  group by r.level, r.subject_name;

  drop table if exists pg_temp.t_stream_subject;
  create temporary table t_stream_subject on commit drop as
  select distinct on (r.stream_rel_id, sub.rel_id)
    public.blob_stable_id('stream-subject', r.stream_rel_id::text || ':' || sub.rel_id::text) as rel_id,
    r.stream_rel_id,
    sub.rel_id as subject_rel_id,
    case
      when public.blob_is_uuid(r.teacher_id)
       and exists (select 1 from public.teachers t where t.id = r.teacher_id::uuid)
      then r.teacher_id::uuid
      else null
    end as teacher_id,
    r.papers
  from t_stream_subject_raw r
  join t_subject sub on sub.level = r.level and sub.subject_name = r.subject_name
  order by r.stream_rel_id, sub.rel_id;

  -- ============================================================= assessments
  drop table if exists pg_temp.t_assessment;
  create temporary table t_assessment on commit drop as
  select
    cls.rel_id as class_rel_id,
    ce.c_idx::text || '/a/' || ae.a_idx::text as path,
    ae.a->>'id' as blob_id,
    case
      when public.blob_is_uuid(ae.a->>'id') then (ae.a->>'id')::uuid
      else public.blob_stable_id(
        'assessment',
        cls.rel_id::text || ':' || coalesce(ae.a->>'name', 'Assessment') || ':' || coalesce(ae.a->>'date', '')
      )
    end as rel_id,
    coalesce(ae.a->>'name', 'Assessment') as name,
    public.blob_date(ae.a->>'date') as assessment_date,
    public.blob_score_value(ae.a->'maxScore') as max_score,
    case
      when public.blob_is_uuid(ae.a->>'academicYearId') then (ae.a->>'academicYearId')::uuid
      else (select ye.rel_id from t_year ye where ye.blob_id = ae.a->>'academicYearId' limit 1)
    end as academic_year_id,
    case
      when public.blob_is_uuid(ae.a->>'termId') then (ae.a->>'termId')::uuid
      else (select tm.rel_id from t_term tm where tm.blob_id = ae.a->>'termId' limit 1)
    end as term_id,
    ae.a as raw
  from jsonb_array_elements(state_row->'classes') with ordinality as ce(c, c_idx)
  join t_class cls on cls.path = ce.c_idx::text
  cross join lateral jsonb_array_elements(public.blob_array(ce.c->'assessments')) with ordinality as ae(a, a_idx);

  -- The ids above are derived (stableId of name-level data) or reused from an
  -- existing row, so two distinct blob rows can land on the same id. Postgres
  -- then rejects the upsert outright ("ON CONFLICT DO UPDATE command cannot
  -- affect row a second time"), and if it did not, the two rows would silently
  -- merge - taking their students and marks with them. Abort with a count
  -- instead of choosing which row wins.
  select count(*) into dup_count from (
    select rel_id from t_year group by rel_id having count(*) > 1
    union all
    select rel_id from t_term group by rel_id having count(*) > 1
    union all
    select rel_id from t_class group by rel_id having count(*) > 1
    union all
    select rel_id from t_stream group by rel_id having count(*) > 1
    union all
    select rel_id from t_assessment group by rel_id having count(*) > 1
  ) d;
  if dup_count > 0 then
    raise exception 'Aborting: % id collision(s) among academic years/terms/classes/streams/assessments. Two blob rows derive the same relational id (same name+level, same class+stream name, or same class+assessment name+date) and would merge. Fix the duplicates in the app first.', dup_count;
  end if;

  -- ================================================================== scores
  -- One row per mark, idd by the same (assessment, student, subject, paper)
  -- tuple stableId() uses, so Phase C can upsert a single row per keystroke.
  -- Structure-only calls skip this whole block (and the insert below): t_score is
  -- never created, so nothing referencing it may be executed on that path.
  if p_include_scores then
  drop table if exists pg_temp.t_score;
  create temporary table t_score on commit drop as
  select distinct on (rel_id)
    rel_id, assessment_rel_id, student_rel_id, subject_name, paper_name, score
  from (
    -- general scores: assessment.scores { studentBlobId: value }
    select
      public.blob_stable_id('score', a.rel_id::text || ':' || s.rel_id::text || '::') as rel_id,
      a.rel_id as assessment_rel_id,
      s.rel_id as student_rel_id,
      ''::text as subject_name,
      ''::text as paper_name,
      public.blob_score_value(e.val) as score
    from t_assessment a
    cross join lateral jsonb_each(public.blob_object(a.raw->'scores')) as e(sid, val)
    join t_student_map s on s.blob_id = e.sid

    union all

    -- subject scores: assessment.subjectScores { subject: { studentBlobId: value } }
    select
      public.blob_stable_id('score', a.rel_id::text || ':' || s.rel_id::text || ':' || se.key || ':'),
      a.rel_id,
      s.rel_id,
      se.key,
      ''::text,
      public.blob_score_value(ss.val)
    from t_assessment a
    cross join lateral jsonb_each(public.blob_object(a.raw->'subjectScores')) as se(key, scores)
    cross join lateral jsonb_each(public.blob_object(se.scores)) as ss(sid, val)
    join t_student_map s on s.blob_id = ss.sid

    union all

    -- paper scores: assessment.paperScores { subject: { paper: { studentBlobId: value } } }
    select
      public.blob_stable_id('score', a.rel_id::text || ':' || s.rel_id::text || ':' || pe.key || ':' || pp.key),
      a.rel_id,
      s.rel_id,
      pe.key,
      pp.key,
      public.blob_score_value(ps.val)
    from t_assessment a
    cross join lateral jsonb_each(public.blob_object(a.raw->'paperScores')) as pe(key, papers)
    cross join lateral jsonb_each(public.blob_object(pe.papers)) as pp(key, scores)
    cross join lateral jsonb_each(public.blob_object(pp.scores)) as ps(sid, val)
    join t_student_map s on s.blob_id = ps.sid
  ) x
  order by rel_id;
  end if;

  -- ================================================================== writes
  -- Order matters: parents before children. Every write is an upsert on `id`.
  insert into public.academic_years (id, name, start_date, end_date, is_active)
  select rel_id, name, start_date, end_date, is_active from t_year
  on conflict (id) do update
    set name = excluded.name, start_date = excluded.start_date,
        end_date = excluded.end_date, is_active = excluded.is_active;

  insert into public.terms (id, academic_year_id, name, number, start_date, end_date, is_active)
  select rel_id, year_rel_id, name, term_number, start_date, end_date, is_active from t_term
  on conflict (id) do update
    set academic_year_id = excluded.academic_year_id, name = excluded.name,
        number = excluded.number, start_date = excluded.start_date,
        end_date = excluded.end_date, is_active = excluded.is_active;

  insert into public.classes (id, name, level)
  select rel_id, name, level from t_class
  on conflict (id) do update set name = excluded.name, level = excluded.level;

  insert into public.streams (id, class_id, name, class_teacher_id)
  select rel_id, class_rel_id, name, class_teacher_id from t_stream
  on conflict (id) do update
    set class_id = excluded.class_id, name = excluded.name,
        class_teacher_id = excluded.class_teacher_id;

  insert into public.subjects (id, name, level, category)
  select rel_id, subject_name, level, category from t_subject
  on conflict (id) do update
    set name = excluded.name, level = excluded.level, category = excluded.category;

  insert into public.stream_subjects (id, stream_id, subject_id, teacher_id, papers)
  select rel_id, stream_rel_id, subject_rel_id, teacher_id, papers from t_stream_subject
  on conflict (id) do update
    set stream_id = excluded.stream_id, subject_id = excluded.subject_id,
        teacher_id = excluded.teacher_id, papers = excluded.papers;

  insert into public.students (
    id, stream_id, student_id, first_name, second_name, other_names, gender,
    subjects, optional_subjects, blob_id
  )
  select
    rel_id, stream_rel_id, admission_final, first_name, second_name, other_names, gender,
    subjects, optional_subjects, nullif(blob_id, '')
  from t_student
  on conflict (id) do update
    set stream_id = excluded.stream_id, student_id = excluded.student_id,
        first_name = excluded.first_name, second_name = excluded.second_name,
        other_names = excluded.other_names, gender = excluded.gender,
        subjects = excluded.subjects, optional_subjects = excluded.optional_subjects,
        blob_id = excluded.blob_id;

  insert into public.assessments (id, class_id, name, date, max_score, academic_year_id, term_id, blob_id)
  select rel_id, class_rel_id, name, assessment_date, max_score, academic_year_id, term_id,
         nullif(blob_id, '')
  from t_assessment
  on conflict (id) do update
    set class_id = excluded.class_id, name = excluded.name, date = excluded.date,
        max_score = excluded.max_score, academic_year_id = excluded.academic_year_id,
        term_id = excluded.term_id, blob_id = excluded.blob_id;

  -- ================================================================= deletes
  -- Hard delete. The blob is the source of truth, deletions included: a student
  -- or assessment removed in the app is removed here too, with its marks.
  --
  -- Scope is exactly the two tables that carry blob_id. That column is the only
  -- thing that can tell "the app deleted this" from "this row was here before
  -- the seed", and every row in both tables has one (verified by the last run:
  -- students_without_blob_id 0, assessments_without_blob_id 0). classes,
  -- streams, terms and stream_subjects have no blob_id, so nothing here deletes
  -- them - a stream removed in the app keeps its row and its stream_subjects
  -- rows until the students in it leave the blob too. No table on the mark read
  -- path depends on those rows.
  --
  -- There are NO foreign keys between these tables (every *_id is a bare uuid),
  -- so deleting a student does NOT cascade to scores. The marks have to be
  -- deleted first or they survive as orphans - which is precisely what the
  -- `orphan_scores` invariant in STEP 4 counts, and it is why that check exists.
  --
  -- A row whose blob_id is null can never match a blob row, so it is left alone
  -- rather than read as deleted. Nothing currently has a null blob_id.
  --
  -- This is the one irreversible statement in this file. /api/backup is the
  -- recovery path; take a fresh one before running.
  --
  -- Two aborts, because this is the only thing here that can destroy data the
  -- blob no longer has a copy of. Both mean "the blob lost a whole table", which
  -- is never a legitimate deletion:
  if exists (select 1 from public.students) and not exists (select 1 from t_student) then
    raise exception 'Aborting: the blob has no students but public.students has rows. Every student and every mark would be deleted. That is a blob problem, not a deletion to apply. Restore the blob from /api/backup first.';
  end if;
  if exists (select 1 from public.assessments) and not exists (select 1 from t_assessment) then
    raise exception 'Aborting: the blob has no assessments but public.assessments has rows. Every assessment and every mark would be deleted. That is a blob problem, not a deletion to apply. Restore the blob from /api/backup first.';
  end if;

  delete from public.scores sc
  where sc.student_id in (
          select s.id from public.students s
          where s.blob_id is not null
            and not exists (select 1 from t_student t where coalesce(t.blob_id, '') = s.blob_id)
        )
     or sc.assessment_id in (
          select a.id from public.assessments a
          where a.blob_id is not null
            and not exists (select 1 from t_assessment t where coalesce(t.blob_id, '') = a.blob_id)
        );
  get diagnostics v_deleted_scores = row_count;

  delete from public.students s
  where s.blob_id is not null
    and not exists (select 1 from t_student t where coalesce(t.blob_id, '') = s.blob_id);
  get diagnostics v_deleted_students = row_count;

  delete from public.assessments a
  where a.blob_id is not null
    and not exists (select 1 from t_assessment t where coalesce(t.blob_id, '') = a.blob_id);
  get diagnostics v_deleted_assessments = row_count;

  -- The mark is stored exactly as the blob has it. It used to be
  -- round(...)::integer here because public.scores.score was `integer`;
  -- migrations/004 retyped it to numeric, so the fractional marks in the blob
  -- (13,343 of them) now land unchanged. `score = excluded.score` also means a
  -- re-run repairs any row that an earlier running of this file rounded.
  --
  -- Inside the same guard as t_score: a structure-only call must not name this
  -- table at all, and must not report score numbers it never computed.
  if p_include_scores then
    insert into public.scores (id, assessment_id, student_id, subject_name, paper_name, score)
    select rel_id, assessment_rel_id, student_rel_id, subject_name, paper_name, score from t_score
    on conflict (id) do update
      set assessment_id = excluded.assessment_id, student_id = excluded.student_id,
          subject_name = excluded.subject_name, paper_name = excluded.paper_name,
          score = excluded.score;

    select count(*) into v_scores from t_score;
    -- Marks the blob holds that never reach the table: score keys pointing at a
    -- student id the blob does not contain. The app's own write path skips these
    -- too (see the normalizedStudentId guard in server/supabase-db.ts), so they
    -- are stale keys rather than a mapping failure.
    select public.blob_score_count(state_row->'classes') - v_scores into v_scores_skipped;
    select count(*) into v_fractional from t_score where score is not null and score <> round(score);
  else
    v_scores := null;
    v_scores_skipped := null;
    v_fractional := null;
  end if;

  -- ================================================================== report
  report := jsonb_build_object(
    'blob_counts', jsonb_build_object(
      'academic_years', (select count(*) from t_year),
      'terms', (select count(*) from t_term),
      'classes', (select count(*) from t_class),
      'streams', (select count(*) from t_stream),
      'subjects', (select count(*) from t_subject),
      'stream_subjects', (select count(*) from t_stream_subject),
      'students', (select count(*) from t_student),
      'assessments', (select count(*) from t_assessment),
      'scores', v_scores
    ),
    'table_counts_before', before_counts,
    'table_counts_after', jsonb_build_object(
      'academic_years', (select count(*) from public.academic_years),
      'terms', (select count(*) from public.terms),
      'classes', (select count(*) from public.classes),
      'streams', (select count(*) from public.streams),
      'subjects', (select count(*) from public.subjects),
      'stream_subjects', (select count(*) from public.stream_subjects),
      'students', (select count(*) from public.students),
      'assessments', (select count(*) from public.assessments),
      'scores', (select count(*) from public.scores)
    ),
    -- Rows the hard delete removed, from GET DIAGNOSTICS on each delete itself
    -- (not recomputed from the counts, so this reports what actually happened).
    -- All three are 0 on a run where nothing was deleted in the app. `scores`
    -- counts marks belonging to a deleted student OR a deleted assessment.
    --
    -- Non-zero here means table_counts_before no longer equals
    -- table_counts_after, and that is correct, not drift: the app deleted
    -- something. Re-running produces 0 and equal counts again.
    'hard_delete', jsonb_build_object(
      'students', v_deleted_students,
      'assessments', v_deleted_assessments,
      'scores', v_deleted_scores
    ),
    'adjusted_admission_numbers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'blob_student_id', r.blob_id,
        'student', r.first_name || ' ' || r.second_name,
        'was', r.admission_raw,
        'now', s.admission_final
      ) order by r.admission_raw, r.first_name), '[]'::jsonb)
      from t_student s
      join t_student_raw r on r.rel_id = s.rel_id
      where s.admission_final <> s.admission_raw
    ),
    'assessments_without_academic_year', (select count(*) from t_assessment where academic_year_id is null),
    'assessments_without_term', (select count(*) from t_assessment where term_id is null),
    -- Both of the next two come from variables computed inside the
    -- `if p_include_scores` block, never from t_score: a structure-only call
    -- (p_include_scores = false) must not name t_score at all, so it reports
    -- null here rather than a number it never measured.
    -- For a full seed, `scores_skipped_unmappable_student` is the number of blob
    -- marks whose student id is not in the blob and so cannot be mapped (95 on
    -- the seeded data). blob_score_count - mapped, i.e. exactly the missing ones.
    'scores_skipped_unmappable_student', v_scores_skipped,
    -- Marks the blob stores with a fractional part, i.e. marks that an `integer`
    -- score column would have silently rounded. After migrations/004 this is
    -- expected to be 13343 and every one of them is now stored exactly. A value
    -- of 0 here means scores.score is still integer, or 004 has not been run.
    'scores_with_fractional_value', v_fractional,
    -- Stream/stream-subject teacher links the blob had as a UUID but that
    -- public.teachers does not contain, so they were seeded as NULL instead of
    -- tripping the foreign key. Expected to be non-zero if the blob's teachers
    -- were never mirrored into public.teachers; it does not affect marks.
    'teacher_links_dropped', (
      (select count(*) from t_stream
        where public.blob_is_uuid(class_teacher_raw)
          and not exists (select 1 from public.teachers t where t.id = class_teacher_raw::uuid))
      + (select count(*) from t_stream_subject_raw r
          where public.blob_is_uuid(r.teacher_id)
            and not exists (select 1 from public.teachers t where t.id = r.teacher_id::uuid))
    ),
    -- ========================================================== Phase B1 - mapping
    'blob_id_mapping', jsonb_build_object(
      -- Mirror of the abort guard above, so the uniqueness Phase B depends on is
      -- re-proven on every run rather than only on the one read-only check.
      'duplicate_blob_student_ids', (
        select count(*) from (
          select blob_id from t_student_raw
          where coalesce(blob_id, '') <> ''
          group by blob_id having count(*) > 1
        ) d
      ),
      -- Students whose id came from an existing row rather than the hash. 0 on a
      -- first run, because nothing is relinked yet. It becomes 11 once the
      -- admission numbers on the correction list are fixed in the app - and that
      -- is the proof the lookup works: the corrected students keep their identity
      -- and their marks instead of forking into a second row.
      -- The uuid check is required: a blob student id that is already a UUID is
      -- used verbatim and never consults derived_id, so without it every such
      -- student would be counted as relinked.
      'students_relinked_by_blob_id', (
        select count(*) from t_student_raw
        where coalesce(blob_id, '') <> ''
          and not public.blob_is_uuid(blob_id)
          and rel_id <> derived_id
      ),
      'students_with_blob_id', (
        select count(*) from t_student where coalesce(blob_id, '') <> ''
      ),
      -- Blob students saved without an id. These cannot be resolved by a later
      -- write, so they are worth seeing rather than assuming they are zero.
      'students_without_blob_id', (
        select count(*) from t_student where coalesce(blob_id, '') = ''
      ),
      'assessments_with_blob_id', (
        select count(*) from t_assessment where coalesce(blob_id, '') <> ''
      ),
      'assessments_without_blob_id', (
        select count(*) from t_assessment where coalesce(blob_id, '') = ''
      )
    )
  );

  return report;
end;
$fn$;

-- The signature is now `(boolean)`, so the argument type has to be written out:
-- a bare `seed_relational_from_state()` does not resolve to this function. (This
-- is also why STEP 2 below can still call it with no arguments - that is a
-- defaulted *call*, not a defaulted *reference*.)
--
-- The server reaches this through PostgREST RPC (supabase-js `.rpc()`) using the
-- service-role key, so `service_role` needs EXECUTE explicitly: revoking from
-- PUBLIC also takes it away from service_role, which does not otherwise have a
-- per-function grant.
--   anon / authenticated : never allowed, the browser must not be able to trigger
--                          a whole-database re-materialisation.
--   service_role         : allowed, server-side only.
revoke execute on function public.seed_relational_from_state(boolean) from public, anon, authenticated;
grant execute on function public.seed_relational_from_state(boolean) to service_role;


-- ---------------------------------------------------------------------------
-- Release 1's gate. The server calls THIS, not the seed.
--
-- It exists so "does the structure need rebuilding?" is decided where the answer
-- is durable and serialisable, instead of in a serverless route that has nowhere
-- to remember the last fingerprint and no way to order two simultaneous saves.
--
-- p_fingerprint comes from structuralFingerprint() in server/supabase-db.ts:
-- a sha256 of the structural part of `classes` and of `academic_years`, with all
-- object keys sorted and assessment.scores / subjectScores / paperScores removed.
-- Mark entry writes only those three keys (see updateAssessmentScore and friends
-- in server/supabase-db.ts), so a mark save has the same fingerprint as the last
-- structural save and this returns without touching the blob at all.
--
-- The advisory lock is transaction-scoped, so it is held until the RPC ends. Two
-- saves that both see a stale fingerprint seed one after the other instead of
-- concurrently - the second re-reads the fingerprint after the first commits and
-- finds it current. The seed is idempotent, so the lock is about not doing the
-- same work twice, not about correctness.
-- ---------------------------------------------------------------------------
create or replace function public.sync_relational_structure(p_fingerprint text)
returns jsonb
language plpgsql
set search_path = public, extensions
as $fn$
declare
  stored text;
  report jsonb;
begin
  if coalesce(p_fingerprint, '') = '' then
    raise exception 'sync_relational_structure requires a non-empty fingerprint';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.relational_sync_state'));

  select classes_fingerprint into stored
  from public.relational_sync_state
  where id = 'default';

  -- `stored` is NULL on the very first call, and NULL = anything is NULL, so a
  -- missing row falls through to the seed instead of looking like a match.
  if stored = p_fingerprint then
    return jsonb_build_object('synced', false, 'fingerprint', p_fingerprint);
  end if;

  report := public.seed_relational_from_state(false);

  insert into public.relational_sync_state (id, classes_fingerprint, updated_at)
  values ('default', p_fingerprint, now())
  on conflict (id) do update
    set classes_fingerprint = excluded.classes_fingerprint,
        updated_at = excluded.updated_at;

  -- The fingerprint is stored in the same transaction as the seed, so a seed that
  -- raises rolls the fingerprint back with it and the next save retries instead
  -- of skipping the sync it never did.
  return report || jsonb_build_object(
    'synced', true,
    'fingerprint', p_fingerprint,
    'fingerprint_replaced', stored
  );
end;
$fn$;

revoke execute on function public.sync_relational_structure(text) from public, anon, authenticated;
grant execute on function public.sync_relational_structure(text) to service_role;


-- ---------------------------------------------------------------------------
-- STEP 2 - run it. Single statement, single transaction. Returns one JSON row.
-- ---------------------------------------------------------------------------
select public.seed_relational_from_state() as seed_report;


-- ---------------------------------------------------------------------------
-- STEP 3 - verification. Standalone, read-only, safe to re-run any time.
-- `in_blob` vs `in_tables` must line up. Rows where they differ are the ones to
-- look at (a score whose student id is missing from the blob, a class with no
-- matching assessment year, ...).
-- ---------------------------------------------------------------------------
with b as (
  select
    public.blob_array(classes) as classes,
    public.blob_array(academic_years) as years
  from public.school_state
  where id = 'default'
)
select entity, in_blob, in_tables, in_tables - in_blob as delta
from (
  select 1 as ord, 'academic_years' as entity,
    (select count(*) from jsonb_array_elements(b.years)) as in_blob,
    (select count(*) from public.academic_years) as in_tables
  from b
  union all
  select 2, 'terms',
    (select count(*) from jsonb_array_elements(b.years) y
       cross join lateral jsonb_array_elements(public.blob_array(y->'terms'))),
    (select count(*) from public.terms)
  from b
  union all
  select 3, 'classes',
    (select count(*) from jsonb_array_elements(b.classes)),
    (select count(*) from public.classes)
  from b
  union all
  select 4, 'streams',
    (select count(*) from jsonb_array_elements(b.classes) c
       cross join lateral jsonb_array_elements(public.blob_array(c->'streams'))),
    (select count(*) from public.streams)
  from b
  union all
  select 5, 'stream_subjects',
    (select count(*) from jsonb_array_elements(b.classes) c
       cross join lateral jsonb_array_elements(public.blob_array(c->'streams')) s
       cross join lateral jsonb_array_elements(public.blob_array(s->'subjects'))),
    (select count(*) from public.stream_subjects)
  from b
  union all
  select 6, 'students',
    (select count(*) from jsonb_array_elements(b.classes) c
       cross join lateral jsonb_array_elements(public.blob_array(c->'streams')) s
       cross join lateral jsonb_array_elements(public.blob_array(s->'students'))),
    (select count(*) from public.students)
  from b
  union all
  select 7, 'assessments',
    (select count(*) from jsonb_array_elements(b.classes) c
       cross join lateral jsonb_array_elements(public.blob_array(c->'assessments'))),
    (select count(*) from public.assessments)
  from b
  union all
  select 8, 'score_entries',
    public.blob_score_count(b.classes),
    (select count(*) from public.scores)
  from b
) t
order by ord;

-- STEP 4 - the invariants the relational schema now has to hold. Every count
-- below should be 0 EXCEPT the two stale_blob_* ones at the end: those report the
-- deletions the agreed policy leaves in place instead of repairing, so they are
-- expected to rise as soon as someone deletes a student or an assessment in the
-- app. They are drift to be aware of, not failures.
select
  (select count(*) from public.students where coalesce(student_id, '') = '') as blank_admission_numbers,
  (select count(*) from (select student_id from public.students group by student_id having count(*) > 1) d) as duplicate_admission_numbers,
  (select count(*) from public.students where coalesce(student_id, '') like 'PENDING-%') as pending_placeholders,
  (select count(*) from public.assessments where academic_year_id is null) as assessments_without_year,
  (select count(*) from public.assessments where term_id is null) as assessments_without_term,
  (select count(*) from public.scores s
     left join public.assessments a on a.id = s.assessment_id
     left join public.students st on st.id = s.student_id
    where a.id is null or st.id is null) as orphan_scores,
  -- Phase B1. duplicate_blob_student_ids must be 0: a duplicate makes the lookup
  -- ambiguous. (The stale_blob_* counts below it are the deletion drift
  -- described above, not failures.)
  (select count(*) from (select blob_id from public.students where blob_id is not null group by blob_id having count(*) > 1) d) as duplicate_blob_student_ids,
  (select count(*) from public.students s
    where s.blob_id is not null
      and not exists (
        select 1
        from public.school_state ss
        cross join lateral jsonb_array_elements(public.blob_array(ss.classes)) c
        cross join lateral jsonb_array_elements(public.blob_array(c->'streams')) str
        cross join lateral jsonb_array_elements(public.blob_array(str->'students')) stu
        where ss.id = 'default' and stu->>'id' = s.blob_id
      )) as stale_blob_id_rows,
  -- Same drift, for assessments. Only students and assessments carry a blob_id,
  -- so classes / streams / terms deletions are neither deleted by the seed nor
  -- measurable here at all. Nothing on the mark read path reads those rows.
  (select count(*) from public.assessments a
    where a.blob_id is not null
      and not exists (
        select 1
        from public.school_state ss
        cross join lateral jsonb_array_elements(public.blob_array(ss.classes)) c
        cross join lateral jsonb_array_elements(public.blob_array(c->'assessments')) ae
        where ss.id = 'default' and ae->>'id' = a.blob_id
      )) as stale_blob_assessment_rows;


-- ---------------------------------------------------------------------------
-- STEP 5 - one-shot verification. Run ONLY this statement.
--
-- The editor shows just the result of the last statement in a run, which is why
-- the report in STEP 2 and the parity in STEP 3 cannot be seen together. This
-- returns both plus the invariants as a single JSON row.
--
-- It calls the seed again on purpose. The seed is idempotent, so on a second run
-- `table_counts_before` must equal `table_counts_after` and every parity `delta`
-- must be 0 - that is the proof the script is safe to re-run.
--
-- The `from b` in the last three subqueries looks redundant but is not: it makes
-- them depend on the seed having already run, so the counts cannot be read from a
-- half-seeded database.
-- ---------------------------------------------------------------------------
with seed as (
  select public.seed_relational_from_state() as report
),
b as (
  select
    seed.report as report,
    public.blob_array(s.classes) as classes,
    public.blob_array(s.academic_years) as years
  from public.school_state s
  cross join seed
  where s.id = 'default'
),
parity as (
  select 1 as ord, 'academic_years' as entity,
    (select count(*) from jsonb_array_elements(b.years)) as in_blob,
    (select count(*) from public.academic_years) as in_tables
  from b
  union all
  select 2, 'terms',
    (select count(*) from jsonb_array_elements(b.years) y
       cross join lateral jsonb_array_elements(public.blob_array(y->'terms'))),
    (select count(*) from public.terms)
  from b
  union all
  select 3, 'classes',
    (select count(*) from jsonb_array_elements(b.classes)),
    (select count(*) from public.classes)
  from b
  union all
  select 4, 'streams',
    (select count(*) from jsonb_array_elements(b.classes) c
       cross join lateral jsonb_array_elements(public.blob_array(c->'streams'))),
    (select count(*) from public.streams)
  from b
  union all
  select 5, 'stream_subjects',
    (select count(*) from jsonb_array_elements(b.classes) c
       cross join lateral jsonb_array_elements(public.blob_array(c->'streams')) s
       cross join lateral jsonb_array_elements(public.blob_array(s->'subjects'))),
    (select count(*) from public.stream_subjects)
  from b
  union all
  select 6, 'students',
    (select count(*) from jsonb_array_elements(b.classes) c
       cross join lateral jsonb_array_elements(public.blob_array(c->'streams')) s
       cross join lateral jsonb_array_elements(public.blob_array(s->'students'))),
    (select count(*) from public.students)
  from b
  union all
  select 7, 'assessments',
    (select count(*) from jsonb_array_elements(b.classes) c
       cross join lateral jsonb_array_elements(public.blob_array(c->'assessments'))),
    (select count(*) from public.assessments)
  from b
  union all
  select 8, 'score_entries',
    public.blob_score_count(b.classes),
    (select count(*) from public.scores)
  from b
)
select jsonb_build_object(
  'seed_report', (select report from b),
  'parity', (
    select jsonb_agg(jsonb_build_object(
             'entity', entity,
             'in_blob', in_blob,
             'in_tables', in_tables,
             'delta', in_tables - in_blob
           ) order by ord)
    from parity
  ),
  'invariants', (
    select jsonb_build_object(
      'blank_admission_numbers', (select count(*) from public.students where coalesce(student_id, '') = ''),
      'duplicate_admission_numbers', (select count(*) from (select student_id from public.students group by student_id having count(*) > 1) d),
      'pending_placeholders', (select count(*) from public.students where coalesce(student_id, '') like 'PENDING-%'),
      'assessments_without_year', (select count(*) from public.assessments where academic_year_id is null),
      'assessments_without_term', (select count(*) from public.assessments where term_id is null),
      'orphan_scores', (select count(*) from public.scores s
         left join public.assessments a on a.id = s.assessment_id
         left join public.students st on st.id = s.student_id
        where a.id is null or st.id is null),
      -- duplicate_blob_student_ids must be 0: a duplicate makes the blob_id
      -- lookup ambiguous, so the seed aborts on it and so does the delete.
      --
      -- Both stale_blob_* counts read the blob AFTER the seed has run, and the
      -- seed now hard deletes exactly the rows they count. So they are not drift
      -- any more - they are the check that the delete worked. Any non-zero value
      -- means a student or assessment left the blob but its row stayed, which is
      -- a bug in the delete, not a normal state to expect after a deletion.
      -- Neither is a count of students without a blob_id; those are reported in
      -- blob_id_mapping.
      'duplicate_blob_student_ids', (select count(*) from (select blob_id from public.students where blob_id is not null group by blob_id having count(*) > 1) d),
      'stale_blob_id_rows', (
        select count(*) from public.students s
        where s.blob_id is not null
          and not exists (
            select 1
            from jsonb_array_elements(b.classes) c
            cross join lateral jsonb_array_elements(public.blob_array(c->'streams')) str
            cross join lateral jsonb_array_elements(public.blob_array(str->'students')) stu
            where stu->>'id' = s.blob_id
          )
      ),
      'stale_blob_assessment_rows', (
        select count(*) from public.assessments a
        where a.blob_id is not null
          and not exists (
            select 1
            from jsonb_array_elements(b.classes) c
            cross join lateral jsonb_array_elements(public.blob_array(c->'assessments')) ae
            where ae->>'id' = a.blob_id
          )
      )
    )
    from b
  )
) as verification;


-- ---------------------------------------------------------------------------
-- STEP 6 - comments only, no statement, so STEP 5 stays the last thing the
-- editor returns.
--
-- Once Release 1 is deployed, this is how to see the gate working:
--
--   select id, updated_at, left(classes_fingerprint, 12) as fingerprint
--   from public.relational_sync_state;
--
-- Exactly one row, `default`. Its `updated_at` moves when you change something
-- structural in the app - add a class, add a student, add an assessment - and
-- does NOT move when you only type marks. If it never moves, the sync is failing
-- (check the server logs for "Relational structure sync failed") or the functions
-- were not created (re-run this file).
-- ---------------------------------------------------------------------------
