"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSchoolData, SubjectEntry, Assessment } from "../../context/SchoolDataContext";

type ViewMode = 'classlist' | 'marksheet' | 'term' | 'completion';

export default function MarksheetsPage() {
  const { classes, teachers, catalog } = useSchoolData();
  const searchParams = useSearchParams();

  const [selectedClassIndex, setSelectedClassIndex] = useState<number | null>(null);
  const [selectedStreamName, setSelectedStreamName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('marksheet');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);

  useEffect(() => {
    const mode = searchParams.get('mode') as ViewMode;
    if (mode && ['classlist', 'marksheet', 'term', 'completion'].includes(mode)) {
      setViewMode(mode);
    }
  }, [searchParams]);

  const currentClass = selectedClassIndex !== null ? classes[selectedClassIndex] : undefined;
  const currentStream = useMemo(() => 
    currentClass ? currentClass.streams.find((s) => s.name === selectedStreamName) ?? currentClass.streams[0] : undefined
  , [currentClass, selectedStreamName]);

  const students = useMemo(() => 
    currentStream ? (currentStream.students ?? []) : []
  , [currentStream]);

  const assessments = useMemo(() => currentClass?.assessments ?? [], [currentClass]);

  // Get all unique subjects from the stream
  const subjects = useMemo(() => {
    return (currentStream?.subjects ?? [])
      .filter((subEntry: SubjectEntry) => {
        return true;
      });
  }, [currentStream]);

  // Helper to shorten subject names
  const shortenSubject = (name: string): string => {
    const words = name.split(" ");
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 3).toUpperCase();
  };

  const handleExportCSV = useCallback(() => {
    if (!currentClass || !currentStream || students.length === 0) return;

    let headers: string[] = [];
    let rows: any[][] = [];
    let fileName = "";

    if (viewMode === 'classlist') {
      headers = ["No.", "Student ID", "First Name", "Second Name", "Gender", "Class", "Stream"];
      rows = students.map((s, i) => [i + 1, s.studentID, s.firstName, s.secondName, s.gender, currentClass.name, currentStream.name]);
      fileName = `${currentClass.name}_${currentStream.name}_classlist.csv`;
    } else if (viewMode === 'marksheet') {
      const assessment = assessments.find(a => a.id === selectedAssessmentId) || assessments[0];
      if (!assessment) return;
      
      headers = ["No.", "Student ID", "First Name", "Second Name", ...subjects.map(s => s.name), "Total", "Avg"];
      rows = students.map((student, idx) => {
        const studentScores = subjects.map(sub => {
          const score = assessment.subjectScores?.[sub.name]?.[student.id] ?? assessment.scores?.[student.id];
          return typeof score === 'number' ? score : '';
        });
        const numericScores = studentScores.filter(s => typeof s === 'number') as number[];
        const total = numericScores.reduce((a, b) => a + b, 0);
        const avg = numericScores.length > 0 ? (total / numericScores.length).toFixed(1) : '';
        return [idx + 1, student.studentID, student.firstName, student.secondName, ...studentScores, total, avg];
      });
      fileName = `${currentClass.name}_${currentStream.name}_${assessment.name}_marksheet.csv`;
    } else if (viewMode === 'completion') {
      const assessment = assessments.find(a => a.id === selectedAssessmentId) || assessments[0];
      if (!assessment) return;
      
      headers = ["No.", "Student ID", "First Name", "Second Name", ...subjects.map(s => s.name), "Missing Count"];
      rows = students.map((student, idx) => {
        let missingCount = 0;
        const status = subjects.map(sub => {
          const isOptional = catalog?.[sub.name] === 'optional';
          const hasSubject = !isOptional || student.optionalSubjects.includes(sub.name);
          if (!hasSubject) return 'N/A';
          
          const score = assessment.subjectScores?.[sub.name]?.[student.id] ?? assessment.scores?.[student.id];
          if (typeof score === 'number') return 'Entered';
          missingCount++;
          return 'Missing';
        });
        return [idx + 1, student.studentID, student.firstName, student.secondName, ...status, missingCount];
      });
      fileName = `${currentClass.name}_${currentStream.name}_${assessment.name}_completion_audit.csv`;
    } else if (viewMode === 'term') {
      headers = ["No.", "Student ID", "First Name", "Second Name", ...subjects.map(s => s.name), "Total", "Avg"];
      rows = students.map((student, idx) => {
        const studentScores = subjects.map(sub => {
          let subTotal = 0;
          let count = 0;
          assessments.forEach(a => {
            const score = a.subjectScores?.[sub.name]?.[student.id] ?? a.scores?.[student.id];
            if (typeof score === 'number') {
              subTotal += score;
              count++;
            }
          });
          return count > 0 ? subTotal.toFixed(1) : '';
        });
        const numericScores = studentScores.filter(s => s !== '').map(s => parseFloat(s));
        const total = numericScores.reduce((a, b) => a + b, 0);
        const avg = numericScores.length > 0 ? (total / numericScores.length).toFixed(1) : '';
        return [idx + 1, student.studentID, student.firstName, student.secondName, ...studentScores, total.toFixed(1), avg];
      });
      fileName = `${currentClass.name}_${currentStream.name}_Term_Summary.csv`;
    }

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentClass, currentStream, students, subjects, assessments, viewMode, selectedAssessmentId]);

  return (
    <div className="marksheets-page">
      <div className="page-header">
        <h1>Marksheets & Class Lists</h1>
        <p className="subtitle">Generate and export academic records</p>
      </div>

      <div className="nav-tabs">
        <Link href="/reports-and-analytics" className="nav-tab">Assessment Reports</Link>
        <Link href="/reports-and-analytics/report-builder" className="nav-tab">Report Cards</Link>
        <button className="nav-tab active">Marksheets & Lists</button>
      </div>

      <div className="controls-card">
        <div className="control-group">
          <label>Select Class</label>
          <select 
            value={selectedClassIndex ?? ""} 
            onChange={(e) => {
              setSelectedClassIndex(e.target.value ? Number(e.target.value) : null);
              setSelectedStreamName(null);
              setSelectedAssessmentId(null);
            }}
          >
            <option value="">-- Choose Class --</option>
            {classes.map((c, ci) => <option key={ci} value={ci}>{c.name}</option>)}
          </select>
        </div>

        <div className="control-group">
          <label>Select Stream</label>
          <select 
            value={selectedStreamName ?? ""} 
            onChange={(e) => setSelectedStreamName(e.target.value || null)}
            disabled={selectedClassIndex === null}
          >
            <option value="">-- Choose Stream --</option>
            {currentClass?.streams.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>

        <div className="control-group">
          <label>View Mode</label>
          <div className="mode-selector">
            <button className={viewMode === 'classlist' ? 'active' : ''} onClick={() => setViewMode('classlist')}>List</button>
            <button className={viewMode === 'marksheet' ? 'active' : ''} onClick={() => setViewMode('marksheet')}>Assessment</button>
            <button className={viewMode === 'term' ? 'active' : ''} onClick={() => setViewMode('term')}>Term Summary</button>
            <button className={viewMode === 'completion' ? 'active' : ''} onClick={() => setViewMode('completion')}>Score Completion</button>
          </div>
        </div>

        {(viewMode === 'marksheet' || viewMode === 'completion') && assessments.length > 0 && (
          <div className="control-group">
            <label>Assessment</label>
            <select 
              value={selectedAssessmentId ?? ""} 
              onChange={(e) => setSelectedAssessmentId(e.target.value || null)}
            >
              <option value="">-- Select Assessment --</option>
              {assessments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}

        <div className="actions">
          <button className="btn btn-success" onClick={handleExportCSV} disabled={!currentStream || students.length === 0}>
            Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => window.print()} disabled={!currentStream || students.length === 0}>
            Print
          </button>
        </div>
      </div>

      {currentStream && students.length > 0 ? (
        <div className="marksheet-container">
          <div className="marksheet-header">
            <h2>{currentClass?.name} - {currentStream.name}</h2>
            <p>
              {viewMode === 'classlist' ? 'Class List' : 
               viewMode === 'term' ? 'Term Summary (Aggregated)' : 
               `Assessment Marksheet: ${assessments.find(a => a.id === selectedAssessmentId)?.name || assessments[0]?.name || ''}`}
            </p>
          </div>
          
          <div className="table-wrapper">
            <table className="marksheet-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student ID</th>
                  <th>Name</th>
                  {viewMode === 'classlist' ? (
                    <th>Gender</th>
                  ) : viewMode === 'completion' ? (
                    <>
                      {subjects.map(sub => (
                        <th key={sub.name} title={sub.name}>{shortenSubject(sub.name)}</th>
                      ))}
                      <th style={{ backgroundColor: '#fef2f2', color: '#991b1b' }}>Missing</th>
                    </>
                  ) : (
                    <>
                      {subjects.map(sub => (
                        <th key={sub.name} title={sub.name}>{shortenSubject(sub.name)}</th>
                      ))}
                      <th>Total</th>
                      <th>Avg</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => {
                  let rowTotal = 0;
                  let rowCount = 0;
                  
                  return (
                    <tr key={student.id}>
                      <td>{idx + 1}</td>
                      <td>{student.studentID}</td>
                      <td>{student.firstName} {student.secondName}</td>
                      
                      {viewMode === 'classlist' ? (
                        <td>{student.gender}</td>
                      ) : viewMode === 'completion' ? (
                        <>
                          {subjects.map(sub => {
                            const assessment = assessments.find(a => a.id === selectedAssessmentId) || assessments[0];
                            const score = assessment?.subjectScores?.[sub.name]?.[student.id] ?? assessment?.scores?.[student.id];
                            const isOptional = catalog?.[sub.name] === 'optional';
                            const hasSubject = !isOptional || student.optionalSubjects.includes(sub.name);
                            
                            if (!hasSubject) return <td key={sub.name} className="empty-cell">—</td>;
                            
                            if (typeof score === 'number') {
                              return <td key={sub.name} style={{ color: '#10b981' }}>✓</td>;
                            }
                            rowCount++; // Track missing scores
                            return <td key={sub.name} style={{ color: '#ef4444', fontWeight: 'bold' }}>✗</td>;
                          })}
                          <td style={{ backgroundColor: rowCount > 0 ? '#fef2f2' : 'transparent', color: '#ef4444', fontWeight: 'bold' }}>
                            {rowCount > 0 ? rowCount : '—'}
                          </td>
                        </>
                      ) : viewMode === 'marksheet' ? (
                        <>
                          {subjects.map(sub => {
                            const assessment = assessments.find(a => a.id === selectedAssessmentId) || assessments[0];
                            const score = assessment?.subjectScores?.[sub.name]?.[student.id] ?? assessment?.scores?.[student.id];
                            const isOptional = catalog?.[sub.name] === 'optional';
                            const hasSubject = !isOptional || student.optionalSubjects.includes(sub.name);
                            
                            if (!hasSubject) return <td key={sub.name} className="empty-cell">—</td>;
                            
                            if (typeof score === 'number') {
                              rowTotal += score;
                              rowCount++;
                              return <td key={sub.name}>{score.toFixed(0)}</td>;
                            }
                            return <td key={sub.name} className="muted">?</td>;
                          })}
                          <td className="bold">{rowCount > 0 ? rowTotal.toFixed(0) : '—'}</td>
                          <td className="bold">{rowCount > 0 ? (rowTotal / rowCount).toFixed(1) : '—'}</td>
                        </>
                      ) : (
                        <>
                          {subjects.map(sub => {
                            let subTotal = 0;
                            let subCount = 0;
                            assessments.forEach(a => {
                              const score = a.subjectScores?.[sub.name]?.[student.id] ?? a.scores?.[student.id];
                              if (typeof score === 'number') {
                                subTotal += score;
                                subCount++;
                              }
                            });
                            const isOptional = catalog?.[sub.name] === 'optional';
                            const hasSubject = !isOptional || student.optionalSubjects.includes(sub.name);

                            if (!hasSubject) return <td key={sub.name} className="empty-cell">—</td>;
                            
                            if (subCount > 0) {
                              rowTotal += subTotal;
                              rowCount++;
                              return <td key={sub.name}>{subTotal.toFixed(0)}</td>;
                            }
                            return <td key={sub.name} className="muted">?</td>;
                          })}
                          <td className="bold">{rowCount > 0 ? rowTotal.toFixed(0) : '—'}</td>
                          <td className="bold">{rowCount > 0 ? (rowTotal / rowCount).toFixed(1) : '—'}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          {selectedClassIndex === null ? 'Select a class to get started' : 'No students found in this stream'}
        </div>
      )}

      <style jsx>{`
        .marksheets-page { padding: 2rem; max-width: 1400px; margin: 0 auto; }
        .page-header { margin-bottom: 2rem; }
        .subtitle { color: var(--text-muted); }
        
        .nav-tabs { display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid var(--border); }
        .nav-tab { padding: 0.75rem 1.5rem; border: none; background: none; cursor: pointer; color: var(--text-muted); font-weight: 600; text-decoration: none; }
        .nav-tab.active { color: var(--primary); border-bottom: 2px solid var(--primary); }
        
        .controls-card { background: var(--surface); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); display: flex; gap: 2rem; flex-wrap: wrap; align-items: flex-end; margin-bottom: 2rem; }
        .control-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .control-group label { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); }
        
        select { padding: 0.6rem 1rem; border-radius: 6px; border: 1px solid var(--border); background: var(--background); min-width: 180px; }
        
        .mode-selector { display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
        .mode-selector button { padding: 0.6rem 1rem; border: none; background: var(--background); cursor: pointer; font-size: 0.9rem; }
        .mode-selector button.active { background: var(--primary); color: white; }
        
        .actions { display: flex; gap: 1rem; margin-left: auto; }
        .btn { padding: 0.6rem 1.25rem; border-radius: 6px; border: none; font-weight: 600; cursor: pointer; font-size: 0.9rem; }
        .btn-success { background: #10b981; color: white; }
        .btn-primary { background: var(--primary); color: white; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .marksheet-container { background: var(--surface); border-radius: 12px; border: 1px solid var(--border); padding: 2rem; box-shadow: var(--shadow-sm); }
        .marksheet-header { text-align: center; margin-bottom: 2rem; }
        .marksheet-header h2 { margin: 0; font-size: 1.5rem; }
        .marksheet-header p { margin: 0.5rem 0 0 0; color: var(--text-muted); }
        
        .table-wrapper { overflow-x: auto; }
        .marksheet-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .marksheet-table th, .marksheet-table td { padding: 0.75rem; border: 1px solid var(--border); text-align: center; }
        .marksheet-table th { background: var(--background); font-weight: 600; }
        .marksheet-table td:nth-child(3) { text-align: left; font-weight: 500; }
        
        .empty-cell { color: #ccc; }
        .muted { color: var(--text-muted); font-style: italic; }
        .bold { font-weight: 700; background: var(--background); }
        
        .empty-state { text-align: center; padding: 4rem; background: var(--surface); border-radius: 12px; border: 1px dashed var(--border); color: var(--text-muted); }
        
        @media print {
          .nav-tabs, .controls-card, .page-header, .nav-tab { display: none !important; }
          .marksheets-page { padding: 0; }
          .marksheet-container { border: none; box-shadow: none; padding: 0; }
          .marksheet-table { font-size: 8pt; }
          .marksheet-table th, .marksheet-table td { padding: 4pt; }
        }
      `}</style>
    </div>
  );
}
