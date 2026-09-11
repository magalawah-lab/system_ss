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

async function writeState(state: State): Promise<State> {
  const nextRevision = state.revision + 1;
  const payload = {
    ...state,
    id: 'default',
    revision: nextRevision,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await getSupabaseAdmin()
    .from('school_state')
    .update(payload)
    .eq('id', 'default')
    .eq('revision', state.revision)
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116' && state.revision === 0) {
      const { data: inserted, error: insertError } = await getSupabaseAdmin()
        .from('school_state')
        .insert(payload)
        .select('*')
        .single();
      if (!insertError) return inserted as State;
    }
    const message = error.code === 'PGRST116'
      ? 'The data changed in another session. Reload the page before saving again.'
      : error.message;
    throw new Error(`Supabase school_state write failed: ${message}`);
  }
  return data as State;
}

export async function seedDefaults(): Promise<void> {
  const [classes, teachers, catalog] = await Promise.all([serializeClasses(), getTeachers(), getCatalog()]);
  if (classes.length || teachers.length || Object.keys(catalog).length) return;
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

export async function serializeClasses(): Promise<any[]> {
  return (await readState()).classes;
}

export async function upsertClasses(classes: any[], force = false): Promise<void> {
  const state = await readState();
  const current = state.classes;
  if (!force && classes.length === 0 && current.length > 0) return;
  await writeState({ ...state, classes: Array.isArray(classes) ? classes : [] });
}

export async function getTeachers(): Promise<any[]> {
  return (await readState()).teachers;
}

export async function replaceTeachers(teachers: any[]): Promise<void> {
  const state = await readState();
  await writeState({ ...state, teachers: Array.isArray(teachers) ? teachers : [] });
}

export async function getCatalog(): Promise<Record<string, SubjectCategory>> {
  return (await readState()).catalog;
}

export async function replaceCatalog(catalog: Record<string, SubjectCategory>): Promise<void> {
  const state = await readState();
  await writeState({ ...state, catalog: catalog && typeof catalog === 'object' ? catalog : {} });
}

export async function getAcademicYears(): Promise<any[]> {
  return (await readState()).academic_years;
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

async function updateAssessmentInState(assessmentId: string, update: (assessment: any) => void): Promise<void> {
  const state = await readState();
  const classes = state.classes.map((classItem: any) => ({
    ...classItem,
    assessments: (classItem.assessments || []).map((assessment: any) => {
      if (assessment.id !== assessmentId) return assessment;
      const updated = { ...assessment };
      update(updated);
      return updated;
    }),
  }));
  const found = classes.some((classItem: any) => (classItem.assessments || []).some((assessment: any) => assessment.id === assessmentId));
  if (!found) throw new Error('Assessment not found');
  await writeState({ ...state, classes });
}

export async function updateAssessmentScore(assessmentId: string, studentId: string, score: number | null): Promise<void> {
  await updateAssessmentInState(assessmentId, (assessment) => {
    assessment.scores = { ...(assessment.scores || {}), [studentId]: score };
  });
}

export async function updateAssessmentSubjectScore(assessmentId: string, subjectName: string, studentId: string, score: number | null): Promise<void> {
  await updateAssessmentInState(assessmentId, (assessment) => {
    assessment.subjectScores = { ...(assessment.subjectScores || {}) };
    assessment.subjectScores[subjectName] = { ...(assessment.subjectScores[subjectName] || {}), [studentId]: score };
  });
}

export async function updateAssessmentPaperScore(assessmentId: string, subjectName: string, paperName: string, studentId: string, score: number | null): Promise<void> {
  await updateAssessmentInState(assessmentId, (assessment) => {
    assessment.paperScores = { ...(assessment.paperScores || {}) };
    assessment.paperScores[subjectName] = { ...(assessment.paperScores[subjectName] || {}) };
    assessment.paperScores[subjectName][paperName] = {
      ...(assessment.paperScores[subjectName][paperName] || {}),
      [studentId]: score,
    };
  });
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
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    backend: 'supabase-relational',
    data: {
      teachers: await getTeachers(),
      classes: await serializeClasses(),
      catalog: await getCatalog(),
      academicYears: await getAcademicYears(),
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
  const [classes, teachers, catalog, academicYears] = await Promise.all([
    serializeClasses(), getTeachers(), getCatalog(), getAcademicYears(),
  ]);
  const streams = classes.flatMap((item: any) => item.streams || []);
  const assessments = classes.flatMap((item: any) => item.assessments || []);
  const students = streams.flatMap((stream: any) => stream.students || []);
  const terms = academicYears.flatMap((year: any) => year.terms || []);

  return {
    sourceOfTruth: 'public relational tables',
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
