import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

export type SubjectCategory = 'compulsory' | 'optional';

const UUID_DELETE_SENTINEL = '00000000-0000-0000-0000-000000000000';

type State = {
  id: string;
  updated_at?: string;
  revision: number;
  classes: any[];
  teachers: any[];
  catalog: Record<string, SubjectCategory>;
  academic_years: any[];
  current_academic_year_id: string;
  current_term_id: string;
};

const EMPTY_STATE: Omit<State, 'id'> = {
  classes: [],
  teachers: [],
  catalog: {},
  academic_years: [],
  current_academic_year_id: '',
  current_term_id: '',
  revision: 0,
};

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables, then redeploy.');
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function stableId(prefix: string, value: string) {
  const hex = createHash('sha256').update(`${prefix}:${value}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function relationalId(value: unknown, prefix: string, fallback: string) {
  return isUuid(value) ? value : stableId(prefix, fallback);
}

async function queryRows(table: string) {
  const { data, error } = await getSupabaseAdmin().from(table).select('*');
  if (error) throw new Error(`Supabase ${table} read failed: ${error.message}`);
  return data || [];
}

async function readRelationalClasses(): Promise<any[]> {
  const [classRows, streamRows, streamSubjectRows, subjectRows, studentRows, assessmentRows, scoreRows] = await Promise.all([
    queryRows('classes'),
    queryRows('streams'),
    queryRows('stream_subjects'),
    queryRows('subjects'),
    queryRows('students'),
    queryRows('assessments'),
    queryRows('scores'),
  ]);

  const studentsById = new Map(studentRows.map((student: any) => [student.id, student]));
  const subjectsById = new Map(subjectRows.map((subject: any) => [subject.id, subject]));
  const studentsByStream = new Map<string, any[]>();
  studentRows.forEach((student: any) => {
    const students = studentsByStream.get(student.stream_id) || [];
    students.push(student);
    studentsByStream.set(student.stream_id, students);
  });
  const subjectsByStream = new Map<string, any[]>();
  streamSubjectRows.forEach((streamSubject: any) => {
    const subjects = subjectsByStream.get(streamSubject.stream_id) || [];
    const subject = subjectsById.get(streamSubject.subject_id);
    if (!subject) return;
    subjects.push({ ...streamSubject, subject });
    subjectsByStream.set(streamSubject.stream_id, subjects);
  });
  const streamsByClass = new Map<string, any[]>();
  streamRows.forEach((stream: any) => {
    const streams = streamsByClass.get(stream.class_id) || [];
    streams.push(stream);
    streamsByClass.set(stream.class_id, streams);
  });
  const scoresByAssessment = new Map<string, any[]>();
  scoreRows.forEach((score: any) => {
    const scores = scoresByAssessment.get(score.assessment_id) || [];
    scores.push(score);
    scoresByAssessment.set(score.assessment_id, scores);
  });
  const assessmentsByClass = new Map<string, any[]>();
  assessmentRows.forEach((assessment: any) => {
    const assessments = assessmentsByClass.get(assessment.class_id) || [];
    assessments.push(assessment);
    assessmentsByClass.set(assessment.class_id, assessments);
  });

  return classRows.map((classRow: any) => ({
    id: classRow.id,
    name: classRow.name,
    level: classRow.level,
    streams: (streamsByClass.get(classRow.id) || []).map((stream: any) => ({
      id: stream.id,
      name: stream.name,
      classTeacherId: stream.class_teacher_id || undefined,
      subjects: (subjectsByStream.get(stream.id) || []).map((streamSubject: any) => ({
        name: streamSubject.subject.name,
        teacherId: streamSubject.teacher_id || undefined,
        initials: undefined,
        category: streamSubject.subject.category || 'optional',
        papers: Array.isArray(streamSubject.papers) ? streamSubject.papers : undefined,
      })),
      students: (studentsByStream.get(stream.id) || []).map((student: any) => {
        return {
          id: student.id,
          studentID: student.student_id || '',
          firstName: student.first_name || '',
          secondName: student.second_name || '',
          otherNames: student.other_names || '',
          gender: student.gender === 'Female' ? 'Female' : 'Male',
          subjects: Array.isArray(student.subjects) ? student.subjects : [],
          optionalSubjects: Array.isArray(student.optional_subjects) ? student.optional_subjects : [],
        };
      }),
    })),
    assessments: (assessmentsByClass.get(classRow.id) || []).map((assessment: any) => {
      const scores: Record<string, number | null> = {};
      const subjectScores: Record<string, Record<string, number | null>> = {};
      const paperScores: Record<string, Record<string, Record<string, number | null>>> = {};
      (scoresByAssessment.get(assessment.id) || []).forEach((row: any) => {
        if (!row.subject_name && !row.paper_name) scores[row.student_id] = row.score;
        if (row.subject_name && !row.paper_name) {
          subjectScores[row.subject_name] = subjectScores[row.subject_name] || {};
          subjectScores[row.subject_name][row.student_id] = row.score;
        }
        if (row.subject_name && row.paper_name) {
          paperScores[row.subject_name] = paperScores[row.subject_name] || {};
          paperScores[row.subject_name][row.paper_name] = paperScores[row.subject_name][row.paper_name] || {};
          paperScores[row.subject_name][row.paper_name][row.student_id] = row.score;
        }
      });
      return {
        id: assessment.id,
        name: assessment.name,
        date: assessment.date || undefined,
        maxScore: assessment.max_score === null ? undefined : Number(assessment.max_score),
        academicYearId: assessment.academic_year_id || '',
        termId: assessment.term_id || '',
        scores,
        subjectScores,
        paperScores,
      };
    }),
  }));
}

async function insertRelationalClasses(classes: any[]) {
  const client = getSupabaseAdmin();
  const { data: existingSubjects, error: subjectReadError } = await client.from('subjects').select('id,name,level');
  if (subjectReadError) throw new Error(`Supabase subjects read failed: ${subjectReadError.message}`);
  const subjectIds = new Map((existingSubjects || []).map((subject: any) => [`${subject.level || ''}:${subject.name}`, subject.id]));
  const classRows: any[] = [];
  const streamRows: any[] = [];
  const subjectRows: any[] = [];
  const streamSubjectRows: any[] = [];
  const studentRows: any[] = [];
  const assessmentRows: any[] = [];
  const scoreRows: any[] = [];
  const studentIds = new Map<string, string>();

  classes.forEach((classItem: any) => {
    const classId = relationalId(classItem.id, 'class', `${classItem.name}:${classItem.level}`);
    classRows.push({ id: classId, name: classItem.name || 'Unnamed', level: classItem.level === 'A' ? 'A' : 'O' });
    (classItem.streams || []).forEach((stream: any) => {
      const streamId = relationalId(stream.id, 'stream', `${classId}:${stream.name}`);
      streamRows.push({ id: streamId, class_id: classId, name: stream.name || 'A', class_teacher_id: isUuid(stream.classTeacherId) ? stream.classTeacherId : null });
      (stream.subjects || []).forEach((subject: any) => {
        const subjectName = typeof subject === 'string' ? subject : subject.name;
        const subjectLevel = classItem.level === 'A' ? 'A' : 'O';
        const subjectId = subjectIds.get(`${subjectLevel}:${subjectName}`) || stableId('subject', `${subjectLevel}:${subjectName}`);
        subjectIds.set(`${subjectLevel}:${subjectName}`, subjectId);
        if (!subjectRows.some((row) => row.id === subjectId)) {
          subjectRows.push({ id: subjectId, name: subjectName, category: typeof subject === 'string' ? 'optional' : subject.category || 'optional', level: subjectLevel });
        }
        streamSubjectRows.push({
          id: stableId('stream-subject', `${streamId}:${subjectId}`),
          stream_id: streamId,
          subject_id: subjectId,
          teacher_id: typeof subject === 'string' || !isUuid(subject.teacherId) ? null : subject.teacherId,
          papers: typeof subject === 'string' ? [] : subject.papers || [],
        });
      });
      (stream.students || []).forEach((student: any) => {
        const studentId = relationalId(student.id, 'student', `${streamId}:${student.studentID}:${student.firstName}:${student.secondName}`);
        if (student.id) studentIds.set(student.id, studentId);
        studentRows.push({
          id: studentId,
          stream_id: streamId,
          student_id: student.studentID || '',
          first_name: student.firstName || '',
          second_name: student.secondName || '',
          other_names: student.otherNames || null,
          gender: student.gender === 'Female' ? 'Female' : 'Male',
          subjects: student.subjects || [],
          optional_subjects: student.optionalSubjects || [],
        });
      });
    });
    (classItem.assessments || []).forEach((assessment: any) => {
      const assessmentId = relationalId(assessment.id, 'assessment', `${classId}:${assessment.name}:${assessment.date || ''}`);
      assessmentRows.push({
        id: assessmentId,
        class_id: classId,
        name: assessment.name || 'Assessment',
        date: assessment.date || null,
        max_score: assessment.maxScore ?? null,
        academic_year_id: isUuid(assessment.academicYearId) ? assessment.academicYearId : null,
        term_id: isUuid(assessment.termId) ? assessment.termId : null,
      });
      Object.entries(assessment.scores || {}).forEach(([studentId, score]) => {
        const normalizedStudentId = studentIds.get(studentId);
        if (normalizedStudentId) scoreRows.push({ id: stableId('score', `${assessmentId}:${normalizedStudentId}::`), assessment_id: assessmentId, student_id: normalizedStudentId, subject_name: null, paper_name: null, score });
      });
      Object.entries(assessment.subjectScores || {}).forEach(([subjectName, scores]) => Object.entries(scores as Record<string, number | null>).forEach(([studentId, score]) => {
        const normalizedStudentId = studentIds.get(studentId);
        if (normalizedStudentId) scoreRows.push({ id: stableId('score', `${assessmentId}:${normalizedStudentId}:${subjectName}:`), assessment_id: assessmentId, student_id: normalizedStudentId, subject_name: subjectName, paper_name: null, score });
      }));
      Object.entries(assessment.paperScores || {}).forEach(([subjectName, papers]) => Object.entries(papers as Record<string, Record<string, number | null>>).forEach(([paperName, scores]) => Object.entries(scores).forEach(([studentId, score]) => {
        const normalizedStudentId = studentIds.get(studentId);
        if (normalizedStudentId) scoreRows.push({ id: stableId('score', `${assessmentId}:${normalizedStudentId}:${subjectName}:${paperName}`), assessment_id: assessmentId, student_id: normalizedStudentId, subject_name: subjectName, paper_name: paperName, score });
      })));
    });
  });

  for (const [table, rows] of [
    ['classes', classRows],
    ['streams', streamRows],
    ['subjects', subjectRows],
    ['stream_subjects', streamSubjectRows],
    ['students', studentRows],
    ['assessments', assessmentRows],
    ['scores', scoreRows],
  ] as const) {
    if (rows.length === 0) continue;
    const uniqueRows = table === 'stream_subjects'
      ? Array.from(new Map(rows.map((row) => [`${row.stream_id}:${row.subject_id}`, row])).values())
      : rows;
    const write = table === 'subjects' || table === 'stream_subjects'
      ? client.from(table).upsert(uniqueRows, { onConflict: 'id' })
      : client.from(table).insert(rows);
    const { error } = await write;
    if (error) throw new Error(`Supabase ${table} write failed: ${error.message}`);
  }
}

async function readState(): Promise<State> {
  const { data, error } = await getSupabaseAdmin()
    .from('school_state')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  if (error) throw new Error(`Supabase school_state read failed: ${error.message}`);
  return {
    id: 'default',
    ...EMPTY_STATE,
    ...(data || {}),
    classes: Array.isArray(data?.classes) ? data.classes : [],
    teachers: Array.isArray(data?.teachers) ? data.teachers : [],
    catalog: data?.catalog && typeof data.catalog === 'object' ? data.catalog : {},
    academic_years: Array.isArray(data?.academic_years) ? data.academic_years : [],
    revision: typeof data?.revision === 'number' ? data.revision : 0,
  };
}

// Read a single column of the state row. readState() selects '*' — the entire
// ~900 KB row — but teachers, catalog and academic_years are a few KB each.
// PostgreSQL does not have to detoast the out-of-line classes column to return
// them, so callers that need only a small slice should not pay for the blob.
async function readColumn<T>(column: string, fallback: T): Promise<T> {
  const { data, error } = await getSupabaseAdmin()
    .from('school_state')
    .select(column)
    .eq('id', 'default')
    .maybeSingle();

  if (error) throw new Error(`Supabase school_state read failed: ${error.message}`);
  const value = (data as Record<string, unknown> | null)?.[column];
  return (value === null || value === undefined) ? fallback : value as T;
}

// Fingerprint of the blob data the relational structure is built from.
//
// Mark entry writes only assessment.scores / subjectScores / paperScores (see
// updateAssessmentScore and the two functions after it), so those three keys are
// dropped before hashing. Without that, every mark keystroke batch would look
// like a structural change and the sync below would re-materialise the entire
// structure - the opposite of the point.
//
// Object keys are sorted recursively because the same data arrives differently
// depending on where it came from: jsonb hands back its own key order, while the
// payload from the browser carries React's. Sorting makes one fingerprint out of
// both, so a save that changes nothing does not trigger a sync.
function structuralFingerprint(classes: unknown, academicYears: unknown): string {
  const canonical = (value: any): any => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce<Record<string, any>>((sorted, key) => {
        sorted[key] = canonical(value[key]);
        return sorted;
      }, {});
    }
    return value;
  };

  const structuralClasses = (Array.isArray(classes) ? classes : []).map((classItem: any) => {
    const { assessments, ...rest } = classItem || {};
    return {
      ...rest,
      assessments: (Array.isArray(assessments) ? assessments : []).map((assessment: any) => {
        if (!assessment || typeof assessment !== 'object') return assessment;
        // Deleting rather than destructuring the three keys out: the point is
        // "these three hold marks", and it keeps the copy explicit.
        const structure = { ...assessment };
        delete structure.scores;
        delete structure.subjectScores;
        delete structure.paperScores;
        return structure;
      }),
    };
  });

  return createHash('sha256')
    .update(JSON.stringify(canonical({ classes: structuralClasses, academic_years: academicYears ?? [] })))
    .digest('hex');
}

// Ask the database to re-materialise the relational structure, but only when the
// structure actually changed. public.sync_relational_structure compares the
// fingerprint against the one stored by the last sync and returns without
// touching the blob when they match - the normal case for a mark save.
//
// Failures are logged and swallowed deliberately. In Release 1 the blob is still
// the source of truth and nothing reads the relational tables yet, so a sync that
// fails must not turn a save that succeeded into an error the teacher sees. The
// fingerprint is only stored when the seed itself succeeds, so the next save
// retries a sync that failed rather than skipping it.
async function syncRelationalStructure(state: State): Promise<void> {
  try {
    const fingerprint = structuralFingerprint(state.classes, state.academic_years);
    const { error } = await getSupabaseAdmin()
      .rpc('sync_relational_structure', { p_fingerprint: fingerprint });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error('Relational structure sync failed (the save itself succeeded):', error);
  }
}

// `expectedRevision` is the revision the caller built its payload from. It is
// deliberately separate from state.revision: readState() immediately above the
// write always returns the current revision, so guarding on it compared a value
// against itself and could never reject anything. A client that loaded the
// school an hour ago would then save its older copy over everyone else's work,
// silently. Callers that omit it (seedDefaults, restoreBackup) get the old
// read-then-write behaviour, which is correct for them because they are the
// ones reading and deciding what the new state is.
async function writeState(state: State, expectedRevision?: number): Promise<State> {
  const nextRevision = state.revision + 1;
  const payload = {
    ...state,
    id: 'default',
    revision: nextRevision,
    updated_at: new Date().toISOString(),
  };
  const guard = typeof expectedRevision === 'number' ? expectedRevision : state.revision;
  // Request only the columns the revision guard needs. Selecting '*' makes
  // PostgREST send the whole row back, and the row is a ~900 KB TOASTed JSONB
  // blob we already hold in memory, so every save downloaded a second full copy
  // of itself. No caller uses the returned state.
  const { error } = await getSupabaseAdmin()
    .from('school_state')
    .update(payload)
    .eq('id', 'default')
    .eq('revision', guard)
    .select('id, revision')
    .single();

  if (error) {
    if (error.code === 'PGRST116' && guard === 0) {
      const { error: insertError } = await getSupabaseAdmin()
        .from('school_state')
        .insert(payload)
        .select('id, revision')
        .single();
      if (!insertError) {
        await syncRelationalStructure(payload);
        return payload;
      }
    }
    const message = error.code === 'PGRST116'
      ? 'The data changed in another session. Reload the page before saving again.'
      : error.message;
    throw new Error(`Supabase school_state write failed: ${message}`);
  }
  // Release 1: keep the relational tables in step with the blob. This is the one
  // place every writer funnels through, so no individual caller has to remember
  // to sync. It runs after the write has committed and it decides for itself
  // whether anything structural changed.
  await syncRelationalStructure(payload);
  return payload;
}

export async function seedDefaults(): Promise<void> {
  const state = await readState();
  if (state.classes.length || state.teachers.length || Object.keys(state.catalog).length) return;
  await replaceTeachers([
    { id: 't1', name: 'John Doe', initials: 'JD' },
    { id: 't2', name: 'Jane Smith', initials: 'JS' },
  ]);
  await replaceCatalog({
    Mathematics: 'compulsory',
    English: 'compulsory',
    'Integrated Science': 'compulsory',
    Physics: 'optional',
    Chemistry: 'optional',
    Biology: 'optional',
    History: 'optional',
    Geography: 'optional',
  });
  await upsertClasses([{ name: 'Senior 1', level: 'O', streams: [], assessments: [] }]);
}

// The marks of every assessment, keyed by the blob ids the browser already
// holds. Shape is fixed by 006_scores_read_overlay.sql.
type ScoresOverlay = Record<string, {
  general?: Record<string, number | null>;
  subjects?: Record<string, Record<string, number | null>>;
  papers?: Record<string, Record<string, Record<string, number | null>>>;
}>;

// Release 2, step 4c: read the marks out of public.scores.
//
// One RPC rather than a select, because the function returns the whole set as
// a single jsonb value: PostgREST caps a response at db-max-rows (1000 by
// default) and there are ~31553 marks, so a table select would come back
// truncated without saying so.
//
// A failure here is logged and swallowed, like the Release 1 sync. Throwing
// would take down /api/classes and /api/assessments - the class list, the
// student list and every report - over the marks of one release. Swallowing
// means the blob's own marks are served instead, which is exactly what the app
// showed before 4b, so the degradation is visible rather than destructive. It
// also covers the window after 006 runs and before PostgREST has reloaded its
// schema cache.
async function readScoresOverlay(): Promise<ScoresOverlay> {
  try {
    const { data, error } = await getSupabaseAdmin().rpc('assessment_scores_overlay');
    if (error) throw new Error(error.message);
    return (data && typeof data === 'object' ? data : {}) as ScoresOverlay;
  } catch (error) {
    console.error('Score overlay read failed (serving the blob\'s own marks):', error);
    return {};
  }
}

// Write the rows over the blob's marks, mark by mark.
//
// The blob stays the base, it is not replaced. It still holds the structure,
// and it holds the ~95 marks whose student has no row (deleted students, and
// students the seed could not map) - replacing the maps wholesale would delete
// those from every report and marksheet, and 4b would then re-add them on the
// next save of the blob anyway. Merging keeps them.
//
// The row always wins, including when it holds NULL: a cleared mark is a row
// with a null score, and that null has to reach the client to clear the blob's
// stale value rather than silently falling back to it.
//
// Known limitation (documented in 006): renaming a subject in class management
// rewrites the blob's key but not the row, so a stale subject name reappears
// next to the new one until the rows are renamed too.
function applyScoresOverlay(classes: any[], overlay: ScoresOverlay): any[] {
  if (classes.length === 0) return classes;

  return classes.map((classItem: any) => {
    if (!Array.isArray(classItem?.assessments)) return classItem;
    return {
      ...classItem,
      assessments: classItem.assessments.map((assessment: any) => {
        const marks = overlay?.[assessment?.id];
        if (!marks) return assessment;

        const scores = { ...(assessment.scores || {}) };
        Object.entries(marks.general || {}).forEach(([studentId, score]) => {
          scores[studentId] = score;
        });

        const subjectScores = { ...(assessment.subjectScores || {}) };
        Object.entries(marks.subjects || {}).forEach(([subjectName, innerMarks]) => {
          subjectScores[subjectName] = { ...(subjectScores[subjectName] || {}), ...innerMarks };
        });

        const paperScores = { ...(assessment.paperScores || {}) };
        Object.entries(marks.papers || {}).forEach(([subjectName, papers]) => {
          const mergedPapers = { ...(paperScores[subjectName] || {}) };
          Object.entries(papers || {}).forEach(([paperName, innerMarks]) => {
            mergedPapers[paperName] = { ...(mergedPapers[paperName] || {}), ...innerMarks };
          });
          paperScores[subjectName] = mergedPapers;
        });

        return { ...assessment, scores, subjectScores, paperScores };
      }),
    };
  });
}

// Structure comes from the blob, marks come from the rows (Release 2, 4c).
//
// The revision is returned with the classes so the browser can name the copy it
// built its edits from and send that back on the next save. Without it a client
// has no way to tell the server which version of the school it is overwriting.
export async function serializeClassesWithRevision(): Promise<{ revision: number; classes: unknown[] }> {
  const [state, overlay] = await Promise.all([readState(), readScoresOverlay()]);
  return { revision: state.revision, classes: applyScoresOverlay(state.classes, overlay) };
}

export async function serializeClasses(): Promise<any[]> {
  return (await serializeClassesWithRevision()).classes;
}

// Writes the whole classes array back to the blob. `expectedRevision` is the
// revision the caller's copy came from; pass it and a save built on a stale copy
// is rejected instead of overwriting newer work. Returns the revision the row
// now holds so the caller can base its next save on it.
export async function upsertClasses(classes: any[], force = false, expectedRevision?: number): Promise<number> {
  const state = await readState();
  const next = Array.isArray(classes) ? classes : [];
  if (!force && next.length === 0 && state.classes.length > 0) return state.revision;
  const saved = await writeState({ ...state, classes: next }, expectedRevision);
  return saved.revision;
}

export async function getTeachers(): Promise<any[]> {
  return readColumn<any[]>('teachers', []);
}

export async function replaceTeachers(teachers: any[]): Promise<void> {
  const state = await readState();
  await writeState({ ...state, teachers: Array.isArray(teachers) ? teachers : [] });
}

export async function getCatalog(): Promise<Record<string, SubjectCategory>> {
  return readColumn<Record<string, SubjectCategory>>('catalog', {});
}

export async function replaceCatalog(catalog: Record<string, SubjectCategory>): Promise<void> {
  const state = await readState();
  await writeState({ ...state, catalog: catalog && typeof catalog === 'object' ? catalog : {} });
}

export async function getAcademicYears(): Promise<any[]> {
  return readColumn<any[]>('academic_years', []);
}

export async function saveAcademicYears(years: any[]): Promise<void> {
  const state = await readState();
  await writeState({ ...state, academic_years: Array.isArray(years) ? years : [] });
}

export async function getCurrentAcademicYearId(): Promise<string> {
  const years = await getAcademicYears();
  return years.find((year) => year.isActive)?.id || years[0]?.id || '';
}

export async function getCurrentTermId(): Promise<string> {
  const years = await getAcademicYears();
  const year = years.find((item: any) => item.isActive) || years[0];
  return year?.terms?.find((term: any) => term.isActive)?.id || year?.terms?.[0]?.id || '';
}

export async function setCurrentAcademicYearId(id: string): Promise<void> {
  const state = await readState();
  const academicYears = state.academic_years.map((year: any) => ({ ...year, isActive: year.id === id }));
  await writeState({ ...state, academic_years: academicYears, current_academic_year_id: id });
}

export async function setCurrentTermId(id: string): Promise<void> {
  const state = await readState();
  const academicYears = state.academic_years.map((year: any) => ({
    ...year,
    terms: (year.terms || []).map((term: any) => ({ ...term, isActive: term.id === id })),
  }));
  await writeState({ ...state, academic_years: academicYears, current_term_id: id });
}

// Release 2's write path. Marks go to public.scores, never to the blob.
//
// The three functions this replaces each read the whole ~900 KB school_state
// row, edited one entry, and wrote the whole row back - so two teachers entering
// marks at the same time both locked that row, both downloaded it, and the loser
// was rejected with PGRST116. A mark is one row in public.scores, keyed by the
// deterministic id 003 seeded it with, so nothing here reads or writes the blob
// and two teachers writing different students touch different rows.
//
// This is the only place the browser's ids meet the relational ones: the ids
// arrive as the blob's string ids (assessment "asm...", student "stu...") and
// the database resolves them through assessments.blob_id / students.blob_id.
// Doing it in SQL rather than here is deliberate - the id formula then lives
// next to the seed that produced the ids, in public.blob_score_id().
export type ScoreMark = {
  assessmentId: string;
  studentId: string;
  type: 'general' | 'subject' | 'paper';
  score: number | null;
  subjectName?: string;
  paperName?: string;
};

export type ScoreWriteReport = {
  received: number;
  written: number;
  unmappedStudents: string[];
  unmappedAssessments: string[];
};

export async function upsertAssessmentScores(marks: ScoreMark[]): Promise<ScoreWriteReport> {
  if (marks.length === 0) {
    return { received: 0, written: 0, unmappedStudents: [], unmappedAssessments: [] };
  }

  // `type` is how the client thinks about a mark; what the table stores is the
  // (subject, paper) pair, and blanks are the absent halves. blob_score_value()
  // in the database is what decides whether `score` is a number at all, so this
  // passes it through rather than second-guessing it here.
  const payload = marks.map((mark) => ({
    assessment: mark.assessmentId,
    student: mark.studentId,
    subject: mark.type === 'general' ? '' : (mark.subjectName || ''),
    paper: mark.type === 'paper' ? (mark.paperName || '') : '',
    score: mark.score === undefined ? null : mark.score,
  }));

  const { data, error } = await getSupabaseAdmin()
    .rpc('upsert_assessment_scores', { p_marks: payload });
  if (error) throw new Error(`Score write failed: ${error.message}`);

  const report = (data || {}) as Record<string, unknown>;
  return {
    received: Number(report.received ?? marks.length),
    written: Number(report.written ?? 0),
    unmappedStudents: (report.unmapped_students as string[]) || [],
    unmappedAssessments: (report.unmapped_assessments as string[]) || [],
  };
}

export async function updateStudentSubjects(studentId: string, subjects: string[], optionalSubjects: string[]): Promise<void> {
  const state = await readState();
  const classes = state.classes.map((classItem: any) => ({
    ...classItem,
    streams: (classItem.streams || []).map((stream: any) => ({
      ...stream,
      students: (stream.students || []).map((student: any) => (
        student.id === studentId ? { ...student, subjects, optionalSubjects } : student
      )),
    })),
  }));
  await writeState({ ...state, classes });
}

export async function updateTeacherAssignment(className: string, streamName: string, type: 'subject' | 'class', teacherId: string | null, subjectName?: string, initials?: string): Promise<void> {
  const state = await readState();
  let found = false;
  const classes = state.classes.map((classItem: any) => {
    if (classItem.name !== className) return classItem;
    return {
      ...classItem,
      streams: (classItem.streams || []).map((stream: any) => {
        if (stream.name !== streamName) return stream;
        found = true;
        if (type === 'class') return { ...stream, classTeacherId: teacherId || undefined };
        return {
          ...stream,
          subjects: (stream.subjects || []).map((subject: any) => (
            subject.name === subjectName ? { ...subject, teacherId: teacherId || undefined, initials } : subject
          )),
        };
      }),
    };
  });
  if (!found) throw new Error('Class stream not found');
  await writeState({ ...state, classes });
}

export async function exportBackup(): Promise<any> {
  // One read instead of four separate full-blob reads.
  const state = await readState();
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    backend: 'supabase-relational',
    data: {
      teachers: state.teachers,
      classes: state.classes,
      catalog: state.catalog,
      academicYears: state.academic_years,
    },
  };
}

export async function restoreBackup(payload: any): Promise<void> {
  const data = payload?.data || payload;
  await replaceTeachers(Array.isArray(data?.teachers) ? data.teachers : []);
  await saveAcademicYears(Array.isArray(data?.academicYears) ? data.academicYears : []);
  await replaceCatalog(data?.catalog && typeof data.catalog === 'object' ? data.catalog : {});
  await upsertClasses(Array.isArray(data?.classes) ? data.classes : [], true);
}

export async function getStudents(streamId?: string): Promise<any[]> {
  const classes = await serializeClasses();
  return classes.flatMap((cls: any) => (cls.streams || [])
    .filter((stream: any) => !streamId || stream.id === streamId || stream.name === streamId)
    .flatMap((stream: any) => stream.students || []));
}

export async function getStorageDiagnostics() {
  // One read, not four. The previous Promise.all() issued four identical
  // full-blob reads of the same single row.
  const state = await readState();
  const classes = state.classes;
  const teachers = state.teachers;
  const catalog = state.catalog;
  const academicYears = state.academic_years;
  const streams = classes.flatMap((item: any) => item.streams || []);
  const assessments = classes.flatMap((item: any) => item.assessments || []);
  const students = streams.flatMap((stream: any) => stream.students || []);
  const terms = academicYears.flatMap((year: any) => year.terms || []);

  return {
    sourceOfTruth: 'public.school_state (single JSONB row)',
    counts: {
      teachers: teachers.length,
      classes: classes.length,
      streams: streams.length,
      students: students.length,
      assessments: assessments.length,
      subjects: streams.reduce((total: number, stream: any) => total + (stream.subjects || []).length, 0),
      catalogEntries: Object.keys(catalog).length,
      academicYears: academicYears.length,
      terms: terms.length,
      scores: assessments.reduce((total: number, assessment: any) => total
        + Object.keys(assessment.scores || {}).length
        + Object.values(assessment.subjectScores || {}).reduce((sum: number, scores: any) => sum + Object.keys(scores || {}).length, 0)
        + Object.values(assessment.paperScores || {}).reduce((sum: number, papers: any) => sum + Object.values(papers || {}).reduce((paperSum: number, scores: any) => paperSum + Object.keys(scores || {}).length, 0), 0), 0),
    },
  };
}
