"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { useAuth } from './SupabaseAuthContext';
import { COMPULSORY_OLEVEL_SUBJECTS, OTHER_OLEVEL_SUBJECTS } from './olevelSubjects';
import { ALEVEL_SUBJECTS_CONFIG } from './alevelConfig';

function resolveApiUrl() {
  const configuredUrl = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/+$/, '');
  if (!configuredUrl) return '/api';
  if (configuredUrl === '/api' || configuredUrl.endsWith('/api')) return configuredUrl;
  return `${configuredUrl}/api`;
}

const API_URL = resolveApiUrl();

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error?: unknown }).error)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'error' in payload) {
    throw new Error(String((payload as { error?: unknown }).error));
  }

  return payload as T;
}

function readLocalSnapshot<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : undefined;
  } catch {
    return undefined;
  }
}

export type SubjectCategory = 'compulsory' | 'optional';

export type Assessment = {
  id: string;
  name: string;
  date?: string;
  maxScore?: number;
  academicYearId: string;
  termId: string;
  scores: Record<string, number | null>;
  subjectScores?: Record<string, Record<string, number | null>>;
  paperScores?: Record<string, Record<string, Record<string, number | null>>>;
};

export type AssessmentReport = {
  assessmentId: string;
  name: string;
  date?: string;
  maxScore?: number | undefined;
  average?: number | null;
  min?: number | null;
  max?: number | null;
  count: number;
  missing: number;
};

export type SubjectAuditReport = {
  className: string;
  classLevel: 'O' | 'A';
  streamName: string;
  subjectName: string;
  teacherId?: string;
  teacherName?: string;
  totalStudents: number;
  assessmentId: string;
  assessmentName: string;
  assessmentDate?: string;
};

export type AssessmentCSVRow = {
  className?: string;
  assessmentId?: string;
  assessmentName?: string;
  date?: string;
  maxScore?: string;
  studentID?: string;
  studentName?: string;
  studentInternalId?: string;
  score?: string;
};

export type Student = {
  id: string;
  studentID: string;
  firstName: string;
  secondName: string;
  otherNames?: string;
  gender: 'Male' | 'Female';
  optionalSubjects: string[];
  subjects: string[];
};

export type Teacher = {
  id: string;
  name: string;
  email?: string;
  initials?: string;
  password?: string;
};

export type SubjectEntry = {
  name: string;
  initials?: string;
  teacherId?: string;
  category?: 'compulsory' | 'optional';
  papers?: string[];
};

export type Stream = {
  name: string;
  subjects: SubjectEntry[];
  students: Student[];
  classTeacherId?: string;
};

export type ClassItem = {
  name: string;
  level: 'O' | 'A';
  streams: Stream[];
  assessments?: Assessment[];
};

export interface Term {
  id: string;
  name: string;
  number: 1 | 2 | 3;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  terms: Term[];
}

const defaultClasses: ClassItem[] = [
  {
    name: 'Senior 1',
    level: 'O',
    streams: [
      { name: 'A', subjects: [{ name: 'Mathematics' }, { name: 'English' }, { name: 'Geography' }], students: [] },
      { name: 'B', subjects: [{ name: 'Mathematics' }, { name: 'English' }], students: [] },
    ],
    assessments: [],
  },
  {
    name: 'Senior 2',
    level: 'O',
    streams: [
      { name: 'A', subjects: [{ name: 'Mathematics' }, { name: 'Biology' }], students: [] },
      { name: 'B', subjects: [{ name: 'Mathematics' }, { name: 'Biology' }], students: [] },
    ],
    assessments: [],
  },
  {
    name: 'Senior 3',
    level: 'O',
    streams: [{ name: 'A', subjects: [{ name: 'Physics' }, { name: 'Chemistry' }], students: [] }],
    assessments: [],
  },
  {
    name: 'Senior 4',
    level: 'O',
    streams: [{ name: 'A', subjects: [{ name: 'Economics' }, { name: 'History' }], students: [] }],
    assessments: [],
  },
  {
    name: 'Senior 5',
    level: 'A',
    streams: [{ name: 'Science', subjects: [{ name: 'Mathematics' }, { name: 'Physics' }], students: [] }],
    assessments: [],
  },
  {
    name: 'Senior 6',
    level: 'A',
    streams: [{ name: 'Arts', subjects: [{ name: 'Literature' }, { name: 'History' }], students: [] }],
    assessments: [],
  },
];

const defaultCatalog: Record<string, SubjectCategory> = {
  ...Object.fromEntries(COMPULSORY_OLEVEL_SUBJECTS.map((s) => [s, 'compulsory' as const])),
  ...Object.fromEntries(OTHER_OLEVEL_SUBJECTS.map((s) => [s, 'optional' as const])),
};

