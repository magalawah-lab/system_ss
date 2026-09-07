"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import ProtectedRoute from "../../components/ProtectedRoute";
import { useSchoolData, ClassItem, Student, Assessment, SubjectEntry } from "../../context/SchoolDataContext";
import { useAuth } from "../../context/SupabaseAuthContext";
import AcademicYearSelector from "../../components/AcademicYearSelector";

// Subject name shortening map
const subjectShortcuts: Record<string, string> = {
  "English": "Eng",
  "Mathematics": "Math",
  "Agriculture": "Agr",
  "Biology": "Bio",
  "Chemistry": "Chem",
  "Physics": "Phy",
  "History": "Hist",
  "Geography": "Geo",
  "Commerce": "Com",
  "Accounts": "Acc",
  "Economics": "Eco",
  "Business Studies": "Bus",
  "Computer Science": "CS",
  "Information Technology": "IT",
  "Religious Education": "RE",
  "Physical Education": "PE",
  "Art": "Art",
  "Music": "Mus",
  "French": "Fr",
  "Kiswahili": "Kisw",
  "Literature": "Lit",
  "Additional Mathematics": "Add Math",
  "Further Mathematics": "Further Math",
};

const shortenSubject = (name: string): string => {
  return subjectShortcuts[name] || name;
};

export default function ConsolidatedMarksheetPage() {
  return (
    <React.Suspense fallback={
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading...</p>
      </div>
    }>
      <ConsolidatedMarksheetContent />
    </React.Suspense>
  );
}

