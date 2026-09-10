-- SUPERSEDED: do not run this migration.
-- The deployed schema uses public.teachers, public.classes, public.streams,
-- public.stream_subjects, public.students, public.assessments, public.scores,
-- public.academic_years, public.terms, and public.catalog. This historical file
-- used prefixed helper tables and is retained only for audit history.

alter table public.school_state
  add column if not exists revision bigint not null default 0;

create table if not exists public.school_teachers (
  id text primary key,
  name text not null,
  email text,
  initials text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists school_teachers_email_lower_idx
  on public.school_teachers (lower(email))
  where email is not null;

create table if not exists public.school_classes (
  id text primary key,
  name text not null,
  level text not null check (level in ('O', 'A')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, level)
);

create table if not exists public.school_streams (
  id text primary key,
  class_id text not null references public.school_classes(id) on delete cascade,
  name text not null,
  class_teacher_id text references public.school_teachers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, name)
);

create table if not exists public.school_stream_subjects (
  stream_id text not null references public.school_streams(id) on delete cascade,
  subject_name text not null,
  teacher_id text references public.school_teachers(id) on delete set null,
  initials text,
  category text not null default 'optional' check (category in ('compulsory', 'optional')),
  papers jsonb not null default '[]'::jsonb,
  primary key (stream_id, subject_name)
);

