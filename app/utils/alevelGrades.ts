// utils/alevelGrades.ts

import { ALEVEL_GRADING_SCALE } from '../context/alevelConfig';

// Paper grades in order of merit (UNEB paper grading)
export const PAPER_GRADES = ['D1', 'D2', 'C3', 'C4', 'C5', 'C6', 'P7', 'P8', 'F9'];

// Subject grades (UACE subject grading)
export const SUBJECT_GRADES = ['A', 'B', 'C', 'D', 'E', 'O', 'F'];

// Get grade value for comparison (lower is better)
export function getGradeValue(grade: string): number {
  const index = PAPER_GRADES.indexOf(grade);
  return index !== -1 ? index : 99; // 99 for unknown
}

// Check if a grade is a Principal Pass (D1 - C6)
export function isPrincipalPass(grade: string): boolean {
  return ['D1', 'D2', 'C3', 'C4', 'C5', 'C6'].includes(grade);
}

// Check if a grade is a Subsidiary Pass (P7 - P8)
export function isSubsidiaryPass(grade: string): boolean {
  return ['P7', 'P8'].includes(grade);
}

// Check if a grade is a Fail (F9)
export function isFail(grade: string): boolean {
  return grade === 'F9';
}

// Get the better of two grades
export function getBetterGrade(grade1: string, grade2: string): string {
  const value1 = getGradeValue(grade1);
  const value2 = getGradeValue(grade2);
  return value1 <= value2 ? grade1 : grade2;
}

// Get the worse of two grades
export function getWorseGrade(grade1: string, grade2: string): string {
  const value1 = getGradeValue(grade1);
  const value2 = getGradeValue(grade2);
  return value1 >= value2 ? grade1 : grade2;
}

/**
 * Calculate paper grade from score.
 * Paper grades use the same D1-F9 scale for both principal and subsidiary subjects.
 */
export function calculatePaperGrade(score: number): string {
  const entry = ALEVEL_GRADING_SCALE.find((s: { grade: string; min: number }) => score >= s.min);
  return entry?.grade || 'F9';
}

/**
 * Calculate UACE Subject Grade from paper grades for PRINCIPAL subjects.
 * Uses the UNEB cross-matching rules in UNEB_ALevel_Grading_Summary.md.
 * Returns subject grade in A, B, C, D, E, O, F format.
 *
 * Paper grades are mapped to numeric values by their index in PAPER_GRADES:
 * D1=0, D2=1, C3=2, C4=3, C5=4, C6=5, P7=6, P8=7, F9=8.
 */
export function calculateUACESubjectGrade(
  paperGrades: string[],
  subjectType: 'two-paper' | 'three-paper' = 'two-paper'
): { grade: string; points: number; comment: string } {
  const validGrades = paperGrades.filter((g: string) => g && g !== '—' && PAPER_GRADES.includes(g));

  if (validGrades.length === 0) {
    return { grade: '—', points: 0, comment: 'No data' };
  }

  // Numeric values, sorted best (lowest) first.
  const values = validGrades.map((g: string) => PAPER_GRADES.indexOf(g)).sort((a: number, b: number) => a - b);

  const grade = subjectType === 'three-paper'
    ? gradeThreePaperSubject(values)
    : gradeTwoPaperSubject(values);

  return {
    grade,
    points: getSubjectGradePoints(grade),
    comment: getSubjectGradeComment(grade),
  };
}

/**
 * Two-paper subjects: the final grade is determined by the WORSE paper.
 *   worse D1/D2 -> A, C3 -> B, C4 -> C, C5 -> D, C6 -> E, P7/P8 -> O.
 *   worse F9 -> O if the other paper is a credit/distinction (D1-C6),
 *               F if the other paper is a Pass/F9 (P7/F9).
 */
function gradeTwoPaperSubject(values: number[]): string {
  const better = values[0];
  const worse = values[values.length - 1];

  if (worse <= 1) return 'A';
  if (worse === 2) return 'B';
  if (worse === 3) return 'C';
  if (worse === 4) return 'D';
  if (worse === 5) return 'E';
  if (worse === 6 || worse === 7) return 'O';
  // worse === 8 (F9)
  return better <= 5 ? 'O' : 'F';
}

/**
 * Three-paper subjects: the final grade is balanced across the three papers;
 * a single weak paper may be offset by two strong papers.
 *   A: at least two distinctions and at worst a C3 in the third paper.
 *   B-E: second-best paper is at the grade threshold, worst paper within one notch.
 *   O: subsidiary pass — best two papers are principal passes and the single
 *      weak paper is at worst F9, or the best two include a P7 with worst at P8.
 *   F: otherwise (severe failures).
 */
function gradeThreePaperSubject(values: number[]): string {
  const b2 = values.length > 1 ? values[1] : values[0];
  const b3 = values[values.length - 1];

  if (b2 <= 1 && b3 <= 2) return 'A';
  if (b2 <= 2 && b3 <= 3) return 'B';
  if (b2 <= 3 && b3 <= 4) return 'C';
  if (b2 <= 4 && b3 <= 5) return 'D';
  if (b2 <= 5 && b3 <= 6) return 'E';
  if ((b2 <= 6 && b3 <= 7) || (b2 <= 5 && b3 === 8)) return 'O';
  return 'F';
}

/**
 * Calculate Subsidiary Subject Grade from paper scores
 * Uses average of paper scores: >= 50% = O (Pass), < 50% = F (Fail)
 */
export function calculateSubsidiaryGradeFromScores(paperScores: number[]): { grade: string; points: number; comment: string } {
  // Filter out empty scores
  const validScores = paperScores.filter((s: number) => typeof s === 'number' && !isNaN(s));
  
  if (validScores.length === 0) {
    return { grade: '—', points: 0, comment: 'No data' };
  }

  // Calculate average
  const average = validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length;
  
  // Binary grading: >= 50% = Pass (O), < 50% = Fail (F)
  if (average >= 50) {
    return { grade: 'O', points: 1, comment: 'Subsidiary Pass' };
  } else {
    return { grade: 'F', points: 0, comment: 'Fail' };
  }
}

/**
 * Get points for a subject grade
 * Principal: A=6, B=5, C=4, D=3, E=2, O=1, F=0
 * Subsidiary: O=1, F=0
 */
export function getSubjectGradePoints(grade: string, isSubsidiary: boolean = false): number {
  if (isSubsidiary) {
    return grade === 'O' ? 1 : 0;
  }
  
  // Principal subjects
  const gradePoints: Record<string, number> = {
    'A': 6,
    'B': 5,
    'C': 4,
    'D': 3,
    'E': 2,
    'O': 1,
    'F': 0,
    '—': 0,
  };
  return gradePoints[grade] || 0;
}

/**
 * Get comment for a subject grade
 */
export function getSubjectGradeComment(grade: string): string {
  const comments: Record<string, string> = {
    'A': 'Excellent performance',
    'B': 'Very good performance',
    'C': 'Good performance',
    'D': 'Satisfactory performance',
    'E': 'Principal Pass',
    'O': 'Subsidiary Pass',
    'F': 'Fail',
    '—': 'No data',
  };
  return comments[grade] || '';
}