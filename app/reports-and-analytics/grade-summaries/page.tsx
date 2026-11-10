"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSchoolData, Assessment, Stream, Student, SubjectEntry, SubjectCategory } from "../../context/SchoolDataContext";
import AcademicYearSelector from "../../components/AcademicYearSelector";
import { ALEVEL_SUBJECTS_CONFIG } from "../../context/alevelConfig";
import { studentTakesSubject } from "../../utils/studentSubjects";
import {
  calculateFinalPaperScore,
  calculatePaperGrade,
  calculateUACESubjectGrade,
  calculateSubsidiaryGrade,
} from "../../utils/alevelGrades";

// Letter grades tallied in the summaries. "O" and "F" only occur at A-Level.
const GRADE_COLUMNS = ["A", "B", "C", "D", "E", "O", "F"] as const;
type GradeKey = (typeof GRADE_COLUMNS)[number];

// UACE subject grade points: A=6 ... O=1, F=0.
const ALEVEL_SUBJECT_POINTS: Record<string, number> = {
  A: 6,
  B: 5,
  C: 4,
  D: 3,
  E: 2,
  O: 1,
  F: 0,
};

type SummaryRow = {
  subjectName: string;
  counts: Record<GradeKey, number>;
  meanMark: number | null;
  meanGrade: string;
};

type IncompleteStudent = {
  id: string;
  studentID: string;
  name: string;
  streamName: string;
  recordedCount: number;
  expected: number;
  missingSubjects: string[];
};

// Expected number of subjects per class (UNEB subject load).
function getExpectedSubjectCount(className: string): number {
  const match = className.match(/\d+/);
  const senior = match ? Number(match[0]) : NaN;
  switch (senior) {
    case 1:
      return 13;
    case 2:
      return 12;
    case 3:
    case 4:
      return 9;
    case 5:
    case 6:
      return 5; // 3 principal + 2 subsidiary
    default:
      return 0;
  }
}

function emptyCounts(): Record<GradeKey, number> {
  return { A: 0, B: 0, C: 0, D: 0, E: 0, O: 0, F: 0 };
}

function isGradeKey(value: string): value is GradeKey {
  return (GRADE_COLUMNS as readonly string[]).includes(value);
}

// O-Level grade from a 100% subject mark.
function getOLevelGrade(mark: number | null): string {
  if (mark === null || mark === undefined) return "—";
  if (mark >= 80) return "A";
  if (mark >= 60) return "B";
  if (mark >= 40) return "C";
  if (mark >= 20) return "D";
  return "E";
}

// Convert an average of A-Level grade points back to a letter grade.
function gradeFromPoints(points: number): string {
  const index = Math.max(0, Math.min(6, Math.round(points)));
  return ["F", "O", "E", "D", "C", "B", "A"][index];
}

function studentIsEnrolled(
  student: Student,
  subEntry: SubjectEntry,
  level: "O" | "A",
  catalog: Record<string, SubjectCategory>
): boolean {
  return studentTakesSubject(student, subEntry.name, { level, catalog, subjectEntry: subEntry });
}

// The full list of subjects a student is enrolled for in a stream.
function getEnrolledSubjects(
  stream: Stream,
  student: Student,
  level: "O" | "A",
  catalog: Record<string, SubjectCategory>
): string[] {
  if (level === "A") {
    const assigned = student.subjects ?? [];
    return assigned.length > 0 ? assigned : (stream.subjects ?? []).map((s) => s.name);
  }
  return (stream.subjects ?? [])
    .filter((subEntry) => studentIsEnrolled(student, subEntry, level, catalog))
    .map((subEntry) => subEntry.name);
}

// A subject has a recorded result if any term assessment holds a numeric score.
function subjectHasResult(
  assessments: Assessment[],
  subjectName: string,
  studentId: string
): boolean {
  return assessments.some((assessment) => {
    const subjectScore = assessment.subjectScores?.[subjectName]?.[studentId];
    if (typeof subjectScore === "number") return true;
    const papers = assessment.paperScores?.[subjectName];
    if (papers) {
      return Object.values(papers).some(
        (paperScores) => typeof paperScores?.[studentId] === "number"
      );
    }
    return false;
  });
}

