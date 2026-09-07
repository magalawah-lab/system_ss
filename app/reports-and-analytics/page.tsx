"use client";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSchoolData, SubjectEntry, Student } from "../context/SchoolDataContext";

export default function ReportsAndAnalytics() {
  const { classes, teachers, catalog } = useSchoolData();

  const [classPromptOpen, setClassPromptOpen] = useState(false);
  const [selectedClassIndex, setSelectedClassIndex] = useState<number | null>(null);
  const [selectedStreamName, setSelectedStreamName] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const [printPromptOpen, setPrintPromptOpen] = useState(false);
  const [printMode, setPrintMode] = useState<"current" | "all" | "page">("current");
  const [printPageNumber, setPrintPageNumber] = useState<string>("");

  const currentClass = selectedClassIndex !== null ? classes[selectedClassIndex] : undefined;
  const currentStream = useMemo(() => (currentClass ? currentClass.streams.find((s) => s.name === selectedStreamName) ?? currentClass.streams[0] : undefined), [currentClass, selectedStreamName]);
  const students = useMemo(() => (currentStream ? (currentStream.students ?? []) : []), [currentStream]);

  const onConfirmClass = () => {
    if (selectedClassIndex === null) return;
    const cls = classes[selectedClassIndex];
    const firstStream = cls.streams[0]?.name ?? null;
    setSelectedStreamName(firstStream);
    setClassPromptOpen(false);
    setSelectedStudentId(null);
  };

  const studentForPrint = useMemo(() => students.find((s) => s.id === selectedStudentId) ?? null, [students, selectedStudentId]);
  const assessments = useMemo(() => currentClass?.assessments ?? [], [currentClass]);

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

  const getTeacherInitials = useCallback((teacherId?: string): string => {
    if (!teacherId) return "";
    const teacher = teachers.find((t) => t.id === teacherId);
    return teacher?.initials || "";
  }, [teachers]);

  // Find Activity of Integration assessments
  const activityAssessments = useMemo(() => {
    return assessments.filter((a) => a.maxScore !== undefined && a.maxScore !== null && a.maxScore >= 0.9 && a.maxScore <= 3);
  }, [assessments]);

  const c1Assessment = useMemo(() => activityAssessments[0], [activityAssessments]);
  const c2Assessment = useMemo(() => activityAssessments[1], [activityAssessments]);

  const endOfCycleAssessment = useMemo(() => {
    return assessments.find((a) => a.maxScore !== undefined && a.maxScore !== null && a.maxScore <= 80 && a.maxScore > 3);
  }, [assessments]);

  // Calculate report rows for preview
  const reportRows = useMemo(() => {
    return (currentStream?.subjects ?? [])
      .filter((subEntry: SubjectEntry) => {
        const subjectName = subEntry.name;
        const isOptional = catalog?.[subjectName] === "optional";
        if (isOptional) {
          return studentForPrint?.optionalSubjects.includes(subjectName);
        }
        return true;
      })
      .map((subEntry: SubjectEntry) => {
        const subjectName = subEntry.name;
        const teacherId = typeof subEntry === "string" ? undefined : subEntry.teacherId;
        const initials = getTeacherInitials(teacherId);

        const c1Score = c1Assessment?.subjectScores?.[subjectName]?.[studentForPrint?.id ?? ""] ?? c1Assessment?.scores?.[studentForPrint?.id ?? ""];
        const c2Score = c2Assessment?.subjectScores?.[subjectName]?.[studentForPrint?.id ?? ""] ?? c2Assessment?.scores?.[studentForPrint?.id ?? ""];
        const endOfCycleScore = endOfCycleAssessment?.subjectScores?.[subjectName]?.[studentForPrint?.id ?? ""] ?? endOfCycleAssessment?.scores?.[studentForPrint?.id ?? ""];

        let twentyPercentValue: number | null = null;
        const c1Present = typeof c1Score === "number";
        const c2Present = typeof c2Score === "number";

        if (c1Present && c2Present) {
          const average = (c1Score + c2Score) / 2;
          twentyPercentValue = (average / 3) * 20;
        } else if (c1Present) {
          twentyPercentValue = (c1Score / 3) * 20;
        } else if (c2Present) {
          twentyPercentValue = (c2Score / 3) * 20;
        }

        const endOfCycleValue = typeof endOfCycleScore === "number" ? endOfCycleScore : null;
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
          twenty: twentyPercentValue !== null ? Math.round(twentyPercentValue) : "",
          eighty: endOfCycleValue !== null ? Math.round(endOfCycleValue) : "",
          hundred: hundredPercentValue !== null ? Math.round(hundredPercentValue) : "",
          grade,
          comment,
          initials,
        };
      });
  }, [currentStream, studentForPrint, c1Assessment, c2Assessment, endOfCycleAssessment, catalog, getTeacherInitials]);

  // Calculate overall grade for preview
  const overallGrades = reportRows.map((r) => r.hundred).filter((h) => h !== "") as string[];
  const overallPercentage = overallGrades.length > 0 ? (overallGrades.reduce((sum, val) => sum + parseFloat(val), 0) as number) / overallGrades.length : null;
  const overallGrade = getGrade(overallPercentage);

  // Compute printable list
  const printableStudents = useMemo(() => {
    if (printMode === "current") return studentForPrint ? [studentForPrint] : [];
    if (printMode === "page") {
      const idx = parseInt(printPageNumber, 10);
      if (!Number.isFinite(idx) || idx < 1) return [];
      return students[idx - 1] ? [students[idx - 1]] : [];
    }
    return students;
  }, [printMode, studentForPrint, printPageNumber, students]);

  const startPrint = () => {
    setTimeout(() => window.print(), 0);
  };

  const onPrintCurrent = () => { setPrintMode("current"); startPrint(); };
  const onPrintAll = () => { setPrintMode("all"); startPrint(); };
  const onPrintSpecific = () => { setPrintMode("page"); startPrint(); };

  return (
    <div style={{ padding: 16 }}>
      <h1>Reports & Analytics</h1>
      
      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: "2px solid #e0e0e0", paddingBottom: 8 }}>
        <button style={{ padding: "8px 12px", fontWeight: 600, color: "#0066cc", borderBottom: "3px solid #0066cc", cursor: "pointer", background: "none", border: "none" }}>
          Assessment Reports
        </button>
        <Link href="/reports-and-analytics/report-builder" style={{ textDecoration: "none" }}>
          <button style={{ padding: "8px 12px", fontWeight: 600, color: "#666", cursor: "pointer", background: "none", border: "none" }}>
            O-Level Report Cards
          </button>
        </Link>
        <Link href="/reports-and-analytics/report-builder-alevel" style={{ textDecoration: "none" }}>
          <button style={{ padding: "8px 12px", fontWeight: 600, color: "#666", cursor: "pointer", background: "none", border: "none" }}>
            A-Level Report Cards
          </button>
        </Link>
        <Link href="/reports-and-analytics/marksheets?mode=completion" style={{ textDecoration: "none" }}>
          <button style={{ padding: "8px 12px", fontWeight: 600, color: "#666", cursor: "pointer", background: "none", border: "none" }}>
            Score Completion Audit
          </button>
        </Link>
        <Link href="/reports-and-analytics/marksheets" style={{ textDecoration: "none" }}>
          <button style={{ padding: "8px 12px", fontWeight: 600, color: "#666", cursor: "pointer", background: "none", border: "none" }}>
            Marksheets & Lists
          </button>
        </Link>
      </div>
      
      <div style={{ marginTop: 8 }}>
        <button onClick={() => setClassPromptOpen(true)} style={{ padding: "6px 10px" }}>Choose class</button>
        {currentClass && (
          <span style={{ marginLeft: 12 }}>Selected: {currentClass.name}{currentStream ? ` • ${currentStream.name}` : ""}</span>
        )}
      </div>

      {/* Class selection prompt */}
      {classPromptOpen && (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #ddd", borderRadius: 6, maxWidth: 480 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Select class and stream</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={selectedClassIndex ?? ""} onChange={(e) => setSelectedClassIndex(e.target.value ? Number(e.target.value) : null)} style={{ flex: 1 }}>
              <option value="">-- Select class --</option>
              {classes.map((c, ci) => (
                <option key={c.name + ci} value={ci}>{c.name}</option>
              ))}
            </select>
            <select value={selectedStreamName ?? ""} onChange={(e) => setSelectedStreamName(e.target.value || null)} style={{ flex: 1 }}>
              <option value="">-- Select stream --</option>
              {(selectedClassIndex !== null ? classes[selectedClassIndex].streams : []).map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button onClick={onConfirmClass} disabled={selectedClassIndex === null} style={{ padding: "6px 10px" }}>Confirm</button>
            <button onClick={() => setClassPromptOpen(false)} style={{ padding: "6px 10px" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Students list */}
      {currentStream && (
        <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: 16, marginTop: 16 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Students in {currentClass?.name} • {currentStream.name}</div>
            <div style={{ border: "1px solid #eee", borderRadius: 6, maxHeight: 420, overflow: "auto" }}>
              {(currentStream.students ?? []).map((st, idx) => (
                <div key={st.id} style={{ padding: 8, borderBottom: "1px solid #f2f2f2", background: st.id === selectedStudentId ? "#f7fbff" : undefined }}>
                  <button onClick={() => setSelectedStudentId(st.id)} style={{ background: "none", border: "none", textAlign: "left", width: "100%", cursor: "pointer" }}>
                    <div style={{ fontWeight: 500 }}>{idx + 1}. {st.firstName} {st.secondName}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{st.studentID}</div>
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <button onClick={() => setPrintPromptOpen(true)} disabled={!currentStream || (currentStream.students ?? []).length === 0} style={{ padding: "6px 10px" }}>Print reports</button>
            </div>
          </div>

          {/* Report preview */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Report preview</div>
            {!selectedStudentId && <div style={{ color: "#666" }}>Select a student to preview their report card.</div>}
            {selectedStudentId && studentForPrint && (
              <div className="report-card-preview">
                {/* Header */}
                <div className="preview-header">
                  <img src="/logo.jpg" alt="School Logo" className="preview-logo-img" />
                  <div className="school-info">
                    <h1>BUSAANA SECONDARY SCHOOL</h1>
                    <p className="contact-info">Email: busaanass2016@gmail.com</p>
                    <p className="contact-info">Contacts: +256(0)703877122</p>
                    <p className="motto">Education is the Key to Success</p>
                  </div>
                </div>

                {/* Report Title */}
                <div className="preview-title">
                  <h2>END OF TERM ASSESSMENT REPORT</h2>
                  <p className="preview-subtitle">{new Date().getFullYear()}</p>
                </div>

                {/* Student Details */}
                <div className="preview-details">
                  <div className="detail-item">
                    <span className="label">NAME:</span>
                    <span className="value">{studentForPrint.firstName} {studentForPrint.secondName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">CLASS:</span>
                    <span className="value">{currentClass?.name} {currentStream.name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">TERM:</span>
                    <span className="value">TERM 2, {new Date().getFullYear()}</span>
                  </div>
                </div>

                {/* Marks Table */}
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th rowSpan={2}>SUBJECT</th>
                      <th colSpan={2}>TEST SCORES</th>
                      <th rowSpan={2}>20%</th>
                      <th rowSpan={2}>80%</th>
                      <th rowSpan={2}>100%</th>
                      <th rowSpan={2}>GRADE</th>
                      <th rowSpan={2}>COMMENTS</th>
                      <th rowSpan={2}>T. INITIALS</th>
                    </tr>
                    <tr>
                      <th>C1</th>
                      <th>C2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="cell-subject">{row.subject}</td>
                        <td>{row.c1}</td>
                        <td>{row.c2}</td>
                        <td>{row.twenty}</td>
                        <td>{row.eighty}</td>
                        <td className="total-cell">{row.hundred}</td>
                        <td className="grade-cell">{row.grade}</td>
                        <td className="comment-cell">{row.comment}</td>
                        <td>{row.initials}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary */}
                <div className="preview-summary">
                  <strong>OVERALL PERFORMANCE:</strong> {overallPercentage !== null ? `${Math.round(overallPercentage as number)}% - Grade ${overallGrade}` : "No grades recorded"}
                </div>

                {/* Comments */}
                <div className="preview-comments">
                  <div className="comment-box">
                    <div className="comment-title">Class Teacher&apos;s Comment:</div>
                    <div className="preview-comment-text">
                      {overallGrade === "A" ? `${studentForPrint?.firstName || "This student"} has demonstrated excellent performance across all subjects. Outstanding achievement and maintains high standards. Keep up the exemplary work.` :
                       overallGrade === "B" ? `${studentForPrint?.firstName || "This student"} has shown good performance throughout the term. Continue working hard to maintain these results.` :
                       overallGrade === "C" ? `${studentForPrint?.firstName || "This student"} has achieved satisfactory results. There is room for improvement. We encourage more effort and dedication.` :
                       overallGrade === "D" || overallGrade === "E" ? `${studentForPrint?.firstName || "This student"} needs to put in more effort to improve performance. We request parental support to ensure better results.` :
                       "No grades recorded for this term."}
                    </div>
                    <div className="signature-area">
                      <div className="signature-line">
                        <span>Signature:</span>
                        <span className="dots">................................</span>
                      </div>
                      <div className="signature-line">
                        <span>Date:</span>
                        <span className="dots">................................</span>
                      </div>
                    </div>
                  </div>
                  <div className="comment-box">
                    <div className="comment-title">Head Teacher&apos;s Comment:</div>
                    <div className="preview-comment-text">
                      {overallGrade === "A" ? `${studentForPrint?.firstName || "This student"} is an outstanding student with excellent academic performance. We commend the high standards maintained. Best wishes for continued success.` :
                       overallGrade === "B" ? `${studentForPrint?.firstName || "This student"} has performed well this term. We encourage maintaining the momentum and striving for even better results.` :
                       overallGrade === "C" ? `${studentForPrint?.firstName || "This student"} has achieved acceptable results. We recommend increased effort to improve academic standing.` :
                       overallGrade === "D" || overallGrade === "E" ? `${studentForPrint?.firstName || "This student"} performance is below expectations. Urgent attention and intervention are needed. We request close cooperation from parents/guardians.` :
                       "No grades recorded for this term."}
                    </div>
                    <div className="signature-area">
                      <div className="signature-line">
                        <span>Signature:</span>
                        <span className="dots">................................</span>
                      </div>
                      <div className="signature-line">
                        <span>Date:</span>
                        <span className="dots">................................</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Print prompt */}
      {printPromptOpen && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 6, maxWidth: 520 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Print reports</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="radio" name="printMode" checked={printMode === "current"} onChange={() => setPrintMode("current")} />
              <span>Current report</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="radio" name="printMode" checked={printMode === "all"} onChange={() => setPrintMode("all")} />
              <span>All reports</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="radio" name="printMode" checked={printMode === "page"} onChange={() => setPrintMode("page")} />
              <span>Specific page</span>
            </label>
            {printMode === "page" && (
              <input type="number" min={1} value={printPageNumber} onChange={(e) => setPrintPageNumber(e.target.value)} placeholder="Page number" style={{ width: 120 }} />
            )}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button onClick={() => { setPrintPromptOpen(false); (printMode === "current" ? onPrintCurrent : printMode === "all" ? onPrintAll : onPrintSpecific)(); }} style={{ padding: "6px 10px" }}>Print</button>
            <button onClick={() => setPrintPromptOpen(false)} style={{ padding: "6px 10px" }}>Close</button>
          </div>
        </div>
      )}

      {/* Hidden printable container */}
      <div className="print-all-container">
        {printableStudents.map((st: Student, studentIdx: number) => {
          const studentReportRows = (currentStream?.subjects ?? [])
            .filter((subEntry: SubjectEntry) => {
              const subjectName = subEntry.name;
              const isOptional = catalog?.[subjectName] === "optional";
              if (isOptional) {
                return st.optionalSubjects.includes(subjectName);
              }
              return true;
            })
            .map((subEntry: SubjectEntry) => {
              const subjectName = subEntry.name;
              const teacherId = typeof subEntry === "string" ? undefined : subEntry.teacherId;
              const initials = getTeacherInitials(teacherId);

              const c1Score = c1Assessment?.subjectScores?.[subjectName]?.[st.id] ?? c1Assessment?.scores?.[st.id];
              const c2Score = c2Assessment?.subjectScores?.[subjectName]?.[st.id] ?? c2Assessment?.scores?.[st.id];
              const endOfCycleScore = endOfCycleAssessment?.subjectScores?.[subjectName]?.[st.id] ?? endOfCycleAssessment?.scores?.[st.id];

              let twentyPercentValue: number | null = null;
              const c1Present = typeof c1Score === "number";
              const c2Present = typeof c2Score === "number";

              if (c1Present && c2Present) {
                const average = (c1Score + c2Score) / 2;
                twentyPercentValue = (average / 3) * 20;
              } else if (c1Present) {
                twentyPercentValue = (c1Score / 3) * 20;
              } else if (c2Present) {
                twentyPercentValue = (c2Score / 3) * 20;
              }

              const endOfCycleValue = typeof endOfCycleScore === "number" ? endOfCycleScore : null;
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
                twenty: twentyPercentValue !== null ? Math.round(twentyPercentValue) : "",
                eighty: endOfCycleValue !== null ? Math.round(endOfCycleValue) : "",
                hundred: hundredPercentValue !== null ? Math.round(hundredPercentValue) : "",
                grade,
                comment,
                initials,
              };
            });

          const studentOverallGrades = studentReportRows.map((r) => r.hundred).filter((h) => h !== "") as string[];
          const studentOverallPercentage = studentOverallGrades.length > 0 ? (studentOverallGrades.reduce((sum, val) => sum + parseFloat(val), 0) as number) / studentOverallGrades.length : null;
          const studentOverallGrade = getGrade(studentOverallPercentage);

          return (
            <div key={st.id} className="report-page">
              {/* Header */}
              <div className="header">
                <div className="logo-box">B</div>
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
                <p className="report-subtitle">{new Date().getFullYear()}</p>
              </div>

              {/* Student Details */}
              <div className="student-details">
                <div className="detail-item">
                  <span className="label">NAME:</span>
                  <span className="value">{st.firstName} {st.secondName}</span>
                </div>
                <div className="detail-item">
                  <span className="label">CLASS:</span>
                  <span className="value">{currentClass?.name} {currentStream?.name}</span>
                </div>
                <div className="detail-item">
                  <span className="label">TERM:</span>
                  <span className="value">TERM 2, {new Date().getFullYear()}</span>
                </div>
              </div>

              {/* Marks Table */}
              <table className="marks-table">
                <thead>
                  <tr>
                    <th rowSpan={2} className="col-subject">SUBJECT</th>
                    <th colSpan={2} className="col-tests">TEST SCORES</th>
                    <th rowSpan={2} className="col-20">20%</th>
                    <th rowSpan={2} className="col-80">80%</th>
                    <th rowSpan={2} className="col-100">100%</th>
                    <th rowSpan={2} className="col-grade">GRADE</th>
                    <th rowSpan={2} className="col-comments">COMMENTS</th>
                    <th rowSpan={2} className="col-initials">T. INITIALS</th>
                  </tr>
                  <tr>
                    <th className="col-c1">C1</th>
                    <th className="col-c2">C2</th>
                  </tr>
                </thead>
                <tbody>
                  {studentReportRows.map((row, idx) => (
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
                  {studentReportRows.length < 10 && Array.from({ length: 10 - studentReportRows.length }).map((_, i) => (
                    <tr key={`empty-${i}`}>
                      <td>&nbsp;</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary */}
              <div className="summary-section">
                <div className="overall-performance">
                  <span className="label">OVERALL PERFORMANCE:</span>
                  <span className="value">{studentOverallPercentage !== null ? `${Math.round(studentOverallPercentage)}% - Grade ${studentOverallGrade}` : "No grades recorded"}</span>
                </div>
              </div>

              {/* Comments */}
              <div className="comments-section">
                <div className="comment-box">
                  <div className="comment-title">Class Teacher&apos;s Comment:</div>
                  <div className="comment-line">
                    {studentOverallGrade === "A" ? `${st.firstName || "This student"} has demonstrated excellent performance across all subjects. Outstanding achievement and maintains high standards. Keep up the exemplary work.` :
                     studentOverallGrade === "B" ? `${st.firstName || "This student"} has shown good performance throughout the term. Continue working hard to maintain these results.` :
                     studentOverallGrade === "C" ? `${st.firstName || "This student"} has achieved satisfactory results. There is room for improvement. We encourage more effort and dedication.` :
                     studentOverallGrade === "D" || studentOverallGrade === "E" ? `${st.firstName || "This student"} needs to put in more effort to improve performance. We request parental support to ensure better results.` :
                     "No grades recorded for this term."}
                  </div>
                  <div className="signature-area">
                    <div className="signature-line">
                      <span>Signature:</span>
                      <span className="dots">................................</span>
                    </div>
                    <div className="signature-line">
                      <span>Date:</span>
                      <span className="dots">................................</span>
                    </div>
                  </div>
                </div>
                <div className="comment-box">
                  <div className="comment-title">Head Teacher&apos;s Comment:</div>
                  <div className="comment-line">
                    {studentOverallGrade === "A" ? `${st.firstName || "This student"} is an outstanding student with excellent academic performance. We commend the high standards maintained. Best wishes for continued success.` :
                     studentOverallGrade === "B" ? `${st.firstName || "This student"} has performed well this term. We encourage maintaining the momentum and striving for even better results.` :
                     studentOverallGrade === "C" ? `${st.firstName || "This student"} has achieved acceptable results. We recommend increased effort to improve academic standing.` :
                     studentOverallGrade === "D" || studentOverallGrade === "E" ? `${st.firstName || "This student"} performance is below expectations. Urgent attention and intervention are needed. We request close cooperation from parents/guardians.` :
                     "No grades recorded for this term."}
                  </div>
                  <div className="signature-area">
                    <div className="signature-line">
                      <span>Signature:</span>
                      <span className="dots">................................</span>
                    </div>
                    <div className="signature-line">
                      <span>Date:</span>
                      <span className="dots">................................</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Page Break */}
              {studentIdx < printableStudents.length - 1 && <div className="page-break"></div>}
            </div>
          );
        })}

        <style>{`
          .print-all-container {
            display: none;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
              background: white;
            }
            .print-all-container {
              display: block;
              width: 100%;
            }
            .print-all-container > div:not(.report-page) {
              display: none !important;
            }
            body * {
              visibility: hidden;
            }
            .report-page, .report-page * {
              visibility: visible;
            }
            .report-page {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 10mm;
            }
            @page {
              size: A4;
              margin: 0;
            }
          }

          .report-page {
            max-width: 190mm;
            margin: 10mm auto;
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

          .logo-img {
            position: absolute;
            left: 0;
            width: 55px;
            height: 55px;
            object-fit: contain;
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
            font-size: 28px;
            font-weight: bold;
            background: #f0f0f0;
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
            margin-bottom: 12px;
          }

          .overall-performance {
            display: flex;
            padding: 8px;
            border: 1px solid #000;
            font-size: 12px;
          }

          .overall-performance .label {
            font-weight: bold;
            min-width: 160px;
          }

          /* Comments Section */
          .comments-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .comment-box {
            border: 1px solid #000;
            padding: 8px;
          }

          .comment-title {
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 4px;
          }

          .comment-line {
            border-bottom: 1px solid #000;
            min-height: 40px;
            margin-bottom: 8px;
            font-size: 10px;
            line-height: 1.4;
          }

          .signature-area {
            margin-top: 12px;
          }

          .signature-line {
            display: flex;
            gap: 8px;
            font-size: 10px;
          }

          .dots {
            letter-spacing: 2px;
          }

          /* Preview Styles */
          .report-card-preview {
            background: white;
            border: 2px solid #000;
            padding: 16px;
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
          }

          .preview-header {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            margin-bottom: 8px;
            padding: 4px 0;
            border-bottom: 2px solid #000;
          }

          .preview-header .logo-img {
            position: absolute;
            left: 0;
            width: 35px;
            height: 35px;
            object-fit: contain;
          }

          .preview-header .school-info {
            margin-left: 20px;
            margin-right: 20px;
          }

          .preview-header .school-info h1 {
            font-size: 16px;
          }

          .preview-title {
            text-align: center;
            margin-bottom: 12px;
          }

          .preview-title h2 {
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
          }

          .preview-subtitle {
            font-size: 12px;
            font-weight: 600;
            margin: 4px 0 0 0;
          }

          .preview-details {
            display: flex;
            justify-content: space-around;
            margin-bottom: 12px;
            font-size: 12px;
            padding: 8px;
            background: #f9f9f9;
            border: 1px solid #ddd;
          }

          .preview-details .detail-item {
            display: flex;
            gap: 6px;
          }

          .preview-details .label {
            font-weight: bold;
          }

          .preview-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 12px;
          }

          .preview-table th,
          .preview-table td {
            border: 1px solid #000;
            padding: 6px 4px;
            text-align: center;
          }

          .preview-table th {
            background: #e0e0e0;
            font-weight: bold;
          }

          .preview-table .cell-subject {
            text-align: left !important;
            font-weight: 500;
          }

          .total-cell {
            font-weight: bold;
            background: #f9fafb;
          }

          .grade-cell {
            font-weight: bold;
            font-size: 12px;
          }

          .comment-cell {
            text-align: left;
            font-size: 10px;
          }

          .preview-summary {
            padding: 8px;
            border: 1px solid #000;
            margin-bottom: 12px;
            font-size: 12px;
            text-align: center;
          }

          .preview-comments {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .preview-comments .comment-box {
            border: 1px solid #000;
            padding: 8px;
          }

          .preview-comments .comment-title {
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 4px;
          }

          .preview-comment-text {
            border-bottom: 1px solid #000;
            min-height: 40px;
            margin-bottom: 8px;
            font-size: 10px;
            line-height: 1.4;
          }

          .preview-comments .signature-area {
            margin-top: 12px;
          }

          .preview-comments .signature-line {
            display: flex;
            gap: 8px;
            font-size: 10px;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }
        `}</style>
      </div>
    </div>
  );
}
