"use client";

import React, { useCallback, useState, useMemo, useEffect } from "react";
import { Info } from "lucide-react";
import Link from "next/link";
import { useSchoolData } from "../../context/SchoolDataContext";
import { ALEVEL_SUBJECTS_CONFIG, ALEVEL_GRADING_SCALE } from "../../context/alevelConfig";
import AcademicYearSelector from "../../components/AcademicYearSelector";
import { calculateUACESubjectGrade, calculateSubsidiaryGradeFromScores } from '../../utils/alevelGrades';

export default function ALevelReportBuilder() {
  const { classes, teachers, catalog, currentAcademicYearId, currentTermId } = useSchoolData();
  const [selectedClassIndex, setSelectedClassIndex] = useState<number | null>(null);
  const [selectedStreamIndex, setSelectedStreamIndex] = useState<number | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [reportTitle, setReportTitle] = useState("UACE END OF TERM ASSESSMENT REPORT");
  
  // Filter only A-Level classes
  const aLevelClasses = useMemo(() => classes.filter(cls => cls.level === 'A'), [classes]);
  
  const currentClass = selectedClassIndex !== null ? aLevelClasses[selectedClassIndex] : undefined;
  const currentStream = currentClass && selectedStreamIndex !== null ? currentClass.streams?.[selectedStreamIndex] : undefined;
  const students = currentStream?.students ?? [];
  
  const assessments = useMemo(() => {
    return (currentClass?.assessments ?? []).filter((assessment) =>
      assessment.academicYearId === currentAcademicYearId &&
      assessment.termId === currentTermId
    );
  }, [currentClass, currentAcademicYearId, currentTermId]);

  const canGenerate = selectedStudentId !== "" && currentClass && currentStream;
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  function getTeacherInitials(teacherId?: string): string {
    if (!teacherId) return "";
    const teacher = teachers.find((t) => t.id === teacherId);
    return teacher?.initials || "";
  }

  // Compute a single subject's grade, points and paper details for a given student.
  const computeSubjectResult = useCallback((subjectName: string, sid: string) => {
    const config = ALEVEL_SUBJECTS_CONFIG[subjectName];
    const paperGrades: string[] = [];
    const paperScores: Record<string, string> = {};
    const paperDetails: Record<string, { score: string; grade: string }> = {};
    const numericPaperScores: number[] = [];

    if (config) {
      config.papers.forEach(paper => {
        const scores = assessments
          .map(asm => asm.paperScores?.[subjectName]?.[paper]?.[sid])
          .filter((s): s is number => typeof s === 'number');

        if (scores.length > 0) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          const roundedScore = Math.round(avg);
          const paperGrade = ALEVEL_GRADING_SCALE.find(s => roundedScore >= s.min)?.grade || '';
          paperScores[paper] = roundedScore.toString();
          paperDetails[paper] = { score: roundedScore.toString(), grade: paperGrade };
          if (paperGrade) {
            paperGrades.push(paperGrade);
          }
          numericPaperScores.push(roundedScore);
        } else {
          paperScores[paper] = "—";
          paperDetails[paper] = { score: "—", grade: "—" };
        }
      });
    }

    // Subject grade:
    // - Subsidiary: binary O/F from the average of all paper scores (>= 50% -> O).
    // - Principal: A-F via UNEB cross-matching of paper grades.
    let grade = '—';
    let points = 0;
    let comment = 'No data';

    if (config?.type === 'subsidiary') {
      const result = calculateSubsidiaryGradeFromScores(numericPaperScores);
      grade = result.grade;
      points = result.points;
      comment = result.comment;
    } else if (config) {
      const subjectType = (config.papers?.length ?? 0) >= 3 ? 'three-paper' : 'two-paper';
      const result = calculateUACESubjectGrade(paperGrades, subjectType);
      grade = result.grade;
      points = result.points;
      comment = result.comment;
    }

    return {
      grade,
      points,
      comment,
      paperDetails,
      type: config?.type || 'principal',
    };
  }, [assessments]);

  // Generate report rows for selected student using UNEB rules
  const reportRows = useMemo(() => {
    if (!selectedStudentId || !selectedStudent || !currentStream) return [];

    // Only reflect the subjects assigned to this student (max 5 for A-Level).
    const assignedSubjectNames = new Set(selectedStudent.subjects ?? []);
    const subjectsForReport = assignedSubjectNames.size > 0
      ? currentStream.subjects.filter((subEntry) => assignedSubjectNames.has(subEntry.name))
      : currentStream.subjects;

    return subjectsForReport.map((subEntry) => {
      const result = computeSubjectResult(subEntry.name, selectedStudent.id);
      return {
        subject: subEntry.name,
        paperDetails: result.paperDetails,
        grade: result.grade,
        points: result.points,
        comment: result.comment,
        initials: getTeacherInitials(subEntry.teacherId),
        type: result.type,
      };
    });
  }, [selectedStudentId, selectedStudent, currentStream, computeSubjectResult]);

  const totalPoints = reportRows.reduce((sum, row) => sum + row.points, 0);

  // Class summaries: total students, class average points, and the student's position.
  const classSummary = useMemo(() => {
    if (!currentStream || !selectedStudent) return null;

    const students = currentStream.students ?? [];
    const totalStudents = students.length;

    const studentPoints = students.map((s) => {
      const assignedNames = new Set(s.subjects ?? []);
      const subjectsForStudent = assignedNames.size > 0
        ? currentStream.subjects.filter((sub) => assignedNames.has(sub.name))
        : currentStream.subjects;
      const points = subjectsForStudent.reduce((sum, sub) => sum + computeSubjectResult(sub.name, s.id).points, 0);
      return { id: s.id, points };
    });

    const classAverage = totalStudents > 0
      ? studentPoints.reduce((sum, sp) => sum + sp.points, 0) / totalStudents
      : 0;

    // Position by total points (descending). Ties share the same position.
    const sorted = [...studentPoints].sort((a, b) => b.points - a.points);
    let position = 0;
    let prevPoints: number | null = null;
    for (let i = 0; i < sorted.length; i++) {
      if (prevPoints === null || sorted[i].points !== prevPoints) {
        position = i + 1;
        prevPoints = sorted[i].points;
      }
      if (sorted[i].id === selectedStudent.id) break;
    }

    return { totalStudents, classAverage, position };
  }, [currentStream, selectedStudent, computeSubjectResult]);

  const handleGeneratePDF = () => {
    if (!canGenerate) return;
    
    const actualClassIndex = classes.findIndex(c => c.name === currentClass.name);
    
    const params = new URLSearchParams({
      classIndex: String(actualClassIndex),
      streamIndex: String(selectedStreamIndex),
      studentId: selectedStudentId,
      title: reportTitle,
      academicYearId: currentAcademicYearId,
      termId: currentTermId,
    });
    window.open(`/reports-and-analytics/report-builder-alevel/pdf?${params}`, "_blank");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold">A-Level Report Builder</h1>
        <Link href="/reports-and-analytics" className="text-blue-600 hover:underline">Back to Dashboard</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Report Title</label>
              <input
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full border p-2 rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Academic year and term</label>
              <AcademicYearSelector />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Class</label>
              <select
                value={selectedClassIndex ?? ""}
                onChange={(e) => {
                  setSelectedClassIndex(e.target.value === "" ? null : Number(e.target.value));
                  setSelectedStreamIndex(0);
                  setSelectedStudentId("");
                }}
                className="w-full border p-2 rounded"
              >
                <option value="">-- Select Class --</option>
                {aLevelClasses.map((cls, idx) => (
                  <option key={idx} value={idx}>{cls.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Stream</label>
              <select
                value={selectedStreamIndex ?? ""}
                onChange={(e) => {
                  setSelectedStreamIndex(Number(e.target.value));
                  setSelectedStudentId("");
                }}
                className="w-full border p-2 rounded"
                disabled={selectedClassIndex === null}
              >
                {currentClass?.streams.map((s, idx) => (
                  <option key={idx} value={idx}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Student</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full border p-2 rounded"
                disabled={!currentStream}
              >
                <option value="">-- Select Student --</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.secondName} ({s.studentID})</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGeneratePDF}
              disabled={!canGenerate}
              className="w-full bg-blue-600 text-white p-3 rounded font-bold disabled:bg-gray-400 mt-4"
            >
              Generate A-Level Report
            </button>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Preview: {selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.secondName}` : 'Select a student'}</h2>
          
          {selectedStudent ? (
            <div className="border rounded overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-3 border">Subject</th>
                    <th className="p-3 border">Papers</th>
                    <th className="p-3 border">Grade</th>
                    <th className="p-3 border">Points</th>
                    <th className="p-3 border">Comment</th>
                    <th className="p-3 border">Initials</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="p-3 border font-medium">{row.subject}</td>
                      <td className="p-3 border">
                        <div className="flex flex-col gap-1 text-xs">
                          {Object.entries(row.paperDetails).map(([paper, data]) => (
                            <div key={paper} className="flex gap-2 items-center">
                              <span className="font-medium">{paper}:</span>
                              <span>{data.score}</span>
                              <span className="text-gray-500">({data.grade})</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 border font-bold text-center">{row.grade}</td>
                      <td className="p-3 border text-center">{row.points}</td>
                      <td className="p-3 border text-sm text-gray-600">{row.comment}</td>
                      <td className="p-3 border text-center text-gray-500">{row.initials}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 font-bold">
                    <td colSpan={3} className="p-3 border text-right">Total Aggregate Points:</td>
                    <td className="p-3 border text-center text-blue-700">{totalPoints}</td>
                    <td className="p-3 border"></td>
                    <td className="p-3 border"></td>
                  </tr>
                </tbody>
              </table>

              {classSummary && (
                <div className="p-3 border-t bg-gray-50 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span><strong>Students in stream:</strong> {classSummary.totalStudents}</span>
                  <span><strong>Class average (points):</strong> {classSummary.classAverage.toFixed(1)}</span>
                  <span><strong>Position:</strong> {classSummary.position} of {classSummary.totalStudents}</span>
                </div>
              )}

              <div className="p-4 bg-yellow-50 text-sm text-yellow-800 border-t">
                <strong>Grade Key:</strong>
                <span className="ml-2">A=6, B=5, C=4, D=3, E=2, O=1 (Pass), F=0 (Fail)</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Info size={48} className="mb-2" />
              <p>Select a student to see the report preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}