// O-Level final subject mark (20% from C1/C2 activities + 80% from end of cycle).
function computeOLevelSubjectMark(
  assessments: Assessment[],
  subjectName: string,
  studentId: string
): number | null {
  const activities = assessments.filter(
    (a) => typeof a.maxScore === "number" && a.maxScore >= 0.9 && a.maxScore <= 3
  );
  const c1 = activities[0];
  const c2 = activities[1];
  const endOfCycle = assessments.find(
    (a) => typeof a.maxScore === "number" && a.maxScore <= 80 && a.maxScore > 3
  );

  const c1Score = c1?.subjectScores?.[subjectName]?.[studentId] ?? c1?.scores?.[studentId];
  const c2Score = c2?.subjectScores?.[subjectName]?.[studentId] ?? c2?.scores?.[studentId];
  const endScore =
    endOfCycle?.subjectScores?.[subjectName]?.[studentId] ?? endOfCycle?.scores?.[studentId];

  let twentyPercentValue: number | null = null;
  const c1Present = typeof c1Score === "number";
  const c2Present = typeof c2Score === "number";

  if (c1Present && c2Present) {
    twentyPercentValue = (((c1Score as number) + (c2Score as number)) / 2 / 3) * 20;
  } else if (c1Present) {
    twentyPercentValue = ((c1Score as number) / 3) * 20;
  } else if (c2Present) {
    twentyPercentValue = ((c2Score as number) / 3) * 20;
  }

  const endOfCycleValue = typeof endScore === "number" ? (endScore as number) : null;
  if (twentyPercentValue === null && endOfCycleValue === null) return null;

  return (twentyPercentValue ?? 0) + (endOfCycleValue ?? 0);
}

// A-Level subject mark (mean paper percentage) and UACE subject grade.
function computeALevelSubjectResult(
  assessments: Assessment[],
  subjectName: string,
  studentId: string
): { mark: number | null; grade: string } {
  const config = ALEVEL_SUBJECTS_CONFIG[subjectName];
  if (!config) return { mark: null, grade: "—" };

  const paperGrades: string[] = [];
  const paperPercentages: number[] = [];

  config.papers.forEach((paper) => {
    const finalPaperScore = calculateFinalPaperScore(
      assessments.map((assessment) => ({
        score: assessment.paperScores?.[subjectName]?.[paper]?.[studentId],
        maxScore: assessment.maxScore,
      }))
    );
    if (finalPaperScore !== null) {
      paperGrades.push(calculatePaperGrade(finalPaperScore));
      paperPercentages.push(finalPaperScore);
    }
  });

  const mark =
    paperPercentages.length > 0
      ? paperPercentages.reduce((total, value) => total + value, 0) / paperPercentages.length
      : null;

  let grade = "—";
  if (paperGrades.length > 0) {
    if (config.type === "subsidiary") {
      grade = calculateSubsidiaryGrade(paperGrades).grade;
    } else {
      const subjectType = (config.papers?.length ?? 0) >= 3 ? "three-paper" : "two-paper";
      grade = calculateUACESubjectGrade(paperGrades, subjectType).grade;
    }
  }

  return { mark, grade };
}

// Tally every subject grade earned by the students in the given streams.
function tallyGrades(
  streams: Stream[],
  assessments: Assessment[],
  level: "O" | "A",
  catalog: Record<string, SubjectCategory>
): Record<GradeKey, number> {
  const counts = emptyCounts();
  const isALevel = level === "A";

  streams.forEach((stream) => {
    (stream.subjects ?? []).forEach((subEntry: SubjectEntry) => {
      (stream.students ?? []).forEach((student) => {
        if (!studentIsEnrolled(student, subEntry, level, catalog)) return;
        if (isALevel) {
          const { grade } = computeALevelSubjectResult(assessments, subEntry.name, student.id);
          if (isGradeKey(grade)) counts[grade] += 1;
        } else {
          const mark = computeOLevelSubjectMark(assessments, subEntry.name, student.id);
          if (mark === null) return;
          const grade = getOLevelGrade(mark);
          if (isGradeKey(grade)) counts[grade] += 1;
        }
      });
    });
  });

  return counts;
}