// Default academic years
function getDefaultAcademicYears(): AcademicYear[] {
  const currentYear = new Date().getFullYear().toString();
  return [
    {
      id: 'year-' + Date.now(),
      name: currentYear,
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`,
      isActive: true,
      terms: [
        {
          id: 'term-1-' + Date.now(),
          name: 'Term 1',
          number: 1,
          startDate: `${currentYear}-01-01`,
          endDate: `${currentYear}-03-31`,
          isActive: false,
        },
        {
          id: 'term-2-' + Date.now(),
          name: 'Term 2',
          number: 2,
          startDate: `${currentYear}-05-01`,
          endDate: `${currentYear}-08-31`,
          isActive: false,
        },
        {
          id: 'term-3-' + Date.now(),
          name: 'Term 3',
          number: 3,
          startDate: `${currentYear}-09-01`,
          endDate: `${currentYear}-11-30`,
          isActive: true,
        },
      ]
    }
  ];
}

function normalizeClasses(input: any): ClassItem[] {
  if (!Array.isArray(input)) return defaultClasses;
  try {
    return input.map((c: any) => {
      if (!c || typeof c !== 'object') return { name: 'Unnamed', level: 'O', streams: [], assessments: [] };
      const streams = Array.isArray(c.streams)
        ? c.streams.map((s: any) => {
          if (!s || typeof s !== 'object') return { name: 'A', subjects: [], students: [] };
          return {
            name: String(s.name ?? 'A'),
            subjects: (Array.isArray(s.subjects) ? s.subjects : []).map((sub: any) =>
              typeof sub === 'string' ? { name: sub } : {
                name: String(sub?.name ?? ''),
                initials: sub?.initials,
                teacherId: sub?.teacherId,
                category: sub?.category || 'optional',
                papers: Array.isArray(sub?.papers) ? sub.papers : undefined
              }
            ),
            students: (Array.isArray(s.students) ? s.students : []).map((stu: any) => ({
              id: stu?.id ?? Math.random().toString(36).slice(2, 9),
              studentID: stu?.studentID ?? '',
              firstName: stu?.firstName ?? '',
              secondName: stu?.secondName ?? '',
              otherNames: stu?.otherNames ?? '',
              gender: stu?.gender === 'Female' ? 'Female' : 'Male',
              optionalSubjects: Array.isArray(stu?.optionalSubjects) ? stu.optionalSubjects.slice(0, 2) : [],
              subjects: Array.isArray(stu?.subjects) ? stu.subjects : [],
            })),
            classTeacherId: s?.classTeacherId ? String(s.classTeacherId) : undefined,
          };
        })
        : [];
      const assessments = Array.isArray(c.assessments)
        ? c.assessments.map((a: any) => ({
          id: a?.id ?? Math.random().toString(36).slice(2, 9),
          name: String(a?.name ?? 'Assessment'),
          date: a?.date ? String(a.date) : undefined,
          maxScore: typeof a?.maxScore === 'number' ? a.maxScore : undefined,
          academicYearId: a?.academicYearId || '',
          termId: a?.termId || '',
          scores: a?.scores && typeof a.scores === 'object' ? a.scores : {},
          subjectScores: a?.subjectScores && typeof a.subjectScores === 'object' ? a.subjectScores : undefined,
          paperScores: a?.paperScores && typeof a.paperScores === 'object' ? a.paperScores : undefined,
        }))
        : [];
      return {
        name: String(c.name ?? 'Unnamed'),
        level: c.level === 'A' ? 'A' : 'O',
        streams,
        assessments,
      };
    });
  } catch (e) {
    return defaultClasses;
  }
}

type SchoolDataContextType = {
  classes: ClassItem[];
  setClasses: React.Dispatch<React.SetStateAction<ClassItem[]>>;
  teachers: Teacher[];
  catalog: Record<string, SubjectCategory>;
  isHydrated: boolean;
  addTeacher: (teacher: { name: string; email?: string; initials?: string; password?: string }) => Promise<string>;
  editTeacher: (id: string, updates: { name?: string; email?: string; initials?: string; password?: string }) => Promise<void>;
  removeTeacher: (id: string) => void;
  setCategory: (subject: string, category: SubjectCategory, level?: 'O' | 'A') => void;
  addSubjectToStream: (classIndex: number, streamName: string, subject: string, teacherId?: string, initials?: string, category?: SubjectCategory, papers?: string[]) => void;
  addSubjectToAllStreams: (subject: string, teacherId?: string, initials?: string, category?: SubjectCategory) => void;
  removeSubjectFromStream: (classIndex: number, streamName: string, subjectIndex: number) => void;
  updateSubjectInStream: (classIndex: number, streamName: string, subjectIndex: number, updates: Partial<SubjectEntry>) => Promise<void>;
  addStudentToStream: (classIndex: number, streamName: string, student: Omit<Student, 'id' | 'subjects'> & { subjects?: string[] }) => void;
  editStudentInStream: (classIndex: number, streamName: string, studentIndex: number, updates: Partial<Student>) => Promise<void>;
  removeStudentFromStream: (classIndex: number, streamName: string, studentIndex: number) => void;
  importStudentsToStream: (classIndex: number, streamName: string, students: Array<Partial<Student>>) => void;
  setClassTeacher: (classIndex: number, streamName: string, teacherId: string | null) => Promise<void>;
  addAssessmentToClass: (classIndex: number, assessment: Omit<Assessment, 'id' | 'scores' | 'subjectScores'> & Partial<Pick<Assessment, 'scores' | 'subjectScores'>>) => string;
  removeAssessmentFromClass: (classIndex: number, assessmentId: string) => void;
  setScoreForAssessment: (classIndex: number, assessmentId: string, studentId: string, score: number | null) => void;
  setSubjectScoreForAssessment: (classIndex: number, assessmentId: string, subjectName: string, studentId: string, score: number | null) => void;
  setPaperScoreForAssessment: (classIndex: number, assessmentId: string, subjectName: string, paperName: string, studentId: string, score: number | null) => void;
  updateAssessmentInClass: (classIndex: number, assessmentId: string, updates: Partial<Assessment>) => void;
  getAssessmentReportsForClass: (classIndex: number) => AssessmentReport[];
  getSubjectsWithMissingScoresForAudit: (classIndex: number, assessmentId: string) => SubjectAuditReport[];
  exportAssessmentsCSV: (classIndex: number) => string;
  importAssessmentsFromCSV: (classIndex: number, csvText: string) => { created: number; updated: number };
  isSaving: boolean;
  syncError: string | null;
  hasUnsavedChanges: boolean;
  saveChanges: () => Promise<void>;
  academicYears: AcademicYear[];
  currentAcademicYearId: string;
  currentTermId: string;
  setAcademicYears: (years: AcademicYear[] | ((prev: AcademicYear[]) => AcademicYear[])) => void;
  setCurrentAcademicYearId: (id: string) => void;
  setCurrentTermId: (id: string) => void;
};

const SchoolDataContext = createContext<SchoolDataContextType | undefined>(undefined);

function makeId(prefix: string) {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}

export function toSubjectName(subject: SubjectEntry | string) {
  return typeof subject === 'string' ? subject : subject.name;
}

function escapeCsvValue(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  result.push(current);
  return result;
}

const EMPTY_TEACHERS: Teacher[] = [];

export function SchoolDataProvider({ children }: { children: React.ReactNode }) {
  const { data: classesData, error: classesError, isLoading: classesLoading } = useSWR<ClassItem[]>(
    `${API_URL}/classes`,
    fetcher,
    {
      fallbackData: undefined,
      refreshInterval: 60000,
      revalidateOnFocus: false,
      dedupingInterval: 10000
    }
  );
  const { data: teachersData, error: teachersError, isLoading: teachersLoading } = useSWR<Teacher[]>(
    `${API_URL}/teachers`,
    fetcher, {
    fallbackData: EMPTY_TEACHERS,
    refreshInterval: 120000,
    revalidateOnFocus: false
  }
  );
  const { data: catalogData, error: catalogError, isLoading: catalogLoading } = useSWR<Record<string, SubjectCategory>>(
    `${API_URL}/catalog`,
    fetcher, {
    fallbackData: defaultCatalog,
    refreshInterval: 300000,
    revalidateOnFocus: false
  }
  );

  const [classes, setClassesState] = useState<ClassItem[]>(defaultClasses);
  const [teachers, setTeachersState] = useState<Teacher[]>([]);
  const [catalog, setCatalogState] = useState<Record<string, SubjectCategory>>(defaultCatalog);

  // Academic years state
  const [academicYears, setAcademicYearsState] = useState<AcademicYear[]>(getDefaultAcademicYears());
  const [currentAcademicYearId, setCurrentAcademicYearIdState] = useState<string>('');
  const [currentTermId, setCurrentTermIdState] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [dirty, setDirty] = useState({
    classes: false,
    teachers: false,
    catalog: false
  });

  const hasUnsavedChanges = dirty.classes || dirty.teachers || dirty.catalog;

  const [localSnapshotsLoaded, setLocalSnapshotsLoaded] = useState(false);

  // Load academic years from localStorage
  // In SchoolDataContext.tsx - Find the useEffect that loads academic years

  useEffect(() => {
    const saved = localStorage.getItem('academicYears');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure each year has a terms array
          const validatedYears = parsed.map((year: any) => ({
            ...year,
            terms: Array.isArray(year.terms) ? year.terms : []
          }));

          setAcademicYearsState(validatedYears);

          // Set current year and term
          const activeYear = validatedYears.find((y: AcademicYear) => y.isActive);
          if (activeYear) {
            setCurrentAcademicYearIdState(activeYear.id);
            const activeTerm = activeYear.terms.find((t: Term) => t.isActive);
            if (activeTerm) {
              setCurrentTermIdState(activeTerm.id);
            } else if (activeYear.terms.length > 0) {
              setCurrentTermIdState(activeYear.terms[0].id);
            }
          } else if (validatedYears.length > 0) {
            setCurrentAcademicYearIdState(validatedYears[0].id);
            if (validatedYears[0].terms.length > 0) {
              setCurrentTermIdState(validatedYears[0].terms[0].id);
            }
          }
          return;
        }
      } catch (e) {
        console.error('Failed to parse academic years:', e);
      }
    }
    // If no saved data, use defaults
    const defaults = getDefaultAcademicYears();
    setAcademicYearsState(defaults);
    setCurrentAcademicYearIdState(defaults[0].id);
    const activeTerm = defaults[0].terms.find(t => t.isActive);
    setCurrentTermIdState(activeTerm ? activeTerm.id : defaults[0].terms[0].id);
    localStorage.setItem('academicYears', JSON.stringify(defaults));
  }, []);

  // Save academic years to localStorage when they change
  useEffect(() => {
    if (academicYears.length > 0) {
      localStorage.setItem('academicYears', JSON.stringify(academicYears));
    }
  }, [academicYears]);

  // Save current academic year to localStorage when it changes
  useEffect(() => {
    if (currentAcademicYearId) {
      localStorage.setItem('currentAcademicYearId', currentAcademicYearId);
    }
  }, [currentAcademicYearId]);

  // Save current term to localStorage when it changes
  useEffect(() => {
    if (currentTermId) {
      localStorage.setItem('currentTermId', currentTermId);
    }
  }, [currentTermId]);

  // Server sync for academic years. Academic years are persisted server-side so every
  // client (admin, teachers) shares the same year/term IDs. Assessment year/term
  // references in the DB would otherwise drift across browsers (IDs were Date.now()-based).
  const academicYearsSyncedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/academic-years`);
        if (!res.ok || cancelled) return;
        const serverYears = await res.json();
        if (cancelled) return;

        if (Array.isArray(serverYears) && serverYears.length > 0) {
          // Server is authoritative: adopt its years and re-derive the active period.
          setAcademicYearsState(serverYears);
          localStorage.setItem('academicYears', JSON.stringify(serverYears));

          const savedYearId = localStorage.getItem('currentAcademicYearId');
          const savedTermId = localStorage.getItem('currentTermId');
          const savedYear = savedYearId
            ? serverYears.find((y: AcademicYear) => y.id === savedYearId)
            : undefined;

          if (savedYear) {
            setCurrentAcademicYearIdState(savedYearId as string);
            const term = (savedTermId && savedYear.terms.find((t: Term) => t.id === savedTermId))
              || savedYear.terms.find((t: Term) => t.isActive)
              || savedYear.terms[0];
            if (term) setCurrentTermIdState(term.id);
          } else {
            const activeYear = serverYears.find((y: AcademicYear) => y.isActive) || serverYears[0];
            if (activeYear) {
              setCurrentAcademicYearIdState(activeYear.id);
              const term = activeYear.terms.find((t: Term) => t.isActive) || activeYear.terms[0];
              if (term) setCurrentTermIdState(term.id);
            }
          }
        } else {
          // Server empty: push any local data up so other clients share it.
          const localRaw = localStorage.getItem('academicYears');
          if (localRaw) {
            const local = JSON.parse(localRaw);
            if (Array.isArray(local) && local.length > 0) {
              await fetch(`${API_URL}/academic-years`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(local),
              });
            }
          }
        }
      } catch (e) {
        console.warn('Failed to sync academic years with server:', e);
      } finally {
        academicYearsSyncedRef.current = true;
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Persist academic years to the server when they change (after initial sync).
  useEffect(() => {
    if (!academicYearsSyncedRef.current) return;
    if (!Array.isArray(academicYears) || academicYears.length === 0) return;
    const timer = setTimeout(() => {
      fetch(`${API_URL}/academic-years`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(academicYears),
      }).catch((e) => console.warn('Failed to save academic years:', e));
    }, 800);
    return () => clearTimeout(timer);
  }, [academicYears]);

  useEffect(() => {
    if (hasUnsavedChanges) {
      console.log("Unsaved changes detected:", dirty);
    }
  }, [hasUnsavedChanges, dirty]);

  // Load buffered changes or the last good API snapshot on mount. This is the
  // client-side half of the SQLite/Supabase hybrid: a temporary API outage
  // must not replace usable local data with an error payload or empty defaults.
  useEffect(() => {
    try {
      const bufferedClasses = localStorage.getItem("school:classes_buffer");
      const bufferedTeachers = localStorage.getItem("school:teachers_buffer");
      const bufferedCatalog = localStorage.getItem("school:catalog_buffer");

      const cachedClasses = readLocalSnapshot<ClassItem[]>("school:classes_cache");
      const cachedTeachers = readLocalSnapshot<Teacher[]>("school:teachers_cache");
      const cachedCatalog = readLocalSnapshot<Record<string, SubjectCategory>>("school:catalog_cache");

      if (bufferedClasses) {
        setClassesState(normalizeClasses(JSON.parse(bufferedClasses)));
        setDirty(d => ({ ...d, classes: true }));
      } else if (cachedClasses) {
        setClassesState(normalizeClasses(cachedClasses));
      }
      if (bufferedTeachers) {
        setTeachersState(JSON.parse(bufferedTeachers));
        setDirty(d => ({ ...d, teachers: true }));
      } else if (cachedTeachers) {
        setTeachersState(cachedTeachers);
      }
      if (bufferedCatalog) {
        setCatalogState(JSON.parse(bufferedCatalog));
        setDirty(d => ({ ...d, catalog: true }));
      } else if (cachedCatalog) {
        setCatalogState(cachedCatalog);
      }
      setLocalSnapshotsLoaded(true);
    } catch (e) {
      console.warn("Failed to load buffered data from localStorage", e);
      setLocalSnapshotsLoaded(true);
    }
  }, []);

  // API errors are recoverable in hybrid mode because local snapshots remain
  // available. Loading must finish before consumers run migrations or save.
  const isHydrated = localSnapshotsLoaded && !classesLoading && !teachersLoading && !catalogLoading;

  const lastUpdate = useRef<Record<string, number>>({ classes: 0, teachers: 0, catalog: 0 });
  const lastSynced = useRef<Record<string, any>>({ classes: null, teachers: null, catalog: null });
  const pendingSyncs = useRef<Set<string>>(new Set());

  // Warn user if leaving while saving or with unsaved changes, plus best-effort beacon save
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Best-effort synchronous flush to the server using sendBeacon
      if (hasUnsavedChanges && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        try {
          const payload: any = {};
          if (dirty.classes) payload.classes = classes;
          if (dirty.teachers) payload.teachers = teachers;
          if (dirty.catalog) payload.catalog = catalog;
          if (Object.keys(payload).length > 0) {
            // Send individual beacons to matching endpoints
            if (payload.classes) {
              const blob = new Blob([JSON.stringify(payload.classes)], { type: 'application/json' });
              try { navigator.sendBeacon(`${API_URL}/classes`, blob); } catch (_) { /* ignore */ }
            }
            if (payload.teachers) {
              const blob = new Blob([JSON.stringify(payload.teachers)], { type: 'application/json' });
              try { navigator.sendBeacon(`${API_URL}/teachers`, blob); } catch (_) { /* ignore */ }
            }
            if (payload.catalog) {
              const blob = new Blob([JSON.stringify(payload.catalog)], { type: 'application/json' });
              try { navigator.sendBeacon(`${API_URL}/catalog`, blob); } catch (_) { /* ignore */ }
            }
          }
        } catch (_) { /* ignore sendBeacon failures */ }
      }

      if (pendingSyncs.current.size > 0 || hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, dirty, classes, teachers, catalog, API_URL]);

  // Sync data from server
  useEffect(() => {
    const hasBuffer = !!localStorage.getItem("school:classes_buffer");
    if (classesData &&
      JSON.stringify(classesData) !== JSON.stringify(lastSynced.current.classes) &&
      (Date.now() - lastUpdate.current.classes > 15000) &&
      !isSaving && !syncError && !hasBuffer && !dirty.classes
    ) {
      lastSynced.current.classes = classesData;
      const normalized = normalizeClasses(classesData);
      setClassesState(normalized);
      localStorage.setItem("school:classes_cache", JSON.stringify(normalized));
    }
  }, [classesData, isSaving, syncError, dirty.classes]);

  useEffect(() => {
    const hasBuffer = !!localStorage.getItem("school:teachers_buffer");
    if (teachersData &&
      teachersData !== lastSynced.current.teachers &&
      (Date.now() - lastUpdate.current.teachers > 15000) &&
      !isSaving && !syncError && !hasBuffer && !dirty.teachers
    ) {
      lastSynced.current.teachers = teachersData;
      setTeachersState(teachersData);
      localStorage.setItem("school:teachers", JSON.stringify(teachersData));
      localStorage.setItem("school:teachers_cache", JSON.stringify(teachersData));
    }
  }, [teachersData, isSaving, syncError, dirty.teachers]);

  useEffect(() => {
    const hasBuffer = !!localStorage.getItem("school:catalog_buffer");
    if (catalogData &&
      catalogData !== lastSynced.current.catalog &&
      (Date.now() - lastUpdate.current.catalog > 15000) &&
      !isSaving && !syncError && !hasBuffer && !dirty.catalog
    ) {
      lastSynced.current.catalog = catalogData;
      setCatalogState(catalogData);
      localStorage.setItem("school:catalog_cache", JSON.stringify(catalogData));
    }
  }, [catalogData, isSaving, syncError, dirty.catalog]);

  // Helper to persist data to the server
  const syncToServer = async (endpoint: string, data: any, mutateKey: string, category: 'classes' | 'teachers' | 'catalog') => {
    const syncId = `${category}-${Date.now()}`;
    pendingSyncs.current.add(syncId);
    setIsSaving(true);
    setSyncError(null);

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorJson = await response.json();
          errorDetails = errorJson.details || errorJson.error || '';
        } catch (e) {
          errorDetails = await response.text();
        }
        throw new Error(`HTTP ${response.status}: ${errorDetails}`);
      }

      lastSynced.current[category] = data;
      lastUpdate.current[category] = Date.now();
      localStorage.removeItem(`school:${category}_buffer`);
      await mutate(mutateKey, data, { revalidate: true });
      setSyncError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Failed to sync ${endpoint}:`, e);
      setSyncError(`Failed to save ${category}. Please check your connection.`);
      throw e;
    } finally {
      pendingSyncs.current.delete(syncId);
      if (pendingSyncs.current.size === 0) {
        setIsSaving(false);
      }
    }
  };

  const classSaveQueue = useRef(Promise.resolve());
  const persistClassesImmediately = useCallback((nextClasses: ClassItem[]) => {
    classSaveQueue.current = classSaveQueue.current
      .catch(() => undefined)
      .then(() => syncToServer('/classes', nextClasses, `${API_URL}/classes`, 'classes'));
    return classSaveQueue.current;
  }, [syncToServer]);

  const setClasses = useCallback((updater: React.SetStateAction<ClassItem[]>) => {
    setDirty(d => ({ ...d, classes: true }));
    setClassesState((prev) => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      localStorage.setItem("school:classes_buffer", JSON.stringify(next));
      lastUpdate.current.classes = Date.now();
      return next;
    });
  }, []);

  const setTeachers = useCallback((updater: React.SetStateAction<Teacher[]>) => {
    setDirty(d => ({ ...d, teachers: true }));
    setTeachersState((prev) => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      localStorage.setItem("school:teachers_buffer", JSON.stringify(next));
      lastUpdate.current.teachers = Date.now();
      localStorage.setItem("school:teachers", JSON.stringify(next));
      return next;
    });
  }, []);

  const setCatalog = useCallback((updater: React.SetStateAction<Record<string, SubjectCategory>>) => {
    setDirty(d => ({ ...d, catalog: true }));
    setCatalogState((prev) => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      localStorage.setItem("school:catalog_buffer", JSON.stringify(next));
      lastUpdate.current.catalog = Date.now();
      return next;
    });
  }, []);

  // Academic years setters
  const setAcademicYears = useCallback((updater: AcademicYear[] | ((prev: AcademicYear[]) => AcademicYear[])) => {
    setAcademicYearsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  }, []);

  const setCurrentAcademicYearId = useCallback((id: string) => {
    setCurrentAcademicYearIdState(id);
  }, []);

  const setCurrentTermId = useCallback((id: string) => {
    setCurrentTermIdState(id);
  }, []);

  const saveChanges = useCallback(async () => {
    setIsSaving(true);
    setSyncError(null);
    try {
      if (dirty.classes) {
        await syncToServer('/classes', classes, `${API_URL}/classes`, 'classes');
      }
      if (dirty.teachers) {
        await syncToServer('/teachers', teachers, `${API_URL}/teachers`, 'teachers');
      }
      if (dirty.catalog) {
        await syncToServer('/catalog', catalog, `${API_URL}/catalog`, 'catalog');
      }
      setDirty({ classes: false, teachers: false, catalog: false });
      setSyncError(null);
    } catch (e) {
      console.error('Failed to save changes:', e);
      setSyncError('Failed to save some changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [classes, teachers, catalog, dirty]);

  // Auto-save changes after a brief delay, plus a WATCHDOG that forces
  // a save every 8s while dirty (so a user who keeps typing scores never
  // ends up with >8s of unsaved data).
  useEffect(() => {
    if (!hasUnsavedChanges || isSaving) return;

    const debounceTimer = setTimeout(() => {
      if (dirty.classes || dirty.teachers || dirty.catalog) {
        console.log('Auto-saving changes (debounce)...');
        saveChanges().catch(e => console.error('Auto-save failed:', e));
      }
    }, 3000);

    const watchdogTimer = setInterval(() => {
      if ((dirty.classes || dirty.teachers || dirty.catalog) && !isSaving) {
        console.log('Auto-saving changes (watchdog)...');
        saveChanges().catch(e => console.error('Watchdog save failed:', e));
      }
    }, 8000);

    return () => {
      clearTimeout(debounceTimer);
      clearInterval(watchdogTimer);
    };
  }, [hasUnsavedChanges, isSaving, saveChanges, dirty]);

  // One-time migration: rename legacy A-Level subject names to the canonical
  // UACE names so existing data lines up with the new subject structure.
  // (Computer Science -> Subsidiary Computer, Sub-Mathematics -> Subsidiary Mathematics)
  useEffect(() => {
    if (!isHydrated || classes.length === 0) return;

    const LEGACY_RENAMES: Record<string, string> = {
      'Computer Science': 'Subsidiary Computer',
      'Sub-Mathematics': 'Subsidiary Mathematics',
    };
    const rename = (name: string) => LEGACY_RENAMES[name] ?? name;

    let needsMigration = false;

    const updatedClasses = classes.map((cls) => {
      if (cls.level !== 'A') return cls;

      const streams = cls.streams.map((stream) => {
        let changed = false;

        // Rename stream subjects and dedupe by name (in case a legacy and
        // canonical name both existed).
        const seenSubjectNames = new Set<string>();
        const subjects = stream.subjects
          .map((sub) => {
            const renamed = sub.name ? rename(sub.name) : sub.name;
            if (renamed !== sub.name) changed = true;
            return { ...sub, name: renamed };
          })
          .filter((sub) => {
            if (seenSubjectNames.has(sub.name)) {
              changed = true;
              return false;
            }
            seenSubjectNames.add(sub.name);
            return true;
          });

        // Rename student subject lists.
        const students = stream.students.map((student) => {
          const nextSubjects = student.subjects?.map(rename);
          const nextOptional = student.optionalSubjects?.map(rename);
          const dedupedSubjects = nextSubjects ? Array.from(new Set(nextSubjects)) : nextSubjects;
          const dedupedOptional = nextOptional ? Array.from(new Set(nextOptional)) : nextOptional;
          if (
            JSON.stringify(dedupedSubjects) !== JSON.stringify(student.subjects) ||
            JSON.stringify(dedupedOptional) !== JSON.stringify(student.optionalSubjects)
          ) {
            changed = true;
          }
          return {
            ...student,
            subjects: dedupedSubjects,
            optionalSubjects: dedupedOptional,
          };
        });

        if (changed) needsMigration = true;
        return { ...stream, subjects, students };
      });

      return { ...cls, streams };
    });

    if (needsMigration) {
      console.log('[SchoolDataContext] Migrating legacy A-Level subject names...');
      setClasses(updatedClasses);
      setTimeout(() => {
        saveChanges().catch((e) => console.error('Post-migration save failed:', e));
      }, 150);
    }
  }, [classes, isHydrated, setClasses, saveChanges]);

  // GLOBAL migration: assign current academic year/term to any assessments
  // missing them, or whose year/term reference no longer exists in the shared
  // academic years list (e.g. IDs generated on a different client). Runs on
  // EVERY page so teacher dashboard users also get fixed data.
  useEffect(() => {
    if (!currentAcademicYearId || !currentTermId || classes.length === 0) return;
    if (!isHydrated) return;

    const years = Array.isArray(academicYears) ? academicYears : [];
    const validYearIds = new Set(years.map((y) => y.id));
    const validTermIds = new Set(
      years.flatMap((y) => (Array.isArray(y.terms) ? y.terms.map((t) => t.id) : []))
    );

    let needsMigration = false;
    const updatedClasses = classes.map((cls) => {
      const assessments = cls.assessments || [];
      const migratedAssessments = assessments.map((a) => {
        const missing = !a.academicYearId || !a.termId;
        const orphaned = (a.academicYearId && !validYearIds.has(a.academicYearId)) ||
          (a.termId && !validTermIds.has(a.termId));

        if (missing || orphaned) {
          needsMigration = true;
          return {
            ...a,
            academicYearId: currentAcademicYearId,
            termId: currentTermId
          };
        }
        return a;
      });
      return {
        ...cls,
        assessments: migratedAssessments
      };
    });

    if (needsMigration) {
      console.log('[SchoolDataContext] Migrating assessments with missing/orphaned academicYearId/termId...');
      setClasses(updatedClasses);
      // Immediately flush to server for durability
      setTimeout(() => {
        saveChanges().catch((e) => console.error('Post-migration save failed:', e));
      }, 150);
    }
  }, [classes, academicYears, currentAcademicYearId, currentTermId, setClasses, saveChanges, isHydrated]);

  const addTeacher = useCallback(async (teacher: { name: string; email?: string; initials?: string; password?: string }) => {
    const email = teacher.email?.trim();
    if (!email) {
      throw new Error('An email address is required to create a teacher login.');
    }

    const provisionResponse = await fetch(`${API_URL}/teachers/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: teacher.name,
        email,
        password: teacher.password || 'password123',
      }),
    });
    if (!provisionResponse.ok) {
      const result = await provisionResponse.json().catch(() => ({}));
      throw new Error(result.error || 'Could not create the teacher login.');
    }

    const id = makeId('t');
    const nextTeacher: Teacher = { id, password: 'password123', ...teacher, email };
    setTeachers((prev) => [...prev, nextTeacher]);
    return id;
  }, [setTeachers]);

  const editTeacher = useCallback(async (id: string, updates: { name?: string; email?: string; initials?: string; password?: string }) => {
    const existingTeacher = teachers.find((teacher) => teacher.id === id);
    const email = updates.email?.trim() || existingTeacher?.email?.trim();

    // A supplied password is an explicit request to create/reset the login.
    if (updates.password && email && existingTeacher) {
      const provisionResponse = await fetch(`${API_URL}/teachers/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updates.name?.trim() || existingTeacher.name,
          email,
          password: updates.password,
        }),
      });
      if (!provisionResponse.ok) {
        const result = await provisionResponse.json().catch(() => ({}));
        throw new Error(result.error || 'Could not update the teacher login.');
      }
    }
    setTeachers((prev) => prev.map((teacher) => (teacher.id === id ? { ...teacher, ...updates } : teacher)));
  }, [teachers, setTeachers]);

  const removeTeacher = useCallback((id: string) => {
    setTeachers((prev) => prev.filter((teacher) => teacher.id !== id));
    setClasses((prev) =>
      prev.map((cls) => ({
        ...cls,
        streams: cls.streams.map((stream) => ({
          ...stream,
          classTeacherId: stream.classTeacherId === id ? undefined : stream.classTeacherId,
          subjects: stream.subjects.map((subject) => (
            subject.teacherId === id ? { ...subject, teacherId: undefined } : subject
          )),
        })),
      }))
    );
  }, [setClasses, setTeachers]);

  const setCategory = useCallback((subject: string, category: SubjectCategory, level?: 'O' | 'A') => {
    if (!subject) return;
    const key = level ? `${level}:${subject}` : subject;
    setCatalog((prev) => ({ ...prev, [key]: category }));
  }, [setCatalog]);

  const addSubjectToStream = useCallback((
    classIndex: number,
    streamName: string,
    subject: string,
    teacherId?: string,
    initials?: string,
    category: SubjectCategory = 'optional',
    customPapers?: string[]
  ) => {
    if (!subject) return;
    setClasses((prev) => prev.map((cls, index) => {
      if (index !== classIndex) return cls;

      let papers: string[] | undefined = customPapers;
      if (!papers && cls.level === 'A' && ALEVEL_SUBJECTS_CONFIG[subject]) {
        papers = ALEVEL_SUBJECTS_CONFIG[subject].papers;
      }

      return {
        ...cls,
        streams: cls.streams.map((stream) => {
          if (stream.name !== streamName) return stream;
          if (stream.subjects.some((entry) => toSubjectName(entry) === subject)) return stream;
          return {
            ...stream,
            subjects: [...stream.subjects, { name: subject, teacherId: teacherId || undefined, initials, category, papers }],
          };
        }),
      };
    }));
    setCategory(subject, category);
  }, [setCategory, setClasses]);

  const addSubjectToAllStreams = useCallback((
    subject: string,
    teacherId?: string,
    initials?: string,
    category: SubjectCategory = 'optional'
  ) => {
    if (!subject) return;
    setClasses((prev) => prev.map((cls) => ({
      ...cls,
      streams: cls.streams.map((stream) => (
        stream.subjects.some((entry) => toSubjectName(entry) === subject)
          ? stream
          : { ...stream, subjects: [...stream.subjects, { name: subject, teacherId, initials, category }] }
      )),
    })));
  }, [setClasses]);

  const removeSubjectFromStream = useCallback((classIndex: number, streamName: string, subjectIndex: number) => {
    setClasses((prev) => prev.map((cls, index) => {
      if (index !== classIndex) return cls;
      return {
        ...cls,
        streams: cls.streams.map((stream) => {
          if (stream.name !== streamName) return stream;
          const removedSubject = stream.subjects[subjectIndex];
          const removedName = removedSubject ? toSubjectName(removedSubject) : null;
          return {
            ...stream,
            subjects: stream.subjects.filter((_, idx) => idx !== subjectIndex),
            students: stream.students.map((student) => ({
              ...student,
              optionalSubjects: removedName ? student.optionalSubjects.filter((name) => name !== removedName) : student.optionalSubjects,
              subjects: removedName ? student.subjects.filter((name) => name !== removedName) : student.subjects,
            })),
          };
        }),
      };
    }));
  }, [setClasses]);

  const updateSubjectInStream = useCallback(async (classIndex: number, streamName: string, subjectIndex: number, updates: Partial<SubjectEntry>) => {
    const selectedClass = classes[classIndex];
    if (!selectedClass) return;
    const stream = selectedClass.streams.find(s => s.name === streamName);
    if (!stream) return;
    const subject = stream.subjects[subjectIndex];
    if (!subject) return;

    const oldName = subject.name;
    const nextName = (updates.name ?? oldName).trim();
    const nextPapers = updates.papers ?? subject.papers;

    setClasses((prev) => {
      const next = prev.map((cls, index) => {
        if (index !== classIndex) return cls;

        const renamedSubjectName = updates.name ? updates.name.trim() : oldName;

        return {
          ...cls,
          streams: cls.streams.map((stream) => {
            if (stream.name !== streamName) return stream;
            return {
              ...stream,
              subjects: stream.subjects.map((subject, idx) => {
                if (idx !== subjectIndex) return subject;
                const subjectEntry = typeof subject === 'string' ? { name: subject } : subject;
                return {
                  ...subjectEntry,
                  ...updates,
                  name: renamedSubjectName || subjectEntry.name,
                  papers: nextPapers ?? subjectEntry.papers,
                };
              }),
              students: stream.students.map((student) => ({
                ...student,
                optionalSubjects: student.optionalSubjects.map((name) => name === oldName ? renamedSubjectName : name),
                subjects: student.subjects.map((name) => name === oldName ? renamedSubjectName : name),
              })),
            };
          }),
          assessments: (cls.assessments ?? []).map((assessment) => {
            const nextSubjectScores = { ...(assessment.subjectScores ?? {}) };
            if (oldName !== renamedSubjectName && nextSubjectScores[oldName]) {
              const value = nextSubjectScores[oldName];
              delete nextSubjectScores[oldName];
              nextSubjectScores[renamedSubjectName] = value;
            }

            const nextPaperScores = { ...(assessment.paperScores ?? {}) };
            if (oldName !== renamedSubjectName && nextPaperScores[oldName]) {
              const value = nextPaperScores[oldName];
              delete nextPaperScores[oldName];
              nextPaperScores[renamedSubjectName] = value;
            }

            if (nextPapers && nextPaperScores[renamedSubjectName]) {
              const allowed = new Set(nextPapers);
              nextPaperScores[renamedSubjectName] = Object.fromEntries(
                Object.entries(nextPaperScores[renamedSubjectName]).filter(([paperName]) => allowed.has(paperName))
              );
            }

            return {
              ...assessment,
              subjectScores: nextSubjectScores,
              paperScores: nextPaperScores,
            };
          }),
        };
      });
      setDirty(d => ({ ...d, classes: true }));
      localStorage.setItem("school:classes_buffer", JSON.stringify(next));
      lastUpdate.current.classes = Date.now();
      return next;
    });

    if (updates.teacherId !== undefined || updates.initials !== undefined) {
      try {
        const response = await fetch(`${API_URL}/assignments/teacher`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'subject',
            className: selectedClass.name,
            streamName,
            subjectName: oldName,
            teacherId: updates.teacherId,
            initials: updates.initials
          })
        });
        if (!response.ok) {
          console.error('Failed to update subject teacher remotely:', response.statusText);
        }
      } catch (e) {
        console.error('Failed to update subject teacher remotely:', e);
      }
    }

    if (updates.name && nextName !== oldName) {
      setCatalog((prev) => {
        const nextCatalog = { ...prev };
        if (prev[oldName]) {
          nextCatalog[nextName] = prev[oldName];
          delete nextCatalog[oldName];
        }
        return nextCatalog;
      });
    }
  }, [classes, setClasses, setCatalog, API_URL]);

  const addStudentToStream = useCallback((classIndex: number, streamName: string, student: Omit<Student, 'id' | 'subjects'> & { subjects?: string[] }) => {
    setClasses((prev) => prev.map((cls, index) => {
      if (index !== classIndex) return cls;
      return {
        ...cls,
        streams: cls.streams.map((stream) => {
          if (stream.name !== streamName) return stream;
          const streamSubjectNames = stream.subjects.map(toSubjectName);
          const nextStudent: Student = {
            id: makeId('stu'),
            studentID: student.studentID ?? '',
            firstName: student.firstName ?? '',
            secondName: student.secondName ?? '',
            otherNames: student.otherNames ?? '',
            gender: student.gender === 'Female' ? 'Female' : 'Male',
            optionalSubjects: (student.optionalSubjects ?? []).filter(Boolean),
            subjects: student.subjects ?? streamSubjectNames,
          };
          return { ...stream, students: [...stream.students, nextStudent] };
        }),
      };
    }));
  }, [setClasses]);

  const editStudentInStream = useCallback(async (classIndex: number, streamName: string, studentIndex: number, updates: Partial<Student>) => {
    const selectedClass = classes[classIndex];
    if (!selectedClass) return;
    const stream = selectedClass.streams.find(s => s.name === streamName);
    if (!stream) return;
    const student = stream.students[studentIndex];
    if (!student) return;

    setClasses((prev) => {
      const next = prev.map((cls, index) => {
        if (index !== classIndex) return cls;
        return {
          ...cls,
          streams: cls.streams.map((stream) => {
            if (stream.name !== streamName) return stream;
            const streamSubjectNames = stream.subjects.map(toSubjectName);
            return {
              ...stream,
              students: stream.students.map((student, idx) => (
                idx !== studentIndex
                  ? student
                  : {
                    ...student,
                    ...updates,
                    optionalSubjects: updates.optionalSubjects ?? student.optionalSubjects,
                    subjects: updates.subjects ?? streamSubjectNames,
                  }
              )),
            };
          }),
        };
      });
      setDirty(d => ({ ...d, classes: true }));
      localStorage.setItem("school:classes_buffer", JSON.stringify(next));
      lastUpdate.current.classes = Date.now();
      return next;
    });

    if (updates.optionalSubjects !== undefined || updates.subjects !== undefined) {
      try {
        const response = await fetch(`${API_URL}/students/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: student.id,
            subjects: updates.subjects ?? student.subjects,
            optionalSubjects: updates.optionalSubjects ?? student.optionalSubjects
          })
        });
        if (!response.ok) {
          console.error('Failed to update student subjects remotely:', response.statusText);
        }
      } catch (e) {
        console.error('Failed to update student subjects remotely:', e);
      }
    }
  }, [classes, setClasses, API_URL]);

  const removeStudentFromStream = useCallback((classIndex: number, streamName: string, studentIndex: number) => {
    setClasses((prev) => prev.map((cls, index) => {
      if (index !== classIndex) return cls;
      return {
        ...cls,
        streams: cls.streams.map((stream) => (
          stream.name !== streamName
            ? stream
            : { ...stream, students: stream.students.filter((_, idx) => idx !== studentIndex) }
        )),
      };
    }));
  }, [setClasses]);

  const importStudentsToStream = useCallback((classIndex: number, streamName: string, studentsToImport: Array<Partial<Student>>) => {
    setClasses((prev) => prev.map((cls, index) => {
      if (index !== classIndex) return cls;
      return {
        ...cls,
        streams: cls.streams.map((stream) => {
          if (stream.name !== streamName) return stream;
          const streamSubjectNames = stream.subjects.map(toSubjectName);
          const imported: Student[] = studentsToImport.map((student) => ({
            id: student.id ?? makeId('stu'),
            studentID: student.studentID ?? '',
            firstName: student.firstName ?? '',
            secondName: student.secondName ?? '',
            otherNames: student.otherNames ?? '',
            gender: (student.gender === 'Female' ? 'Female' : 'Male') as 'Male' | 'Female',
            optionalSubjects: Array.isArray(student.optionalSubjects) ? student.optionalSubjects.filter(Boolean) as string[] : [],
            subjects: Array.isArray(student.subjects) && student.subjects.length > 0 ? student.subjects as string[] : streamSubjectNames,
          }));
          return { ...stream, students: [...stream.students, ...imported] };
        }),
      };
    }));
  }, [setClasses]);

  const setClassTeacher = useCallback(async (classIndex: number, streamName: string, teacherId: string | null) => {
    const selectedClass = classes[classIndex];
    if (!selectedClass) return;

    setClasses((prev) => {
      const next = prev.map((cls, index) => {
        if (index !== classIndex) return cls;
        return {
          ...cls,
          streams: cls.streams.map((stream) => (
            stream.name !== streamName ? stream : { ...stream, classTeacherId: teacherId || undefined }
          )),
        };
      });
      setDirty(d => ({ ...d, classes: true }));
      localStorage.setItem("school:classes_buffer", JSON.stringify(next));
      lastUpdate.current.classes = Date.now();
      return next;
    });

    try {
      const response = await fetch(`${API_URL}/assignments/teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'class',
          className: selectedClass.name,
          streamName,
          teacherId
        })
      });
      if (!response.ok) {
        console.error('Failed to update class teacher remotely:', response.statusText);
      }
    } catch (e) {
      console.error('Failed to update class teacher remotely:', e);
    }
  }, [classes, setClasses, API_URL]);

  const addAssessmentToClass = useCallback((
    classIndex: number,
    assessment: Omit<Assessment, 'id' | 'scores' | 'subjectScores'> & Partial<Pick<Assessment, 'scores' | 'subjectScores'>>
  ) => {
    const id = makeId('asm');
    const nextAssessment: Assessment = {
      id,
      name: assessment.name,
      date: assessment.date,
      maxScore: assessment.maxScore,
      academicYearId: assessment.academicYearId || currentAcademicYearId,
      termId: assessment.termId || currentTermId,
      scores: assessment.scores ?? {},
      subjectScores: assessment.subjectScores ?? {},
    };
    const nextClasses = classes.map((cls, index) => (
      index !== classIndex ? cls : { ...cls, assessments: [...(cls.assessments ?? []), nextAssessment] }
    ));
    setClasses(nextClasses);
    persistClassesImmediately(nextClasses).catch((error) => {
      console.warn('Assessment creation sync failed; the buffered save will retry:', error);
    });
    return id;
  }, [classes, setClasses, persistClassesImmediately, currentAcademicYearId, currentTermId]);

  const removeAssessmentFromClass = useCallback((classIndex: number, assessmentId: string) => {
    const nextClasses = classes.map((cls, index) => (
      index !== classIndex ? cls : { ...cls, assessments: (cls.assessments ?? []).filter((assessment) => assessment.id !== assessmentId) }
    ));
    setClasses(nextClasses);
    persistClassesImmediately(nextClasses).catch((error) => {
      console.warn('Assessment deletion sync failed; the buffered save will retry:', error);
    });
  }, [classes, setClasses, persistClassesImmediately]);

  const setScoreForAssessment = useCallback((classIndex: number, assessmentId: string, studentId: string, score: number | null) => {
    setClasses((prev) => prev.map((cls, index) => {
      if (index !== classIndex) return cls;
      return {
        ...cls,
        assessments: (cls.assessments ?? []).map((assessment) => (
          assessment.id !== assessmentId
            ? assessment
            : { ...assessment, scores: { ...assessment.scores, [studentId]: score } }
        )),
      };
    }));
    // Immediate granular DB write for "very persistent" scores
    (async () => {
      try {
        await fetch(`${API_URL}/assessments/scores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'general', assessmentId, studentId, score }),
        });
      } catch (e) {
        console.warn('Granular score sync failed, will retry on bulk save:', e);
      }
    })();
  }, [setClasses, API_URL]);

  const setSubjectScoreForAssessment = useCallback((classIndex: number, assessmentId: string, subjectName: string, studentId: string, score: number | null) => {
    setClasses((prev) => prev.map((cls, index) => {
      if (index !== classIndex) return cls;
      return {
        ...cls,
        assessments: (cls.assessments ?? []).map((assessment) => (
          assessment.id !== assessmentId
            ? assessment
            : {
              ...assessment,
              subjectScores: {
                ...(assessment.subjectScores ?? {}),
                [subjectName]: {
                  ...((assessment.subjectScores ?? {})[subjectName] ?? {}),
                  [studentId]: score,
                },
              },
            }
        )),
      };
    }));
    // Immediate granular DB write for "very persistent" scores
    (async () => {
      try {
        await fetch(`${API_URL}/assessments/scores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'subject', assessmentId, subjectName, studentId, score }),
        });
      } catch (e) {
        console.warn('Granular subject-score sync failed, will retry on bulk save:', e);
      }
    })();
  }, [setClasses, API_URL]);

  const setPaperScoreForAssessment = useCallback((classIndex: number, assessmentId: string, subjectName: string, paperName: string, studentId: string, score: number | null) => {
    setClasses((prev) => prev.map((cls, index) => {
      if (index !== classIndex) return cls;
      return {
        ...cls,
        assessments: (cls.assessments ?? []).map((assessment) => (
          assessment.id !== assessmentId
            ? assessment
            : {
              ...assessment,
              paperScores: {
                ...(assessment.paperScores ?? {}),
                [subjectName]: {
                  ...((assessment.paperScores ?? {})[subjectName] ?? {}),
                  [paperName]: {
                    ...(((assessment.paperScores ?? {})[subjectName] ?? {})[paperName] ?? {}),
                    [studentId]: score,
                  },
                },
              },
            }
        )),
      };
    }));
    // Immediate granular DB write for "very persistent" scores
    (async () => {
      try {
        await fetch(`${API_URL}/assessments/scores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'paper', assessmentId, subjectName, paperName, studentId, score }),
        });
      } catch (e) {
        console.warn('Granular paper-score sync failed, will retry on bulk save:', e);
      }
    })();
  }, [setClasses, API_URL]);

  const updateAssessmentInClass = useCallback((classIndex: number, assessmentId: string, updates: Partial<Assessment>) => {
    const nextClasses = classes.map((cls, index) => {
      if (index !== classIndex) return cls;
      return {
        ...cls,
        assessments: (cls.assessments ?? []).map((assessment) => (
          assessment.id !== assessmentId ? assessment : { ...assessment, ...updates }
        )),
      };
    });
    setClasses(nextClasses);
    persistClassesImmediately(nextClasses).catch((error) => {
      console.warn('Assessment update sync failed; the buffered save will retry:', error);
    });
  }, [classes, setClasses, persistClassesImmediately]);

  const getAssessmentReportsForClass = useCallback((classIndex: number) => {
    const selectedClass = classes[classIndex];
    if (!selectedClass) return [];
    const totalStudents = selectedClass.streams.reduce((sum, stream) => sum + stream.students.length, 0);
    return (selectedClass.assessments ?? []).map((assessment) => {
      const numericScores = Object.values(assessment.scores).filter((value): value is number => typeof value === 'number');
      const average = numericScores.length > 0 ? numericScores.reduce((sum, value) => sum + value, 0) / numericScores.length : null;
      return {
        assessmentId: assessment.id,
        name: assessment.name,
        date: assessment.date,
        maxScore: assessment.maxScore,
        average,
        min: numericScores.length > 0 ? Math.min(...numericScores) : null,
        max: numericScores.length > 0 ? Math.max(...numericScores) : null,
        count: numericScores.length,
        missing: Math.max(0, totalStudents - numericScores.length),
      };
    });
  }, [classes]);

  const getSubjectsWithMissingScoresForAudit = useCallback((classIndex: number, assessmentId: string) => {
    const selectedClass = classes[classIndex];
    if (!selectedClass || !assessmentId) return [];

    const assessment = (selectedClass.assessments ?? []).find((a) => a.id === assessmentId);
    if (!assessment) return [];

    const auditReports: SubjectAuditReport[] = [];

    selectedClass.streams.forEach((stream) => {
      stream.subjects.forEach((subject) => {
        const subjectName = typeof subject === 'string' ? subject : subject.name;
        const subjectScores = assessment.subjectScores?.[subjectName] ?? {};

        const hasAnyScores = Object.values(subjectScores).some((v) => typeof v === 'number');

        if (!hasAnyScores && stream.students.length > 0) {
          const teacher = typeof subject === 'string' ? undefined : (subject.teacherId ? teachers.find((t) => t.id === subject.teacherId) : undefined);

          auditReports.push({
            className: selectedClass.name,
            classLevel: selectedClass.level,
            streamName: stream.name,
            subjectName,
            teacherId: typeof subject === 'string' ? undefined : subject.teacherId,
            teacherName: teacher?.name ?? 'Unassigned',
            totalStudents: stream.students.length,
            assessmentId,
            assessmentName: assessment.name,
            assessmentDate: assessment.date,
          });
        }
      });
    });

    return auditReports;
  }, [classes, teachers]);

  const exportAssessmentsCSV = useCallback((classIndex: number) => {
    const selectedClass = classes[classIndex];
    if (!selectedClass) return '';
    const students = selectedClass.streams.flatMap((stream) => stream.students);
    const rows = [[
      'className',
      'assessmentId',
      'assessmentName',
      'date',
      'maxScore',
      'studentID',
      'studentName',
      'studentInternalId',
      'score',
    ].join(',')];

    (selectedClass.assessments ?? []).forEach((assessment) => {
      students.forEach((student) => {
        rows.push([
          escapeCsvValue(selectedClass.name),
          escapeCsvValue(assessment.id),
          escapeCsvValue(assessment.name),
          escapeCsvValue(assessment.date ?? ''),
          escapeCsvValue(assessment.maxScore ?? ''),
          escapeCsvValue(student.studentID),
          escapeCsvValue(`${student.firstName} ${student.secondName}`.trim()),
          escapeCsvValue(student.id),
          escapeCsvValue(assessment.scores?.[student.id] ?? ''),
        ].join(','));
      });
    });

    return rows.join('\n');
  }, [classes]);

  const importAssessmentsFromCSV = useCallback((classIndex: number, csvText: string) => {
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length <= 1) return { created: 0, updated: 0 };

    const headers = parseCsvLine(lines[0]).map((header) => header.trim());
    const rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      return headers.reduce<Record<string, string>>((acc, header, index) => {
        acc[header] = values[index] ?? '';
        return acc;
      }, {});
    });

    let created = 0;
    let updated = 0;

    setClasses((prev) => prev.map((cls, index) => {
      if (index !== classIndex) return cls;
      const students = cls.streams.flatMap((stream) => stream.students);
      const assessments = [...(cls.assessments ?? [])];

      rows.forEach((row) => {
        const assessmentId = row.assessmentId?.trim();
        const assessmentName = row.assessmentName?.trim();
        if (!assessmentId && !assessmentName) return;

        let assessment = assessments.find((item) => item.id === assessmentId)
          ?? assessments.find((item) => item.name === assessmentName && (item.date ?? '') === (row.date ?? ''));

        if (!assessment) {
          const newAssessment = {
            id: assessmentId || makeId('asm'),
            name: assessmentName || 'Assessment',
            date: row.date || undefined,
            maxScore: row.maxScore ? Number(row.maxScore) : undefined,
            academicYearId: currentAcademicYearId,
            termId: currentTermId,
            scores: {},
            subjectScores: {},
          };
          assessments.push(newAssessment);
          assessment = newAssessment;
          created += 1;
        }

        if (!assessment) return;

        const student = students.find((item) => item.id === row.studentInternalId || item.studentID === row.studentID);
        if (!student) return;

        const scoreText = row.score?.trim() ?? '';
        assessment.scores[student.id] = scoreText === '' ? null : Number(scoreText);
        if (assessment.maxScore === undefined && row.maxScore) {
          assessment.maxScore = Number(row.maxScore);
        }
        if (!assessment.date && row.date) {
          assessment.date = row.date;
        }
        updated += 1;
      });

      return { ...cls, assessments };
    }));

    return { created, updated };
  }, [setClasses, currentAcademicYearId, currentTermId]);

  const value = useMemo(() => ({
    classes,
    setClasses,
    teachers,
    catalog,
    isHydrated,
    addTeacher,
    editTeacher,
    removeTeacher,
    setCategory,
    addSubjectToStream,
    addSubjectToAllStreams,
    removeSubjectFromStream,
    updateSubjectInStream,
    addStudentToStream,
    editStudentInStream,
    removeStudentFromStream,
    importStudentsToStream,
    setClassTeacher,
    addAssessmentToClass,
    removeAssessmentFromClass,
    setScoreForAssessment,
    setSubjectScoreForAssessment,
    setPaperScoreForAssessment,
    updateAssessmentInClass,
    getAssessmentReportsForClass,
    getSubjectsWithMissingScoresForAudit,
    exportAssessmentsCSV,
    importAssessmentsFromCSV,
    isSaving,
    syncError,
    hasUnsavedChanges,
    saveChanges,
    academicYears,
    currentAcademicYearId,
    currentTermId,
    setAcademicYears,
    setCurrentAcademicYearId,
    setCurrentTermId,
  }), [
    classes,
    setClasses,
    teachers,
    catalog,
    isHydrated,
    addTeacher,
    editTeacher,
    removeTeacher,
    setCategory,
    addSubjectToStream,
    addSubjectToAllStreams,
    removeSubjectFromStream,
    updateSubjectInStream,
    addStudentToStream,
    editStudentInStream,
    removeStudentFromStream,
    importStudentsToStream,
    setClassTeacher,
    addAssessmentToClass,
    removeAssessmentFromClass,
    setScoreForAssessment,
    setSubjectScoreForAssessment,
    setPaperScoreForAssessment,
    updateAssessmentInClass,
    getAssessmentReportsForClass,
    getSubjectsWithMissingScoresForAudit,
    exportAssessmentsCSV,
    importAssessmentsFromCSV,
    isSaving,
    syncError,
    hasUnsavedChanges,
    saveChanges,
    academicYears,
    currentAcademicYearId,
    currentTermId,
    setAcademicYears,
    setCurrentAcademicYearId,
    setCurrentTermId,
  ]);

  return <SchoolDataContext.Provider value={value}>{children}</SchoolDataContext.Provider>;
}

export function useSchoolData() {
  const ctx = useContext(SchoolDataContext);
  if (!ctx) throw new Error('useSchoolData must be used within a SchoolDataProvider');
  return ctx;
}

export function useIsClassTeacher(classIndex: number, streamName?: string) {
  const { classes } = useSchoolData();
  const { currentUser, isTeacher } = useAuth();

  return useMemo(() => {
    if (!isTeacher || !currentUser || classIndex < 0) return false;
    const selectedClass = classes[classIndex];
    const selectedStream = selectedClass?.streams.find((stream) => stream.name === streamName);
    return selectedStream?.classTeacherId === currentUser.id;
  }, [classIndex, classes, currentUser, isTeacher, streamName]);
}
