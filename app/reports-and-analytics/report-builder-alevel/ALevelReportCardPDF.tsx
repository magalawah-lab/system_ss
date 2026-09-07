"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSchoolData } from "../../context/SchoolDataContext";
import { ALEVEL_SUBJECTS_CONFIG, ALEVEL_GRADING_SCALE } from "../../context/alevelConfig";
import { calculateUACESubjectGrade, calculateSubsidiaryGradeFromScores } from '../../utils/alevelGrades';


export default function ALevelReportCardPDF() {
  const [isHydrated, setIsHydrated] = useState(false);
  const search = useSearchParams();
  const classIndex = Number(search.get("classIndex")) || 0;
  const streamIndex = Number(search.get("streamIndex")) || 0;
  const studentId = search.get("studentId") || "";
  const title = search.get("title") || "UACE END OF TERM ASSESSMENT REPORT";
  const { classes, teachers, currentAcademicYearId, currentTermId, academicYears } = useSchoolData();
  const selectedAcademicYearId = search.get("academicYearId") || currentAcademicYearId;
  const selectedTermId = search.get("termId") || currentTermId;
  const cls = classes[classIndex];
  const stream = cls?.streams?.[streamIndex];
  const student = stream?.students?.find((s) => s.id === studentId) ?? null;
  const selectedYear = academicYears.find((year) => year.id === selectedAcademicYearId);
  const selectedTerm = selectedYear?.terms.find((term) => term.id === selectedTermId);

  const assessments = useMemo(() => {
    return (cls?.assessments ?? []).filter((assessment) =>
      assessment.academicYearId === selectedAcademicYearId &&
      assessment.termId === selectedTermId
    );
  }, [cls, selectedAcademicYearId, selectedTermId]);

  useEffect(() => {
    setIsHydrated(true);
    const t = setTimeout(() => {
      window.print();
    }, 1000);
    return () => clearTimeout(t);
  }, []);

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
          // Paper grade uses the same D1-F9 scale for principal and subsidiary.
          const paperGrade = ALEVEL_GRADING_SCALE.find(s => roundedScore >= s.min)?.grade || '';
          paperScores[paper] = roundedScore.toString();
          paperDetails[paper] = { score: roundedScore.toString(), grade: paperGrade };
          if (paperGrade) {
            paperGrades.push(paperGrade);
          }
          numericPaperScores.push(roundedScore);
        } else {
          paperScores[paper] = '—';
          paperDetails[paper] = { score: '—', grade: '—' };
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
      hasPapers: config ? config.papers.length > 0 : false,
    };
  }, [assessments]);

  // Calculate report rows for each subject with paper details
  const reportRows = useMemo(() => {
    if (!student || !stream) return [];

    // Only reflect the subjects assigned to this student (max 5 for A-Level).
    const assignedSubjectNames = new Set(student.subjects ?? []);
    const subjectsForReport = assignedSubjectNames.size > 0
      ? stream.subjects.filter((subEntry) => assignedSubjectNames.has(subEntry.name))
      : stream.subjects;

    return subjectsForReport.map((subEntry) => {
      const result = computeSubjectResult(subEntry.name, student.id);
      return {
        subject: subEntry.name,
        paperDetails: result.paperDetails,
        grade: result.grade,
        points: result.points,
        initials: getTeacherInitials(subEntry.teacherId),
        subjectComment: result.comment,
        type: result.type,
        hasPapers: result.hasPapers,
      };
    });
  }, [stream, student, computeSubjectResult]);

  const totalPoints = reportRows.reduce((sum, row) => sum + row.points, 0);

  // Class summaries: total students, class average points, and the student's position.
  const classSummary = useMemo(() => {
    if (!stream || !student) return null;

    const students = stream.students ?? [];
    const totalStudents = students.length;

    const studentPoints = students.map((s) => {
      const assignedNames = new Set(s.subjects ?? []);
      const subjectsForStudent = assignedNames.size > 0
        ? stream.subjects.filter((sub) => assignedNames.has(sub.name))
        : stream.subjects;
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
      if (sorted[i].id === student.id) break;
    }

    return { totalStudents, classAverage, position };
  }, [stream, student, computeSubjectResult]);

  // Auto-generate comments based on points
  let classTeacherComment = '';
  let headTeacherComment = '';

  const hasGrades = reportRows.some(row => row.grade && row.grade !== '—');

  if (!hasGrades || reportRows.length === 0) {
    classTeacherComment = 'No assessment data available. Please ensure all scores are entered.';
    headTeacherComment = 'No assessment data available. Please ensure all scores are entered.';
  } else {
    classTeacherComment = totalPoints >= 15 ? 'Excellent performance. Keep it up.' :
      totalPoints >= 10 ? 'Good work, but aim higher in the next term.' :
        totalPoints >= 5 ? 'Fair performance. More effort is needed.' :
          'Poor results. Urgent improvement required.';

    headTeacherComment = totalPoints >= 15 ? 'A very promising candidate. Maintain the standard.' :
      totalPoints >= 10 ? 'Steady progress. Keep focused on your goals.' :
        totalPoints >= 5 ? 'Hard work is required for better grades.' :
          'Urgent parental meeting required to discuss performance.';
  }

  if (!isHydrated || !cls || !stream || !student) {
    return <div className="p-8 text-center">Report data not found.</div>;
  }

  // Get all paper names for column headers
  const allPaperNames = new Set<string>();
  reportRows.forEach(row => {
    Object.keys(row.paperDetails).forEach(paper => allPaperNames.add(paper));
  });
  const paperColumns = Array.from(allPaperNames).sort();

  return (
    <div className="print-container">
      {/* Header */}
      <div className="header">
        <div className="logo-box"><img src="/BSS.jpg" alt="BSS Logo" className="report-logo" /></div>
        <div className="school-info">
          <h1>BUSAANA SECONDARY SCHOOL</h1>
          <p className="contact-info">Email: busaanass2016@gmail.com</p>
          <p className="contact-info">Contacts: +256(0)703877122</p>
          <p className="motto">Education is the Key to Success</p>
        </div>
      </div>

      <div className="report-title">
        <h2>{title}</h2>
        <p className="report-subtitle">{selectedTerm?.name || "Selected term"}, {selectedYear?.name || "Selected year"}</p>
      </div>

      {/* Student Details */}
      <div className="student-details">
        <div className="detail-item">
          <span className="label">NAME:</span>
          <span className="value">{student.firstName} {student.secondName}</span>
        </div>
        <div className="detail-item">
          <span className="label">CLASS:</span>
          <span className="value">{cls.name} {stream.name}</span>
        </div>
        <div className="detail-item">
          <span className="label">ID:</span>
          <span className="value">{student.studentID}</span>
        </div>
      </div>

      {/* Marks Table - Vertical Layout with RowSpan */}
      <table className="marks-table">
        <thead>
          <tr>
            <th className="col-subject">SUBJECT</th>
            <th className="col-paper">PAPER</th>
            <th className="col-marks">MARKS</th>
            <th className="col-paper-grade">PAPER GRADE</th>
            <th className="col-subject-grade">SUBJECT GRADE</th>
            <th className="col-comment">COMMENT</th>
            <th className="col-initials">INITIALS</th>
          </tr>
        </thead>
        <tbody>
          {reportRows.map((row, rowIdx) => {
            const paperEntries = Object.entries(row.paperDetails);
            const rowSpan = Math.max(paperEntries.length, 1);

            return paperEntries.map(([paper, data], paperIdx) => {
              // Only show subject name and grade on the first paper row
              const showSubject = paperIdx === 0;
              const showSubjectGrade = paperIdx === 0;
              const showComment = paperIdx === 0;
              const showInitials = paperIdx === 0;

              return (
                <tr key={`${row.subject}-${paper}`}>
                  {showSubject && (
                    <td className="cell-subject" rowSpan={rowSpan}>
                      {row.subject}
                    </td>
                  )}
                  <td className="cell-paper-name">{paper}</td>
                  <td className="cell-marks">{data.score}</td>
                  <td className="cell-paper-grade">{data.grade}</td>
                  {showSubjectGrade && (
                    <td className="cell-subject-grade" rowSpan={rowSpan}>
                      {row.grade}
                    </td>
                  )}
                  {showComment && (
                    <td className="cell-comment" rowSpan={rowSpan}>
                      {row.subjectComment}
                    </td>
                  )}
                  {showInitials && (
                    <td className="cell-initials" rowSpan={rowSpan}>
                      {row.initials}
                    </td>
                  )}
                </tr>
              );
            });
          })}
          {/* Total Points Row */}
          <tr className="total-row">
            <td colSpan={4} className="text-right font-bold">TOTAL AGGREGATE POINTS:</td>
            <td className="cell-center font-bold">{totalPoints}</td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>

      {/* Class Summary */}
      {classSummary && (
        <div className="class-summary">
          <div className="summary-item">
            <span className="summary-label">Total Students in Stream:</span>
            <span className="summary-value">{classSummary.totalStudents}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Class Average (Points):</span>
            <span className="summary-value">{classSummary.classAverage.toFixed(1)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Position in Class:</span>
            <span className="summary-value">{classSummary.position} of {classSummary.totalStudents}</span>
          </div>
        </div>
      )}

      {/* Grading Scale */}
      <div className="grading-scale">
        <div className="scale-title">GRADING SCALE</div>
        <div className="scale-grid">
          <div className="scale-item"><span className="scale-grade">D1</span><span className="scale-range">85 - 100</span></div>
          <div className="scale-item"><span className="scale-grade">D2</span><span className="scale-range">75 - 84</span></div>
          <div className="scale-item"><span className="scale-grade">C3</span><span className="scale-range">70 - 74</span></div>
          <div className="scale-item"><span className="scale-grade">C4</span><span className="scale-range">60 - 69</span></div>
          <div className="scale-item"><span className="scale-grade">C5</span><span className="scale-range">50 - 59</span></div>
          <div className="scale-item"><span className="scale-grade">C6</span><span className="scale-range">40 - 49</span></div>
          <div className="scale-item"><span className="scale-grade">P7</span><span className="scale-range">35 - 39</span></div>
          <div className="scale-item"><span className="scale-grade">P8</span><span className="scale-range">31 - 34</span></div>
          <div className="scale-item"><span className="scale-grade">F9</span><span className="scale-range">0 - 30</span></div>
        </div>
        <div className="scale-note">* Principal subjects use D1-F9 scale. Subsidiary subjects use D1-F9 scale.</div>
      </div>

      {/* Comments Section */}
      <div className="comments-section">
        <div className="comment-box">
          <div className="comment-title">Class Teacher's Comment:</div>
          <div className="comment-text">{classTeacherComment}</div>
          <div className="signature-area">
            <div className="signature-line"><span>Signature:</span><span className="dots">................................</span></div>
            <div className="signature-line"><span>Date:</span><span className="dots">................................</span></div>
          </div>
        </div>

        <div className="comment-box">
          <div className="comment-title">Head Teacher's Comment:</div>
          <div className="comment-text">{headTeacherComment}</div>
          <div className="signature-area">
            <div className="signature-line"><span>Signature:</span><span className="dots">................................</span></div>
            <div className="signature-line"><span>Date:</span><span className="dots">................................</span></div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .print-container {
          max-width: 210mm;
          margin: 0 auto;
          padding: 8mm;
          font-family: "Arial", sans-serif;
          color: #000;
          background: #fff;
          line-height: 1.3;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          margin-bottom: 6px;
          padding-bottom: 6px;
          border-bottom: 2px solid #000;
        }
        .logo-box {
          position: absolute;
          left: 0;
          width: 65px;
          height: 65px;
          border: 1px solid #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .report-logo {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .school-info {
          text-align: center;
        }
        .school-info h1 {
          font-size: 22px;
          font-weight: 800;
          margin: 0;
        }
        .contact-info {
          font-size: 10px;
          margin: 1px 0;
        }
        .motto {
          font-size: 11px;
          font-weight: 600;
          font-style: italic;
        }
        .report-title {
          text-align: center;
          margin: 10px 0;
        }
        .report-title h2 {
          font-size: 16px;
          font-weight: 800;
          margin: 0;
          text-decoration: underline;
        }
        .report-subtitle {
          font-size: 11px;
          margin: 2px 0 0 0;
        }
        .student-details {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 12px;
          padding: 8px 12px;
          border: 1px solid #000;
        }
        .label { font-weight: bold; margin-right: 6px; }
        .value { font-weight: 500; }
        
        .marks-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
          margin-bottom: 10px;
        }
        .marks-table th, .marks-table td {
          border: 1px solid #000;
          padding: 4px 6px;
          text-align: center;
        }
        .marks-table th {
          background: #eee;
          font-weight: bold;
          font-size: 9px;
          text-transform: uppercase;
        }
        .col-subject { width: 16%; }
        .col-paper { width: 10%; }
        .col-marks { width: 10%; }
        .col-paper-grade { width: 14%; }
        .col-subject-grade { width: 12%; }
        .col-comment { width: 25%; }
        .col-initials { width: 8%; }
        
        .cell-subject { 
          font-weight: bold; 
          text-align: left;
          padding-left: 8px;
          font-size: 10px;
          vertical-align: middle;
        }
        .cell-paper-name {
          font-weight: 600;
          font-size: 10px;
          text-align: center;
        }
        .cell-marks { 
          font-weight: 600;
          font-size: 10px;
          text-align: center;
        }
        .cell-paper-grade {
          font-weight: 600;
          font-size: 10px;
          text-align: center;
        }
        .cell-subject-grade {
          font-weight: 700;
          font-size: 12px;
          text-align: center;
          vertical-align: middle;
        }
        .cell-comment {
          font-size: 9px;
          text-align: left;
          padding-left: 8px;
          vertical-align: middle;
          font-style: italic;
        }
        .cell-initials {
          font-size: 9px;
          text-align: center;
          vertical-align: middle;
          font-weight: 600;
        }
        .total-row {
          background: #f9f9f9;
          font-weight: bold;
        }
        .total-row td {
          padding: 6px 4px;
        }
        .font-bold { font-weight: bold; }
        .text-right { text-align: right; }
        .cell-center { text-align: center; }

        .class-summary {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin: 10px 0;
          padding: 8px 12px;
          border: 1px solid #000;
          font-size: 11px;
          background: #fafafa;
        }
        .summary-item {
          display: flex;
          gap: 6px;
          align-items: baseline;
        }
        .summary-label {
          font-weight: bold;
        }
        .summary-value {
          font-weight: 700;
        }

        .grading-scale {
          margin: 10px 0;
          padding: 8px;
          border: 1px solid #000;
        }
        .scale-title {
          font-weight: bold;
          font-size: 11px;
          text-align: center;
          margin-bottom: 6px;
          text-decoration: underline;
        }
        .scale-grid {
          display: grid;
          grid-template-columns: repeat(9, 1fr);
          gap: 2px;
        }
        .scale-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2px 0;
          border-right: 1px solid #ccc;
        }
        .scale-item:last-child {
          border-right: none;
        }
        .scale-grade {
          font-weight: bold;
          font-size: 10px;
        }
        .scale-range {
          font-size: 8px;
          color: #555;
        }
        .scale-note {
          font-size: 8px;
          font-style: italic;
          margin-top: 4px;
          text-align: center;
          color: #555;
        }
        
        .comments-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 10px;
        }
        .comment-box {
          border: 1px solid #000;
          padding: 8px 10px;
        }
        .comment-title {
          font-weight: bold;
          font-size: 11px;
          margin-bottom: 4px;
          text-decoration: underline;
        }
        .comment-text {
          min-height: 35px;
          font-size: 10px;
          font-style: italic;
          padding: 4px 0;
        }
        .signature-area {
          margin-top: 8px;
        }
        .signature-line {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          margin-top: 3px;
        }
        .dots {
          border-bottom: 1px dotted #000;
          flex: 1;
          margin-left: 5px;
        }
        
        @media print {
          body { margin: 0; padding: 0; }
          .print-container { padding: 6mm; }
          .no-print { display: none !important; }
        }
        
        @media (max-width: 768px) {
          .print-container { padding: 4mm; }
          .school-info h1 { font-size: 18px; }
          .marks-table { font-size: 8px; }
          .marks-table th { font-size: 7px; }
          .cell-subject { font-size: 8px; }
          .comments-section { grid-template-columns: 1fr; }
          .scale-grid { grid-template-columns: repeat(9, 1fr); }
          .scale-grade { font-size: 8px; }
          .scale-range { font-size: 6px; }
        }
      `}</style>
    </div>
  );
}