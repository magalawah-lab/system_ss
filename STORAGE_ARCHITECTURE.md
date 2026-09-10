# Storage Architecture

The application uses the existing normalized public tables as its operational source of truth. `public.school_state` remains as a rollback and export source during the migration period.

## What is stored there

The legacy `school_state` row contains the original application snapshot:

- `teachers`
- `classes`, including streams, students, subjects, assessments, and scores
- `catalog`
- `academic_years`, including terms
- current academic-year and term IDs

The routes under `app/api/classes`, `app/api/teachers`, `app/api/catalog`, and
`app/api/academic-years` now read and write `public.classes`,
`public.teachers`, `public.streams`, `public.stream_subjects`,
`public.students`, `public.assessments`, `public.scores`,
`public.academic_years`, `public.terms`, and `public.catalog` through
`server/supabase-db.ts`. The students and assessments routes continue to expose
the existing nested response shape for UI compatibility.

## Relational tables

These existing relational tables are the active operational tables. Their
relationships are `streams.class_id`, `students.stream_id`,
`stream_subjects.subject_id`, `assessments.class_id`, and
`scores.assessment_id` plus `scores.student_id`.

## Verification

`GET /api/storage/diagnostics` returns counts from the relational tables without
returning student, teacher, or score values. It reports nested students,
assessments, terms, and scores as well as classes, streams, subjects, and catalog
entries.

The JSON row now uses a `revision` value for optimistic locking. Concurrent
writes are rejected instead of silently overwriting the other session's data.

A future migration to relational storage must be an explicit, tested migration:
first define the target schema and foreign-key mapping, then dual-read or
dual-write during cutover, and only remove the JSON fields after verification.

## Relational migration

The deployed relational tables were already present and populated. The server
now reads and writes those tables directly. The old JSON migration remains
available as a rollback/export source; do not use its prefixed helper tables as
the application source of truth.
