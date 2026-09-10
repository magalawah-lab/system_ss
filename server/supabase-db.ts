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
  return readRelationalClasses();
}

export async function upsertClasses(classes: any[], force = false): Promise<void> {
  const current = await readRelationalClasses();
  if (!force && classes.length === 0 && current.length > 0) return;
  const client = getSupabaseAdmin();
  for (const table of ['scores', 'assessments', 'stream_subjects', 'students', 'streams', 'classes']) {
    const { error } = await client.from(table).delete().neq('id', UUID_DELETE_SENTINEL);
    if (error) throw new Error(`Supabase ${table} delete failed: ${error.message}`);
  }
  await insertRelationalClasses(Array.isArray(classes) ? classes : []);
}

export async function getTeachers(): Promise<any[]> {
  const [teacherRows, profiles] = await Promise.all([
    queryRows('teachers'),
    queryRows('user_profiles'),
  ]);
  const profilesById = new Map(profiles.map((profile: any) => [profile.id, profile]));
  return teacherRows.map((teacher: any) => {
    const profile = profilesById.get(teacher.user_id) || profilesById.get(teacher.id) || {};
    return {
      id: teacher.id,
      user_id: teacher.user_id,
      name: profile.name || profile.email || 'Unnamed',
      email: profile.email || undefined,
      initials: teacher.initials || undefined,
    };
  });
}

export async function replaceTeachers(teachers: any[]): Promise<void> {
  const client = getSupabaseAdmin();
  const rows = (Array.isArray(teachers) ? teachers : []).map((teacher: any) => ({
    id: relationalId(teacher.id, 'teacher', `${teacher.email || ''}:${teacher.name || ''}`),
    user_id: isUuid(teacher.user_id) ? teacher.user_id : null,
    initials: teacher.initials || null,
  }));
  if (rows.length > 0) {
    const { error } = await client.from('teachers').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`Supabase teachers write failed: ${error.message}`);
  }
  const retainedIds = rows.map((teacher: any) => teacher.id);
  const { data: existing, error: existingError } = await client.from('teachers').select('id');
  if (existingError) throw new Error(`Supabase teachers read failed: ${existingError.message}`);
  const removedIds = (existing || []).map((teacher: any) => teacher.id).filter((id: string) => !retainedIds.includes(id));
  if (removedIds.length > 0) {
    const { error } = await client.from('teachers').delete().in('id', removedIds);
    if (error) throw new Error(`Supabase teachers delete failed: ${error.message}`);
  }
}

export async function getCatalog(): Promise<Record<string, SubjectCategory>> {
  const rows = await queryRows('catalog');
  return Object.fromEntries(rows.map((row: any) => [row.subject_name, row.category as SubjectCategory]));
}

export async function replaceCatalog(catalog: Record<string, SubjectCategory>): Promise<void> {
  const client = getSupabaseAdmin();
  const { data: existing, error: readError } = await client.from('catalog').select('id,subject_name,level');
  if (readError) throw new Error(`Supabase catalog read failed: ${readError.message}`);
  const existingByKey = new Map((existing || []).map((row: any) => [`${row.level || ''}:${row.subject_name}`, row]));
  const rows = Object.entries(catalog || {}).map(([key, category]) => {
    const level = key.startsWith('O:') || key.startsWith('A:') ? key.slice(0, 1) : null;
    const subject_name = level ? key.slice(2) : key;
    const existingRow = existingByKey.get(`${level || ''}:${subject_name}`) || existingByKey.get(`:${subject_name}`);
    const id = existingRow?.id || stableId('catalog', `${level || ''}:${subject_name}`);
    return { id, subject_name, level: level || existingRow?.level || 'O', category };
  });
  if (rows.length > 0) {
    const { error } = await client.from('catalog').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`Supabase catalog write failed: ${error.message}`);
  }
}

