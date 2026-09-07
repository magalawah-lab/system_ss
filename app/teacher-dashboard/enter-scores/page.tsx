"use client";

import React, { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/SupabaseAuthContext";
import { useSchoolData, Student, Assessment, toSubjectName } from "../../context/SchoolDataContext";
import AcademicYearSelector from "../../components/AcademicYearSelector";

function EnterScoresContent() {
  const { currentUser, isAuthenticated, isTeacher } = useAuth();
  const { 
    classes,
    teachers,
    setSubjectScoreForAssessment, 
    setPaperScoreForAssessment, 
    catalog, 
    hasUnsavedChanges, 
    saveChanges, 
    isSaving,
    academicYears,
    currentAcademicYearId,
    currentTermId,
    isHydrated
  } = useSchoolData();
  const router = useRouter();
  const searchParams = useSearchParams();

  const classIndex = searchParams?.get("classIndex") ? parseInt(searchParams.get("classIndex")!) : null;
  const streamName = searchParams?.get("streamName") ?? null;
  const assessmentIdsStr = searchParams?.get("assessmentIds") ?? searchParams?.get("assessmentId") ?? null;
  const assessmentIds = useMemo(() => assessmentIdsStr ? assessmentIdsStr.split(",") : [], [assessmentIdsStr]);

  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedPaper, setSelectedPaper] = useState<string>("");
  const [scoreErrors, setScoreErrors] = useState<Record<string, string>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  const currentTeacher = currentUser?.role === "teacher" ? currentUser : null;

  // Subject assignments reference the school teacher record, while the
  // authenticated user has a Supabase ID. Resolve both IDs by email.
  const teacherIds = useMemo(() => {
    if (!currentTeacher) return new Set<string>();

    const ids = new Set([currentTeacher.id]);
    const email = currentTeacher.email.trim().toLowerCase();
    teachers.forEach((teacher) => {
      if (teacher.id === currentTeacher.id || teacher.email?.trim().toLowerCase() === email) {
        ids.add(teacher.id);
      }
    });
    return ids;
  }, [currentTeacher, teachers]);

  // Get current year and term
  const currentYear = useMemo(() => {
    if (!academicYears || !Array.isArray(academicYears)) return null;
    return academicYears.find((y: any) => y.id === currentAcademicYearId);
  }, [academicYears, currentAcademicYearId]);

  const currentTerm = useMemo(() => {
    if (!currentYear || !currentYear.terms || !Array.isArray(currentYear.terms)) return null;
    return currentYear.terms.find((t: any) => t.id === currentTermId);
  }, [currentYear, currentTermId]);

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 640);
      setIsTablet(width >= 640 && width < 1024);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Redirect to login if not authenticated or not a teacher
  useEffect(() => {
    if (!isAuthenticated || !isTeacher) {
      router.push("/login");
    }
  }, [isAuthenticated, isTeacher, router]);

  // Validate parameters - filter assessments by current year/term
  const { currentClass, currentStream, assessments, teacherSubjects, subjectPapers } = useMemo(() => {
    if (classIndex === null || streamName === null || !currentTeacher) {
      return { currentClass: null, currentStream: null, assessments: [], teacherSubjects: [], subjectPapers: [] };
    }

    const cls = classes[classIndex];
    if (!cls) {
      return { currentClass: null, currentStream: null, assessments: [], teacherSubjects: [], subjectPapers: [] };
    }

    const stream = cls.streams.find((s) => s.name === streamName);
    if (!stream) {
      return { currentClass: cls, currentStream: null, assessments: [], teacherSubjects: [], subjectPapers: [] };
    }

    // Get subjects assigned to this teacher in this stream
    const subjects = stream.subjects
      .map((sub) => {
        const name = typeof sub === "string" ? sub : sub.name;
        const tid = typeof sub === "string" ? undefined : sub.teacherId;
        return { name, teacherId: tid };
      })
      .filter((sub) => Boolean(sub.teacherId && teacherIds.has(sub.teacherId)))
      .map((sub) => sub.name);

    // Get the assessments - filter by current year and term
    let matchedAssessments = assessmentIds.length > 0 
      ? (cls.assessments ?? []).filter((a) =>
          assessmentIds.includes(a.id) &&
          a.academicYearId === currentAcademicYearId &&
          a.termId === currentTermId
        )
      : [];

    // If no specific assessments requested, get all from current year/term
    if (matchedAssessments.length === 0 && currentAcademicYearId && currentTermId) {
      matchedAssessments = (cls.assessments ?? []).filter((a) => 
        a.academicYearId === currentAcademicYearId && 
        a.termId === currentTermId
      );
    }

    return {
      currentClass: cls,
      currentStream: stream,
      assessments: matchedAssessments,
      teacherSubjects: subjects,
      subjectPapers: (stream.subjects.find(s => toSubjectName(s) === selectedSubject) as any)?.papers || [],
    };
  }, [classIndex, streamName, assessmentIds, classes, teacherIds, selectedSubject, currentAcademicYearId, currentTermId]);

  // Set default selected subject and paper if not set
  useEffect(() => {
    if (teacherSubjects.length > 0 && !selectedSubject) {
      setSelectedSubject(teacherSubjects[0]);
    }
  }, [teacherSubjects, selectedSubject]);

  useEffect(() => {
    if (subjectPapers.length > 0 && !selectedPaper) {
      setSelectedPaper(subjectPapers[0]);
    } else if (subjectPapers.length === 0) {
      setSelectedPaper("");
    }
  }, [subjectPapers, selectedPaper]);

  const handleSetScore = useCallback((assessment: Assessment, subjectName: string, studentId: string, value: string) => {
    if (!assessment || classIndex === null) return;

    const parsed = value === "" ? null : Number(value);
    const max = assessment.maxScore;

    const errorKey = selectedPaper 
      ? `${assessment.id}:${subjectName}:${selectedPaper}:${studentId}`
      : `${assessment.id}:${subjectName}:${studentId}`;

    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0 || (typeof max === "number" && parsed > max))) {
      setScoreErrors((prev) => ({
        ...prev,
        [errorKey]: `Invalid score${typeof max === "number" ? ` (0-${max})` : ""}`,
      }));
      return;
    }

    setScoreErrors((prev) => {
      const next = { ...prev };
      delete next[errorKey];
      return next;
    });

    if (selectedPaper) {
      setPaperScoreForAssessment(classIndex, assessment.id, subjectName, selectedPaper, studentId, parsed);
    } else {
      setSubjectScoreForAssessment(classIndex, assessment.id, subjectName, studentId, parsed);
    }
  }, [classIndex, selectedPaper, setPaperScoreForAssessment, setSubjectScoreForAssessment]);

  if (!isAuthenticated || !isTeacher || !currentTeacher) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p>Redirecting to login...</p>
      </div>
    );
  }

  if (!isHydrated || !currentAcademicYearId || !currentTermId) {
    return (
      <div className="empty-entry-page">
        <div className="empty-entry-card">
          <p>Loading your classes and assessments...</p>
        </div>
      </div>
    );
  }

  if (!currentClass || !currentStream || assessments.length === 0) {
    return (
      <div className="empty-entry-page">
        <div className="empty-entry-card">
          <AcademicYearSelector compact />
          <h2>No Assessments Available</h2>
          <p style={{ color: '#6b7280' }}>
            {currentAcademicYearId && currentTermId 
              ? `No assessments found for ${currentYear?.name || 'current year'} • ${currentTerm?.name || 'current term'}.`
              : 'Please select an academic year and term first.'}
          </p>
          <Link href="/teacher-dashboard" className="empty-entry-back-link">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (teacherSubjects.length === 0) {
    return (
      <div style={{ padding: "2rem", maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '2rem' }}>
          <h2>No Subjects Assigned</h2>
          <p style={{ color: '#6b7280' }}>You don't have any subjects assigned for this class/stream.</p>
          <Link href="/teacher-dashboard" style={{ display: 'inline-block', marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#000', color: 'white', borderRadius: '6px', textDecoration: 'none' }}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Filter students based on class level:
  // - A-Level: only students whose assigned subjects include the selected subject.
  // - O-Level: optional subjects must be selected by the student; compulsory show all.
  const isALevel = currentClass?.level === 'A';
  const isOptionalSubject = catalog?.[selectedSubject] === "optional";
  const filteredStudents = (currentStream.students ?? []).filter((student: Student) => {
    if (isALevel) {
      return (student.subjects ?? []).includes(selectedSubject);
    }
    if (isOptionalSubject) {
      return student.optionalSubjects.includes(selectedSubject);
    }
    return true;
  });

  // Determine which columns to show based on screen size
  const showIdColumn = !isMobile;
  const showNameColumn = true;

  // Check if any assessments have year/term assigned
  const hasYearTerm = assessments.some(a => a.academicYearId && a.termId);

  return (
    <div style={{ padding: isMobile ? '0.75rem' : '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? '1rem' : '1.5rem' }}>
        <Link 
          href="/teacher-dashboard" 
          style={{ 
            display: 'inline-block', 
            marginBottom: isMobile ? '0.75rem' : '1rem', 
            color: '#666', 
            textDecoration: 'none',
            fontSize: isMobile ? '0.85rem' : '1rem'
          }}
        >
          ← Back to Dashboard
        </Link>
        <h1 style={{ fontSize: isMobile ? '1.25rem' : '2rem', margin: '0 0 0.25rem 0' }}>Enter Scores</h1>
        <p style={{ color: '#6b7280', margin: 0, fontSize: isMobile ? '0.8rem' : '1rem' }}>
          {currentClass.name} - {currentStream.name} | {assessments.length > 1 ? `${assessments.length} Assessments` : `Assessment: ${assessments[0].name}`}
          {currentYear && currentTerm && (
            <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>
              • {currentYear.name} • {currentTerm.name}
            </span>
          )}
        </p>
      </div>

      {/* Academic Year & Term Selector */}
      <div style={{ marginBottom: '1rem' }}>
        <AcademicYearSelector compact />
      </div>

      {/* Current Year/Term Banner */}
      {currentYear && currentTerm && (
        <div style={{
          padding: '0.5rem 0.75rem',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(37, 99, 235, 0.02))',
          border: '1px solid rgba(37, 99, 235, 0.15)',
          borderRadius: '6px',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          fontSize: isMobile ? '0.8rem' : '0.9rem'
        }}>
          <span style={{ fontWeight: '600', color: '#1d4ed8' }}>
            📅 Currently Viewing:
          </span>
          <span style={{ fontWeight: '500' }}>
            {currentYear.name} • {currentTerm.name}
          </span>
          <span style={{
            padding: '0.15rem 0.5rem',
            borderRadius: '12px',
            fontSize: '0.7rem',
            background: currentTerm.isActive ? '#dbeafe' : '#f3f4f6',
            color: currentTerm.isActive ? '#1d4ed8' : '#6b7280'
          }}>
            {currentTerm.isActive ? 'Active Term' : 'Inactive'}
          </span>
          <span style={{
            padding: '0.15rem 0.5rem',
            borderRadius: '12px',
            fontSize: '0.7rem',
            background: '#dcfce7',
            color: '#166534'
          }}>
            {assessments.length} Assessments
          </span>
          {!hasYearTerm && assessments.length > 0 && (
            <span style={{
              padding: '0.15rem 0.5rem',
              borderRadius: '12px',
              fontSize: '0.7rem',
              background: '#fef3c7',
              color: '#92400e'
            }}>
              ⚠️ Some assessments may be unassigned to a year/term
            </span>
          )}
        </div>
      )}

      {/* Main Panel */}
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: isMobile ? '0.75rem' : '1.5rem',
        background: 'white'
      }}>
        {/* Controls */}
        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '0.75rem' : '1.5rem', 
          marginBottom: isMobile ? '1rem' : '1.5rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: isMobile ? '1' : '0 1 auto', minWidth: isMobile ? '100%' : '200px' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold', fontSize: isMobile ? '0.8rem' : '1rem' }}>
              Subject:
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              style={{ 
                width: '100%', 
                padding: isMobile ? '0.4rem 0.5rem' : '0.5rem', 
                borderRadius: '6px', 
                border: '1px solid #d1d5db',
                fontSize: isMobile ? '0.85rem' : '1rem',
                background: 'white',
                minHeight: isMobile ? '44px' : 'auto'
              }}
            >
              {teacherSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          {subjectPapers.length > 0 && (
            <div style={{ flex: isMobile ? '1' : '0 1 auto', minWidth: isMobile ? '100%' : '120px' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold', fontSize: isMobile ? '0.8rem' : '1rem' }}>
                Paper:
              </label>
              <select
                value={selectedPaper}
                onChange={(e) => setSelectedPaper(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: isMobile ? '0.4rem 0.5rem' : '0.5rem', 
                  borderRadius: '6px', 
                  border: '1px solid #d1d5db',
                  fontSize: isMobile ? '0.85rem' : '1rem',
                  background: 'white',
                  minHeight: isMobile ? '44px' : 'auto'
                }}
              >
                {subjectPapers.map((paper: string) => (
                  <option key={paper} value={paper}>
                    {paper}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedSubject && (
          <div>
            {/* Subject Info */}
            <div style={{ 
              display: 'flex', 
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? '0.25rem' : '2rem', 
              alignItems: isMobile ? 'flex-start' : 'center', 
              marginBottom: isMobile ? '1rem' : '1.5rem', 
              padding: isMobile ? '0.75rem' : '1rem', 
              background: '#f9fafb', 
              borderRadius: '8px',
              fontSize: isMobile ? '0.8rem' : '1rem'
            }}>
              <div>
                <strong>Subject:</strong> {selectedSubject}
                {selectedPaper && <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>({selectedPaper})</span>}
              </div>
              <div>
                <strong>Students:</strong> {filteredStudents.length}
              </div>
              {currentYear && currentTerm && (
                <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                  <strong>Year/Term:</strong> {currentYear.name} • {currentTerm.name}
                </div>
              )}
            </div>

            {/* Table */}
            <div style={{ 
              overflowX: 'auto', 
              border: '1px solid #ddd', 
              borderRadius: '8px',
              WebkitOverflowScrolling: 'touch'
            }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: isMobile ? '0.75rem' : '0.9rem',
                minWidth: isMobile ? '350px' : 'auto'
              }}>
                <thead>
                  <tr style={{ background: '#374151', color: 'white' }}>
                    <th style={{ 
                      padding: isMobile ? '6px 4px' : '12px', 
                      textAlign: 'center', 
                      borderRight: '1px solid #4b5563',
                      fontSize: isMobile ? '0.65rem' : '0.85rem',
                      position: 'sticky',
                      left: 0,
                      background: '#374151',
                      zIndex: 2,
                      minWidth: isMobile ? '24px' : '30px'
                    }}>#</th>
                    
                    {showIdColumn && (
                      <th style={{ 
                        padding: isMobile ? '6px 4px' : '12px', 
                        textAlign: 'left', 
                        borderRight: '1px solid #4b5563',
                        fontSize: isMobile ? '0.65rem' : '0.85rem',
                        position: 'sticky',
                        left: isMobile ? '24px' : '30px',
                        background: '#374151',
                        zIndex: 2,
                        minWidth: isMobile ? '50px' : '80px'
                      }}>ID</th>
                    )}
                    
                    <th style={{ 
                      padding: isMobile ? '6px 4px' : '12px', 
                      textAlign: 'left', 
                      borderRight: '2px solid #4b5563',
                      fontSize: isMobile ? '0.65rem' : '0.85rem',
                      position: 'sticky',
                      left: showIdColumn ? (isMobile ? '74px' : '110px') : (isMobile ? '24px' : '30px'),
                      background: '#374151',
                      zIndex: 2,
                      width: isMobile ? '70px' : '120px',
                      minWidth: isMobile ? '70px' : '120px',
                      maxWidth: isMobile ? '80px' : '150px'
                    }}>
                      <div style={{ 
                        whiteSpace: isMobile ? 'normal' : 'nowrap',
                        wordBreak: 'break-word',
                        lineHeight: isMobile ? '1.2' : '1.4'
                      }}>
                        Name
                      </div>
                    </th>
                    
                    {assessments.map((assessment, idx) => {
                      const yearName = academicYears?.find((y: any) => y.id === assessment.academicYearId)?.name || '';
                      const termName = yearName ? academicYears?.find((y: any) => y.id === assessment.academicYearId)?.terms?.find((t: any) => t.id === assessment.termId)?.name || '' : '';
                      const hasYearTermInfo = assessment.academicYearId && assessment.termId;
                      
                      return (
                        <th key={assessment.id} style={{ 
                          padding: isMobile ? '6px 4px' : '12px', 
                          textAlign: 'center', 
                          borderRight: idx === assessments.length - 1 ? 'none' : '2px solid #4b5563',
                          minWidth: isMobile ? '65px' : '120px',
                          fontSize: isMobile ? '0.6rem' : '0.85rem'
                        }}>
                          <div style={{ 
                            fontWeight: '700',
                            whiteSpace: isMobile ? 'normal' : 'nowrap',
                            wordBreak: 'break-word',
                            lineHeight: isMobile ? '1.2' : '1.4'
                          }}>
                            {isMobile ? assessment.name.substring(0, 8) : assessment.name}
                          </div>
                          <div style={{ 
                            fontSize: isMobile ? '7px' : '11px', 
                            opacity: 0.9, 
                            fontWeight: 'normal' 
                          }}>
                            Max: {assessment.maxScore ?? "—"}
                            {hasYearTermInfo && (
                              <span style={{ display: 'block', fontSize: '6px', opacity: 0.7 }}>
                                {yearName} • {termName}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student: Student, i: number) => (
                    <tr key={student.id} style={{ 
                      borderBottom: '1px solid #ddd', 
                      background: i % 2 === 0 ? '#ffffff' : '#f9fafb' 
                    }}>
                      <td style={{ 
                        padding: isMobile ? '4px 2px' : '12px', 
                        borderRight: '1px solid #ddd',
                        textAlign: 'center',
                        position: 'sticky',
                        left: 0,
                        background: i % 2 === 0 ? '#ffffff' : '#f9fafb',
                        zIndex: 1,
                        fontSize: isMobile ? '0.65rem' : '0.9rem'
                      }}>{i + 1}</td>
                      
                      {showIdColumn && (
                        <td style={{ 
                          padding: isMobile ? '4px 2px' : '12px', 
                          borderRight: '1px solid #ddd',
                          fontFamily: 'monospace',
                          position: 'sticky',
                          left: isMobile ? '24px' : '30px',
                          background: i % 2 === 0 ? '#ffffff' : '#f9fafb',
                          zIndex: 1,
                          fontSize: isMobile ? '0.6rem' : '0.85rem',
                          textAlign: 'center'
                        }}>
                          {isMobile ? student.studentID.substring(0, 6) : student.studentID}
                        </td>
                      )}
                      
                      <td style={{ 
                        padding: isMobile ? '4px 2px' : '12px', 
                        borderRight: '2px solid #4b5563',
                        fontWeight: '500',
                        position: 'sticky',
                        left: showIdColumn ? (isMobile ? '74px' : '110px') : (isMobile ? '24px' : '30px'),
                        background: i % 2 === 0 ? '#ffffff' : '#f9fafb',
                        zIndex: 1,
                        fontSize: isMobile ? '0.7rem' : '0.9rem',
                        width: isMobile ? '70px' : '120px',
                        minWidth: isMobile ? '70px' : '120px',
                        maxWidth: isMobile ? '80px' : '150px',
                        wordBreak: 'break-word',
                        lineHeight: isMobile ? '1.2' : '1.4',
                        whiteSpace: isMobile ? 'normal' : 'nowrap'
                      }}>
                        <div>
                          {student.firstName}
                          {!isMobile && <span> {student.secondName}</span>}
                          {isMobile && student.secondName && (
                            <span style={{ display: 'block', fontSize: '0.65rem', opacity: 0.8 }}>
                              {student.secondName}
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {assessments.map((assessment, idx) => {
                        const errorKey = selectedPaper 
                          ? `${assessment.id}:${selectedSubject}:${selectedPaper}:${student.id}`
                          : `${assessment.id}:${selectedSubject}:${student.id}`;
                        
                        let currentScore: string | number = "";
                        if (selectedPaper) {
                          currentScore = assessment.paperScores?.[selectedSubject]?.[selectedPaper]?.[student.id] ?? "";
                        } else {
                          const scoresForSubject = assessment.subjectScores?.[selectedSubject] ?? {};
                          currentScore = (scoresForSubject as Record<string, number | null>)[student.id] ?? "";
                        }
                        
                        return (
                          <td key={assessment.id} style={{ 
                            padding: isMobile ? '2px 2px' : '8px 12px', 
                            textAlign: 'center',
                            borderRight: idx === assessments.length - 1 ? 'none' : '2px solid #4b5563',
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <input
                                type="number"
                                min={0}
                                max={assessment.maxScore ?? undefined}
                                value={currentScore}
                                onChange={(e) => handleSetScore(assessment, selectedSubject, student.id, e.target.value)}
                                placeholder="—"
                                style={{
                                  width: isMobile ? '44px' : '70px',
                                  padding: isMobile ? '0.3rem 0.1rem' : '0.6rem',
                                  borderRadius: '4px',
                                  border: `2px solid ${scoreErrors[errorKey] ? '#ef4444' : '#ddd'}`,
                                  textAlign: 'center',
                                  fontSize: isMobile ? '0.8rem' : '1.1rem',
                                  fontWeight: '600',
                                  backgroundColor: scoreErrors[errorKey] ? '#fef2f2' : 'white',
                                  outline: 'none',
                                  minHeight: isMobile ? '36px' : 'auto'
                                }}
                                onFocus={(e) => {
                                  if (!scoreErrors[errorKey]) {
                                    e.target.style.borderColor = '#000';
                                  }
                                }}
                                onBlur={(e) => {
                                  if (!scoreErrors[errorKey]) {
                                    e.target.style.borderColor = '#ddd';
                                  }
                                }}
                              />
                              {scoreErrors[errorKey] && (
                                <span style={{ 
                                  color: '#ef4444', 
                                  fontSize: isMobile ? '7px' : '10px', 
                                  marginTop: '2px', 
                                  fontWeight: 'bold',
                                  display: 'block',
                                  maxWidth: isMobile ? '50px' : '70px',
                                  wordWrap: 'break-word',
                                  lineHeight: '1.2'
                                }}>
                                  {scoreErrors[errorKey]}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Save Section */}
            <div style={{ 
              marginTop: isMobile ? '1rem' : '2rem', 
              padding: isMobile ? '0.75rem' : '1.5rem', 
              background: hasUnsavedChanges ? '#fff7ed' : '#f0fdf4', 
              borderRadius: '8px',
              border: `1px solid ${hasUnsavedChanges ? '#fdba74' : '#bbf7d0'}`,
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: isMobile ? '0.75rem' : '0'
            }}>
              <div>
                <h4 style={{ 
                  margin: '0 0 0.25rem 0', 
                  color: hasUnsavedChanges ? '#9a3412' : '#166534',
                  fontSize: isMobile ? '0.9rem' : '1.1rem'
                }}>
                  {hasUnsavedChanges ? "⚠️ Unsaved changes" : "✅ All saved"}
                </h4>
                <p style={{ 
                  margin: 0, 
                  fontSize: isMobile ? '0.75rem' : '0.9rem', 
                  color: '#6b7280' 
                }}>
                  {hasUnsavedChanges 
                    ? "Click to permanently save scores." 
                    : "Your scores are up to date."}
                </p>
              </div>
              <button 
                onClick={() => saveChanges()}
                disabled={!hasUnsavedChanges || isSaving}
                style={{ 
                  padding: isMobile ? '0.6rem 1rem' : '0.75rem 2rem', 
                  fontSize: isMobile ? '0.9rem' : '1.1rem',
                  background: hasUnsavedChanges && !isSaving ? '#000' : '#e5e5e5',
                  color: hasUnsavedChanges && !isSaving ? 'white' : '#999',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: hasUnsavedChanges && !isSaving ? 'pointer' : 'default',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  width: isMobile ? '100%' : 'auto',
                  minHeight: isMobile ? '44px' : 'auto'
                }}
              >
                {isSaving ? "Saving..." : "💾 Save"}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .empty-entry-page {
          padding: 1.5rem;
          max-width: 600px;
          margin: 0 auto;
        }

        .empty-entry-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.5rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: white;
        }

        .empty-entry-card h2,
        .empty-entry-card p {
          margin: 0;
        }

        .empty-entry-back-link {
          display: inline-block;
          padding: 0.6rem 1rem;
          background: #000;
          color: white;
          border-radius: 6px;
          text-decoration: none;
        }

        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
        
        /* Touch-friendly sizing on mobile */
        @media (max-width: 640px) {
          input[type="number"],
          select,
          button {
            min-height: 44px;
          }
        }

        @media (max-width: 768px) {
          .table-responsive {
            -webkit-overflow-scrolling: touch;
          }
        }
      `}</style>
    </div>
  );
}

export default function EnterScoresPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading...</p>
      </div>
    }>
      <EnterScoresContent />
    </Suspense>
  );
}
