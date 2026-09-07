import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SubjectCategory = 'compulsory' | 'optional';

type State = {
  id: string;
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
};

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server credentials are not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
  };
}

async function writeState(state: State): Promise<State> {
  const payload = {
    ...state,
    id: 'default',
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await getSupabaseAdmin()
    .from('school_state')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw new Error(`Supabase school_state write failed: ${error.message}`);
  return data as State;
}

export async function seedDefaults(): Promise<void> {
  const state = await readState();
  if (state.classes.length || state.teachers.length || Object.keys(state.catalog).length) return;
  state.teachers = [
    { id: 't1', name: 'John Doe', initials: 'JD' },
    { id: 't2', name: 'Jane Smith', initials: 'JS' },
  ];
  state.catalog = {
    Mathematics: 'compulsory',
    English: 'compulsory',
    'Integrated Science': 'compulsory',
    Physics: 'optional',
    Chemistry: 'optional',
    Biology: 'optional',
    History: 'optional',
    Geography: 'optional',
  };
  state.classes = [{ name: 'Senior 1', level: 'O', streams: [], assessments: [] }];
  await writeState(state);
}

export async function serializeClasses(): Promise<any[]> {
  return (await readState()).classes;
}

export async function upsertClasses(classes: any[], force = false): Promise<void> {
  const state = await readState();
  if (!force && classes.length === 0 && state.classes.length > 0) return;
  state.classes = Array.isArray(classes) ? classes : [];
  await writeState(state);
}

export async function getTeachers(): Promise<any[]> {
  return (await readState()).teachers;
}

export async function replaceTeachers(teachers: any[]): Promise<void> {
  const state = await readState();
  if (!teachers.length && state.teachers.length) return;
  state.teachers = Array.isArray(teachers) ? teachers : [];
  await writeState(state);
}

export async function getCatalog(): Promise<Record<string, SubjectCategory>> {
  return (await readState()).catalog;
}

export async function replaceCatalog(catalog: Record<string, SubjectCategory>): Promise<void> {
  const state = await readState();
  if (!Object.keys(catalog).length && Object.keys(state.catalog).length) return;
  state.catalog = catalog || {};
  await writeState(state);
}

export async function getAcademicYears(): Promise<any[]> {
  return (await readState()).academic_years;
}

export async function saveAcademicYears(years: any[]): Promise<void> {
  const state = await readState();
  state.academic_years = Array.isArray(years) ? years : [];
  await writeState(state);
}

export async function getCurrentAcademicYearId(): Promise<string> {
  const state = await readState();
  return state.current_academic_year_id || state.academic_years.find((year) => year.isActive)?.id || state.academic_years[0]?.id || '';
}

export async function getCurrentTermId(): Promise<string> {
  const state = await readState();
  const year = state.academic_years.find((item) => item.id === state.current_academic_year_id) || state.academic_years.find((item) => item.isActive) || state.academic_years[0];
  return state.current_term_id || year?.terms?.find((term: any) => term.isActive)?.id || year?.terms?.[0]?.id || '';
}

export async function setCurrentAcademicYearId(id: string): Promise<void> {
  const state = await readState();
  state.current_academic_year_id = id;
  await writeState(state);
}

export async function setCurrentTermId(id: string): Promise<void> {
  const state = await readState();
  state.current_term_id = id;
  await writeState(state);
}

async function updateAssessment(assessmentId: string, update: (assessment: any) => void): Promise<void> {
  const state = await readState();
  for (const cls of state.classes) {
    const assessment = (cls.assessments || []).find((item: any) => item.id === assessmentId);
    if (assessment) {
      update(assessment);
      await writeState(state);
      return;
    }
  }
  throw new Error('Assessment not found');
}

export async function updateAssessmentScore(assessmentId: string, studentId: string, score: number | null): Promise<void> {
  return updateAssessment(assessmentId, (assessment) => {
    assessment.scores = { ...(assessment.scores || {}), [studentId]: score };
  });
}

export async function updateAssessmentSubjectScore(assessmentId: string, subjectName: string, studentId: string, score: number | null): Promise<void> {
  return updateAssessment(assessmentId, (assessment) => {
    assessment.subjectScores = { ...(assessment.subjectScores || {}), [subjectName]: { ...(assessment.subjectScores?.[subjectName] || {}), [studentId]: score } };
  });
}

export async function updateAssessmentPaperScore(assessmentId: string, subjectName: string, paperName: string, studentId: string, score: number | null): Promise<void> {
  return updateAssessment(assessmentId, (assessment) => {
    assessment.paperScores = { ...(assessment.paperScores || {}), [subjectName]: { ...(assessment.paperScores?.[subjectName] || {}), [paperName]: { ...(assessment.paperScores?.[subjectName]?.[paperName] || {}), [studentId]: score } } };
  });
}

export async function updateStudentSubjects(studentId: string, subjects: string[], optionalSubjects: string[]): Promise<void> {
  const state = await readState();
  for (const cls of state.classes) for (const stream of cls.streams || []) for (const student of stream.students || []) {
    if (student.id === studentId) {
      student.subjects = subjects;
      student.optionalSubjects = optionalSubjects;
      await writeState(state);
      return;
    }
  }
  throw new Error('Student not found');
}

export async function updateTeacherAssignment(className: string, streamName: string, type: 'subject' | 'class', teacherId: string | null, subjectName?: string, initials?: string): Promise<void> {
  const state = await readState();
  const cls = state.classes.find((item) => item.name === className);
  const stream = cls?.streams?.find((item: any) => item.name === streamName);
  if (!stream) throw new Error('Stream not found');
  if (type === 'class') stream.classTeacherId = teacherId || undefined;
  else {
    const subject = stream.subjects?.find((item: any) => item.name === subjectName);
    if (!subject) throw new Error('Subject not found');
    subject.teacherId = teacherId || undefined;
    subject.initials = initials;
  }
  await writeState(state);
}

export async function exportBackup(): Promise<any> {
  const state = await readState();
  return { version: 1, exportedAt: new Date().toISOString(), backend: 'supabase', data: { teachers: state.teachers, classes: state.classes, catalog: state.catalog, academicYears: state.academic_years } };
}

export async function restoreBackup(payload: any): Promise<void> {
  const data = payload?.data || payload;
  const state = await readState();
  state.teachers = Array.isArray(data?.teachers) ? data.teachers : [];
  state.classes = Array.isArray(data?.classes) ? data.classes : [];
  state.catalog = data?.catalog && typeof data.catalog === 'object' ? data.catalog : {};
  state.academic_years = Array.isArray(data?.academicYears) ? data.academicYears : [];
  await writeState(state);
}

export async function getStudents(streamId?: string): Promise<any[]> {
  const classes = await serializeClasses();
  return classes.flatMap((cls: any) => (cls.streams || []).filter((stream: any) => !streamId || stream.id === streamId).flatMap((stream: any) => stream.students || []));
}
