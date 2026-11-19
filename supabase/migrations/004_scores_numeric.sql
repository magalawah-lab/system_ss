-- ============================================================================
-- 004_scores_numeric.sql
--
-- Retype the two mark-bearing columns from integer to numeric.
--
-- WHY
--   42% of the blob's marks have a fractional part (13,343 of 31,553 - measured
--   by migrations/003's report). grades for a term are entered like 67.5, and
--   `integer` cannot hold that: every fractional mark was silently rounded on
--   insert (67.5 stored as 68) and the original value was unrecoverable from the
--   table. schools_state (the blob) is still the source of truth, so nothing has
--   been lost yet, but Phase B points writes at this table and must not start on
--   a lossy type.
--
-- WHY THIS IS SAFE
--   Neither table is read or written by the running app:
--     * public.scores is written only by the unused insertRelationalClasses()
--       in server/supabase-db.ts and read only by the unused
--       readRelationalClasses(). Nothing imports either.
--     * server/supabase-db.ts reads assessments.max_score through
--       Number(assessment.max_score), which is unaffected by the retype.
--   No view, rule or trigger in the live project references either column
--   (otherwise the ALTER would be refused - see the pre-check below).
--   Both ALTERs are metadata-only in effect and safe to re-run.
--
-- RUN ORDER
--   1. Run this file first.
--   2. Then re-run migrations/003 - STEP 5 - so the 13,343 rounded marks are
--      rewritten with their exact values (003 upserts `score = excluded.score`).
--      Expect scores_with_fractional_value = 13343 afterwards.
--
-- ROLLBACK (only if you must; it re-rounds 13,343 marks)
--   alter table public.scores      alter column score     type integer;
--   alter table public.assessments alter column max_score type integer;
-- ============================================================================


-- ---------------------------------------------------------------------------
-- PRE-CHECK - read-only. Returns one row per column when a view or rule depends
-- on it; any row here means the matching ALTER below will be refused. Both
-- columns are expected to be absent from this result.
-- ---------------------------------------------------------------------------
select distinct table_name, column_name
from information_schema.view_column_usage
where table_schema = 'public'
  and table_name in ('scores', 'assessments')
order by table_name, column_name;


-- ---------------------------------------------------------------------------
-- The retype.
-- ---------------------------------------------------------------------------
alter table public.scores alter column score type numeric;

alter table public.assessments alter column max_score type numeric;


-- ---------------------------------------------------------------------------
-- VERIFY - the types, and the two values that must survive:
--   count > 0 proves fractional marks are stored without loss.
-- ---------------------------------------------------------------------------
select
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'scores' and column_name = 'score') as scores_score_type,
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'assessments' and column_name = 'max_score') as assessments_max_score_type,
  (select count(*) from public.scores where score is not null and score <> round(score)) as fractional_marks_stored,
  (select count(*) from public.scores) as total_marks;
