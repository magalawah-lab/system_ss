-- ============================================================================
-- 005_mark_writes.sql
--
-- RELEASE 2, STEP 4a of the school_state (JSONB blob) -> relational migration.
-- Run this in the Supabase SQL editor, the same way 003 and 004 are run.
--
-- WHY
--   Today a mark is stored by rewriting the whole ~900 KB public.school_state
--   JSONB row. Every mark batch therefore reads and writes that entire row while
--   holding a lock on it, which is what exhausts the Supabase Disk IO budget and
--   what makes two teachers entering marks at the same time collide (PGRST116,
--   "data changed in another session").
--
--   public.scores already exists and already holds every mark - 003 seeded all
--   31,553 of them. This file adds the one function that writes there: one row
--   per mark, keyed by the id 003 already assigned. A mark update becomes a
--   ~60 byte row write that touches neither the blob nor any other teacher's
--   mark, which is the whole point of the migration.
--
-- WHAT IT ADDS
--   public.blob_score_id(uuid, uuid, text, text)  the mark -> row id formula
--   public.upsert_assessment_scores(jsonb)        the write itself
--
-- WHAT IT DELIBERATELY DOES NOT DO
--   * It never reads public.scores back, and nothing else reads it yet. Serving
--     marks from the table is 4c.
--   * It never deletes. A cleared mark (score null) keeps its row with a null
--     score, exactly as 003 seeds it, so "row exists with no mark" and "no row"
--     keep meaning the same thing to the read overlay.
--   * It never touches public.school_state. During Release 2 the blob is still
--     written for structure; marks simply stop being written there.
--
-- IDEMPOTENT. Both objects are create-or-replace and no data is rewritten, so
-- re-running this file is a no-op. It is safe to run before or after 003.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- The mark -> row id formula, in one place.
--
-- 003 builds every scores.id as
--     blob_stable_id('score', <assessment uuid> || ':' || <student uuid> || ':' || <subject> || ':' || <paper>)
-- with subject and paper empty for a general mark and paper empty for a subject
-- mark. The three arms of 003's t_score spell that tuple out inline; this is the
-- same tuple as a function so the write path cannot drift away from the seed.
-- The verification queries at the bottom of this file prove the two agree on
-- every existing row - run them after any change to either side.
--
-- Coalescing to '' rather than leaving NULL: `a || ':' || null` is NULL in
-- Postgres, which would silently turn the id (and therefore the lookup) into
-- null. 003's union arms pass ''::text for the absent parts, so this has to
-- render identically.
-- ---------------------------------------------------------------------------
create or replace function public.blob_score_id(
  assessment_id uuid,
  student_id uuid,
  subject_name text,
  paper_name text
)
returns uuid
language sql
immutable
set search_path = public, extensions
as $$
  select public.blob_stable_id(
    'score',
    assessment_id::text || ':' || student_id::text || ':' ||
    coalesce(subject_name, '') || ':' || coalesce(paper_name, '')
  );
$$;