export default function GradeSummariesPage() {
  const { classes, catalog, currentAcademicYearId, currentTermId, academicYears } = useSchoolData();
  const [selectedClassIndex, setSelectedClassIndex] = useState(0);

  const safeClassIndex = selectedClassIndex < classes.length ? selectedClassIndex : 0;
  const currentClass = classes[safeClassIndex];

  // Class-based grade breakdown: one combined class total plus a row per stream.
  const breakdown = useMemo(() => {
    if (!currentClass) return null;

    const isALevel = currentClass.level === "A";
    const assessments = (currentClass.assessments ?? []).filter(
      (assessment) =>
        assessment.academicYearId === currentAcademicYearId &&
        assessment.termId === currentTermId
    );

    return {
      isALevel,
      classCounts: tallyGrades(currentClass.streams, assessments, currentClass.level, catalog),
      streams: currentClass.streams.map((stream) => ({
        name: stream.name,
        counts: tallyGrades([stream], assessments, currentClass.level, catalog),
      })),
    };
  }, [currentClass, catalog, currentAcademicYearId, currentTermId]);

  // Subject analysis within the selected class (aggregated across its streams).
  const summary = useMemo(() => {
    if (!currentClass) return { isALevel: false, rows: [] as SummaryRow[] };

    const isALevel = currentClass.level === "A";
    const assessments = (currentClass.assessments ?? []).filter(
      (assessment) =>
        assessment.academicYearId === currentAcademicYearId &&
        assessment.termId === currentTermId
    );

    const subjectNames: string[] = [];
    currentClass.streams.forEach((stream) => {
      (stream.subjects ?? []).forEach((subEntry: SubjectEntry) => {
        if (!subjectNames.includes(subEntry.name)) subjectNames.push(subEntry.name);
      });
    });

    const rows: SummaryRow[] = subjectNames.map((subjectName) => {
      const counts = emptyCounts();
      let markSum = 0;
      let markCount = 0;
      let pointSum = 0;
      let pointCount = 0;

      currentClass.streams.forEach((stream) => {
        const subEntry = (stream.subjects ?? []).find((entry) => entry.name === subjectName);
        if (!subEntry) return;
        (stream.students ?? []).forEach((student) => {
          if (!studentIsEnrolled(student, subEntry, currentClass.level, catalog)) return;
          if (isALevel) {
            const { mark, grade } = computeALevelSubjectResult(assessments, subjectName, student.id);
            if (mark !== null) {
              markSum += mark;
              markCount += 1;
            }
            if (isGradeKey(grade)) counts[grade] += 1;
            if (typeof ALEVEL_SUBJECT_POINTS[grade] === "number") {
              pointSum += ALEVEL_SUBJECT_POINTS[grade];
              pointCount += 1;
            }
          } else {
            const mark = computeOLevelSubjectMark(assessments, subjectName, student.id);
            if (mark === null) return;
            markSum += mark;
            markCount += 1;
            const grade = getOLevelGrade(mark);
            if (isGradeKey(grade)) counts[grade] += 1;
          }
        });
      });

      const meanMark = markCount > 0 ? markSum / markCount : null;
      let meanGrade = "—";
      if (isALevel) {
        if (pointCount > 0) meanGrade = gradeFromPoints(pointSum / pointCount);
      } else if (meanMark !== null) {
        meanGrade = getOLevelGrade(meanMark);
      }

      return { subjectName, counts, meanMark, meanGrade };
    });

    return { isALevel, rows };
  }, [currentClass, catalog, currentAcademicYearId, currentTermId]);

  // Students whose recorded results fall short of their class's expected subject load.
  const incompleteByClass = useMemo(() => {
    return classes
      .map((cls) => {
        const expected = getExpectedSubjectCount(cls.name);
        const assessments = (cls.assessments ?? []).filter(
          (assessment) =>
            assessment.academicYearId === currentAcademicYearId &&
            assessment.termId === currentTermId
        );

        const students: IncompleteStudent[] = [];

        if (expected > 0) {
          cls.streams.forEach((stream) => {
            (stream.students ?? []).forEach((student) => {
              const enrolled = getEnrolledSubjects(stream, student, cls.level, catalog);
              const missingSubjects = enrolled.filter(
                (subjectName) => !subjectHasResult(assessments, subjectName, student.id)
              );
              const recordedCount = enrolled.length - missingSubjects.length;

              if (recordedCount < expected) {
                students.push({
                  id: student.id,
                  studentID: student.studentID,
                  name: [student.firstName, student.secondName, student.otherNames]
                    .filter(Boolean)
                    .join(" "),
                  streamName: stream.name,
                  recordedCount,
                  expected,
                  missingSubjects,
                });
              }
            });
          });
        }

        return { className: cls.name, level: cls.level, expected, students };
      })
      .filter((group) => group.students.length > 0);
  }, [classes, catalog, currentAcademicYearId, currentTermId]);

  // Count of students with incomplete results, per class and per stream.
  const incompleteCountsByClass = useMemo(() => {
    return classes
      .map((cls) => {
        const expected = getExpectedSubjectCount(cls.name);
        const assessments = (cls.assessments ?? []).filter(
          (assessment) =>
            assessment.academicYearId === currentAcademicYearId &&
            assessment.termId === currentTermId
        );

        const streams = cls.streams.map((stream) => {
          const totalStudents = (stream.students ?? []).length;
          let incompleteCount = 0;

          (stream.students ?? []).forEach((student) => {
            const enrolled = getEnrolledSubjects(stream, student, cls.level, catalog);
            const recordedCount = enrolled.filter((subjectName) =>
              subjectHasResult(assessments, subjectName, student.id)
            ).length;
            if (recordedCount < expected) incompleteCount += 1;
          });

          return { name: stream.name, totalStudents, incompleteCount };
        });

        return {
          className: cls.name,
          level: cls.level,
          expected,
          totalStudents: streams.reduce((sum, stream) => sum + stream.totalStudents, 0),
          incompleteCount: streams.reduce((sum, stream) => sum + stream.incompleteCount, 0),
          streams,
        };
      })
      .filter((group) => group.totalStudents > 0);
  }, [classes, catalog, currentAcademicYearId, currentTermId]);

  // Subjects offered in a stream for which no student has any recorded entry.
  const missingEntriesByClass = useMemo(() => {
    return classes
      .map((cls) => {
        const assessments = (cls.assessments ?? []).filter(
          (assessment) =>
            assessment.academicYearId === currentAcademicYearId &&
            assessment.termId === currentTermId
        );

        const streams = cls.streams
          .map((stream) => {
            const subjects = (stream.subjects ?? [])
              .map((subEntry) => {
                const enrolledCount = (stream.students ?? []).filter((student) =>
                  studentIsEnrolled(student, subEntry, cls.level, catalog)
                ).length;
                const hasAnyEntry = (stream.students ?? []).some((student) =>
                  subjectHasResult(assessments, subEntry.name, student.id)
                );
                return { subjectName: subEntry.name, enrolledCount, hasAnyEntry };
              })
              .filter((entry) => !entry.hasAnyEntry)
              .map(({ subjectName, enrolledCount }) => ({ subjectName, enrolledCount }));

            return { name: stream.name, subjects };
          })
          .filter((stream) => stream.subjects.length > 0);

        return { className: cls.name, level: cls.level, streams };
      })
      .filter((group) => group.streams.length > 0);
  }, [classes, catalog, currentAcademicYearId, currentTermId]);

  const breakdownGradeColumns = breakdown?.isALevel ? GRADE_COLUMNS : ["A", "B", "C", "D", "E"];
  const summaryGradeColumns = summary.isALevel ? GRADE_COLUMNS : ["A", "B", "C", "D", "E"];

  const currentYear = Array.isArray(academicYears)
    ? academicYears.find((year) => year.id === currentAcademicYearId)
    : undefined;
  const currentTerm = currentYear?.terms?.find((term) => term.id === currentTermId);
  const yearName = currentYear?.name ?? "";
  const termName = currentTerm?.name ?? "";

  const handleExport = () => {
    if (!currentClass || !breakdown) return;

    const escapeCsv = (value: string | number) => {
      const str = String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const columns: string[] = [...breakdownGradeColumns];
    const lines: string[] = [];

    lines.push("Grade Summaries");
    lines.push([currentClass.name, yearName, termName].map(escapeCsv).join(","));
    lines.push("");

    lines.push("Grade Breakdown");
    lines.push(["Class / Stream", ...columns].map(escapeCsv).join(","));
    lines.push(
      [`${currentClass.name} (All streams)`, ...columns.map((g) => breakdown.classCounts[g as GradeKey])]
        .map(escapeCsv)
        .join(",")
    );
    breakdown.streams.forEach((stream) => {
      lines.push(
        [`Stream ${stream.name}`, ...columns.map((g) => stream.counts[g as GradeKey])]
          .map(escapeCsv)
          .join(",")
      );
    });
    lines.push("");

    lines.push("Subject Analysis");
    lines.push(["Subject", ...columns, "Mean Marks", "Mean Grade"].map(escapeCsv).join(","));
    summary.rows.forEach((row) => {
      lines.push(
        [
          row.subjectName,
          ...columns.map((g) => row.counts[g as GradeKey]),
          row.meanMark === null ? "" : row.meanMark.toFixed(1),
          row.meanGrade,
        ]
          .map(escapeCsv)
          .join(",")
      );
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentClass.name}_grade_summaries_${yearName}_${termName}.csv`.replace(/\s+/g, "_");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportIncomplete = () => {
    const escapeCsv = (value: string | number) => {
      const str = String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const lines: string[] = [];
    lines.push("Students With Incomplete Results");
    lines.push([yearName, termName].map(escapeCsv).join(","));
    lines.push("");
    lines.push(
      ["Class", "Student ID", "Student Name", "Stream", "Results Entered", "Expected", "Missing", "Missing Subjects"]
        .map(escapeCsv)
        .join(",")
    );

    incompleteByClass.forEach((group) => {
      group.students.forEach((student) => {
        lines.push(
          [
            group.className,
            student.studentID,
            student.name,
            student.streamName,
            student.recordedCount,
            student.expected,
            student.expected - student.recordedCount,
            student.missingSubjects.join("; "),
          ]
            .map(escapeCsv)
            .join(",")
        );
      });
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `incomplete_results_${yearName}_${termName}.csv`.replace(/\s+/g, "_");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportIncompleteCounts = () => {
    const escapeCsv = (value: string | number) => {
      const str = String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const lines: string[] = [];
    lines.push("Incomplete Results — Count by Class/Stream");
    lines.push([yearName, termName].map(escapeCsv).join(","));
    lines.push("");
    lines.push(
      ["Class / Stream", "Incomplete Students", "Total Students", "Expected Subjects"]
        .map(escapeCsv)
        .join(",")
    );

    incompleteCountsByClass.forEach((group) => {
      lines.push(
        [
          `${group.className} (All streams)`,
          group.incompleteCount,
          group.totalStudents,
          group.expected,
        ]
          .map(escapeCsv)
          .join(",")
      );
      group.streams.forEach((stream) => {
        lines.push(
          [`Stream ${stream.name}`, stream.incompleteCount, stream.totalStudents, group.expected]
            .map(escapeCsv)
            .join(",")
        );
      });
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `incomplete_counts_${yearName}_${termName}.csv`.replace(/\s+/g, "_");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportMissingEntries = () => {
    const escapeCsv = (value: string | number) => {
      const str = String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const lines: string[] = [];
    lines.push("Subjects With No Entries — By Class/Stream");
    lines.push([yearName, termName].map(escapeCsv).join(","));
    lines.push("");
    lines.push(["Class", "Stream", "Subject", "Enrolled Students"].map(escapeCsv).join(","));

    missingEntriesByClass.forEach((group) => {
      group.streams.forEach((stream) => {
        stream.subjects.forEach((subject) => {
          lines.push(
            [group.className, stream.name, subject.subjectName, subject.enrolledCount]
              .map(escapeCsv)
              .join(",")
          );
        });
      });
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `subjects_no_entries_${yearName}_${termName}.csv`.replace(/\s+/g, "_");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const thStyle: React.CSSProperties = {
    padding: "0.5rem",
    textAlign: "center",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 600,
  };
  const tdStyle: React.CSSProperties = {
    padding: "0.5rem",
    textAlign: "center",
    borderBottom: "1px solid #f3f4f6",
  };

  return (
    <div style={{ padding: "1rem", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          href="/reports-and-analytics"
          style={{ display: "inline-block", marginBottom: "0.5rem", color: "#666", textDecoration: "none" }}
        >
          ← Back to Reports
        </Link>
        <h1 style={{ margin: "0 0 0.25rem 0" }}>Grade Summaries</h1>
        <p style={{ color: "#6b7280", margin: 0 }}>
          Grade distribution and mean performance for the selected academic year and term.
        </p>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <AcademicYearSelector compact />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>Class:</label>
        <select
          value={safeClassIndex}
          onChange={(e) => setSelectedClassIndex(Number(e.target.value))}
          style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid #ddd" }}
        >
          {classes.map((cls, index) => (
            <option key={cls.name} value={index}>
              {cls.name} ({cls.level})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleExport}
          disabled={!currentClass}
          style={{
            marginLeft: "auto",
            padding: "0.5rem 1rem",
            borderRadius: "4px",
            border: "none",
            background: currentClass ? "#2563eb" : "#9ca3af",
            color: "#fff",
            fontWeight: 600,
            cursor: currentClass ? "pointer" : "not-allowed",
          }}
        >
          Export Spreadsheet
        </button>
      </div>

      {!currentClass ? (
        <p style={{ color: "#6b7280" }}>No classes available.</p>
      ) : (
        <>
          {/* 1. Class grade breakdown (class total + one row per stream) */}
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ margin: "0 0 0.5rem 0" }}>Grade Breakdown — {currentClass.name}</h3>
            <p style={{ color: "#6b7280", margin: "0 0 0.75rem 0", fontSize: "0.85rem" }}>
              Each figure counts every subject grade earned by students in the class or stream.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "520px" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: "left" }}>Class / Stream</th>
                    {(breakdownGradeColumns as readonly string[]).map((grade) => (
                      <th key={grade} style={thStyle}>{grade}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: "#eff6ff" }}>
                    <td style={{ ...tdStyle, textAlign: "left", fontWeight: 700 }}>
                      {currentClass.name} (All streams)
                    </td>
                    {(breakdownGradeColumns as readonly string[]).map((grade) => (
                      <td key={grade} style={{ ...tdStyle, fontWeight: 700 }}>
                        {breakdown?.classCounts[grade as GradeKey] ?? 0}
                      </td>
                    ))}
                  </tr>
                  {breakdown?.streams.map((stream) => (
                    <tr key={stream.name}>
                      <td style={{ ...tdStyle, textAlign: "left", paddingLeft: "1.5rem" }}>
                        Stream {stream.name}
                      </td>
                      {(breakdownGradeColumns as readonly string[]).map((grade) => (
                        <td key={grade} style={tdStyle}>
                          {stream.counts[grade as GradeKey]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Subject analysis within the class */}
          <div>
            <h3 style={{ margin: "0 0 0.5rem 0" }}>Subject Analysis — {currentClass.name}</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "620px" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: "left" }}>Subject</th>
                    {(summaryGradeColumns as readonly string[]).map((grade) => (
                      <th key={grade} style={thStyle}>{grade}</th>
                    ))}
                    <th style={thStyle}>Mean Marks</th>
                    <th style={thStyle}>Mean Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={summaryGradeColumns.length + 3}
                        style={{ ...tdStyle, textAlign: "center", color: "#6b7280" }}
                      >
                        No subjects found for this class.
                      </td>
                    </tr>
                  ) : (
                    summary.rows.map((row) => (
                      <tr key={row.subjectName}>
                        <td style={{ ...tdStyle, textAlign: "left", fontWeight: 500 }}>{row.subjectName}</td>
                        {(summaryGradeColumns as readonly string[]).map((grade) => (
                          <td key={grade} style={tdStyle}>
                            {row.counts[grade as GradeKey]}
                          </td>
                        ))}
                        <td style={tdStyle}>
                          {row.meanMark === null ? "—" : `${row.meanMark.toFixed(1)}%`}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{row.meanGrade}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p style={{ color: "#6b7280", marginTop: "0.75rem", fontSize: "0.8rem" }}>
              Mean Grade is derived from the mean marks (O-Level). For A-Level it is the average of
              subject grade points converted back to a letter. Columns &quot;O&quot; and &quot;F&quot; apply to A-Level only.
            </p>
          </div>
        </>
      )}

      {/* 3. Students with incomplete results, organised per class */}
      <div style={{ marginTop: "2.5rem", borderTop: "1px solid #e5e7eb", paddingTop: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <h3 style={{ margin: 0 }}>Incomplete Results — By Class</h3>
          <button
            type="button"
            onClick={handleExportIncomplete}
            disabled={incompleteByClass.length === 0}
            style={{
              marginLeft: "auto",
              padding: "0.5rem 1rem",
              borderRadius: "4px",
              border: "none",
              background: incompleteByClass.length > 0 ? "#2563eb" : "#9ca3af",
              color: "#fff",
              fontWeight: 600,
              cursor: incompleteByClass.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            Export Spreadsheet
          </button>
        </div>
        <p style={{ color: "#6b7280", margin: "0 0 0.75rem 0", fontSize: "0.85rem" }}>
          Students whose recorded subject results fall short of their class&apos;s expected load
          (S.1: 13, S.2: 12, S.3–S.4: 9, S.5–S.6: 3 principal + 2 subsidiary).
        </p>
        {incompleteByClass.length === 0 ? (
          <p style={{ color: "#6b7280" }}>All students have complete results for this term.</p>
        ) : (
          incompleteByClass.map((group) => (
            <div key={group.className} style={{ marginBottom: "1.5rem" }}>
              <h4 style={{ margin: "0 0 0.5rem 0" }}>
                {group.className} — {group.students.length} incomplete (expected {group.expected} subjects)
              </h4>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "720px" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: "left" }}>Student ID</th>
                      <th style={{ ...thStyle, textAlign: "left" }}>Name</th>
                      <th style={thStyle}>Stream</th>
                      <th style={thStyle}>Results Entered</th>
                      <th style={thStyle}>Expected</th>
                      <th style={thStyle}>Missing</th>
                      <th style={{ ...thStyle, textAlign: "left" }}>Missing Subjects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.students.map((student) => (
                      <tr key={student.id}>
                        <td style={{ ...tdStyle, textAlign: "left" }}>{student.studentID}</td>
                        <td style={{ ...tdStyle, textAlign: "left" }}>{student.name}</td>
                        <td style={tdStyle}>{student.streamName}</td>
                        <td style={tdStyle}>{student.recordedCount}</td>
                        <td style={tdStyle}>{student.expected}</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: "#b91c1c" }}>
                          {student.expected - student.recordedCount}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "left" }}>
                          {student.missingSubjects.length > 0 ? student.missingSubjects.join(", ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 4. Count of students with incomplete results, per class/stream */}
      <div style={{ marginTop: "2.5rem", borderTop: "1px solid #e5e7eb", paddingTop: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <h3 style={{ margin: 0 }}>Incomplete Results — Count by Class/Stream</h3>
          <button
            type="button"
            onClick={handleExportIncompleteCounts}
            disabled={incompleteCountsByClass.length === 0}
            style={{
              marginLeft: "auto",
              padding: "0.5rem 1rem",
              borderRadius: "4px",
              border: "none",
              background: incompleteCountsByClass.length > 0 ? "#2563eb" : "#9ca3af",
              color: "#fff",
              fontWeight: 600,
              cursor: incompleteCountsByClass.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            Export Spreadsheet
          </button>
        </div>
        <p style={{ color: "#6b7280", margin: "0 0 0.75rem 0", fontSize: "0.85rem" }}>
          Number of students whose recorded results fall short of the expected subject load.
        </p>
        {incompleteCountsByClass.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No students found for this term.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "560px" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "left" }}>Class / Stream</th>
                  <th style={thStyle}>Incomplete Students</th>
                  <th style={thStyle}>Total Students</th>
                  <th style={thStyle}>Expected Subjects</th>
                </tr>
              </thead>
              <tbody>
                {incompleteCountsByClass.map((group) => (
                  <React.Fragment key={group.className}>
                    <tr style={{ background: "#eff6ff" }}>
                      <td style={{ ...tdStyle, textAlign: "left", fontWeight: 700 }}>
                        {group.className} (All streams)
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{group.incompleteCount}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{group.totalStudents}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{group.expected || "—"}</td>
                    </tr>
                    {group.streams.map((stream) => (
                      <tr key={stream.name}>
                        <td style={{ ...tdStyle, textAlign: "left", paddingLeft: "1.5rem" }}>
                          Stream {stream.name}
                        </td>
                        <td style={tdStyle}>{stream.incompleteCount}</td>
                        <td style={tdStyle}>{stream.totalStudents}</td>
                        <td style={tdStyle}>{group.expected || "—"}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Subjects with no recorded entries, per class/stream */}
      <div style={{ marginTop: "2.5rem", borderTop: "1px solid #e5e7eb", paddingTop: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <h3 style={{ margin: 0 }}>Subjects With No Entries — By Class/Stream</h3>
          <button
            type="button"
            onClick={handleExportMissingEntries}
            disabled={missingEntriesByClass.length === 0}
            style={{
              marginLeft: "auto",
              padding: "0.5rem 1rem",
              borderRadius: "4px",
              border: "none",
              background: missingEntriesByClass.length > 0 ? "#2563eb" : "#9ca3af",
              color: "#fff",
              fontWeight: 600,
              cursor: missingEntriesByClass.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            Export Spreadsheet
          </button>
        </div>
        <p style={{ color: "#6b7280", margin: "0 0 0.75rem 0", fontSize: "0.85rem" }}>
          Subjects offered in a stream that have no recorded score from any student this term.
        </p>
        {missingEntriesByClass.length === 0 ? (
          <p style={{ color: "#6b7280" }}>Every offered subject has at least one recorded entry.</p>
        ) : (
          missingEntriesByClass.map((group) => (
            <div key={group.className} style={{ marginBottom: "1.5rem" }}>
              <h4 style={{ margin: "0 0 0.5rem 0" }}>{group.className}</h4>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "560px" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: "left" }}>Stream</th>
                      <th style={{ ...thStyle, textAlign: "left" }}>Subject</th>
                      <th style={thStyle}>Enrolled Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.streams.flatMap((stream) =>
                      stream.subjects.map((subject) => (
                        <tr key={`${stream.name}-${subject.subjectName}`}>
                          <td style={{ ...tdStyle, textAlign: "left" }}>{stream.name}</td>
                          <td style={{ ...tdStyle, textAlign: "left", fontWeight: 500 }}>
                            {subject.subjectName}
                          </td>
                          <td style={tdStyle}>{subject.enrolledCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
