// app/context/alevelConfig.ts

/**
 * Ugandan A-Level (UACE) Curriculum Constants
 * Based on NCDC standards.
 */

// A-Level students take exactly 5 subjects: 3 principal + 2 subsidiary.
// Subsidiary = General Paper (compulsory) + one choice of
// Subsidiary Mathematics OR Subsidiary Computer.
export const ALEVEL_SUBSIDIARY_COMPULSORY = 'General Paper';
export const ALEVEL_SUBSIDIARY_CHOICES = ['Subsidiary Mathematics', 'Subsidiary Computer'];
export const ALEVEL_SUBSIDIARY_SUBJECTS = [ALEVEL_SUBSIDIARY_COMPULSORY, ...ALEVEL_SUBSIDIARY_CHOICES];


export const ALEVEL_SUBJECTS_CONFIG: Record<string, { papers: string[], type: 'principal' | 'subsidiary' }> = {
  // Principal Subjects (Typical combinations: PCM, BCM, HEG, MEG, etc.)
  'Mathematics': { papers: ['P1', 'P2'], type: 'principal' },
  'Physics': { papers: ['P1', 'P2', 'P3'], type: 'principal' },
  'Chemistry': { papers: ['P1', 'P2', 'P3'], type: 'principal' },
  'Biology': { papers: ['P1', 'P2', 'P3'], type: 'principal' },
  'Economics': { papers: ['P1', 'P2'], type: 'principal' },
  'Geography': { papers: ['P1', 'P2'], type: 'principal' },
  'History': { papers: ['P1', 'P2'], type: 'principal' }, // Often P1, P2, P3 or P4
  'Literature in English': { papers: ['P1', 'P2', 'P3'], type: 'principal' },
  'Christian Religious Education': { papers: ['P1', 'P2'], type: 'principal' },
  'Islamic Religious Education': { papers: ['P1', 'P2'], type: 'principal' },
  'Art': { papers: ['P1', 'P2', 'P3', 'P4'], type: 'principal' },
  'Agriculture': { papers: ['P1', 'P2', 'P3'], type: 'principal' },
  'Entrepreneurship Education': { papers: ['P1', 'P2'], type: 'principal' },
  'Luganda': { papers: ['P1', 'P2'], type: 'principal' },
  
  // Subsidiary Subjects (Compulsory)
  'General Paper': { papers: ['P1'], type: 'subsidiary' },
  'Subsidiary Mathematics': { papers: ['P1'], type: 'subsidiary' },
  'Subdiary Computer': { papers: ['P1', 'P2'], type: 'subsidiary' },
};

export type ALevelGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'O' | 'F';

export const ALEVEL_GRADING_SCALE = [
  { grade: 'D1', min: 90, comment: 'Excellent' },
  { grade: 'D2', min: 80, comment: 'Very Good' },
  { grade: 'C3', min: 75, comment: 'Good' },
  { grade: 'C4', min: 65, comment: 'Fair' },
  { grade: 'C5', min: 60, comment: 'Pass' },
  { grade: 'C6', min: 50, comment: 'Borderline Pass' },
  { grade: 'P7', min: 45, comment: 'Subsidiary Pass' },
  { grade: 'P8', min: 40, comment: 'Weak Pass' },
  { grade: 'F9', min: 0, comment: 'Fail' },
];