create table if not exists public.school_students (
  id text primary key,
  student_id text not null,
  first_name text not null default '',
  second_name text not null default '',
  other_names text,
  gender text not null check (gender in ('Male', 'Female')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists school_students_student_id_idx
  on public.school_students (student_id)
  where student_id <> '';

create table if not exists public.school_stream_students (
  stream_id text not null references public.school_streams(id) on delete cascade,
  student_id text not null references public.school_students(id) on delete cascade,
  subjects jsonb not null default '[]'::jsonb,
  optional_subjects jsonb not null default '[]'::jsonb,
  primary key (stream_id, student_id)
);

create table if not exists public.school_academic_years (
  id text primary key,
  name text not null,
  start_date date,
  end_date date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_terms (
  id text primary key,
  academic_year_id text not null references public.school_academic_years(id) on delete cascade,
  name text not null,
  term_number integer not null check (term_number between 1 and 3),
  start_date date,
  end_date date,
  is_active boolean not null default false,
  unique (academic_year_id, term_number)
);

create table if not exists public.school_assessments (
  id text primary key,
  class_id text not null references public.school_classes(id) on delete cascade,
  name text not null,
  assessment_date date,
  max_score numeric,
  academic_year_id text references public.school_academic_years(id) on delete set null,
  term_id text references public.school_terms(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_scores (
  assessment_id text not null references public.school_assessments(id) on delete cascade,
  student_id text not null references public.school_students(id) on delete cascade,
  score_kind text not null check (score_kind in ('general', 'subject', 'paper')),
  subject_name text not null default '',
  paper_name text not null default '',
  score numeric,
  updated_at timestamptz not null default now(),
  primary key (assessment_id, student_id, score_kind, subject_name, paper_name)
);

create table if not exists public.school_catalog (
  subject_name text primary key,
  category text not null check (category in ('compulsory', 'optional')),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_storage_meta (
  id text primary key check (id = 'default'),
  current_academic_year_id text not null default '',
  current_term_id text not null default '',
  updated_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'school_teachers', 'school_classes', 'school_streams',
    'school_stream_subjects', 'school_students', 'school_stream_students',
    'school_academic_years', 'school_terms', 'school_assessments',
    'school_scores', 'school_catalog', 'school_storage_meta'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end $$;

-- Backfill is idempotent for this migration's tables. It never deletes school_state.
create or replace function public.backfill_relational_school_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  state_row jsonb;
  class_row jsonb;
  stream_row jsonb;
  subject_row jsonb;
  student_row jsonb;
  year_row jsonb;
  term_row jsonb;
  assessment_row jsonb;
  score_entry record;
  subject_entry record;
  paper_entry record;
  paper_score_entry record;
  class_id text;
  stream_id text;
  student_id text;
  teacher_id text;
  year_id text;
begin
  select jsonb_build_object(
    'classes', classes,
    'teachers', teachers,
    'catalog', catalog,
    'academic_years', academic_years,
    'current_academic_year_id', current_academic_year_id,
    'current_term_id', current_term_id
  ) into state_row
  from public.school_state
  where id = 'default';

  if state_row is null then
    raise exception 'Cannot backfill relational data: school_state.default does not exist';
  end if;

  delete from public.school_scores;
  delete from public.school_assessments;
  delete from public.school_stream_students;
  delete from public.school_students;
  delete from public.school_stream_subjects;
  delete from public.school_streams;
  delete from public.school_classes;
  delete from public.school_terms;
  delete from public.school_academic_years;
  delete from public.school_catalog;
  delete from public.school_teachers;
  delete from public.school_storage_meta;

  insert into public.school_teachers (id, name, email, initials)
  select coalesce(value->>'id', 'teacher:' || md5(coalesce(value->>'email', '') || ':' || coalesce(value->>'name', ''))),
         coalesce(value->>'name', 'Unnamed'), value->>'email', value->>'initials'
  from jsonb_array_elements(coalesce(state_row->'teachers', '[]'::jsonb))
  on conflict (id) do update set name = excluded.name, email = excluded.email, initials = excluded.initials, updated_at = now();

  for year_row in select value from jsonb_array_elements(coalesce(state_row->'academic_years', '[]'::jsonb)) loop
    year_id := year_row->>'id';
    insert into public.school_academic_years (id, name, start_date, end_date, is_active)
    values (year_id, coalesce(year_row->>'name', year_id), nullif(year_row->>'startDate', '')::date, nullif(year_row->>'endDate', '')::date, coalesce((year_row->>'isActive')::boolean, false))
    on conflict (id) do update set name = excluded.name, start_date = excluded.start_date, end_date = excluded.end_date, is_active = excluded.is_active, updated_at = now();

    for term_row in select value from jsonb_array_elements(coalesce(year_row->'terms', '[]'::jsonb)) loop
      insert into public.school_terms (id, academic_year_id, name, term_number, start_date, end_date, is_active)
      values (term_row->>'id', year_id, coalesce(term_row->>'name', 'Term'), coalesce((term_row->>'number')::integer, 1), nullif(term_row->>'startDate', '')::date, nullif(term_row->>'endDate', '')::date, coalesce((term_row->>'isActive')::boolean, false))
      on conflict (id) do update set academic_year_id = excluded.academic_year_id, name = excluded.name, term_number = excluded.term_number, start_date = excluded.start_date, end_date = excluded.end_date, is_active = excluded.is_active;
    end loop;
  end loop;

  insert into public.school_catalog (subject_name, category)
  select key, value #>> '{}'
  from jsonb_each(coalesce(state_row->'catalog', '{}'::jsonb))
  where value #>> '{}' in ('compulsory', 'optional')
  on conflict (subject_name) do update set category = excluded.category, updated_at = now();

  for class_row in select value from jsonb_array_elements(coalesce(state_row->'classes', '[]'::jsonb)) loop
    class_id := coalesce(class_row->>'id', 'class:' || md5(coalesce(class_row->>'name', 'Unnamed') || ':' || coalesce(class_row->>'level', 'O')));
    insert into public.school_classes (id, name, level)
    values (class_id, coalesce(class_row->>'name', 'Unnamed'), case when class_row->>'level' = 'A' then 'A' else 'O' end)
    on conflict (id) do update set name = excluded.name, level = excluded.level, updated_at = now();

    for assessment_row in select value from jsonb_array_elements(coalesce(class_row->'assessments', '[]'::jsonb)) loop
      insert into public.school_assessments (id, class_id, name, assessment_date, max_score, academic_year_id, term_id)
      values (assessment_row->>'id', class_id, coalesce(assessment_row->>'name', 'Assessment'), nullif(assessment_row->>'date', '')::date, (assessment_row->>'maxScore')::numeric, nullif(assessment_row->>'academicYearId', ''), nullif(assessment_row->>'termId', ''))
      on conflict (id) do update set class_id = excluded.class_id, name = excluded.name, assessment_date = excluded.assessment_date, max_score = excluded.max_score, academic_year_id = excluded.academic_year_id, term_id = excluded.term_id, updated_at = now();
    end loop;

    for stream_row in select value from jsonb_array_elements(coalesce(class_row->'streams', '[]'::jsonb)) loop
      stream_id := coalesce(stream_row->>'id', 'stream:' || md5(class_id || ':' || coalesce(stream_row->>'name', 'A')));
      teacher_id := nullif(stream_row->>'classTeacherId', '');
      insert into public.school_streams (id, class_id, name, class_teacher_id)
      values (stream_id, class_id, coalesce(stream_row->>'name', 'A'), teacher_id)
      on conflict (id) do update set class_id = excluded.class_id, name = excluded.name, class_teacher_id = excluded.class_teacher_id, updated_at = now();

      for subject_row in select value from jsonb_array_elements(coalesce(stream_row->'subjects', '[]'::jsonb)) loop
        insert into public.school_stream_subjects (stream_id, subject_name, teacher_id, initials, category, papers)
        values (stream_id, coalesce(subject_row->>'name', subject_row #>> '{}'), nullif(subject_row->>'teacherId', ''), subject_row->>'initials', coalesce(subject_row->>'category', 'optional'), coalesce(subject_row->'papers', '[]'::jsonb))
        on conflict (stream_id, subject_name) do update set teacher_id = excluded.teacher_id, initials = excluded.initials, category = excluded.category, papers = excluded.papers;
      end loop;

      for student_row in select value from jsonb_array_elements(coalesce(stream_row->'students', '[]'::jsonb)) loop
        student_id := coalesce(student_row->>'id', 'student:' || md5(stream_id || ':' || coalesce(student_row->>'studentID', '') || ':' || coalesce(student_row->>'firstName', '')));
        insert into public.school_students (id, student_id, first_name, second_name, other_names, gender)
        values (student_id, coalesce(student_row->>'studentID', ''), coalesce(student_row->>'firstName', ''), coalesce(student_row->>'secondName', ''), student_row->>'otherNames', case when student_row->>'gender' = 'Female' then 'Female' else 'Male' end)
        on conflict (id) do update set student_id = excluded.student_id, first_name = excluded.first_name, second_name = excluded.second_name, other_names = excluded.other_names, gender = excluded.gender, updated_at = now();
        insert into public.school_stream_students (stream_id, student_id, subjects, optional_subjects)
        values (stream_id, student_id, coalesce(student_row->'subjects', '[]'::jsonb), coalesce(student_row->'optionalSubjects', '[]'::jsonb))
        on conflict (stream_id, student_id) do update set subjects = excluded.subjects, optional_subjects = excluded.optional_subjects;
      end loop;
    end loop;
  end loop;

  insert into public.school_storage_meta (id, current_academic_year_id, current_term_id)
  values ('default', coalesce(state_row->>'current_academic_year_id', ''), coalesce(state_row->>'current_term_id', ''))
  on conflict (id) do update set current_academic_year_id = excluded.current_academic_year_id, current_term_id = excluded.current_term_id, updated_at = now();
end;
$$;

select public.backfill_relational_school_data();

revoke execute on function public.backfill_relational_school_data() from public, anon, authenticated;

create or replace function public.sync_relational_school_data_from_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.backfill_relational_school_data();
  return new;
end;
$$;

drop trigger if exists school_state_relational_sync on public.school_state;
create trigger school_state_relational_sync
after insert or update on public.school_state
for each row execute function public.sync_relational_school_data_from_state();

revoke execute on function public.sync_relational_school_data_from_state() from public, anon, authenticated;