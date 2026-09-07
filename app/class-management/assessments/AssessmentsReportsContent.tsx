"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "../../components/ProtectedRoute";
import { useSchoolData, ClassItem, Student, Assessment, useIsClassTeacher } from "../../context/SchoolDataContext";
import { useAuth } from "../../context/SupabaseAuthContext";
import AcademicYearSelector from "../../components/AcademicYearSelector";

export default function AssessmentsPage() {
  const { 
    classes, 
    addAssessmentToClass, 
    removeAssessmentFromClass, 
    setScoreForAssessment, 
    setSubjectScoreForAssessment, 
    updateAssessmentInClass, 
    getAssessmentReportsForClass, 
    exportAssessmentsCSV, 
    importAssessmentsFromCSV,
    academicYears,
    currentAcademicYearId,
    currentTermId,
    setClasses
  } = useSchoolData();
  
  const { isAdmin } = useAuth();
  const [level, setLevel] = useState<"O" | "A">("O");
  const classesForLevel: ClassItem[] = classes.filter((c) => c.level === level);
  const [selectedClassIndex, setSelectedClassIndex] = useState<number>(0);
  const [selectedStreamName, setSelectedStreamName] = useState<string>(classesForLevel[0]?.streams[0]?.name ?? "");
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);
  
  // Find global class index
  const globalClassIndex = useMemo(() => {
    const currentClass = classesForLevel[selectedClassIndex];
    if (!currentClass) return -1;
    return classes.findIndex(c => c.name === currentClass.name && c.level === currentClass.level);
  }, [classes, classesForLevel, selectedClassIndex]);
  
  const isClassTeacherForStream = useIsClassTeacher(globalClassIndex, selectedStreamName);
  const canEdit = isAdmin || isClassTeacherForStream;
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);

  // Get current year and term
  const currentYear = useMemo(() => {
    if (!academicYears || !Array.isArray(academicYears)) return null;
    return academicYears.find((y: any) => y.id === currentAcademicYearId);
  }, [academicYears, currentAcademicYearId]);

  const currentTerm = useMemo(() => {
    if (!currentYear || !currentYear.terms || !Array.isArray(currentYear.terms)) return null;
    return currentYear.terms.find((t: any) => t.id === currentTermId);
  }, [currentYear, currentTermId]);

  // Migration: Assign default year/term to assessments that don't have them
  useEffect(() => {
    if (!currentAcademicYearId || !currentTermId || classes.length === 0) return;
    if (!Array.isArray(academicYears) || academicYears.length === 0) return;

    let needsMigration = false;
    const updatedClasses = classes.map((cls: any) => {
      const assessments = cls.assessments || [];
      const migratedAssessments = assessments.map((a: any) => {
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

  // form state for creating assessment
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newMax, setNewMax] = useState<number | undefined>(undefined);
  const [assessmentTypeModalOpen, setAssessmentTypeModalOpen] = useState(false);
  const [selectedAssessmentType, setSelectedAssessmentType] = useState<"Activity of Integration" | "End of Cycle" | null>(null);

  // import/export & UI state
  const [importResult, setImportResult] = useState<string | null>(null);
  const [addResult, setAddResult] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editMax, setEditMax] = useState<number | undefined>(undefined);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferYearId, setTransferYearId] = useState("");
  const [transferTermId, setTransferTermId] = useState("");
  const [scoreErrors, setScoreErrors] = useState<Record<string, string>>({});
  const [subjectPromptOpen, setSubjectPromptOpen] = useState(false);
  const [subjectPromptSelection, setSubjectPromptSelection] = useState<string>("");
  const [highlightSubjectName, setHighlightSubjectName] = useState<string | null>(null);

  useEffect(() => {
    const count = classes.filter((c) => c.level === level).length;
    if (selectedClassIndex >= count) setSelectedClassIndex(0);
  }, [level, classes, selectedClassIndex]);

  useEffect(() => {
    const firstStream = classesForLevel[selectedClassIndex]?.streams[0]?.name ?? "";
    setSelectedStreamName((prev) => (classesForLevel[selectedClassIndex]?.streams.some((st: any) => st.name === prev) ? prev : firstStream));
  }, [selectedClassIndex, classesForLevel]);

  const currentClass = classesForLevel[selectedClassIndex];
  const currentStream = currentClass?.streams.find((s: any) => s.name === selectedStreamName) ?? null;
  
  // Filter assessments by current year and term
  const assessments: Assessment[] = useMemo(() => {
    if (!currentClass) return [];
    return (currentClass.assessments || []).filter((a: any) => 
      a.academicYearId === currentAcademicYearId && 
      a.termId === currentTermId
    );
  }, [currentClass, currentAcademicYearId, currentTermId]);

  const selectedAssessment: Assessment | null = assessments.find((a) => a.id === selectedAssessmentId) ?? null;

  const transferYear = academicYears.find((year) => year.id === transferYearId);

  function openTransferModal() {
    if (!selectedAssessment) return;
    const destinationYearId = selectedAssessment.academicYearId || currentAcademicYearId;
    const destinationYear = academicYears.find((year) => year.id === destinationYearId);
    const destinationTermId = selectedAssessment.termId || currentTermId;
    setTransferYearId(destinationYearId);
    setTransferTermId(destinationYear?.terms.some((term) => term.id === destinationTermId)
      ? destinationTermId
      : destinationYear?.terms[0]?.id || "");
    setTransferModalOpen(true);
  }

  function transferSelectedAssessment() {
    if (!currentClass || !selectedAssessment || !transferYearId || !transferTermId) return;
    const destinationYear = academicYears.find((year) => year.id === transferYearId);
    const destinationTerm = destinationYear?.terms.find((term) => term.id === transferTermId);
    if (!destinationYear || !destinationTerm) return;

    if (transferYearId === selectedAssessment.academicYearId && transferTermId === selectedAssessment.termId) {
      setTransferModalOpen(false);
      return;
    }

    const globalIndex = classes.findIndex((c) => c.name === currentClass.name && c.level === currentClass.level);
    updateAssessmentInClass(globalIndex, selectedAssessment.id, {
      academicYearId: transferYearId,
      termId: transferTermId,
    });
    setTransferModalOpen(false);
    setSelectedAssessmentId(null);
    setAddResult(`Assessment moved to ${destinationYear.name}, ${destinationTerm.name}`);
    setTimeout(() => setAddResult(null), 4000);
  }

  // Get unassigned assessments count
  const unassignedCount = useMemo(() => {
    if (!currentClass) return 0;
    return (currentClass.assessments || []).filter((a: any) => 
      !a.academicYearId || !a.termId
    ).length;
  }, [currentClass]);

  function handleAddAssessment() {
    if (!currentClass) { alert('Select a class'); return; }
    if (!newName.trim()) { alert('Please provide a name for the assessment'); return; }
    if (!selectedAssessmentType) { alert('Please select an assessment type'); return; }
    if (!currentAcademicYearId || !currentTermId) { 
      alert('Please select an academic year and term first.'); 
      return; 
    }
    
    const globalIndex = classes.findIndex((c) => c.name === currentClass.name && c.level === currentClass.level);
    const maxScore = selectedAssessmentType === "Activity of Integration" ? newMax || 3 : newMax || 80;
    const createdId = addAssessmentToClass(globalIndex, { 
      name: newName.trim(), 
      date: newDate || undefined, 
      maxScore,
      academicYearId: currentAcademicYearId,
      termId: currentTermId
    });
    
    setSelectedAssessmentId(createdId);
    setAddResult('Assessment created');
    setTimeout(() => setAddResult(null), 3000);
    setNewName(""); 
    setNewDate(""); 
    setNewMax(undefined); 
    setSelectedAssessmentType(null);
  }

  function handleExportCSV() {
    if (!currentClass) return;
    const globalIndex = classes.findIndex((c) => c.name === currentClass.name && c.level === currentClass.level);
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

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentClass) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const globalIndex = classes.findIndex((c) => c.name === currentClass.name && c.level === currentClass.level);
      const res = importAssessmentsFromCSV(globalIndex, text);
      setImportResult(`Created ${res?.created ?? 0}, Updated ${res?.updated ?? 0}`);
    };
    reader.readAsText(file);
    e.currentTarget.value = '';
  }

  function handleSetScore(studentId: string, value: string) {
    if (!selectedAssessment) return;
    const parsed = value === "" ? null : Number(value);
    const max = selectedAssessment?.maxScore;
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0 || (typeof max === 'number' && parsed > max))) {
      setScoreErrors((prev) => ({ ...prev, [studentId]: `Invalid score${typeof max === 'number' ? ` (0-${max})` : ''}` }));
      return;
    }

    setScoreErrors((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });

    const globalIndex = classes.findIndex((c) => c.name === currentClass?.name && c.level === currentClass?.level);
    setScoreForAssessment(globalIndex, selectedAssessment.id, studentId, parsed);
  }

  function handleSetSubjectScore(subjectName: string, studentId: string, value: string) {
    if (!selectedAssessment) return;
    const parsed = value === "" ? null : Number(value);
    const max = selectedAssessment?.maxScore;
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0 || (typeof max === 'number' && parsed > max))) {
      setScoreErrors((prev) => ({ ...prev, [`${subjectName}:${studentId}`]: `Invalid score${typeof max === 'number' ? ` (0-${max})` : ''}` }));
      return;
    }
    setScoreErrors((prev) => {
      const next = { ...prev };
      delete next[`${subjectName}:${studentId}`];
      return next;
    });
    const globalIndex = classes.findIndex((c) => c.name === currentClass?.name && c.level === currentClass?.level);
    setSubjectScoreForAssessment(globalIndex, selectedAssessment.id, subjectName, studentId, parsed);
  }

  return (
    <ProtectedRoute>
      <div className="assessments-page">
        <div style={{ marginBottom: '1.5rem' }}>
          <Link 
            href="/class-management" 
            style={{ display: 'inline-block', marginBottom: '0.5rem', color: '#666', textDecoration: 'none' }}
          >
            ← Back to Class Management
          </Link>
          <h1 style={{ margin: '0 0 0.25rem 0' }}>Assessments</h1>
          <p className="muted">Create assessments for a class and enter scores per learner.</p>
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
          <AcademicYearSelector />
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
              {assessments.length} Assessments
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

        <div className="grid">
          <aside className="sidebar">
            <div className="level-toggle">
              <select value={level} onChange={(e) => setLevel(e.target.value as "O"|"A")}> 
                <option value="O">O'Level</option>
                <option value="A">A'Level</option>
              </select>
            </div>

            <h3>Classes</h3>
            <div className="classes-list">
              <select value={selectedClassIndex} onChange={(e) => setSelectedClassIndex(Number(e.target.value))} suppressHydrationWarning>
                {classesForLevel.map((c: ClassItem, i: number) => (
                  <option key={c.name} value={i}>{c.name}</option>
                ))}
              </select>
            </div> 

            <h4 style={{ marginTop: 12 }}>Streams</h4>
            <div className="streams">
              <select value={selectedStreamName} onChange={(e) => setSelectedStreamName(e.target.value)} suppressHydrationWarning>
                {(currentClass?.streams ?? []).map((s: any) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div> 

            <Link href="/class-management" style={{ display: 'block', marginTop: 12 }}>Back to Classes</Link>
          </aside>

          <section className="main">
            <div className="controls">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input 
                  placeholder="Assessment name" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  disabled={!selectedAssessmentType} 
                  style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
                <input 
                  type="date" 
                  value={newDate} 
                  onChange={(e) => setNewDate(e.target.value)} 
                  disabled={!selectedAssessmentType} 
                  style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
                <input 
                  type="number" 
                  placeholder="Max score" 
                  value={newMax ?? ''} 
                  onChange={(e) => setNewMax(e.target.value === '' ? undefined : Number(e.target.value))} 
                  style={{ width: 120, padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} 
                  disabled={!selectedAssessmentType} 
                />
                <button 
                  className="primary" 
                  onClick={selectedAssessmentType ? handleAddAssessment : () => setAssessmentTypeModalOpen(true)} 
                  disabled={!canEdit || !currentAcademicYearId || !currentTermId}
                  style={{
                    padding: '0.35rem 0.75rem',
                    background: (!canEdit || !currentAcademicYearId || !currentTermId) ? '#ccc' : '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (!canEdit || !currentAcademicYearId || !currentTermId) ? 'default' : 'pointer'
                  }}
                >
                  {selectedAssessmentType ? 'Add assessment' : 'New assessment'}
                </button>
                {selectedAssessmentType && (
                  <button onClick={() => {
                    setSelectedAssessmentType(null);
                    setNewName("");
                    setNewDate("");
                    setNewMax(undefined);
                  }} style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>
                    Reset
                  </button>
                )}
              </div>
              {selectedAssessmentType && (
                <div style={{ marginTop: 8, fontSize: '0.9em', color: '#666' }}>
                  Type: <strong>{selectedAssessmentType}</strong> (Max: {selectedAssessmentType === "Activity of Integration" ? newMax || 3 : newMax || 80})
                </div>
              )}
              {!currentAcademicYearId && (
                <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#d97706' }}>
                  ⚠️ Please select an academic year and term before creating assessments.
                </div>
              )}

              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontWeight: '500' }}>Choose assessment: </label>
                <select 
                  value={selectedAssessmentId ?? ""} 
                  onChange={(e) => setSelectedAssessmentId(e.target.value || null)} 
                  style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                  suppressHydrationWarning
                >
                  <option value="">-- select --</option>
                  {assessments.map((a: Assessment) => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.date ? ` — ${a.date}` : ''}
                    </option>
                  ))}
                </select>
                {addResult && <span style={{ color: 'green' }}>{addResult}</span>}
                {selectedAssessment && (
                  <>
                    <button 
                      style={{ padding: '0.35rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: 'pointer' }} 
                      onClick={() => {
                        if (!currentClass) return; 
                        const globalIndex = classes.findIndex((c) => c.name === currentClass.name && c.level === currentClass.level); 
                        if (!confirm('Remove assessment?')) return; 
                        removeAssessmentFromClass(globalIndex, selectedAssessment.id); 
                        setSelectedAssessmentId(null);
                      }} 
                      disabled={!canEdit}
                    >
                      Remove
                    </button>

                    <button 
                      style={{ padding: '0.35rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: 'pointer' }} 
                      onClick={() => {
                        setEditName(selectedAssessment.name);
                        setEditDate(selectedAssessment.date ?? '');
                        setEditMax(selectedAssessment.maxScore);
                        setEditModalOpen(true);
                      }} 
                      disabled={!canEdit}
                    >
                      Edit
                    </button>

                    <button
                      style={{ padding: '0.35rem 0.75rem', border: '1px solid #2563eb', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer' }}
                      onClick={openTransferModal}
                      disabled={!canEdit}
                    >
                      Move to year/term
                    </button>

                    <button 
                      style={{ padding: '0.35rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: 'pointer' }} 
                      onClick={handleExportCSV}
                    >
                      Export CSV
                    </button>
                    <input style={{ marginLeft: 8 }} type="file" accept=".csv" onChange={handleImportFile} />

                    <button 
                      className="primary" 
                      style={{ padding: '0.35rem 0.75rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }} 
                      onClick={() => {
                        setSubjectPromptSelection((currentStream?.subjects?.[0]?.name) ?? (typeof (currentStream?.subjects?.[0]) === 'string' ? String(currentStream?.subjects?.[0]) : ""));
                        setSubjectPromptOpen(true);
                      }}
                    >
                      Enter subject scores
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="panel" style={{ marginTop: 18 }}>
              <h3>{selectedAssessment ? selectedAssessment.name : 'No assessment selected'}</h3>
              {/* edit modal simple implementation */}
              {editModalOpen && selectedAssessment && (
                <div className="modal-backdrop" role="dialog" aria-modal="true">
                  <div className="modal">
                    <h3>Edit assessment</h3>
                    <label>Name<input value={editName} onChange={(e) => setEditName(e.target.value)} /></label>
                    <label>Date<input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} /></label>
                    <label>Max score<input type="number" value={editMax ?? ''} onChange={(e) => setEditMax(e.target.value === '' ? undefined : Number(e.target.value))} /></label>
                    <div style={{ marginTop: 8 }}>
                      <button className="primary" onClick={() => {
                        const globalIndex = classes.findIndex((c) => c.name === currentClass?.name && c.level === currentClass?.level);
                        updateAssessmentInClass(globalIndex, selectedAssessment.id, { name: editName.trim(), date: editDate || undefined, maxScore: editMax });
                        setEditModalOpen(false);
                      }}>Save</button>
                      <button onClick={() => setEditModalOpen(false)} style={{ marginLeft: 8 }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {transferModalOpen && selectedAssessment && (
                <div className="modal-backdrop" role="dialog" aria-modal="true">
                  <div className="modal">
                    <h3>Move assessment</h3>
                    <p style={{ marginBottom: 16 }}>
                      Move <strong>{selectedAssessment.name}</strong> and keep all entered scores.
                    </p>
                    <label>
                      Academic year
                      <select
                        value={transferYearId}
                        onChange={(e) => {
                          const nextYearId = e.target.value;
                          const nextYear = academicYears.find((year) => year.id === nextYearId);
                          setTransferYearId(nextYearId);
                          setTransferTermId(nextYear?.terms[0]?.id || "");
                        }}
                      >
                        {academicYears.map((year) => (
                          <option key={year.id} value={year.id}>{year.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Term
                      <select value={transferTermId} onChange={(e) => setTransferTermId(e.target.value)}>
                        {(transferYear?.terms ?? []).map((term) => (
                          <option key={term.id} value={term.id}>{term.name}</option>
                        ))}
                      </select>
                    </label>
                    <div style={{ marginTop: 12 }}>
                      <button className="primary" onClick={transferSelectedAssessment} disabled={!transferYearId || !transferTermId}>
                        Move assessment
                      </button>
                      <button onClick={() => setTransferModalOpen(false)} style={{ marginLeft: 8 }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {assessmentTypeModalOpen && (
                <div className="modal-backdrop" role="dialog" aria-modal="true">
                  <div className="modal">
                    <h3>Create New Assessment</h3>
                    <p style={{ marginBottom: 16 }}>Select assessment type:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button 
                        className={selectedAssessmentType === "Activity of Integration" ? "primary" : ""}
                        onClick={() => setSelectedAssessmentType("Activity of Integration")}
                        style={{ 
                          padding: 12, 
                          border: selectedAssessmentType === "Activity of Integration" ? '2px solid #007bff' : '1px solid #ddd', 
                          borderRadius: 4, 
                          cursor: 'pointer', 
                          textAlign: 'left',
                          background: selectedAssessmentType === "Activity of Integration" ? '#e8f0fe' : 'white'
                        }}
                      >
                        <strong>Activity of Integration</strong>
                        <div style={{ fontSize: '0.85em', color: '#666', marginTop: 4 }}>For C1 and C2 activities (default max: 3)</div>
                      </button>
                      <button 
                        className={selectedAssessmentType === "End of Cycle" ? "primary" : ""}
                        onClick={() => setSelectedAssessmentType("End of Cycle")}
                        style={{ 
                          padding: 12, 
                          border: selectedAssessmentType === "End of Cycle" ? '2px solid #007bff' : '1px solid #ddd', 
                          borderRadius: 4, 
                          cursor: 'pointer', 
                          textAlign: 'left',
                          background: selectedAssessmentType === "End of Cycle" ? '#e8f0fe' : 'white'
                        }}
                      >
                        <strong>End of Cycle</strong>
                        <div style={{ fontSize: '0.85em', color: '#666', marginTop: 4 }}>For end-of-cycle assessments (default max: 80)</div>
                      </button>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <button 
                        className="primary" 
                        onClick={() => setAssessmentTypeModalOpen(false)} 
                        disabled={!selectedAssessmentType}
                        style={{
                          padding: '0.35rem 0.75rem',
                          background: selectedAssessmentType ? '#2563eb' : '#ccc',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: selectedAssessmentType ? 'pointer' : 'default'
                        }}
                      >
                        Continue
                      </button>
                      <button 
                        onClick={() => {
                          setAssessmentTypeModalOpen(false);
                          setSelectedAssessmentType(null);
                        }} 
                        style={{ marginLeft: 8, padding: '0.35rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {subjectPromptOpen && selectedAssessment && (
                <div className="modal-backdrop" role="dialog" aria-modal="true">
                  <div className="modal">
                    <h3>Select subject for scores</h3>
                    <div>
                      <select 
                        value={subjectPromptSelection} 
                        onChange={(e) => setSubjectPromptSelection(e.target.value)}
                        style={{ width: '100%', padding: '0.35rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                      >
                        {(currentStream?.subjects ?? []).map((sub: any) => {
                          const name = typeof sub === 'string' ? sub : sub?.name;
                          return <option key={name} value={name}>{name}</option>;
                        })}
                      </select>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <button className="primary" onClick={() => {
                        setSubjectPromptOpen(false);
                        setHighlightSubjectName(subjectPromptSelection);
                        const anchorId = `subject-${subjectPromptSelection.replace(/\s+/g, '-')}`;
                        const el = document.getElementById(anchorId);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}>Go</button>
                      <button onClick={() => setSubjectPromptOpen(false)} style={{ marginLeft: 8 }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
              {selectedAssessment && (
                <div>
                  <p className="muted">Enter scores for learners in <strong>{selectedStreamName}</strong>. Scores saved automatically.</p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                    <div><strong>Max:</strong> {selectedAssessment?.maxScore ?? '—'}</div>
                    <div><strong>Submitted:</strong> {Object.values(selectedAssessment?.scores ?? {}).filter((v) => typeof v === 'number').length}</div>
                    <div><strong>Missing:</strong> {(currentStream?.students ?? []).length - Object.values(selectedAssessment?.scores ?? {}).filter((v) => typeof v === 'number').length}</div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      <strong>Year:</strong> {currentYear?.name || '—'} • <strong>Term:</strong> {currentTerm?.name || '—'}
                    </div>
                  </div>

                  <table className="simple-table" style={{ width: '100%', marginTop: 8 }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>StudentID</th>
                        <th>Name</th>
                        <th>Score</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(currentStream?.students ?? []).map((stu: Student, i: number) => (
                        <tr key={stu.id} className={scoreErrors[stu.id] ? 'error-row' : ''}>
                          <td>{i + 1}</td>
                          <td>{stu.studentID}</td>
                          <td>{stu.firstName} {stu.secondName}</td>
                          <td>
                            <input 
                              type="number" 
                              min={0} 
                              max={selectedAssessment?.maxScore ?? undefined} 
                              value={selectedAssessment?.scores?.[stu.id] ?? ''} 
                              onChange={(e) => handleSetScore(stu.id, e.target.value)} 
                              disabled={!canEdit} 
                              style={{ 
                                width: '80px', 
                                padding: '0.25rem', 
                                borderRadius: '4px', 
                                border: '1px solid #e5e7eb' 
                              }}
                            />
                          </td>
                          <td style={{ color: 'red', fontSize: 12 }}>{scoreErrors[stu.id] ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ marginTop: 24 }}>
                    <h4>Subject Scores</h4>
                    {highlightSubjectName && (
                      <div className="muted" style={{ marginTop: 6 }}>
                        Showing only: <strong>{highlightSubjectName}</strong>
                        <button 
                          style={{ marginLeft: 8, padding: '0.2rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: 'pointer' }} 
                          onClick={() => setHighlightSubjectName(null)}
                        >
                          Show all subjects
                        </button>
                      </div>
                    )}
                    {(currentStream?.subjects ?? []).map((sub: any) => {
                      const subjectName = typeof sub === 'string' ? sub : sub?.name;
                      if (highlightSubjectName && subjectName !== highlightSubjectName) return null;
                      const scoresForSubject = selectedAssessment?.subjectScores?.[subjectName] ?? {};
                      const submittedCount = Object.values(scoresForSubject).filter((v) => typeof v === 'number').length;
                      const missingCount = (currentStream?.students ?? []).length - submittedCount;
                      return (
                        <div key={subjectName} id={`subject-${subjectName.replace(/\s+/g, '-')}`} className={highlightSubjectName === subjectName ? 'highlight-subject' : ''} style={{ marginTop: 12 }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <strong>{subjectName}</strong>
                            <div><strong>Submitted:</strong> {submittedCount}</div>
                            <div><strong>Missing:</strong> {missingCount}</div>
                            {highlightSubjectName === subjectName && (
                              <button 
                                style={{ marginLeft: 'auto', padding: '0.2rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: 'pointer' }} 
                                onClick={() => setHighlightSubjectName(null)}
                              >
                                Clear highlight
                              </button>
                            )}
                          </div>
                          <table className="simple-table" style={{ width: '100%', marginTop: 8 }}>
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>StudentID</th>
                                <th>Name</th>
                                <th>Score</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {(currentStream?.students ?? []).map((stu: Student, i: number) => (
                                <tr key={`${subjectName}:${stu.id}`} className={scoreErrors[`${subjectName}:${stu.id}`] ? 'error-row' : ''}>
                                  <td>{i + 1}</td>
                                  <td>{stu.studentID}</td>
                                  <td>{stu.firstName} {stu.secondName}</td>
                                  <td>
                                    <input
                                      type="number"
                                      min={0}
                                      max={selectedAssessment?.maxScore ?? undefined}
                                      value={(scoresForSubject as Record<string, number | null>)[stu.id] ?? ''}
                                      onChange={(e) => handleSetSubjectScore(subjectName, stu.id, e.target.value)}
                                      disabled={!canEdit}
                                      style={{ 
                                        width: '80px', 
                                        padding: '0.25rem', 
                                        borderRadius: '4px', 
                                        border: '1px solid #e5e7eb' 
                                      }}
                                    />
                                  </td>
                                  <td style={{ color: 'red', fontSize: 12 }}>{scoreErrors[`${subjectName}:${stu.id}`] ?? ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!selectedAssessment && (
                <p className="muted">Select an assessment to view and enter scores.</p>
              )}
            </div>
          </section>
        </div>

        <style jsx>{`
          .assessments-page select, .assessments-page input[type="number"], .assessments-page input[type="date"] { 
            padding: 0.35rem 0.5rem; 
            border-radius: 6px; 
            border: 1px solid #d1d5db; 
          }
          .classes-list select { min-width: 160px; }
          .streams select { min-width: 120px; }
          .level-toggle select { min-width: 100px; margin-bottom: 8px; }
          .simple-table input[type="number"] { 
            width: 80px; 
            padding: 0.25rem; 
            border-radius: 4px; 
            border: 1px solid #e5e7eb; 
          }
          .error-row { background: #fff5f5; }
          .highlight-subject { outline: 2px solid #2563eb; background: #eff6ff; }
          
          .grid { 
            display: grid; 
            grid-template-columns: 200px 1fr; 
            gap: 1.5rem; 
          }
          .sidebar { 
            border-right: 1px solid #e5e7eb; 
            padding-right: 1rem; 
          }
          .main { min-width: 0; }
          .controls { margin-bottom: 1rem; }
          .panel { 
            border: 1px solid #e5e7eb; 
            border-radius: 8px; 
            padding: 1rem; 
            background: white; 
          }
          .modal-backdrop { 
            position: fixed; 
            inset: 0; 
            background: rgba(0,0,0,0.5); 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            z-index: 1000; 
          }
          .modal { 
            background: white; 
            padding: 1.5rem; 
            border-radius: 8px; 
            width: 400px; 
            max-width: 90vw; 
            max-height: 90vh; 
            overflow: auto; 
          }
          .modal label { 
            display: block; 
            margin-bottom: 0.5rem; 
          }
          .modal input { 
            width: 100%; 
            padding: 0.35rem; 
            border-radius: 4px; 
            border: 1px solid #d1d5db; 
            margin-top: 0.25rem; 
          }
          .primary { 
            background: #2563eb; 
            color: white; 
            border: none; 
            padding: 0.35rem 0.75rem; 
            border-radius: 6px; 
            cursor: pointer; 
          }
          .primary:disabled { 
            background: #ccc; 
            cursor: default; 
          }
          .muted { color: #6b7280; }
          
          @media (max-width: 768px) {
            .grid { 
              grid-template-columns: 1fr; 
            }
            .sidebar { 
              border-right: none; 
              padding-right: 0; 
              margin-bottom: 1rem; 
            }
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}