export async function getAcademicYears(): Promise<any[]> {
  const [yearRows, termRows] = await Promise.all([queryRows('academic_years'), queryRows('terms')]);
  return yearRows.map((year: any) => ({
    id: year.id,
    name: year.name,
    startDate: year.start_date || '',
    endDate: year.end_date || '',
    isActive: year.is_active,
    terms: termRows.filter((term: any) => term.academic_year_id === year.id).map((term: any) => ({
      id: term.id,
      name: term.name,
      number: term.number,
      startDate: term.start_date || '',
      endDate: term.end_date || '',
      isActive: term.is_active,
    })),
  }));
}

export async function saveAcademicYears(years: any[]): Promise<void> {
  const client = getSupabaseAdmin();
  const yearRows = (Array.isArray(years) ? years : []).map((year: any) => ({ id: year.id, name: year.name, start_date: year.startDate || null, end_date: year.endDate || null, is_active: Boolean(year.isActive) }));
  const termRows = (Array.isArray(years) ? years : []).flatMap((year: any) => (year.terms || []).map((term: any) => ({ id: term.id, academic_year_id: year.id, name: term.name, number: term.number, start_date: term.startDate || null, end_date: term.endDate || null, is_active: Boolean(term.isActive) })));
  const { error: termDeleteError } = await client.from('terms').delete().neq('id', UUID_DELETE_SENTINEL);
  if (termDeleteError) throw new Error(`Supabase terms delete failed: ${termDeleteError.message}`);
  const { error: yearDeleteError } = await client.from('academic_years').delete().neq('id', UUID_DELETE_SENTINEL);
  if (yearDeleteError) throw new Error(`Supabase academic_years delete failed: ${yearDeleteError.message}`);
  if (yearRows.length > 0) {
    const { error } = await client.from('academic_years').insert(yearRows);
    if (error) throw new Error(`Supabase academic_years write failed: ${error.message}`);
  }
  if (termRows.length > 0) {
    const { error } = await client.from('terms').insert(termRows);
    if (error) throw new Error(`Supabase terms write failed: ${error.message}`);
  }
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
  const client = getSupabaseAdmin();
  const { error } = await client.from('academic_years').update({ is_active: false }).neq('id', id);
  if (error) throw new Error(`Supabase academic_years write failed: ${error.message}`);
  const { error: activeError } = await client.from('academic_years').update({ is_active: true }).eq('id', id);
  if (activeError) throw new Error(`Supabase academic_years write failed: ${activeError.message}`);
}

export async function setCurrentTermId(id: string): Promise<void> {
  const client = getSupabaseAdmin();
  const { data: term, error: termError } = await client.from('terms').select('academic_year_id').eq('id', id).maybeSingle();
  if (termError) throw new Error(`Supabase terms read failed: ${termError.message}`);
  if (!term) throw new Error('Term not found');
  const { error } = await client.from('terms').update({ is_active: false }).eq('academic_year_id', term.academic_year_id).neq('id', id);
  if (error) throw new Error(`Supabase terms write failed: ${error.message}`);
  const { error: activeError } = await client.from('terms').update({ is_active: true }).eq('id', id);
  if (activeError) throw new Error(`Supabase terms write failed: ${activeError.message}`);
}

async function updateAssessment(assessmentId: string, update: (assessment: any) => void): Promise<void> {
  const classes = await readRelationalClasses();
  for (const cls of classes) {
    const assessment = (cls.assessments || []).find((item: any) => item.id === assessmentId);
    if (assessment) {
      update(assessment);
      await upsertClasses(classes);
      return;
    }
  }
  throw new Error('Assessment not found');
}

export async function updateAssessmentScore(assessmentId: string, studentId: string, score: number | null): Promise<void> {
  const client = getSupabaseAdmin();
  const { data: existing } = await client.from('scores').select('id').eq('assessment_id', assessmentId).eq('student_id', studentId).is('subject_name', null).is('paper_name', null).maybeSingle();
  const payload = { assessment_id: assessmentId, student_id: studentId, subject_name: null, paper_name: null, score };
  const { error } = existing
    ? await client.from('scores').update(payload).eq('id', existing.id)
    : await client.from('scores').insert({ id: stableId('score', `${assessmentId}:${studentId}::`), ...payload });
  if (error) throw new Error(`Supabase scores write failed: ${error.message}`);
}

