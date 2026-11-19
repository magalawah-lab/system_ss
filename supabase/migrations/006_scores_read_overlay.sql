-- ============================================================================
-- 006_scores_read_overlay.sql
--
-- RELEASE 2, step 4c. The read half: makes the marks that live in
-- public.scores visible to the app, without changing the shape the app reads.
-- Run this in the Supabase SQL editor. Nothing has to be deployed for it.
--
-- WHY
--   Until now every mark the app shows comes from public.school_state (the
--   blob). 4b stops writing marks there, so from the moment it deploys the
--   blob's copy of a mark is frozen at whatever that browser last sent - and any
--   other browser that later saves the blob writes its own, older copy back.
--   The row in public.scores is the only copy that cannot go stale, so the read
--   path has to prefer it.
--
-- WHAT
--   assessment_scores_overlay() returns the marks of every assessment as a
--   single jsonb object, keyed by the blob ids the browser already holds:
--
--     { "<assessment blob id>": {
--         "general":  { "<student blob id>": <score> },
--         "subjects": { "<subject name>": { "<student blob id>": <score> } },
--         "papers":   { "<subject name>": { "<paper name>":
--                                          { "<student blob id>": <score> } } } } }
--
--   One jsonb value rather than rows, deliberately: PostgREST caps a response at
--   db-max-rows (1000 by default) and there are ~31553 marks, so rows would come
--   back truncated and the caller would have to page ~32 times to even notice.
--
-- MERGE RULE (implemented in serializeClasses(), server/supabase-db.ts)
--   The blob's marks stay the base and the overlay is written over them mark by
--   mark. So a row always wins, a row holding NULL clears the blob's value, and
--   the ~95 blob marks whose student has no row - plus anything a deleted
--   student left behind - survive untouched. That last part matters: without it
--   those marks would vanish from every report and marksheet.
--
-- IT DOES NOT
--   * write anything, to the blob or to any table. Read-only, safe to run first.
--   * touch structure. Structure still comes from the blob, via 003's seed and
--     the Release 1 gate.
--
-- DEPLOY ORDER - READ THIS BEFORE 4b GOES OUT
--   1. Run the full seed (STEP 5 of 003) immediately before deploying 4b/4c.
--      Until 4b is live marks are still written to the blob only, so the blob is
--      ahead of public.scores and this overlay would revert any mark typed after
--      the last seed. Seeding right before the deploy makes the two agree at
--      that instant.
--   2. Deploy the route and client changes together - they are one release by
--      design. The overlay alone reverts blob marks (step 1); 4b alone makes new
--      marks invisible to every reader until 4c is there to show them.
--
-- KNOWN LIMITATION - subject rename
--   A row's id and its subject_name both contain the subject name
--   (blob_score_id in 005). Renaming a subject in class management rewrites the
--   blob's key but not the row, so after a rename the overlay re-adds the old
--   subject name alongside the new one. Fixing it means renaming the rows with
--   the blob, which is its own change; until then, treat a subject rename as
--   followed by a re-entry or a manual update of public.scores.subject_name.
--
-- IDEMPOTENT. create-or-replace and no data rewritten, so re-running is a no-op.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- The overlay.
--
-- Volatile-safe: reads only, so `stable`. security invoker (the default) is what
-- we want - the caller is the service role over PostgREST, and the browser is
-- never granted execute below.
--
-- Score values go through as they are stored, including NULL: a cleared mark is
-- a row with a NULL score, and that NULL has to reach the client so it clears
-- the blob's stale value rather than falling back to it.
-- ---------------------------------------------------------------------------
create or replace function public.assessment_scores_overlay()
returns jsonb
language sql
stable
set search_path = public, extensions
as $fn$
  with mark as (
    select
      a.blob_id as assessment_blob_id,
      s.blob_id as student_blob_id,
      sc.subject_name,
      sc.paper_name,
      sc.score
    from public.scores sc
    join public.assessments a on a.id = sc.assessment_id
    join public.students s on s.id = sc.student_id
    where a.blob_id is not null
      and s.blob_id is not null
  ),
  -- assessment.scores { studentBlobId: value }
  general as (
    select assessment_blob_id as id,
           jsonb_object_agg(student_blob_id, score) as marks
    from mark
    where subject_name = '' and paper_name = ''
    group by assessment_blob_id
  ),
  -- assessment.subjectScores { subjectName: { studentBlobId: value } }
  subject_level as (
    select assessment_blob_id as id,
           jsonb_object_agg(subject_name, inner_marks) as marks
    from (
      select assessment_blob_id, subject_name,
             jsonb_object_agg(student_blob_id, score) as inner_marks
      from mark
      where subject_name <> '' and paper_name = ''
      group by assessment_blob_id, subject_name
    ) per_subject
    group by assessment_blob_id
  ),
  -- assessment.paperScores { subjectName: { paperName: { studentBlobId: value } } }
  paper_level as (
    select assessment_blob_id as id,
           jsonb_object_agg(subject_name, papers) as marks
    from (
      select assessment_blob_id, subject_name,
             jsonb_object_agg(paper_name, inner_marks) as papers
      from (
        select assessment_blob_id, subject_name, paper_name,
               jsonb_object_agg(student_blob_id, score) as inner_marks
        from mark
        where subject_name <> '' and paper_name <> ''
        group by assessment_blob_id, subject_name, paper_name
      ) per_paper
      group by assessment_blob_id, subject_name
    ) per_subject
    group by assessment_blob_id
  )
  select coalesce(jsonb_object_agg(ids.id, jsonb_build_object(
           'general',  coalesce(general.marks, '{}'::jsonb),
           'subjects', coalesce(subject_level.marks, '{}'::jsonb),
           'papers',   coalesce(paper_level.marks, '{}'::jsonb)
         )), '{}'::jsonb)
  from (select distinct assessment_blob_id as id from mark) ids
  left join general on general.id = ids.id
  left join subject_level on subject_level.id = ids.id
  left join paper_level on paper_level.id = ids.id;
