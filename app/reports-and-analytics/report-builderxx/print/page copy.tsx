"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSchoolData } from "../../../context/SchoolDataContext";

export default function PrintAllReportCardsPage() {
  const [isHydrated, setIsHydrated] = useState(false);
  const search = useSearchParams();
  const classIndex = Number(search.get("classIndex")) || 0;
  const streamIndex = Number(search.get("streamIndex")) || 0;
  const term = Number(search.get("term")) || 2;

  const { classes, teachers, catalog, currentAcademicYearId, currentTermId } = useSchoolData();

  const cls = classes[classIndex];
  const stream = cls?.streams?.[streamIndex];
  const students = stream?.students ?? [];
  const selectedAcademicYearId = search.get("academicYearId") || currentAcademicYearId;
  const selectedTermId = search.get("termId") || currentTermId;
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
    }, 500);
    return () => clearTimeout(t);
  }, []);

  // Grading scale based on 100% mark
  function getGrade(mark: number | null): string {
    if (mark === null || mark === undefined) return "—";
    if (mark >= 80) return "A";
    if (mark >= 60) return "B";
    if (mark >= 40) return "C";
    if (mark >= 20) return "D";
    return "E";
  }

  // Comments based on grade
  function getComment(grade: string): string {
    const gradeComments: Record<string, string> = {
      A: "Excellent performance. Outstanding achievement.",
      B: "Good performance. Well done.",
      C: "Satisfactory performance. Keep up the good work.",
      D: "Fair performance. Needs improvement.",
      E: "Poor performance. Requires immediate attention.",
      "—": "",
    };
    return gradeComments[grade] || "";
  }

  function getTeacherInitials(teacherId?: string): string {
    if (!teacherId) return "";
    const teacher = teachers.find((t) => t.id === teacherId);
    return teacher?.initials || "";
  }

  // Find Activity of Integration assessments (scores between 0.9 and 3)
  const activityAssessments = useMemo(() => {
    return assessments.filter(
      (a) => a.maxScore !== undefined && a.maxScore !== null && a.maxScore >= 0.9 && a.maxScore <= 3
    );
  }, [assessments]);

  const c1Assessment = useMemo(() => activityAssessments[0], [activityAssessments]);
  const c2Assessment = useMemo(() => activityAssessments[1], [activityAssessments]);

  // Find End of Cycle assessment (maxScore <= 80, typically 80)
  const endOfCycleAssessment = useMemo(() => {
    return assessments.find((a) => a.maxScore !== undefined && a.maxScore !== null && a.maxScore <= 80 && a.maxScore > 3);
  }, [assessments]);

  // Function to get filtered subjects for a student (compulsory + student's optional)
  const getStudentSubjects = (student: any) => {
    return (stream?.subjects ?? []).filter((subEntry: any) => {
      const subjectName = typeof subEntry === "string" ? subEntry : subEntry.name;
      const isCompulsory = catalog[subjectName] !== "optional";
      const isStudentOptional = student.optionalSubjects?.includes(subjectName);
      return isCompulsory || isStudentOptional;
    });
  };

  // Function to generate report rows for a student
  const generateReportRows = (student: any) => {
    const studentSubjects = getStudentSubjects(student);
    return studentSubjects.map((subEntry) => {
      const subjectName = typeof subEntry === "string" ? subEntry : subEntry.name;
      const teacherId = typeof subEntry === "string" ? undefined : subEntry.teacherId;
      const initials = getTeacherInitials(teacherId);

      const c1Score =
        c1Assessment?.subjectScores?.[subjectName]?.[student.id] ??
        c1Assessment?.scores?.[student.id];
      const c2Score =
        c2Assessment?.subjectScores?.[subjectName]?.[student.id] ??
        c2Assessment?.scores?.[student.id];
      const endOfCycleScore =
        endOfCycleAssessment?.subjectScores?.[subjectName]?.[student.id] ??
        endOfCycleAssessment?.scores?.[student.id];

      // Calculate 20% column
      // Formula: If only C1: (C1/3)*20, If C1 and C2: ((average(C1,C2))/3)*20
      let twentyPercentValue: number | null = null;
      const c1Present = typeof c1Score === "number";
      const c2Present = typeof c2Score === "number";

      if (c1Present && c2Present) {
        // Both C1 and C2: use average
        const average = (c1Score + c2Score) / 2;
        twentyPercentValue = (average / 3) * 20;
      } else if (c1Present) {
        // Only C1: use C1 directly
        twentyPercentValue = (c1Score / 3) * 20;
      } else if (c2Present) {
        // Only C2: use C2 directly
        twentyPercentValue = (c2Score / 3) * 20;
      }

      // End of Cycle column (mapped to 80%)
      const endOfCycleValue =
        typeof endOfCycleScore === "number" ? endOfCycleScore : null;

      let hundredPercentValue: number | null = null;
      if (twentyPercentValue !== null || endOfCycleValue !== null) {
        hundredPercentValue = (twentyPercentValue || 0) + (endOfCycleValue || 0);
      }

      const grade = getGrade(hundredPercentValue);
      const comment = getComment(grade);

      return {
        subject: subjectName,
        c1: typeof c1Score === "number" ? c1Score.toFixed(1) : "",
        c2: typeof c2Score === "number" ? c2Score.toFixed(1) : "",
        twenty:
          twentyPercentValue !== null ? Math.round(twentyPercentValue) : "",
        eighty:
          endOfCycleValue !== null
            ? Math.round(endOfCycleValue)
            : "",
        hundred:
          hundredPercentValue !== null
            ? Math.round(hundredPercentValue)
            : "",
        grade,
        comment,
        initials,
      };
    });
  };

  if (!cls || !stream) {
    return <div className="p-8 text-center">Report data not found.</div>;
  }

  const year = new Date().getFullYear();

  return (
    <div className="print-all-container">
      {isHydrated && students.map((student, studentIdx) => {
        const reportRows = generateReportRows(student);
        const overallGrades = reportRows
          .map((r) => r.hundred)
          .filter((h) => h !== "");
        const overallPercentage =
          overallGrades.length > 0
            ? (overallGrades.reduce((a, b) => (a as any) + (b as any), 0) as number) /
              overallGrades.length
            : null;
        const overallGrade = getGrade(overallPercentage as any);

        // Auto-generate comments based on overall grade
        let classTeacherComment = '';
        let headTeacherComment = '';
        
        if (overallGrade === '—' || overallGrade === null) {
          // No grades recorded
          classTeacherComment = 'No assessment data available. Please ensure all scores are entered.';
          headTeacherComment = 'No assessment data available. Please ensure all scores are entered.';
        } else {
          classTeacherComment = overallGrade === 'A' ? 'Excellent overall performance. Continue working hard and maintain high standards.' :
            overallGrade === 'B' ? 'Good work this term. Aim for consistency across all subjects.' :
            overallGrade === 'C' ? 'Satisfactory results. Focus on weaker areas for improvement.' :
            overallGrade === 'D' ? 'Fair performance. Significant improvement needed, especially in core subjects.' :
            'Poor results. Immediate intervention required. See class teacher for study plan.';

          headTeacherComment = overallGrade === 'A' ? 'Outstanding student. Exemplary conduct and academic excellence.' :
            overallGrade === 'B' ? 'Well done. Good student and consistent performer.' :
            overallGrade === 'C' ? 'Average performance. Room for improvement with better effort.' :
            overallGrade === 'D' ? 'Below expectations. Parents to meet with class teacher.' :
            'Unsatisfactory. Urgent parental meeting required.';
        }

        return (
          <div key={student.id} className="report-page">
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

            {/* Report Title */}
            <div className="report-title">
              <h2>END OF TERM ASSESSMENT REPORT</h2>
              <p className="report-subtitle">{year}</p>
            </div>

            {/* Student Details */}
            <div className="student-details">
              <div className="detail-item">
                <span className="label">NAME:</span>
                <span className="value">
                  {student.firstName} {student.secondName}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">CLASS:</span>
                <span className="value">
                  {cls.name} {stream.name}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">TERM:</span>
                <span className="value">TERM {term}, {year}</span>
              </div>
            </div>

            {/* Marks Table */}
            <table className="marks-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="col-subject">
                    SUBJECT
                  </th>
                  <th colSpan={2} className="col-tests">
                    TEST SCORES
                  </th>
                  <th rowSpan={2} className="col-20">
                    20%
                  </th>
                  <th rowSpan={2} className="col-80">
                    80%
                  </th>
                  <th rowSpan={2} className="col-100">
                    100%
                  </th>
                  <th rowSpan={2} className="col-grade">
                    GRADE
                  </th>
                  <th rowSpan={2} className="col-comments">
                    COMMENTS
                  </th>
                  <th rowSpan={2} className="col-initials">
                    T. INITIALS
                  </th>
                </tr>
                <tr>
                  <th className="col-c1">C1</th>
                  <th className="col-c2">C2</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="cell-subject">{row.subject}</td>
                    <td className="cell-center">{row.c1}</td>
                    <td className="cell-center">{row.c2}</td>
                    <td className="cell-center">{row.twenty}</td>
                    <td className="cell-center">{row.eighty}</td>
                    <td className="cell-center">{row.hundred}</td>
                    <td className="cell-center">{row.grade}</td>
                    <td className="cell-comment">{row.comment}</td>
                    <td className="cell-center">{row.initials}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary Section */}
            <div className="summary-section">
              <div className="overall-performance">
                <span className="label">OVERALL PERFORMANCE:</span>
                <span className="value">
                  {overallPercentage !== null
                    ? `${Math.round(overallPercentage)}% - Grade ${overallGrade}`
                    : "No grades recorded"}
                </span>
              </div>
            </div>

            {/* Comments Section */}
            <div className="comments-section">
              <div className="comment-box">
                <div className="comment-title">Class Teacher's Comment:</div>
                <div className="comment-text">{classTeacherComment}</div>
                <div className="signature-area">
                  <div className="signature-line">
                    <span>Signature:</span>
                    <span className="dots"></span>
                  </div>
                  <div className="signature-line">
                    <span>Date:</span>
                    <span className="dots"></span>
                  </div>
                </div>
              </div>

              <div className="comment-box">
                <div className="comment-title">Head Teacher's Comment:</div>
                <div className="comment-text">{headTeacherComment}</div>
                <div className="signature-area">
                  <div className="signature-line">
                    <span>Signature:</span>
                    <span className="dots"></span>
                  </div>
                  <div className="signature-line">
                    <span>Date:</span>
                    <span className="dots"></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer with Next Term Dates */}
            <div className="report-footer">
              <p><strong>Next Term Begins:</strong>September 14, 2026 — December 4, 2026</p>
            </div>

            {/* Page Break */}
            {studentIdx < students.length - 1 && <div className="page-break"></div>}
          </div>
        );
      })}

      <style jsx>{`
        .print-all-container {
          font-family: "Arial", sans-serif;
          color: #000;
          background: #fff;
          line-height: 1.3;
        }

        .report-page {
          max-width: 210mm;
          margin: 0 auto;
          padding: 10mm;
          page-break-after: always;
        }

        .page-break {
          page-break-after: always;
          height: 0;
        }

        /* Header Styles */
        .header {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 2px solid #000;
        }

        .logo-box {
          position: absolute;
          left: 0;
          width: 60px;
          height: 60px;
          border: 2px solid #000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
        }

        .report-logo {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .school-info {
          text-align: center;
          margin-left: 40px;
          margin-right: 40px;
        }

        .school-info h1 {
          font-size: 20px;
          font-weight: 800;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .contact-info {
          font-size: 11px;
          margin: 2px 0;
        }

        .motto {
          font-size: 12px;
          font-weight: 600;
          font-style: italic;
          margin-top: 4px;
          margin-bottom: 0;
        }

        /* Report Title */
        .report-title {
          text-align: center;
          margin-bottom: 12px;
        }

        .report-title h2 {
          font-size: 16px;
          font-weight: 800;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .report-subtitle {
          font-size: 12px;
          margin: 4px 0 0 0;
          font-weight: 600;
        }

        /* Student Details */
        .student-details {
          display: flex;
          justify-content: space-around;
          margin-bottom: 14px;
          font-size: 12px;
          padding: 8px;
          background: #f9f9f9;
          border: 1px solid #ddd;
        }

        .detail-item {
          display: flex;
          gap: 6px;
        }

        .detail-item .label {
          font-weight: bold;
          min-width: 50px;
        }

        .detail-item .value {
          flex: 1;
        }

        /* Marks Table */
        .marks-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          margin-bottom: 12px;
        }

        .marks-table th,
        .marks-table td {
          border: 1px solid #000;
          padding: 6px 4px;
          text-align: center;
        }

        .marks-table th {
          background-color: #e0e0e0;
          font-weight: bold;
          color: #000;
        }

        .marks-table td {
          height: 24px;
        }

        .col-subject {
          width: 18%;
        }
        .col-tests {
          width: 8%;
        }
        .col-c1,
        .col-c2 {
          width: 4%;
        }
        .col-20 {
          width: 8%;
        }
        .col-80 {
          width: 8%;
        }
        .col-100 {
          width: 8%;
        }
        .col-grade {
          width: 6%;
        }
        .col-comments {
          width: 22%;
        }
        .col-initials {
          width: 10%;
        }

        .cell-subject {
          text-align: left !important;
          font-weight: 500;
        }

        .cell-center {
          text-align: center;
        }

        .cell-comment {
          text-align: left;
          font-size: 10px;
        }

        /* Summary Section */
        .summary-section {
          background: #f9f9f9;
          border: 1px solid #ddd;
          padding: 8px;
          margin-bottom: 12px;
          font-size: 12px;
        }

        .overall-performance {
          display: flex;
          gap: 10px;
        }

        .overall-performance .label {
          font-weight: bold;
          min-width: 150px;
        }

        /* Comments Section */
        .comments-section {
          margin-top: 16px;
        }

        .comment-box {
          margin-bottom: 20px;
          border: 1px solid #999;
          padding: 8px;
        }

        .comment-title {
          font-weight: bold;
          font-size: 12px;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .comment-text {
          min-height: 30px;
          margin-bottom: 8px;
          font-size: 11px;
          line-height: 1.4;
        }

        .signature-area {
          display: flex;
          justify-content: space-between;
        }

        .signature-line {
          display: flex;
          gap: 8px;
          font-size: 11px;
          align-items: center;
        }

        .signature-line span:first-child {
          font-weight: bold;
          min-width: 60px;
        }

        .dots {
          border-bottom: 1px solid #000;
          flex: 1;
          display: inline-block;
        }

        /* Footer */
        .report-footer {
          margin-top: 16px;
          padding: 8px;
          border-top: 2px solid #000;
          text-align: center;
          font-size: 12px;
          font-weight: 600;
        }

        /* Print Styles */
        @media print {
          @page {
            size: A4;
            margin: 0.5cm;
          }

          body {
            background: white;
            margin: 0;
            padding: 0;
          }

          .print-all-container {
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 0;
          }

          .report-page {
            max-width: 100%;
            margin: 0;
            padding: 10mm;
          }

          .marks-table {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
