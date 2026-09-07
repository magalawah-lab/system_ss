"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSchoolData, AssessmentReport } from "../context/SchoolDataContext";
import AcademicYearSelector from "../components/AcademicYearSelector";

export default function AssessmentsReports() {
  const { 
    classes, 
    getAssessmentReportsForClass, 
    exportAssessmentsCSV, 
    importAssessmentsFromCSV,
    academicYears,
    currentAcademicYearId,
    currentTermId,
    setClasses
  } = useSchoolData();
  
  const [level, setLevel] = useState<"O" | "A">("O");
  const classesForLevel = classes.filter((c: any) => c.level === level);
  const [selectedClassIndex, setSelectedClassIndex] = useState<number>(0);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [selectedStreamIndex, setSelectedStreamIndex] = useState<number>(0);
  const [showAllAssessments, setShowAllAssessments] = useState<boolean>(false);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);

  // Safely get current year and term
  const currentYear = useMemo(() => {
    if (!academicYears || !Array.isArray(academicYears)) return null;
    return academicYears.find((y: any) => y.id === currentAcademicYearId);
  }, [academicYears, currentAcademicYearId]);

  const currentTerm = useMemo(() => {
    if (!currentYear || !currentYear.terms || !Array.isArray(currentYear.terms)) return null;
    return currentYear.terms.find((t: any) => t.id === currentTermId);
  }, [currentYear, currentTermId]);

  useEffect(() => setSelectedClassIndex(0), [level, classes]);
  useEffect(() => setSelectedStreamIndex(0), [selectedClassIndex]);

  // Migration: Assign default year/term to assessments that don't have them
  useEffect(() => {
    if (!currentAcademicYearId || !currentTermId || classes.length === 0) return;
    if (!Array.isArray(academicYears) || academicYears.length === 0) return;

    let needsMigration = false;
    const updatedClasses = classes.map((cls: any) => {
      const assessments = cls.assessments || [];
      const migratedAssessments = assessments.map((a: any) => {
        // If assessment doesn't have academicYearId or termId, assign current ones
        if (!a.academicYearId || !a.termId) {
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
      setClasses(updatedClasses);
      setMigrationMessage('✅ Old assessments have been migrated to the current academic year and term.');
      setTimeout(() => setMigrationMessage(null), 5000);
    }
  }, [classes, currentAcademicYearId, currentTermId, setClasses, academicYears]);

  const currentClass = classesForLevel[selectedClassIndex];
  const globalClassIndex = classes.findIndex((c: any) => c.name === currentClass?.name && c.level === currentClass?.level);
  
  // Filter assessments - show all if toggle is on, otherwise filter by year/term
  const classAssessments = useMemo(() => {
    if (!currentClass) return [];
    return (currentClass.assessments || []).filter((a: any) => {
      if (showAllAssessments) return true;
      // If assessment has year/term, filter by current
      if (a.academicYearId && a.termId) {
        return a.academicYearId === currentAcademicYearId && a.termId === currentTermId;
      }
      // If assessment doesn't have year/term, show it in the "Unassigned" category
      return false;
    });
  }, [currentClass, currentAcademicYearId, currentTermId, showAllAssessments]);

  // Get unassigned assessments (those without year/term)
  const unassignedAssessments = useMemo(() => {
    if (!currentClass) return [];
    return (currentClass.assessments || []).filter((a: any) => 
      !a.academicYearId || !a.termId
    );
  }, [currentClass]);

  // Get reports filtered by year/term or all
  const reports: AssessmentReport[] = useMemo(() => {
    if (globalClassIndex === -1) return [];
    const allReports = getAssessmentReportsForClass(globalClassIndex);
    if (showAllAssessments) return allReports;
    return allReports.filter((r: AssessmentReport) => 
      classAssessments.some((a: any) => a.id === r.assessmentId)
    );
  }, [globalClassIndex, getAssessmentReportsForClass, classAssessments, showAllAssessments]);

  const currentStream = currentClass?.streams?.[selectedStreamIndex] ?? null;
  
  // Use filtered assessments for the stream
  const streamAssessments = showAllAssessments 
    ? (currentClass?.assessments || [])
    : classAssessments;

  const [modal, setModal] = useState<any | null>(null);

  function handleExport() {
    if (!currentClass) return;
    const globalIndex = classes.findIndex((c: any) => c.name === currentClass.name && c.level === currentClass.level);
    const csv = exportAssessmentsCSV(globalIndex);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentClass.name}_${currentYear?.name || ''}_${currentTerm?.name || ''}_assessments.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentClass) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const globalIndex = classes.findIndex((c: any) => c.name === currentClass.name && c.level === currentClass.level);
      const res = importAssessmentsFromCSV(globalIndex, text);
      setImportResult(`Created ${res?.created ?? 0}, Updated ${res?.updated ?? 0}`);
    };
    reader.readAsText(file);
    e.currentTarget.value = '';
  }

  function exportStudentReportCSV(student: any) {
    if (!currentClass) return;
    const rows: string[] = [];
    rows.push(['StudentID','Name','Assessment','Score','Max','Percent','Year','Term'].join(','));
    for (const a of streamAssessments) {
      const sc = a.scores?.[student.id];
      const pct = sc === null || sc === undefined ? '' : (a.maxScore ? ((sc / a.maxScore) * 100).toFixed(1) : String(sc));
      let year = 'Unassigned';
      let term = 'Unassigned';
      
      if (a.academicYearId && Array.isArray(academicYears)) {
        const foundYear = academicYears.find((y: any) => y.id === a.academicYearId);
        if (foundYear) {
          year = foundYear.name || 'Unassigned';
          if (a.termId && foundYear.terms && Array.isArray(foundYear.terms)) {
            const foundTerm = foundYear.terms.find((t: any) => t.id === a.termId);
            if (foundTerm) term = foundTerm.name || 'Unassigned';
          }
        }
      }
      
      rows.push([student.studentID, `${student.firstName} ${student.secondName}`.trim(), a.name, sc ?? '', a.maxScore ?? '', pct ? `${pct}%` : '', year, term].map((v) => String(v).includes(',') ? `"${String(v).replace(/"/g,'""') }"` : String(v)).join(','));
    }

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${student.firstName}_${student.secondName}_${currentYear?.name || ''}_${currentTerm?.name || ''}_report.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function gradeFromPercent(p: number | null) {
    if (p === null) return '—';
    if (p >= 90) return 'A';
    if (p >= 80) return 'B';
    if (p >= 70) return 'C';
    if (p >= 60) return 'D';
    return 'F';
  }

  const studentAverages = (currentStream?.students ?? []).map((stu: any) => {
    const scores = streamAssessments.map((a: any) => {
      const sc = a.scores?.[stu.id];
      return sc === null || sc === undefined ? null : (a.maxScore ? (sc / a.maxScore) * 100 : sc);
    });
    const valid = scores.filter((p) => typeof p === 'number') as number[];
    return { id: stu.id, avg: valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null };
  });

  const sorted = studentAverages.slice().filter((s) => s.avg !== null).sort((a, b) => (b.avg! - a.avg!));
  const ranks: Record<string, number> = {};
  sorted.forEach((s, i) => { ranks[s.id] = i + 1; });

  const classAverage = (() => {
    const vals = studentAverages.map((s) => s.avg).filter((x): x is number => typeof x === 'number');
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  })();

  const assessmentsWithScores = streamAssessments.filter((a: any) => 
    Object.values(a.scores).some((s: any) => typeof s === 'number')
  ).length;

  const unassignedCount = unassignedAssessments.length;

  return (
    <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link 
          href="/reports-and-analytics" 
          style={{ display: 'inline-block', marginBottom: '0.5rem', color: '#666', textDecoration: 'none' }}
        >
          ← Back to Reports
        </Link>
        <h1 style={{ margin: '0 0 0.25rem 0' }}>Assessments Reports</h1>
        <p className="muted">Aggregate assessment results across streams and export/import CSV data.</p>
      </div>

      {/* Migration Message */}
      {migrationMessage && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#dcfce7',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          marginBottom: '1rem',
          color: '#166534'
        }}>
          {migrationMessage}
        </div>
      )}

      {/* Academic Year & Term Selector */}
      <div style={{ marginBottom: '1.5rem' }}>
        <AcademicYearSelector compact />
      </div>

      {/* Current Year/Term Banner */}
      {currentYear && currentTerm && (
        <div style={{
          padding: '0.75rem 1rem',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(37, 99, 235, 0.02))',
          border: '1px solid rgba(37, 99, 235, 0.15)',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontWeight: '600', color: '#1d4ed8' }}>
            📅 Currently Viewing:
          </span>
          <span style={{ fontWeight: '500' }}>
            {currentYear.name} • {currentTerm.name}
          </span>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            ({currentYear.startDate} → {currentYear.endDate})
          </span>
          <span style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            background: currentTerm.isActive ? '#dbeafe' : '#f3f4f6',
            color: currentTerm.isActive ? '#1d4ed8' : '#6b7280'
          }}>
            {currentTerm.isActive ? 'Active Term' : 'Inactive'}
          </span>
          <span style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            background: '#dcfce7',
            color: '#166534'
          }}>
            {streamAssessments.length} Assessments • {assessmentsWithScores} with scores
          </span>
          {unassignedCount > 0 && (
            <span style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              background: '#fef3c7',
              color: '#92400e'
            }}>
              ⚠️ {unassignedCount} unassigned
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select 
          value={level} 
          onChange={(e) => setLevel(e.target.value as "O"|"A")}
          style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          <option value="O">O'Level</option>
          <option value="A">A'Level</option>
        </select>

        <select 
          value={selectedClassIndex} 
          onChange={(e) => setSelectedClassIndex(Number(e.target.value))}
          style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          {classesForLevel.map((c: any, i: number) => (
            <option key={c.name} value={i}>{c.name}</option>
          ))}
        </select>

        <select 
          value={selectedStreamIndex} 
          onChange={(e) => setSelectedStreamIndex(Number(e.target.value))}
          style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          {currentClass?.streams.map((s: any, i: number) => <option key={s.name} value={i}>{s.name}</option> )}
        </select>

        <button 
          onClick={handleExport} 
          disabled={!currentClass || streamAssessments.length === 0}
          style={{
            padding: '0.4rem 1rem',
            background: streamAssessments.length > 0 ? '#2563eb' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: streamAssessments.length > 0 ? 'pointer' : 'default'
          }}
        >
          Export CSV
        </button>
        <input type="file" accept=".csv" onChange={handleImport} style={{ marginLeft: 8 }} />
        {importResult && <div style={{ marginLeft: 8 }}><strong>Import:</strong> {importResult}</div>}
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={showAllAssessments} 
            onChange={(e) => setShowAllAssessments(e.target.checked)}
          />
          <span style={{ fontSize: '0.9rem' }}>Show all assessments (including unassigned)</span>
        </label>
      </div>

      <div style={{ marginTop: 18 }}>
        <h3>Assessment Summaries {!showAllAssessments && `(${currentYear?.name || ''} • ${currentTerm?.name || ''})`}</h3>
        {!reports.length && (
          <p className="muted">
            {showAllAssessments 
              ? 'No assessments found for this class.' 
              : 'No assessments found for this class in the selected year/term.'}
          </p>
        )}
        {reports.length > 0 && (
          <table className="simple-table" style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assessment</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Year</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Term</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Avg</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Min</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Max</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Submitted</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Missing</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r: AssessmentReport) => {
                const assessment = classAssessments.find((a: any) => a.id === r.assessmentId);
                let yearName = '—';
                let termName = '—';
                let isUnassigned = false;
                
                if (assessment) {
                  if (!assessment.academicYearId || !assessment.termId) {
                    isUnassigned = true;
                  } else if (Array.isArray(academicYears)) {
                    const year = academicYears.find((y: any) => y.id === assessment.academicYearId);
                    if (year) {
                      yearName = year.name || '—';
                      if (year.terms && Array.isArray(year.terms)) {
                        const term = year.terms.find((t: any) => t.id === assessment.termId);
                        if (term) termName = term.name || '—';
                      }
                    }
                  }
                }
                
                const isComplete = r.missing === 0;
                
                return (
                  <tr key={r.assessmentId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem' }}>
                      <strong>{r.name}</strong>
                      {r.date ? ` — ${r.date}` : ''}
                      {isUnassigned && (
                        <span style={{
                          marginLeft: '0.5rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.65rem',
                          background: '#fef3c7',
                          color: '#92400e'
                        }}>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem' }}>{yearName}</td>
                    <td style={{ padding: '0.5rem' }}>{termName}</td>
                    <td style={{ padding: '0.5rem' }}>{r.average ?? '—'}</td>
                    <td style={{ padding: '0.5rem' }}>{r.min ?? '—'}</td>
                    <td style={{ padding: '0.5rem' }}>{r.max ?? '—'}</td>
                    <td style={{ padding: '0.5rem' }}>{r.count}</td>
                    <td style={{ padding: '0.5rem' }}>{r.missing}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        background: isComplete ? '#dcfce7' : '#fef3c7',
                        color: isComplete ? '#166534' : '#92400e'
                      }}>
                        {isComplete ? '✅ Complete' : '⚠️ Incomplete'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <h3>Report Cards — {currentStream?.name ?? ''}</h3>
        {classAverage !== null && <p className="muted">Class average: {classAverage.toFixed(1)}%</p>}
        {!currentStream && <p className="muted">Select a class and stream to view report cards.</p>}
        {currentStream && (
          <div>
            {streamAssessments.length === 0 ? (
              <p className="muted">No assessments for this stream in the selected year/term.</p>
            ) : (
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>#</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>StudentID</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                      {streamAssessments.map((a: any) => (
                        <th key={a.id} style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
                          {a.name}
                        </th>
                      ))}
                      <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Avg (%)</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Grade</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Rank</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentStream.students.map((stu: any, i: number) => {
                      const scores = streamAssessments.map((a: any) => ({ score: a.scores?.[stu.id] ?? null, max: a.maxScore }));
                      const percentValues = scores.map((s: any) => (s.score === null ? null : (s.max ? (s.score / s.max) * 100 : s.score)));
                      const validPercents = percentValues.filter((p: any) => typeof p === 'number') as number[];
                      const avgPercent = validPercents.length ? (validPercents.reduce((s: number, v: number) => s + v, 0) / validPercents.length) : null;
                      return (
                        <tr key={stu.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.5rem' }}>{i+1}</td>
                          <td style={{ padding: '0.5rem' }}>{stu.studentID}</td>
                          <td style={{ padding: '0.5rem' }}>{stu.firstName} {stu.secondName}</td>
                          {scores.map((s: any, idx: number) => (
                            <td key={idx} style={{ padding: '0.5rem', textAlign: 'center' }}>
                              {s.score === null ? '—' : `${s.score}${s.max ? `/${s.max}` : ''}`}
                            </td>
                          ))}
                          <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600' }}>
                            {avgPercent === null ? '—' : `${avgPercent.toFixed(1)}%`}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            {avgPercent === null ? '—' : gradeFromPercent(avgPercent)}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            {ranks[stu.id] ?? (Object.keys(ranks).length ? (Object.keys(ranks).length + 1) : '—')}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <button 
                              onClick={() => setModal({ type: 'view', student: stu, scores, avgPercent })}
                              style={{
                                padding: '0.25rem 0.75rem',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                              }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {modal?.type === 'view' && (
              <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setModal(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h3>Report Card — {modal.student.firstName} {modal.student.secondName}</h3>
                  <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                    <strong>StudentID:</strong> {modal.student.studentID} &nbsp;|&nbsp; 
                    <strong>Average:</strong> {modal.avgPercent === null ? '—' : `${modal.avgPercent.toFixed(1)}%`} &nbsp;|&nbsp; 
                    <strong>Grade:</strong> {modal.avgPercent === null ? '—' : gradeFromPercent(modal.avgPercent)} &nbsp;|&nbsp; 
                    <strong>Rank:</strong> {ranks[modal.student.id] ?? '—'} &nbsp;|&nbsp; 
                    <strong>Year:</strong> {currentYear?.name || 'N/A'} &nbsp;|&nbsp; 
                    <strong>Term:</strong> {currentTerm?.name || 'N/A'}
                  </p>
                  <table style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assessment</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Score</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Max</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Percent</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Year</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Term</th>
                      </tr>
                    </thead>
                    <tbody>
                      {streamAssessments.map((a: any) => {
                        const sc = a.scores?.[modal.student.id];
                        const pct = sc === null || sc === undefined ? null : (a.maxScore ? (sc / a.maxScore) * 100 : sc);
                        let yearName = '—';
                        let termName = '—';
                        
                        if (a.academicYearId && Array.isArray(academicYears)) {
                          const year = academicYears.find((y: any) => y.id === a.academicYearId);
                          if (year) {
                            yearName = year.name || '—';
                            if (a.termId && year.terms && Array.isArray(year.terms)) {
                              const term = year.terms.find((t: any) => t.id === a.termId);
                              if (term) termName = term.name || '—';
                            }
                          }
                        }
                        
                        return (
                          <tr key={a.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem' }}>{a.name}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>{sc ?? '—'}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>{a.maxScore ?? '—'}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>{pct === null ? '—' : `${pct.toFixed(1)}%`}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>{yearName}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>{termName}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div style={{ marginTop: 12, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button 
                      className="primary" 
                      onClick={() => exportStudentReportCSV(modal.student)}
                      style={{
                        padding: '0.4rem 1rem',
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Export CSV
                    </button>
                    <button 
                      style={{ 
                        padding: '0.4rem 1rem', 
                        border: '1px solid #ddd', 
                        borderRadius: '4px', 
                        background: 'white', 
                        cursor: 'pointer' 
                      }} 
                      onClick={() => setModal(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            <style jsx>{`
              .modal-backdrop { 
                position: fixed; 
                inset: 0; 
                background: rgba(0,0,0,0.5); 
                display:flex; 
                align-items:center; 
                justify-content:center; 
                z-index: 1000; 
                padding: 1rem; 
              }
              .modal { 
                background:#fff; 
                padding:1.5rem; 
                border-radius:8px; 
                width:90%; 
                max-width: 700px; 
                max-height: 90vh; 
                overflow: auto; 
                box-shadow: 0 20px 60px rgba(0,0,0,0.3); 
              }
              @media print {
                body * { visibility: hidden; }
                .printable, .printable * { visibility: visible; }
                .printable { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; }
                .modal-backdrop { background: none; }
              }
            `}</style>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <Link href="/reports-and-analytics" style={{ color: '#2563eb', textDecoration: 'none' }}>
          ← Back to reports
        </Link>
      </div>
    </div>
  );
}