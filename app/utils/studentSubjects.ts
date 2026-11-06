import type { Student, SubjectCategory, SubjectEntry } from "../context/SchoolDataContext";

function normalizeName(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

function listIncludes(list: string[] | undefined, subjectName: string): boolean {
  const target = normalizeName(subjectName);
  if (!target) return false;
  return (list ?? []).some((entry) => normalizeName(entry) === target);
}

/**
 * Resolve whether a subject is optional for a class level.
 * Prefer the stream subject entry, then level-specific catalog keys, then plain catalog keys.
 * Unknown subjects are treated as compulsory so marks entry does not hide an entire class.
 */
export function isSubjectOptional(
  subjectName: string,
  options: {
    level?: "O" | "A";
    catalog?: Record<string, SubjectCategory>;
    subjectEntry?: SubjectEntry | string | null;
  } = {}
): boolean {
  const entry = options.subjectEntry;
  if (entry && typeof entry !== "string" && (entry.category === "compulsory" || entry.category === "optional")) {
    return entry.category === "optional";
  }

  const catalog = options.catalog;
  if (!catalog) return false;

  const level = options.level;
  if (level) {
    const levelKey = `${level}:${subjectName}`;
    if (catalog[levelKey] === "compulsory" || catalog[levelKey] === "optional") {
      return catalog[levelKey] === "optional";
    }
  }

  return catalog[subjectName] === "optional";
}

/**
 * Whether a student should appear for marks entry / marksheets for a subject.
 */
export function studentTakesSubject(
  student: Student,
  subjectName: string,
  options: {
    level: "O" | "A";
    catalog?: Record<string, SubjectCategory>;
    subjectEntry?: SubjectEntry | string | null;
  }
): boolean {
  if (!subjectName?.trim()) return false;

  if (options.level === "A") {
    const picks = (student.subjects ?? []).map((s) => s.trim()).filter(Boolean);
    // Legacy / incomplete records: student is in the class but has no A-level
    // combination saved yet. Still show them so teachers can enter marks.
    if (picks.length === 0) return true;
    return listIncludes(picks, subjectName);
  }

  if (!isSubjectOptional(subjectName, options)) {
    return true;
  }

  return listIncludes(student.optionalSubjects, subjectName);
}