function ConsolidatedMarksheetContent() {
  const { 
    classes, 
    setSubjectScoreForAssessment, 
    hasUnsavedChanges, 
    saveChanges, 
    isSaving, 
    catalog,
    academicYears,
    currentAcademicYearId,
    currentTermId,
  } = useSchoolData();
  const { isAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [level, setLevel] = useState<"O" | "A">("O");
  const [selectedClassIndex, setSelectedClassIndex] = useState(0);
  const [selectedStreamName, setSelectedStreamName] = useState("");
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<string[]>([]);
  
  const isInitialMount = useRef(true);
  const previousUrl = useRef<string>("");

  // Memoized derived data
  const classesForLevel = useMemo(() => {
    return classes.filter(c => c.level === level);
  }, [classes, level]);

  const currentClass = useMemo(() => {
    return classesForLevel[selectedClassIndex] || null;
  }, [classesForLevel, selectedClassIndex]);

  const currentStream = useMemo(() => {
    return currentClass?.streams.find(s => s.name === selectedStreamName) ?? null;
  }, [currentClass, selectedStreamName]);

  // Filter assessments by current academic year and term
  const assessments = useMemo(() => {
    return (currentClass?.assessments ?? []).filter(a => 
      a.academicYearId === currentAcademicYearId && 
      a.termId === currentTermId
    );
  }, [currentClass, currentAcademicYearId, currentTermId]);

  const selectedAssessments = useMemo(() => {
    return assessments.filter(a => selectedAssessmentIds.includes(a.id));
  }, [assessments, selectedAssessmentIds]);

  const streamSubjects = useMemo(() => {
    return (currentStream?.subjects ?? []).map(s => 
      typeof s === "string" ? { name: s } : s
    );
  }, [currentStream]);

  const classKey = useMemo(() => {
    return currentClass ? `${currentClass.name}-${currentClass.level}` : null;
  }, [currentClass]);

  // Get current year and term names
  const currentYear = academicYears.find(y => y.id === currentAcademicYearId);
  const currentTerm = currentYear?.terms.find(t => t.id === currentTermId);

  // Initialize from URL - only on mount
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const levelParam = params.get("level");
    const classParam = params.get("class");
    const streamParam = params.get("stream");
    const assessmentParam = params.get("assessmentIds");

    if (levelParam === "A" || levelParam === "O") {
      setLevel(levelParam);
    }

    const arr = levelParam === "A" 
      ? classes.filter(c => c.level === "A") 
      : classes.filter(c => c.level === "O");

    if (classParam && arr.length > 0) {
      const decoded = decodeURIComponent(classParam);
      const idx = arr.findIndex(c => c.name === decoded);
      if (idx >= 0) {
        setSelectedClassIndex(idx);
        const cls = arr[idx];
        if (streamParam) {
          setSelectedStreamName(decodeURIComponent(streamParam));
        } else if (cls?.streams[0]) {
          setSelectedStreamName(cls.streams[0].name);
        }
        if (assessmentParam) {
          const ids = assessmentParam.split(",").filter(Boolean);
          setSelectedAssessmentIds(ids);
        }
      }
    }

    isInitialMount.current = false;
  }, []);

  // Update URL - with stable dependencies
  useEffect(() => {
    if (isInitialMount.current) return;
    if (!classKey) return;

    const params = new URLSearchParams();
    params.set("level", level);
    params.set("class", encodeURIComponent(currentClass!.name));
    if (selectedStreamName) params.set("stream", encodeURIComponent(selectedStreamName));
    if (selectedAssessmentIds.length > 0) {
      params.set("assessmentIds", selectedAssessmentIds.join(","));
    }

    const url = `/class-management/consolidated-marksheet?${params.toString()}`;
    
    if (previousUrl.current !== url) {
      previousUrl.current = url;
      router.replace(url);
    }
  }, [level, selectedClassIndex, selectedStreamName, selectedAssessmentIds, classKey, router]);

  // Fix class/stream selection
  useEffect(() => {
    if (classesForLevel.length === 0) return;
    if (selectedClassIndex >= classesForLevel.length) {
      setSelectedClassIndex(0);
    }
    
    const stream = classesForLevel[selectedClassIndex]?.streams[0]?.name || "";
    if (stream && !selectedStreamName) {
      setSelectedStreamName(stream);
    }
  }, [classesForLevel, selectedClassIndex]);

  // Reset assessments when stream, year, or term changes
  useEffect(() => {
    if (isInitialMount.current) return;
    setSelectedAssessmentIds([]);
  }, [selectedStreamName, currentAcademicYearId, currentTermId]);

  const handleScoreChange = useCallback((assessmentId: string, subjectName: string, studentId: string, value: string) => {
    const asm = assessments.find(a => a.id === assessmentId);
    if (!asm) return;
    
    const parsed = value === "" ? null : Number(value);
    const max = asm.maxScore;
    
    if (parsed !== null && (isNaN(parsed) || parsed < 0 || (typeof max === "number" && parsed > max))) {
      return;
    }
    
    const classIndex = classes.findIndex(c => c.name === currentClass?.name && c.level === currentClass?.level);
    if (classIndex === -1) return;
    
    setSubjectScoreForAssessment(classIndex, assessmentId, subjectName, studentId, parsed);
  }, [assessments, classes, currentClass, setSubjectScoreForAssessment]);

  const toggleAssessment = useCallback((id: string) => {
    setSelectedAssessmentIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const selectAllAssessments = useCallback(() => {
    setSelectedAssessmentIds(assessments.map(a => a.id));
  }, [assessments]);

  const clearAllAssessments = useCallback(() => {
    setSelectedAssessmentIds([]);
  }, []);

  const studentTakesSubject = useCallback((student: Student, subjectName: string) => {
    // Check if subject is optional using level-specific catalog key
    const levelKey = `${level}:${subjectName}`;
    const isOptional = catalog?.[levelKey] === "optional" || 
                      (!catalog?.[levelKey] && catalog?.[subjectName] === "optional");
    return !isOptional || student.optionalSubjects.includes(subjectName);
  }, [catalog, level]);

  const getScore = useCallback((assessmentId: string, subjectName: string, studentId: string) => {
    const asm = assessments.find(a => a.id === assessmentId);
    if (!asm) return null;
    return (asm.subjectScores?.[subjectName]?.[studentId]) ?? null;
  }, [assessments]);

  const progress = useMemo(() => {
    if (!currentStream || selectedAssessments.length === 0 || streamSubjects.length === 0) return null;
    
    let total = 0, filled = 0;
    
    for (const asm of selectedAssessments) {
      for (const sub of streamSubjects) {
        const students = currentStream.students.filter(s => studentTakesSubject(s, sub.name));
        for (const stu of students) {
          total++;
          const score = getScore(asm.id, sub.name, stu.id);
          if (typeof score === "number") filled++;
        }
      }
    }
    
    return {
      total,
      filled,
      percentage: total > 0 ? Math.round((filled / total) * 100) : 0
    };
  }, [currentStream, selectedAssessments, streamSubjects, studentTakesSubject, getScore]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "Escape") {
      (e.target as HTMLInputElement).value = "";
      (e.target as HTMLInputElement).blur();
    }
  }, []);

  const handleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#000';
  }, []);

  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#ddd';
  }, []);

  // Memoize the table rendering
  const tableContent = useMemo(() => {
    if (selectedAssessmentIds.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', border: '1px solid #ddd', borderRadius: '4px' }}>
          <p>Select assessments above to begin</p>
        </div>
      );
    }

    if (streamSubjects.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', border: '1px solid #ddd', borderRadius: '4px' }}>
          <p>No subjects found for this stream</p>
        </div>
      );
    }

    if (!currentStream) {
      return null;
    }

    return (
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '4px', 
        overflow: 'auto',
        maxHeight: '70vh',
        position: 'relative'
      }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          fontSize: '0.85rem',
          minWidth: '600px'
        }}>
          <thead>
            <tr>
              <th style={{ 
                position: 'sticky',
                top: 0,
                left: 0, 
                zIndex: 20, 
                background: '#f5f5f5',
                border: '1px solid #ddd',
                padding: '0.4rem',
                minWidth: '30px',
                fontWeight: '600'
              }}>#</th>
              <th style={{ 
                position: 'sticky',
                top: 0,
                left: '30px', 
                zIndex: 20, 
                background: '#f5f5f5',
                border: '1px solid #ddd',
                padding: '0.4rem',
                minWidth: '60px',
                fontWeight: '600'
              }}>ID</th>
              <th style={{ 
                position: 'sticky',
                top: 0,
                left: '90px', 
                zIndex: 20, 
                background: '#f5f5f5',
                border: '1px solid #ddd',
                padding: '0.4rem',
                minWidth: '120px',
                textAlign: 'left',
                fontWeight: '600'
              }}>Name</th>
              {streamSubjects.map(sub => (
                <th 
                  key={sub.name} 
                  colSpan={selectedAssessmentIds.length}
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 15,
                    border: '1px solid #ddd',
                    padding: '0.3rem 0.2rem',
                    textAlign: 'center',
                    background: '#f5f5f5',
                    fontSize: '0.8rem',
                    fontWeight: '600'
                  }}
                >
                  {shortenSubject(sub.name)}
                </th>
              ))}
            </tr>
            <tr>
              <th style={{ 
                position: 'sticky',
                top: '38px',
                left: 0, 
                zIndex: 20, 
                background: '#f5f5f5',
                border: '1px solid #ddd',
                padding: '0.2rem'
              }}></th>
              <th style={{ 
                position: 'sticky',
                top: '38px',
                left: '30px', 
                zIndex: 20, 
                background: '#f5f5f5',
                border: '1px solid #ddd',
                padding: '0.2rem'
              }}></th>
              <th style={{ 
                position: 'sticky',
                top: '38px',
                left: '90px', 
                zIndex: 20, 
                background: '#f5f5f5',
                border: '1px solid #ddd',
                padding: '0.2rem'
              }}></th>
              {selectedAssessments.map(asm => (
                <th 
                  key={asm.id} 
                  style={{
                    position: 'sticky',
                    top: '38px',
                    zIndex: 15,
                    border: '1px solid #ddd',
                    padding: '0.2rem',
                    textAlign: 'center',
                    background: '#f5f5f5',
                    fontSize: '0.7rem',
                    minWidth: '70px',
                    fontWeight: '500'
                  }}
                >
                  {shortenSubject(asm.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentStream.students.map((student, idx) => (
              <tr key={student.id}>
                <td style={{ 
                  position: 'sticky', 
                  left: 0, 
                  zIndex: 3,
                  background: 'white',
                  border: '1px solid #ddd',
                  padding: '0.3rem',
                  textAlign: 'center'
                }}>
                  {idx + 1}
                </td>
                <td style={{ 
                  position: 'sticky', 
                  left: '30px', 
                  zIndex: 3,
                  background: 'white',
                  border: '1px solid #ddd',
                  padding: '0.3rem',
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem'
                }}>
                  {student.studentID}
                </td>
                <td style={{ 
                  position: 'sticky', 
                  left: '90px', 
                  zIndex: 3,
                  background: 'white',
                  border: '1px solid #ddd',
                  padding: '0.3rem',
                  textAlign: 'left',
                  fontSize: '0.8rem'
                }}>
                  {student.firstName} {student.secondName}
                </td>
                {streamSubjects.map(sub => (
                  <React.Fragment key={sub.name}>
                    {selectedAssessments.map(asm => {
                      const takesSubject = studentTakesSubject(student, sub.name);
                      
                      if (!takesSubject) {
                        return (
                          <td 
                            key={`${asm.id}-${sub.name}-${student.id}`} 
                            style={{
                              border: '1px solid #ddd',
                              padding: '0.15rem',
                              textAlign: 'center',
                              background: '#f9f9f9',
                              color: '#ccc'
                            }}
                          >
                            —
                          </td>
                        );
                      }
                      
                      const score = getScore(asm.id, sub.name, student.id);
                      
                      return (
                        <td 
                          key={`${asm.id}-${sub.name}-${student.id}`} 
                          style={{
                            border: '1px solid #ddd',
                            padding: '0.15rem',
                            textAlign: 'center'
                          }}
                        >
                          <input
                            type="number"
                            min="0"
                            max={asm.maxScore || undefined}
                            value={score !== null ? score : ''}
                            onChange={(e) => handleScoreChange(asm.id, sub.name, student.id, e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                            placeholder="-"
                            style={{
                              width: '60px',
                              padding: '0.3rem 0.1rem',
                              border: '1px solid #ddd',
                              borderRadius: '2px',
                              textAlign: 'center',
                              fontSize: '0.85rem',
                              background: 'white',
                              outline: 'none'
                            }}
                            disabled={!isAdmin}
                          />
                        </td>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tr>
            ))}

            {/* Summary Rows */}
            <tr style={{ background: '#f5f5f5', fontWeight: 'bold' }}>
              <td colSpan={3} style={{ border: '1px solid #ddd', padding: '0.3rem', textAlign: 'right', background: '#f5f5f5' }}>Avg</td>
              {streamSubjects.map(sub => (
                selectedAssessments.map(asm => {
                  const students = currentStream.students.filter(s => studentTakesSubject(s, sub.name));
                  const scores = students.map(s => getScore(asm.id, sub.name, s.id)).filter((v): v is number => typeof v === 'number');
                  const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
                  return (
                    <td key={`avg-${asm.id}-${sub.name}`} style={{ border: '1px solid #ddd', padding: '0.3rem', textAlign: 'center', background: '#f5f5f5' }}>
                      {avg}
                    </td>
                  );
                })
              ))}
            </tr>

            <tr style={{ background: '#fafafa', fontWeight: 'bold' }}>
              <td colSpan={3} style={{ border: '1px solid #ddd', padding: '0.3rem', textAlign: 'right', background: '#fafafa' }}>Max</td>
              {streamSubjects.map(sub => (
                selectedAssessments.map(asm => {
                  const students = currentStream.students.filter(s => studentTakesSubject(s, sub.name));
                  const scores = students.map(s => getScore(asm.id, sub.name, s.id)).filter((v): v is number => typeof v === 'number');
                  const max = scores.length > 0 ? Math.max(...scores) : '—';
                  return (
                    <td key={`max-${asm.id}-${sub.name}`} style={{ border: '1px solid #ddd', padding: '0.3rem', textAlign: 'center', background: '#fafafa' }}>
                      {max}
                    </td>
                  );
                })
              ))}
            </tr>

            <tr style={{ background: '#f5f5f5', fontWeight: 'bold' }}>
              <td colSpan={3} style={{ border: '1px solid #ddd', padding: '0.3rem', textAlign: 'right', background: '#f5f5f5' }}>Min</td>
              {streamSubjects.map(sub => (
                selectedAssessments.map(asm => {
                  const students = currentStream.students.filter(s => studentTakesSubject(s, sub.name));
                  const scores = students.map(s => getScore(asm.id, sub.name, s.id)).filter((v): v is number => typeof v === 'number');
                  const min = scores.length > 0 ? Math.min(...scores) : '—';
                  return (
                    <td key={`min-${asm.id}-${sub.name}`} style={{ border: '1px solid #ddd', padding: '0.3rem', textAlign: 'center', background: '#f5f5f5' }}>
                      {min}
                    </td>
                  );
                })
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  }, [
    selectedAssessmentIds,
    streamSubjects,
    currentStream,
    studentTakesSubject,
    getScore,
    handleScoreChange,
    handleKeyDown,
    handleInputFocus,
    handleInputBlur,
    isAdmin,
    selectedAssessments
  ]);

  const canExport = selectedAssessmentIds.length > 0 && streamSubjects.length > 0 && currentStream;
  const hasAssessments = assessments.length > 0;

  return (
    <ProtectedRoute requireAdmin>
      <style>{`
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
      <div style={{ padding: '1rem', maxWidth: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Link 
            href="/class-management" 
            style={{ display: 'inline-block', marginBottom: '0.5rem', color: '#666', textDecoration: 'none' }}
          >
            ← Back to Class Management
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem' }}>Consolidated Marksheet</h1>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                {currentYear?.name || 'No year'} • {currentTerm?.name || 'No term'}
                {currentClass && ` • ${currentClass.name}`}
              </p>
            </div>
            
            {canExport && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Export:</span>
                <button
                  onClick={() => {
                    // Simple CSV export
                    try {
                      const headers = ['#', 'ID', 'Name'];
                      const subjectHeaders = streamSubjects.flatMap(sub => 
                        selectedAssessments.map(asm => `${shortenSubject(sub.name)} (${shortenSubject(asm.name)})`)
                      );
                      const allHeaders = [...headers, ...subjectHeaders];
                      
                      const rows = currentStream?.students.map((student, idx) => {
                        const row = [idx + 1, student.studentID, `${student.firstName} ${student.secondName}`];
                        streamSubjects.forEach(sub => {
                          selectedAssessments.forEach(asm => {
                            const takesSubject = studentTakesSubject(student, sub.name);
                            if (!takesSubject) {
                              row.push('');
                            } else {
                              const score = getScore(asm.id, sub.name, student.id);
                              row.push(score !== null ? score : '');
                            }
                          });
                        });
                        return row;
                      }) || [];

                      // Add summary rows
                      const avgRow = ['', '', 'Avg'];
                      streamSubjects.forEach(sub => {
                        selectedAssessments.forEach(asm => {
                          const students = currentStream?.students.filter(s => studentTakesSubject(s, sub.name)) || [];
                          const scores = students.map(s => getScore(asm.id, sub.name, s.id)).filter((v): v is number => typeof v === 'number');
                          const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '';
                          avgRow.push(avg);
                        });
                      });

                      const maxRow = ['', '', 'Max'];
                      streamSubjects.forEach(sub => {
                        selectedAssessments.forEach(asm => {
                          const students = currentStream?.students.filter(s => studentTakesSubject(s, sub.name)) || [];
                          const scores = students.map(s => getScore(asm.id, sub.name, s.id)).filter((v): v is number => typeof v === 'number');
                          const max = scores.length > 0 ? Math.max(...scores) : '';
                          maxRow.push(max !== '' ? String(max) : '');
                        });
                      });

                      const minRow = ['', '', 'Min'];
                      streamSubjects.forEach(sub => {
                        selectedAssessments.forEach(asm => {
                          const students = currentStream?.students.filter(s => studentTakesSubject(s, sub.name)) || [];
                          const scores = students.map(s => getScore(asm.id, sub.name, s.id)).filter((v): v is number => typeof v === 'number');
                          const min = scores.length > 0 ? Math.min(...scores) : '';
                          minRow.push(min !== '' ? String(min) : '');
                        });
                      });

                      const allRows = [
                        [`${currentClass?.name} - Stream ${selectedStreamName}`],
                        [`Academic Year: ${currentYear?.name || 'N/A'} | Term: ${currentTerm?.name || 'N/A'}`],
                        [`Generated: ${new Date().toLocaleString()}`],
                        [],
                        allHeaders,
                        ...rows,
                        [],
                        avgRow,
                        maxRow,
                        minRow
                      ];

                      const csv = allRows.map(row => 
                        row.map(cell => {
                          const value = cell === null || cell === undefined ? '' : String(cell);
                          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
                        }).join(',')
                      ).join('\r\n');

                      const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `${currentClass?.name}_${selectedStreamName}_${currentYear?.name || ''}_${currentTerm?.name || ''}_marksheet.csv`;
                      link.click();
                      URL.revokeObjectURL(url);
                    } catch (error) {
                      console.error('Export failed:', error);
                      alert('Failed to export. Please try again.');
                    }
                  }}
                  style={{
                    padding: '0.4rem 1.2rem',
                    border: '1px solid #28a745',
                    borderRadius: '4px',
                    background: '#28a745',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#218838'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#28a745'}
                >
                  📥 Download CSV
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Academic Year & Term Selector */}
        <div style={{ marginBottom: '1rem' }}>
          <AcademicYearSelector compact />
        </div>

        {/* Controls */}
        <div style={{ 
          marginBottom: '1rem', 
          padding: '1rem', 
          border: '1px solid #ddd',
          borderRadius: '4px',
          background: '#fafafa'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
            gap: '0.75rem',
            marginBottom: '0.75rem'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Level</label>
              <select 
                value={level} 
                onChange={(e) => {
                  setLevel(e.target.value as "O" | "A");
                  setSelectedClassIndex(0);
                }}
                style={{ width: '100%', padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px', background: 'white' }}
              >
                <option value="O">O'Level</option>
                <option value="A">A'Level</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Class</label>
              <select 
                value={selectedClassIndex} 
                onChange={(e) => setSelectedClassIndex(Number(e.target.value))}
                style={{ width: '100%', padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px', background: 'white' }}
              >
                {classesForLevel.map((c, i) => (
                  <option key={c.name} value={i}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Stream</label>
              <select 
                value={selectedStreamName} 
                onChange={(e) => setSelectedStreamName(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px', background: 'white' }}
              >
                {(currentClass?.streams || []).map(s => (
                  <option key={s.name} value={s.name}>Stream {s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assessment Selection */}
          <div style={{ borderTop: '1px solid #ddd', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', marginRight: '0.5rem' }}>
                Assessments ({selectedAssessmentIds.length}/{assessments.length}):
              </span>
              {!hasAssessments ? (
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  No assessments for {currentYear?.name || 'current year'} • {currentTerm?.name || 'current term'}
                </span>
              ) : (
                <>
                  {assessments.map(asm => (
                    <button
                      key={asm.id}
                      onClick={() => toggleAssessment(asm.id)}
                      style={{
                        padding: '0.25rem 0.6rem',
                        border: selectedAssessmentIds.includes(asm.id) ? '2px solid #000' : '1px solid #ddd',
                        borderRadius: '4px',
                        background: selectedAssessmentIds.includes(asm.id) ? '#e5e5e5' : 'white',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        transition: 'all 0.15s'
                      }}
                    >
                      {shortenSubject(asm.name)}
                    </button>
                  ))}
                  <button
                    onClick={selectAllAssessments}
                    style={{ padding: '0.25rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    All
                  </button>
                  <button
                    onClick={clearAllAssessments}
                    style={{ padding: '0.25rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Progress and Save */}
          {progress && selectedAssessmentIds.length > 0 && (
            <div style={{ 
              borderTop: '1px solid #ddd', 
              paddingTop: '0.75rem',
              marginTop: '0.75rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '0.85rem' }}>
                Progress: {progress.filled}/{progress.total} ({progress.percentage}%)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: hasUnsavedChanges ? '#d97706' : '#059669' }}>
                  {hasUnsavedChanges ? '⚠ Unsaved' : '✓ Saved'}
                </span>
                <button
                  onClick={saveChanges}
                  disabled={!hasUnsavedChanges || isSaving}
                  style={{
                    padding: '0.3rem 1rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    background: hasUnsavedChanges && !isSaving ? '#000' : '#e5e5e5',
                    color: hasUnsavedChanges && !isSaving ? 'white' : '#999',
                    cursor: hasUnsavedChanges && !isSaving ? 'pointer' : 'default',
                    fontSize: '0.85rem'
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Table Content */}
        {tableContent}
      </div>
    </ProtectedRoute>
  );
}