-- ---------------------------------------------------------------------------
-- The mark write.
--
-- p_marks is a jsonb array; each element is one mark and carries the ids the
-- browser already has (the blob's string ids, not relational uuids):
--   { "assessment": "<assessment blob id>",
--     "student":    "<student blob id>",
--     "subject":    "<subject name, '' for a general mark>",
--     "paper":      "<paper name, '' unless it is a paper mark>",
--     "score":      <number | numeric string | null> }
--
-- Returns:
--   { "received": n, "written": n,
--     "unmapped_students":    [...blob ids...],
--     "unmapped_assessments": [...blob ids...] }
--
-- The two unmapped arrays are the important part. blob_id is how a browser id
-- finds its row, and a mark whose student has no row yet cannot be written
-- anywhere sensible - inserting it against a null student_id would create an
-- orphan that no read path would ever see. Those marks are therefore dropped
-- from THIS call and reported instead, and the endpoint turns a non-empty report
-- into a 409 so it cannot pass as success. The normal reason for a miss is a
-- student created since the last structural sync; when the Release 1 gate is
-- working, it is always empty.
--
-- Concurrency: two teachers marking different students insert/update different
-- primary keys, so they do not contend. The dedup below is not about that - it
-- is about a batch that names the same mark twice, which without it would make
-- Postgres raise "ON CONFLICT DO UPDATE command cannot affect row a second
-- time". Last one in the array wins.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_assessment_scores(p_marks jsonb)
returns jsonb
language plpgsql
set search_path = public, extensions
as $fn$
declare
  v_written integer := 0;
  v_unmapped_students text[];
  v_unmapped_assessments text[];
begin
  if p_marks is null or jsonb_typeof(p_marks) <> 'array' then
    raise exception 'upsert_assessment_scores expects a jsonb array of marks';
  end if;

  if jsonb_array_length(p_marks) = 0 then
    return jsonb_build_object(
      'received', 0, 'written', 0,
      'unmapped_students', '[]'::jsonb, 'unmapped_assessments', '[]'::jsonb
    );
  end if;

  -- Resolve first, so the report describes this call's input rather than the
  -- rows the insert happened to leave behind.
  select
    coalesce(array_agg(distinct i.student_blob_id) filter (where s.id is null), '{}'::text[]),
    coalesce(array_agg(distinct i.assessment_blob_id) filter (where a.id is null), '{}'::text[])
  into v_unmapped_students, v_unmapped_assessments
  from (
    select
      coalesce(m->>'assessment', '') as assessment_blob_id,
      coalesce(m->>'student', '') as student_blob_id
    from jsonb_array_elements(p_marks) as m
  ) i
  left join public.students s on s.blob_id = i.student_blob_id
  left join public.assessments a on a.blob_id = i.assessment_blob_id;

  -- One statement, so the whole batch is one transaction and one round trip.
  -- `with ordinality` + `order by id, ord desc` is what makes a duplicated mark
  -- resolve to the last submitted value instead of an arbitrary one.
  with input as (
    select
      coalesce(m->>'assessment', '') as assessment_blob_id,
      coalesce(m->>'student', '') as student_blob_id,
      coalesce(m->>'subject', '') as subject_name,
      coalesce(m->>'paper', '') as paper_name,
      public.blob_score_value(m->'score') as score,
      m.ord
    from jsonb_array_elements(p_marks) with ordinality as m(m, ord)
  ),
  resolved as (
    select
      public.blob_score_id(a.id, s.id, i.subject_name, i.paper_name) as id,
      a.id as assessment_id,
      s.id as student_id,
      i.subject_name,
      i.paper_name,
      i.score,
      i.ord
    from input i
    join public.assessments a on a.blob_id = i.assessment_blob_id
    join public.students s on s.blob_id = i.student_blob_id
  )
  insert into public.scores (id, assessment_id, student_id, subject_name, paper_name, score)
  select distinct on (id)
    id, assessment_id, student_id, subject_name, paper_name, score
  from resolved
  order by id, ord desc
  on conflict (id) do update
    set score = excluded.score;

  get diagnostics v_written = row_count;

  return jsonb_build_object(
    'received', jsonb_array_length(p_marks),
    'written', v_written,
    'unmapped_students', to_jsonb(v_unmapped_students),
    'unmapped_assessments', to_jsonb(v_unmapped_assessments)
  );
end;
$fn$;

-- Same shape as the grants on 003's functions. `revoke ... from public` also
-- takes execute away from service_role, which is why the grant below is needed.
-- The browser must never be able to write marks directly, so anon and
-- authenticated get nothing; the route calls this with the service-role key.
revoke execute on function public.blob_score_id(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.blob_score_id(uuid, uuid, text, text) to service_role;

revoke execute on function public.upsert_assessment_scores(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_assessment_scores(jsonb) to service_role;

-- PostgREST answers .rpc() from its own cached list of functions, and in front of
-- a fresh DDL it can still be holding the old one. This asks it to re-read the
-- schema now. Harmless if it has already reloaded.
notify pgrst, 'reload schema';


-- ===========================================================================
-- VERIFICATION. Each block below is a single statement - the SQL editor only
-- shows the result of the last one, so run them one at a time.
-- ===========================================================================

-- STEP 1 - the two id formulas agree on every seeded row.
-- Expect id_matches = score_rows = 31553, id_mismatches = 0. A non-zero
-- id_mismatches means blob_score_id() and 003's t_score tuple have drifted and
-- the write path would be updating rows the read overlay does not read. Stop and
-- fix that before using the endpoint.
-- select
--   count(*) as score_rows,
--   count(*) filter (
--     where sc.id = public.blob_score_id(sc.assessment_id, sc.student_id, sc.subject_name, sc.paper_name)
--   ) as id_matches,
--   count(*) filter (
--     where sc.id <> public.blob_score_id(sc.assessment_id, sc.student_id, sc.subject_name, sc.paper_name)
--   ) as id_mismatches
-- from public.scores sc;

-- STEP 2 - every mark's assessment and student can be found from a blob id.
-- This is the exact join the write function does, so a deficit here is a deficit
-- in the write path. Expect 31553 both times (rows_with_blob_links may be lower
-- only if a row predates blob_id population).
-- select
--   count(*) as score_rows,
--   count(*) filter (where a.blob_id is not null and s.blob_id is not null) as rows_with_blob_links
-- from public.scores sc
-- join public.assessments a on a.id = sc.assessment_id
-- join public.students s on s.id = sc.student_id;

-- STEP 3 - write one real mark back through the endpoint's function.
-- Picks the first seeded mark, feeds it through with its own value, and expects
-- {"received": 1, "written": 1, "unmapped_students": [], "unmapped_assessments": []}.
-- Because the id it computes is the id the row already has, it updates that row
-- instead of inserting: re-run `select count(*) from public.scores;` afterwards
-- and it must still be 31553. A higher count means the id formula is wrong.
-- select public.upsert_assessment_scores(
--   (select jsonb_agg(jsonb_build_object(
--       'assessment', a.blob_id,
--       'student',    s.blob_id,
--       'subject',    sc.subject_name,
--       'paper',      sc.paper_name,
--       'score',      sc.score))
--    from (select * from public.scores order by id limit 1) sc
--    join public.assessments a on a.id = sc.assessment_id
--    join public.students s on s.id = sc.student_id)
-- ) as write_test;

-- STEP 4 - the unmapped path reports instead of writing an orphan.
-- A student blob id that cannot exist, so expect written 0, one entry in
-- unmapped_students, and no change to public.scores.
-- select public.upsert_assessment_scores(
--   jsonb_build_array(jsonb_build_object(
--     'assessment', (select blob_id from public.assessments where blob_id is not null limit 1),
--     'student',    'stu-does-not-exist',
--     'subject',    '', 'paper', '', 'score', 1))
-- ) as unmapped_test;