export async function updateAssessmentSubjectScore(assessmentId: string, subjectName: string, studentId: string, score: number | null): Promise<void> {
  const client = getSupabaseAdmin();
  const { data: existing } = await client.from('scores').select('id').eq('assessment_id', assessmentId).eq('student_id', studentId).eq('subject_name', subjectName).is('paper_name', null).maybeSingle();
  const payload = { assessment_id: assessmentId, student_id: studentId, subject_name: subjectName, paper_name: null, score };
  const { error } = existing
    ? await client.from('scores').update(payload).eq('id', existing.id)
    : await client.from('scores').insert({ id: stableId('score', `${assessmentId}:${studentId}:${subjectName}:`), ...payload });
  if (error) throw new Error(`Supabase scores write failed: ${error.message}`);
}

export async function updateAssessmentPaperScore(assessmentId: string, subjectName: string, paperName: string, studentId: string, score: number | null): Promise<void> {
  const client = getSupabaseAdmin();
  const { data: existing } = await client.from('scores').select('id').eq('assessment_id', assessmentId).eq('student_id', studentId).eq('subject_name', subjectName).eq('paper_name', paperName).maybeSingle();
  const payload = { assessment_id: assessmentId, student_id: studentId, subject_name: subjectName, paper_name: paperName, score };
  const { error } = existing
    ? await client.from('scores').update(payload).eq('id', existing.id)
    : await client.from('scores').insert({ id: stableId('score', `${assessmentId}:${studentId}:${subjectName}:${paperName}`), ...payload });
  if (error) throw new Error(`Supabase scores write failed: ${error.message}`);
}

export async function updateStudentSubjects(studentId: string, subjects: string[], optionalSubjects: string[]): Promise<void> {
  const { error } = await getSupabaseAdmin().from('students').update({ subjects, optional_subjects: optionalSubjects }).eq('id', studentId);
  if (error) throw new Error(`Supabase students write failed: ${error.message}`);
}

export async function updateTeacherAssignment(className: string, streamName: string, type: 'subject' | 'class', teacherId: string | null, subjectName?: string, initials?: string): Promise<void> {
  const client = getSupabaseAdmin();
  const { data: cls, error: classError } = await client.from('classes').select('id').eq('name', className).maybeSingle();
  if (classError) throw new Error(`Supabase classes read failed: ${classError.message}`);
  if (!cls) throw new Error('Class not found');
  const { data: stream, error: streamError } = await client.from('streams').select('id').eq('class_id', cls.id).eq('name', streamName).maybeSingle();
  if (streamError) throw new Error(`Supabase streams read failed: ${streamError.message}`);
  if (!stream) throw new Error('Stream not found');
  if (type === 'class') {
    const { error } = await client.from('streams').update({ class_teacher_id: teacherId || null }).eq('id', stream.id);
    if (error) throw new Error(`Supabase streams write failed: ${error.message}`);
  } else {
    const { data: subject } = await client.from('subjects').select('id').eq('name', subjectName || '').maybeSingle();
    if (!subject) throw new Error('Subject not found');
    const { error } = await client.from('stream_subjects').update({ teacher_id: teacherId || null }).eq('stream_id', stream.id).eq('subject_id', subject.id);
    if (error) throw new Error(`Supabase stream_subjects write failed: ${error.message}`);
  }
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
  const [classes, teachers, catalog, academicYears, scoreRows] = await Promise.all([
    serializeClasses(),
    getTeachers(),
    getCatalog(),
    getAcademicYears(),
    queryRows('scores'),
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
      scores: scoreRows.length,
    },
  };
}