$fn$;

revoke execute on function public.assessment_scores_overlay() from public, anon, authenticated;
grant execute on function public.assessment_scores_overlay() to service_role;

-- PostgREST caches the list of callable functions, so without this the RPC can
-- 404 for a while after this file runs.
notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- STEP 1 - coverage. Run ONLY this statement.
--
-- The editor shows the result of the last statement in a run, hence one query.
--
-- WHAT TO EXPECT
--   general_marks + subject_marks + paper_marks = score_rows.
--   Both sides are ~31553 today. The three arms count what the overlay will
--   actually hand the client; score_rows counts the table. They differ only if a
--   row's assessment or student has no blob_id - i.e. a row this overlay cannot
--   address - so a shortfall here is the number of marks that would stay
--   invisible, and is worth chasing before 4c is deployed.
--
--   assessments_in_overlay is the number of assessments holding at least one
--   mark, which is <= the 17 in the blob.
-- ---------------------------------------------------------------------------
with o as (
  select public.assessment_scores_overlay() as j
)
select
  (select count(*) from o, jsonb_each(o.j)) as assessments_in_overlay,
  (select count(*) from o, jsonb_each(o.j) a, jsonb_each(a.value->'general') g) as general_marks,
  (select count(*) from o, jsonb_each(o.j) a, jsonb_each(a.value->'subjects') s, jsonb_each(s.value) m) as subject_marks,
  (select count(*) from o, jsonb_each(o.j) a, jsonb_each(a.value->'papers') s, jsonb_each(s.value) p, jsonb_each(p.value) m) as paper_marks,
  (select count(*) from public.scores) as score_rows;


-- ---------------------------------------------------------------------------
-- STEP 2 - READ THIS BEFORE POINTING AT A REAL MARK.
--
-- Until 4b is deployed the blob is still ahead of public.scores, because marks
-- typed after the last seed went to the blob only. The overlay prefers the row,
-- so deploying 4c before a seed would revert those marks in the UI. Run STEP 5
-- of 003 (the full seed) immediately before the deploy that ships 4b + 4c.
--
-- Since 006 is code-side only and harmless on its own, the order is:
--   run 006  ->  run STEP 5 of 003  ->  deploy 4b + 4c  ->  4d below.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 4d - ACCEPTANCE, after 4b + 4c are deployed. Comments only, so STEP 1 stays
-- the last statement the editor returns.
--
-- The point of the whole release is that entering a mark no longer touches the
-- blob. So the test is that the blob does NOT move while the mark does.
--
-- a) Note the blob's revision:
--
--      select revision, updated_at from public.school_state where id = 'default';
--
-- b) In the app, type one mark into any assessment. Wait for the save (the
--    debounce is 3s). Do NOT touch anything structural.
--
-- c) Re-run (a). revision must be UNCHANGED. If it went up, mark entry is still
--    writing the blob and the concurrency fix is not in effect - check that
--    server/supabase-db.ts still routes marks through upsert_assessment_scores
--    and that the client's flushMarks is the one sending them.
--
-- d) The row holds the new value. Replace the two blob ids:
--
--      select sc.score
--      from public.scores sc
--      join public.assessments a on a.id = sc.assessment_id
--      join public.students s on s.id = sc.student_id
--      where a.blob_id = '<assessment blob id>'
--        and s.blob_id = '<student blob id>'
--        and sc.subject_name = '' and sc.paper_name = '';   -- general mark
--
-- e) The read path shows it. Same two ids:
--
--      select public.assessment_scores_overlay()
--               -> '<assessment blob id>' -> 'general' -> '<student blob id>';
--
--    then reload the app and confirm the mark is on screen: a reload is the
--    real test, because the typing client also holds it in local state.
--
-- f) One teacher's mark must reach another's screen. Open a second browser
--    profile (or a different teacher's login), load the marks sheet and confirm
--    the value is there after a reload - that is the concurrency problem this
--    release exists to fix.
--
-- g) Re-run STEP 1 above. The totals must have moved by exactly the number of
--    marks entered, and general/subject/paper must still sum to score_rows.
-- ---------------------------------------------------------------------------
